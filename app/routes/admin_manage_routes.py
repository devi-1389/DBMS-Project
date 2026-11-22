"""
Administrative CRUD for operational master data: resources & maintenance, suppliers,
staff members, user accounts and guest review moderation.
Routes are registered on the existing `admin` blueprint.
"""
import pymysql
from flask import flash, redirect, render_template, request, session, url_for
from werkzeug.security import generate_password_hash

from app.routes.admin_routes import admin_bp
from app.routes.auth_routes import login_required, role_required
from app.security import (
    ValidationError, parse_date, parse_int, require_choice, require_text, validate_email, validate_password,
)
from app.services.audit_service import log_audit_action
from database.connection import get_db_transaction, query_db

RESOURCE_TYPES = ('equipment', 'venue', 'vehicle', 'gear')
CONDITIONS = ('excellent', 'good', 'fair', 'under_maintenance')


def _admin_id():
    return session['user_id']


# ---------------------------------------------------------------------------
# Resources & maintenance
# ---------------------------------------------------------------------------
@admin_bp.route('/resources')
@login_required
@role_required(['admin'])
def resources():
    res_list = query_db("""
        SELECT r.*, s.name AS supplier_name,
               COALESCE(SUM(CASE WHEN ra.allocation_status = 'reserved' AND es.slot_date >= CURDATE()
                                 THEN ra.quantity_allocated ELSE 0 END), 0) AS upcoming_reserved,
               COUNT(DISTINCT er.experience_id) AS used_by_experiences
        FROM resources r
        LEFT JOIN suppliers s ON r.supplier_id = s.supplier_id
        LEFT JOIN resource_allocations ra ON r.resource_id = ra.resource_id
        LEFT JOIN experience_slots es ON es.slot_id = ra.slot_id
        LEFT JOIN experience_resources er ON er.resource_id = r.resource_id
        GROUP BY r.resource_id
        ORDER BY r.resource_type, r.name
    """)
    maintenance = query_db("""
        SELECT m.*, r.name AS resource_name
        FROM maintenance_periods m
        JOIN resources r ON m.resource_id = r.resource_id
        ORDER BY FIELD(m.status, 'in_progress', 'scheduled', 'completed'), m.start_datetime DESC
    """)
    suppliers = query_db("SELECT supplier_id, name FROM suppliers WHERE is_active = 1 ORDER BY name")
    return render_template('admin/resources.html', resources=res_list, maintenance=maintenance,
                           suppliers=suppliers, resource_types=RESOURCE_TYPES, conditions=CONDITIONS)


def _resource_from_form(form):
    return {
        'name': require_text(form.get('name'), 'Name', 120),
        'resource_type': require_choice(form.get('resource_type'), 'Type', RESOURCE_TYPES),
        'total_quantity': parse_int(form.get('total_quantity'), 'Quantity', min_value=0, max_value=10000),
        'condition_status': require_choice(form.get('condition_status'), 'Condition', CONDITIONS, default='excellent'),
        'supplier_id': parse_int(form.get('supplier_id'), 'Supplier', min_value=1) if form.get('supplier_id') else None,
        'is_sustainable': 1 if form.get('is_sustainable') == '1' else 0,
        'eco_notes': require_text(form.get('eco_notes'), 'Eco notes', 1000, required=False),
    }


