from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.routes.auth_routes import login_required, role_required
from database.connection import query_db, get_db_transaction
from app.security import ValidationError, parse_int, require_text
from app.services.audit_service import log_audit_action

staff_bp = Blueprint('staff', __name__, url_prefix='/staff')


def _current_staff():
    return query_db("""
        SELECT s.*, u.full_name, u.email, u.phone, u.created_at AS member_since
        FROM staff s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.user_id = %s
    """, (session['user_id'],), one=True)


@staff_bp.route('/dashboard')
@login_required
@role_required(['staff'])
def dashboard():
    staff = _current_staff()
    if not staff:
        session.clear()
        flash('Staff profile not found. Please contact the administrator.', 'danger')
        return redirect(url_for('auth.login'))
    staff_id = staff['staff_id']
    view = request.args.get('view', 'upcoming')

    sql = """
        SELECT sa.*, es.slot_date, es.start_time, es.end_time, es.booked_capacity, es.max_capacity,
               e.experience_id, e.name AS experience_name, e.slug, e.duration_minutes, e.safety_instructions,
               c.name AS category_name, c.slug AS category_slug, b.booking_id, b.booking_reference, b.party_size,
               b.special_requests, b.booking_status,
               u_guest.full_name AS guest_name, u_guest.phone AS guest_phone,
               g.accessibility_notes,
               (es.slot_date = CURDATE()) AS is_today
        FROM staff_assignments sa
        JOIN experience_slots es ON sa.slot_id = es.slot_id
        JOIN experiences e ON es.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN bookings b ON sa.booking_id = b.booking_id
        LEFT JOIN guests g ON b.guest_id = g.guest_id
        LEFT JOIN users u_guest ON g.guest_id = u_guest.user_id
        WHERE sa.staff_id = %s
    """
    if view == 'history':
        sql += " AND (sa.assignment_status IN ('completed', 'reassigned') OR es.slot_date < CURDATE()) ORDER BY es.slot_date DESC, es.start_time DESC"
    else:
        view = 'upcoming'
        sql += " AND sa.assignment_status IN ('assigned', 'confirmed') AND es.slot_date >= CURDATE() ORDER BY es.slot_date ASC, es.start_time ASC"
    assignments = query_db(sql, (staff_id,))

    kpis = query_db("""
        SELECT
            SUM(sa.assignment_status IN ('assigned','confirmed') AND es.slot_date = CURDATE()) AS today_sessions,
            SUM(sa.assignment_status IN ('assigned','confirmed') AND es.slot_date >= CURDATE()) AS upcoming_sessions,
            SUM(sa.assignment_status = 'completed') AS completed_sessions,
            COALESCE(SUM(CASE WHEN sa.assignment_status IN ('assigned','confirmed') AND es.slot_date = CURDATE()
                              THEN b.party_size END), 0) AS guests_today
        FROM staff_assignments sa
        JOIN experience_slots es ON es.slot_id = sa.slot_id
        LEFT JOIN bookings b ON b.booking_id = sa.booking_id
        WHERE sa.staff_id = %s
    """, (staff_id,), one=True)

    allocated_resources = query_db("""
        SELECT ra.slot_id, r.name AS resource_name, r.resource_type, r.condition_status,
               SUM(ra.quantity_allocated) AS quantity_allocated, es.slot_date, es.start_time
        FROM resource_allocations ra
        JOIN resources r ON ra.resource_id = r.resource_id
        JOIN experience_slots es ON es.slot_id = ra.slot_id
        WHERE ra.allocation_status = 'reserved' AND es.slot_date >= CURDATE()
          AND ra.slot_id IN (SELECT slot_id FROM staff_assignments
                             WHERE staff_id = %s AND assignment_status IN ('assigned', 'confirmed'))
        GROUP BY ra.slot_id, r.resource_id, r.name, r.resource_type, r.condition_status, es.slot_date, es.start_time
        ORDER BY es.slot_date, es.start_time
    """, (staff_id,))

    maintenance = query_db("""
        SELECT m.*, r.name AS resource_name
        FROM maintenance_periods m JOIN resources r ON r.resource_id = m.resource_id
        WHERE m.status <> 'completed'
        ORDER BY m.start_datetime ASC LIMIT 8
    """)

    return render_template('staff/dashboard.html', staff=staff, assignments=assignments, kpis=kpis,
                           allocated_resources=allocated_resources, maintenance=maintenance, view=view)


@staff_bp.route('/complete-booking/<int:booking_id>', methods=['POST'])
@login_required
@role_required(['staff', 'admin'])
def complete_booking(booking_id):
    user_id = session['user_id']
    role = session.get('role_name')
    back = url_for('admin.bookings') if role == 'admin' else url_for('staff.dashboard')

    with get_db_transaction() as cursor:
        cursor.execute("""
            SELECT b.*, (TIMESTAMP(es.slot_date, es.start_time) <= NOW()) AS has_started
            FROM bookings b JOIN experience_slots es ON es.slot_id = b.slot_id
            WHERE b.booking_id = %s FOR UPDATE
        """, (booking_id,))
        b = cursor.fetchone()
        if not b:
            flash('Booking not found.', 'danger')
            return redirect(back)

        if role == 'staff':
            # Staff may only complete sessions they are assigned to lead
            cursor.execute("""
                SELECT 1 FROM staff_assignments sa JOIN staff s ON s.staff_id = sa.staff_id
                WHERE sa.booking_id = %s AND s.user_id = %s AND sa.assignment_status IN ('assigned', 'confirmed')
            """, (booking_id, user_id))
            if not cursor.fetchone():
                flash('You can only complete sessions that are assigned to you.', 'danger')
                return redirect(back)

        if b['booking_status'] != 'confirmed':
            flash(f'Cannot mark a {b["booking_status"]} booking as completed.', 'warning')
            return redirect(back)
        if not b['has_started']:
            flash('A session can only be marked as completed once it has started.', 'warning')
            return redirect(back)

        cursor.execute("UPDATE bookings SET booking_status = 'completed' WHERE booking_id = %s", (booking_id,))
        cursor.execute("UPDATE staff_assignments SET assignment_status = 'completed' WHERE booking_id = %s",
                       (booking_id,))
        log_audit_action(user_id, 'COMPLETE_BOOKING', 'bookings', booking_id,
                         {'status': 'confirmed'}, {'status': 'completed'}, cursor=cursor)

    flash(f'Booking {b["booking_reference"]} marked as completed. The guest can now submit a verified review.', 'success')
    return redirect(back)


@staff_bp.route('/profile', methods=['GET', 'POST'])
@login_required
@role_required(['staff'])
def profile():
    staff = _current_staff()
    if request.method == 'POST':
        try:
            phone = require_text(request.form.get('contact_phone'), 'Phone', 30, required=False)
            bio = require_text(request.form.get('bio'), 'Bio', 1000, required=False)
        except ValidationError as err:
            flash(str(err), 'danger')
            return redirect(url_for('staff.profile'))
        is_available = 1 if request.form.get('is_available') == '1' else 0
        with get_db_transaction() as cursor:
            cursor.execute("UPDATE staff SET contact_phone = %s, bio = %s, is_available = %s WHERE staff_id = %s",
                           (phone, bio, is_available, staff['staff_id']))
            cursor.execute("UPDATE users SET phone = %s WHERE user_id = %s", (phone, session['user_id']))
        flash('Your staff profile has been updated.', 'success')
        return redirect(url_for('staff.profile'))

    workload = query_db("SELECT * FROM v_staff_workload WHERE staff_id = %s", (staff['staff_id'],), one=True)
    return render_template('staff/profile.html', staff=staff, workload=workload)


@staff_bp.route('/report-issue', methods=['GET', 'POST'])
@login_required
@role_required(['staff'])
def report_issue():
    if request.method == 'POST':
        try:
            resource_id = parse_int(request.form.get('resource_id'), 'Resource', min_value=1)
            reason = require_text(request.form.get('reason'), 'Issue description', 1000)
            days = parse_int(request.form.get('duration_days'), 'Estimated downtime', default=2, min_value=1, max_value=30)
        except ValidationError as err:
            flash(str(err), 'danger')
            return redirect(url_for('staff.report_issue'))

        with get_db_transaction() as cursor:
            cursor.execute("SELECT resource_id, name, condition_status FROM resources WHERE resource_id = %s FOR UPDATE",
                           (resource_id,))
            res = cursor.fetchone()
            if not res:
                flash('Resource not found.', 'danger')
                return redirect(url_for('staff.report_issue'))
            cursor.execute("UPDATE resources SET condition_status = 'under_maintenance' WHERE resource_id = %s",
                           (resource_id,))
            cursor.execute("""
                INSERT INTO maintenance_periods (resource_id, start_datetime, end_datetime, reason, status)
                VALUES (%s, NOW(), DATE_ADD(NOW(), INTERVAL %s DAY), %s, 'in_progress')
            """, (resource_id, days, reason))
            log_audit_action(session['user_id'], 'REPORT_EQUIPMENT_ISSUE', 'resources', resource_id,
                             {'condition_status': res['condition_status']},
                             {'condition_status': 'under_maintenance', 'reason': reason}, cursor=cursor)

        flash(f'Issue reported - "{res["name"]}" is now under maintenance and blocked from new bookings.', 'info')
        return redirect(url_for('staff.dashboard'))

    resources = query_db("SELECT * FROM resources ORDER BY resource_type, name")
    return render_template('staff/report_issue.html', resources=resources)