@admin_bp.route('/resources/save', methods=['POST'])
@admin_bp.route('/resources/save/<int:resource_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def resource_save(resource_id=None):
    try:
        data = _resource_from_form(request.form)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.resources'))
    with get_db_transaction() as cursor:
        if resource_id:
            cursor.execute("SELECT * FROM resources WHERE resource_id = %s FOR UPDATE", (resource_id,))
            old = cursor.fetchone()
            if not old:
                flash('Resource not found.', 'danger')
                return redirect(url_for('admin.resources'))
            cursor.execute("""
                UPDATE resources SET name=%s, resource_type=%s, total_quantity=%s, condition_status=%s,
                       supplier_id=%s, is_sustainable=%s, eco_notes=%s
                WHERE resource_id = %s
            """, tuple(data.values()) + (resource_id,))
            log_audit_action(_admin_id(), 'UPDATE_RESOURCE', 'resources', resource_id,
                             {k: old[k] for k in data}, data, cursor=cursor)
            msg = f'Resource "{data["name"]}" updated.'
        else:
            cursor.execute("""
                INSERT INTO resources (name, resource_type, total_quantity, condition_status, supplier_id, is_sustainable, eco_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, tuple(data.values()))
            log_audit_action(_admin_id(), 'CREATE_RESOURCE', 'resources', cursor.lastrowid, None, data, cursor=cursor)
            msg = f'Resource "{data["name"]}" added to inventory.'
    flash(msg, 'success')
    return redirect(url_for('admin.resources'))


@admin_bp.route('/resources/delete/<int:resource_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def resource_delete(resource_id):
    try:
        with get_db_transaction() as cursor:
            cursor.execute("SELECT name FROM resources WHERE resource_id = %s", (resource_id,))
            res = cursor.fetchone()
            if not res:
                flash('Resource not found.', 'danger')
                return redirect(url_for('admin.resources'))
            cursor.execute("DELETE FROM resources WHERE resource_id = %s", (resource_id,))
            log_audit_action(_admin_id(), 'DELETE_RESOURCE', 'resources', resource_id, {'name': res['name']}, None,
                             cursor=cursor)
        flash(f'Resource "{res["name"]}" deleted.', 'success')
    except pymysql.err.IntegrityError:
        flash('This resource has booking allocations (fk_ra_resource ON DELETE RESTRICT) and cannot be deleted. '
              'Set its quantity to 0 or mark it under maintenance instead.', 'warning')
    return redirect(url_for('admin.resources'))


@admin_bp.route('/maintenance/save', methods=['POST'])
@login_required
@role_required(['admin'])
def maintenance_save():
    try:
        resource_id = parse_int(request.form.get('resource_id'), 'Resource', min_value=1)
        start = parse_date(request.form.get('start_date'), 'Start date', required=True)
        end = parse_date(request.form.get('end_date'), 'End date', required=True)
        reason = require_text(request.form.get('reason'), 'Reason', 1000)
        if end < start:
            raise ValidationError('End date must be on or after the start date.')
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.resources'))
    with get_db_transaction() as cursor:
        cursor.execute("""
            INSERT INTO maintenance_periods (resource_id, start_datetime, end_datetime, reason, status)
            VALUES (%s, TIMESTAMP(%s, '08:00:00'), TIMESTAMP(%s, '20:00:00'), %s, 'scheduled')
        """, (resource_id, start, end, reason))
        log_audit_action(_admin_id(), 'SCHEDULE_MAINTENANCE', 'maintenance_periods', cursor.lastrowid, None,
                         {'resource_id': resource_id, 'start': start, 'end': end}, cursor=cursor)
    flash('Maintenance window scheduled.', 'success')
    return redirect(url_for('admin.resources'))


@admin_bp.route('/maintenance/<int:maintenance_id>/status', methods=['POST'])
@login_required
@role_required(['admin'])
def maintenance_status(maintenance_id):
    new_status = request.form.get('status')
    if new_status not in ('scheduled', 'in_progress', 'completed'):
        flash('Invalid maintenance status.', 'danger')
        return redirect(url_for('admin.resources'))
    with get_db_transaction() as cursor:
        cursor.execute("SELECT * FROM maintenance_periods WHERE maintenance_id = %s FOR UPDATE", (maintenance_id,))
        m = cursor.fetchone()
        if not m:
            flash('Maintenance record not found.', 'danger')
            return redirect(url_for('admin.resources'))
        cursor.execute("UPDATE maintenance_periods SET status = %s WHERE maintenance_id = %s", (new_status, maintenance_id))
        if new_status == 'in_progress':
            cursor.execute("UPDATE resources SET condition_status = 'under_maintenance' WHERE resource_id = %s",
                           (m['resource_id'],))
        elif new_status == 'completed':
            # Return the resource to service unless another window is still in progress
            cursor.execute("""
                UPDATE resources SET condition_status = 'good'
                WHERE resource_id = %s AND condition_status = 'under_maintenance'
                  AND NOT EXISTS (SELECT 1 FROM maintenance_periods
                                   WHERE resource_id = %s AND status = 'in_progress' AND maintenance_id <> %s)
            """, (m['resource_id'], m['resource_id'], maintenance_id))
        log_audit_action(_admin_id(), 'MAINTENANCE_STATUS', 'maintenance_periods', maintenance_id,
                         {'status': m['status']}, {'status': new_status}, cursor=cursor)
    flash(f'Maintenance marked as {new_status.replace("_", " ")}.', 'info')
    return redirect(url_for('admin.resources'))


# ---------------------------------------------------------------------------
# Suppliers & staff
# ---------------------------------------------------------------------------
@admin_bp.route('/staff-suppliers')
@login_required
@role_required(['admin'])
def staff_suppliers():
    staff_list = query_db("""
        SELECT s.*, u.full_name, u.email, u.phone, u.is_active AS account_active,
               w.total_assignments, w.active_assignments, w.completed_assignments
        FROM staff s
        JOIN users u ON s.user_id = u.user_id
        JOIN v_staff_workload w ON w.staff_id = s.staff_id
        ORDER BY u.full_name
    """)
    suppliers_list = query_db("""
        SELECT s.*,
               (SELECT COUNT(*) FROM experiences e WHERE e.supplier_id = s.supplier_id) AS linked_experiences,
               (SELECT COUNT(*) FROM resources r WHERE r.supplier_id = s.supplier_id) AS linked_resources
        FROM suppliers s
        ORDER BY s.name
    """)
    return render_template('admin/staff_suppliers.html', staff=staff_list, suppliers=suppliers_list,
                           tab=request.args.get('tab', 'staff'))


@admin_bp.route('/suppliers/save', methods=['POST'])
@admin_bp.route('/suppliers/save/<int:supplier_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def supplier_save(supplier_id=None):
    form = request.form
    try:
        data = {
            'name': require_text(form.get('name'), 'Name', 150),
            'contact_person': require_text(form.get('contact_person'), 'Contact person', 100, required=False),
            'email': validate_email(form.get('email')) if form.get('email') else None,
            'phone': require_text(form.get('phone'), 'Phone', 30, required=False),
            'address': require_text(form.get('address'), 'Address', 500, required=False),
            'supplier_type': require_text(form.get('supplier_type'), 'Supplier type', 50, required=False) or 'Local Artisan / Equipment',
            'is_local': 1 if form.get('is_local') == '1' else 0,
            'products_services': require_text(form.get('products_services'), 'Products / services', 1000, required=False),
            'is_active': 1 if form.get('is_active') == '1' else 0,
        }
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.staff_suppliers', tab='suppliers'))
    with get_db_transaction() as cursor:
        if supplier_id:
            cursor.execute("""
                UPDATE suppliers SET name=%s, contact_person=%s, email=%s, phone=%s, address=%s,
                       supplier_type=%s, is_local=%s, products_services=%s, is_active=%s
                WHERE supplier_id = %s
            """, tuple(data.values()) + (supplier_id,))
            log_audit_action(_admin_id(), 'UPDATE_SUPPLIER', 'suppliers', supplier_id, None, data, cursor=cursor)
        else:
            cursor.execute("""
                INSERT INTO suppliers (name, contact_person, email, phone, address, supplier_type, is_local, products_services, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, tuple(data.values()))
            log_audit_action(_admin_id(), 'CREATE_SUPPLIER', 'suppliers', cursor.lastrowid, None, data, cursor=cursor)
    flash(f'Supplier "{data["name"]}" saved.', 'success')
    return redirect(url_for('admin.staff_suppliers', tab='suppliers'))


@admin_bp.route('/suppliers/delete/<int:supplier_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def supplier_delete(supplier_id):
    with get_db_transaction() as cursor:
        cursor.execute("SELECT name FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        sup = cursor.fetchone()
        if not sup:
            flash('Supplier not found.', 'danger')
            return redirect(url_for('admin.staff_suppliers', tab='suppliers'))
        # experiences.supplier_id and resources.supplier_id are ON DELETE SET NULL
        cursor.execute("DELETE FROM suppliers WHERE supplier_id = %s", (supplier_id,))
        log_audit_action(_admin_id(), 'DELETE_SUPPLIER', 'suppliers', supplier_id, {'name': sup['name']}, None,
                         cursor=cursor)
    flash(f'Supplier "{sup["name"]}" deleted; linked experiences/resources now have no supplier (ON DELETE SET NULL).', 'success')
    return redirect(url_for('admin.staff_suppliers', tab='suppliers'))


@admin_bp.route('/staff/create', methods=['POST'])
@login_required
@role_required(['admin'])
def staff_create():
    form = request.form
    try:
        full_name = require_text(form.get('full_name'), 'Full name', 120)
        email = validate_email(form.get('email'))
        password = validate_password(form.get('password', ''))
        specialization = require_text(form.get('specialization'), 'Specialization', 120)
        phone = require_text(form.get('contact_phone'), 'Phone', 30, required=False)
        bio = require_text(form.get('bio'), 'Bio', 1000, required=False)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.staff_suppliers'))
    try:
        with get_db_transaction() as cursor:
            cursor.execute("SELECT role_id FROM roles WHERE name = 'staff'")
            role_id = cursor.fetchone()['role_id']
            cursor.execute("""
                INSERT INTO users (role_id, full_name, email, phone, password_hash, is_active)
                VALUES (%s, %s, %s, %s, %s, 1)
            """, (role_id, full_name, email, phone, generate_password_hash(password)))
            user_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO staff (user_id, specialization, contact_phone, bio, is_available, is_active)
                VALUES (%s, %s, %s, %s, 1, 1)
            """, (user_id, specialization, phone, bio))
            log_audit_action(_admin_id(), 'CREATE_STAFF', 'staff', cursor.lastrowid, None,
                             {'name': full_name, 'email': email, 'specialization': specialization}, cursor=cursor)
    except pymysql.err.IntegrityError:
        flash('A user with this email already exists.', 'danger')
        return redirect(url_for('admin.staff_suppliers'))
    flash(f'Staff account for {full_name} created. They can now sign in with the password you set.', 'success')
    return redirect(url_for('admin.staff_suppliers'))


@admin_bp.route('/staff/<int:staff_id>/update', methods=['POST'])
@login_required
@role_required(['admin'])
def staff_update(staff_id):
    form = request.form
    try:
        full_name = require_text(form.get('full_name'), 'Full name', 120)
        specialization = require_text(form.get('specialization'), 'Specialization', 120)
        phone = require_text(form.get('contact_phone'), 'Phone', 30, required=False)
        bio = require_text(form.get('bio'), 'Bio', 1000, required=False)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.staff_suppliers'))
    is_available = 1 if form.get('is_available') == '1' else 0
    is_active = 1 if form.get('is_active') == '1' else 0
    with get_db_transaction() as cursor:
        cursor.execute("SELECT user_id FROM staff WHERE staff_id = %s", (staff_id,))
        st = cursor.fetchone()
        if not st:
            flash('Staff member not found.', 'danger')
            return redirect(url_for('admin.staff_suppliers'))
        cursor.execute("""
            UPDATE staff SET specialization=%s, contact_phone=%s, bio=%s, is_available=%s, is_active=%s
            WHERE staff_id = %s
        """, (specialization, phone, bio, is_available, is_active, staff_id))
        cursor.execute("UPDATE users SET full_name = %s, phone = %s, is_active = %s WHERE user_id = %s",
                       (full_name, phone, is_active, st['user_id']))
        log_audit_action(_admin_id(), 'UPDATE_STAFF', 'staff', staff_id, None,
                         {'name': full_name, 'available': is_available, 'active': is_active}, cursor=cursor)
    flash(f'Staff profile for {full_name} updated.', 'success')
    return redirect(url_for('admin.staff_suppliers'))


# ---------------------------------------------------------------------------
# User accounts
# ---------------------------------------------------------------------------
@admin_bp.route('/users')
@login_required
@role_required(['admin'])
def users():
    role = request.args.get('role', '')
    q = request.args.get('q', '').strip()[:100]
    sql = """
        SELECT u.user_id, u.full_name, u.email, u.phone, u.is_active, u.created_at, r.name AS role_name,
               (SELECT COUNT(*) FROM bookings b WHERE b.guest_id = u.user_id) AS bookings
        FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE 1 = 1
    """
    params = []
    if role in ('admin', 'staff', 'guest'):
        sql += " AND r.name = %s"
        params.append(role)
    if q:
        sql += " AND (u.full_name LIKE %s OR u.email LIKE %s)"
        params += [f'%{q}%', f'%{q}%']
    sql += " ORDER BY r.role_id, u.full_name"
    rows = query_db(sql, tuple(params))
    role_counts = query_db("""
        SELECT r.name, COUNT(u.user_id) AS n FROM roles r LEFT JOIN users u ON u.role_id = r.role_id GROUP BY r.role_id
    """)
    return render_template('admin/users.html', users=rows, active_role=role, q=q, role_counts=role_counts)


@admin_bp.route('/users/<int:user_id>/toggle', methods=['POST'])
@login_required
@role_required(['admin'])
def user_toggle(user_id):
    if user_id == _admin_id():
        flash('You cannot deactivate your own administrator account.', 'warning')
        return redirect(url_for('admin.users'))
    with get_db_transaction() as cursor:
        cursor.execute("SELECT full_name, is_active FROM users WHERE user_id = %s FOR UPDATE", (user_id,))
        u = cursor.fetchone()
        if not u:
            flash('User not found.', 'danger')
            return redirect(url_for('admin.users'))
        new_state = 0 if u['is_active'] else 1
        cursor.execute("UPDATE users SET is_active = %s WHERE user_id = %s", (new_state, user_id))
        log_audit_action(_admin_id(), 'TOGGLE_USER', 'users', user_id, {'is_active': u['is_active']},
                         {'is_active': new_state}, cursor=cursor)
    flash(f'{u["full_name"]} is now {"active" if new_state else "deactivated (cannot sign in)"}.', 'info')
    return redirect(request.referrer or url_for('admin.users'))


# ---------------------------------------------------------------------------
# Review moderation
# ---------------------------------------------------------------------------
@admin_bp.route('/reviews')
@login_required
@role_required(['admin'])
def reviews():
    rows = query_db("""
        SELECT r.*, u.full_name AS guest_name, e.name AS experience_name, e.slug, b.booking_reference
        FROM reviews r
        JOIN users u ON u.user_id = r.guest_id
        JOIN experiences e ON e.experience_id = r.experience_id
        JOIN bookings b ON b.booking_id = r.booking_id
        ORDER BY r.created_at DESC, r.review_id DESC
    """)
    summary = query_db("""
        SELECT COUNT(*) AS total, SUM(is_approved = 1) AS approved, ROUND(AVG(rating), 2) AS avg_rating
        FROM reviews
    """, one=True)
    return render_template('admin/reviews.html', reviews=rows, summary=summary)


@admin_bp.route('/reviews/<int:review_id>/toggle', methods=['POST'])
@login_required
@role_required(['admin'])
def review_toggle(review_id):
    with get_db_transaction() as cursor:
        cursor.execute("SELECT is_approved FROM reviews WHERE review_id = %s FOR UPDATE", (review_id,))
        r = cursor.fetchone()
        if not r:
            flash('Review not found.', 'danger')
            return redirect(url_for('admin.reviews'))
        new_state = 0 if r['is_approved'] else 1
        cursor.execute("UPDATE reviews SET is_approved = %s WHERE review_id = %s", (new_state, review_id))
        log_audit_action(_admin_id(), 'MODERATE_REVIEW', 'reviews', review_id, {'is_approved': r['is_approved']},
                         {'is_approved': new_state}, cursor=cursor)
    flash('Review published.' if new_state else 'Review hidden from the public catalogue.', 'info')
    return redirect(url_for('admin.reviews'))


@admin_bp.route('/reviews/<int:review_id>/delete', methods=['POST'])
@login_required
@role_required(['admin'])
def review_delete(review_id):
    with get_db_transaction() as cursor:
        cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
        deleted = cursor.rowcount
        if deleted:
            log_audit_action(_admin_id(), 'DELETE_REVIEW', 'reviews', review_id, None, None, cursor=cursor)
    flash('Review deleted.' if deleted else 'Review not found.', 'success' if deleted else 'warning')
    return redirect(url_for('admin.reviews'))
