import os
import re
import uuid
from datetime import date, timedelta

import pymysql
from flask import (Blueprint, current_app, flash, redirect, render_template, request, session, url_for)
from app.routes.auth_routes import login_required, role_required
from database.connection import call_procedure, get_db_transaction, query_db
from app.security import (
    ValidationError, parse_date, parse_float, parse_int, parse_time, require_choice, require_text,
)
from app.services.audit_service import log_audit_action
from app.services.availability_service import release_booking_resources

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
IMAGE_SIGNATURES = {
    'jpg': (b'\xff\xd8\xff',), 'jpeg': (b'\xff\xd8\xff',),
    'png': (b'\x89PNG\r\n\x1a\n',), 'webp': (b'RIFF',),
}
PAGE_SIZE = 50


def _page():
    try:
        return max(1, int(request.args.get('page', 1)))
    except ValueError:
        return 1


def _slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', (text or '').lower()).strip('-')[:150]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@admin_bp.route('/dashboard')
@login_required
@role_required(['admin'])
def dashboard():
    kpis = query_db("""
        SELECT
            (SELECT COUNT(*) FROM guests) AS total_guests,
            (SELECT COUNT(*) FROM experiences WHERE is_active = 1) AS active_experiences,
            (SELECT COUNT(*) FROM bookings WHERE booking_status = 'confirmed') AS confirmed_bookings,
            (SELECT COUNT(*) FROM bookings WHERE booking_status = 'completed') AS completed_bookings,
            (SELECT COUNT(*) FROM bookings WHERE booking_status IN ('pending', 'failed')) AS unpaid_bookings,
            (SELECT COALESCE(SUM(amount), 0.00) FROM payments WHERE payment_status = 'successful') AS total_revenue,
            (SELECT COALESCE(SUM(amount), 0.00) FROM payments WHERE payment_status = 'refunded') AS total_refunded,
            (SELECT ROUND(AVG(rating), 2) FROM reviews WHERE is_approved = 1) AS avg_guest_rating,
            (SELECT COUNT(*) FROM reviews) AS total_reviews,
            (SELECT COUNT(*) FROM resources WHERE condition_status = 'under_maintenance') AS maintenance_count,
            (SELECT COUNT(*) FROM experience_slots WHERE slot_date = CURDATE() AND slot_status = 'available') AS sessions_today,
            (SELECT ROUND(100 * SUM(booked_capacity) / NULLIF(SUM(max_capacity), 0), 1)
               FROM experience_slots WHERE slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)
                 AND slot_status <> 'cancelled') AS occupancy_7d,
            (SELECT COUNT(*) FROM staff WHERE is_active = 1 AND is_available = 1) AS staff_on_duty
    """, one=True)

    status_counts = query_db("SELECT booking_status, COUNT(*) AS count FROM bookings GROUP BY booking_status")

    category_analytics = query_db("""
        SELECT c.name, c.slug, COUNT(DISTINCT e.experience_id) AS exp_count,
               COUNT(b.booking_id) AS booking_count,
               COALESCE(SUM(CASE WHEN b.booking_status IN ('confirmed', 'completed') THEN b.total_amount ELSE 0 END), 0) AS revenue
        FROM experience_categories c
        LEFT JOIN experiences e ON c.category_id = e.category_id
        LEFT JOIN bookings b ON e.experience_id = b.experience_id
        GROUP BY c.category_id
        ORDER BY c.display_order ASC
    """)

    upcoming_load = query_db("""
        SELECT d.slot_date, COUNT(*) AS sessions, SUM(d.booked_capacity) AS booked, SUM(d.max_capacity) AS capacity
        FROM experience_slots d
        WHERE d.slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY) AND d.slot_status <> 'cancelled'
        GROUP BY d.slot_date ORDER BY d.slot_date
    """)

    recent_bookings = query_db("""
        SELECT * FROM v_booking_overview ORDER BY created_at DESC, booking_id DESC LIMIT 6
    """)

    top_experiences = query_db("""
        SELECT e.name, e.slug, COUNT(b.booking_id) AS bookings,
               COALESCE(SUM(b.total_amount), 0) AS revenue
        FROM experiences e
        JOIN bookings b ON b.experience_id = e.experience_id AND b.booking_status IN ('confirmed', 'completed')
        GROUP BY e.experience_id ORDER BY revenue DESC LIMIT 5
    """)

    eco_summary = query_db("""
        SELECT
            COUNT(CASE WHEN e.is_low_impact = 1 THEN 1 END) AS low_impact_count,
            COUNT(CASE WHEN s.is_local = 1 THEN 1 END) AS local_partner_exp_count,
            ROUND(AVG(e.eco_impact_score), 1) AS avg_eco_score,
            COUNT(*) AS total
        FROM experiences e
        LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
        WHERE e.is_active = 1
    """, one=True)

    alerts = query_db("""
        SELECT r.name, r.condition_status, m.reason, m.end_datetime
        FROM resources r
        LEFT JOIN maintenance_periods m ON m.resource_id = r.resource_id AND m.status <> 'completed'
        WHERE r.condition_status = 'under_maintenance' OR m.maintenance_id IS NOT NULL
        ORDER BY m.start_datetime LIMIT 5
    """)

    return render_template(
        'admin/dashboard.html', kpis=kpis, status_counts=status_counts,
        category_analytics=category_analytics, recent_bookings=recent_bookings,
        eco_summary=eco_summary, upcoming_load=upcoming_load, top_experiences=top_experiences,
        alerts=alerts,
    )


# ---------------------------------------------------------------------------
# Experiences (CRUD)
# ---------------------------------------------------------------------------
@admin_bp.route('/experiences')
@login_required
@role_required(['admin'])
def experiences():
    q = request.args.get('q', '').strip()[:100]
    category = request.args.get('category', '')
    status = request.args.get('status', '')
    sql = """
        SELECT e.*, c.name AS category_name, c.slug AS category_slug, s.name AS supplier_name,
               ROUND(AVG(r.rating), 2) AS avg_rating,
               COUNT(DISTINCT r.review_id) AS review_count,
               (SELECT COUNT(*) FROM bookings b WHERE b.experience_id = e.experience_id) AS booking_count,
               (SELECT COUNT(*) FROM experience_slots es WHERE es.experience_id = e.experience_id
                  AND es.slot_date >= CURDATE() AND es.slot_status = 'available') AS future_slots
        FROM experiences e
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
        LEFT JOIN reviews r ON e.experience_id = r.experience_id
        WHERE 1 = 1
    """
    params = []
    if q:
        sql += " AND (e.name LIKE %s OR e.slug LIKE %s)"
        params += [f'%{q}%', f'%{q}%']
    if category:
        sql += " AND c.slug = %s"
        params.append(category)
    if status in ('active', 'inactive'):
        sql += " AND e.is_active = %s"
        params.append(1 if status == 'active' else 0)
    sql += " GROUP BY e.experience_id ORDER BY c.display_order, e.name"
    exp_list = query_db(sql, tuple(params))
    categories = query_db("SELECT name, slug FROM experience_categories ORDER BY display_order")
    return render_template('admin/experiences.html', experiences=exp_list, categories=categories,
                           q=q, active_category=category, active_status=status)


def _save_uploaded_image(file_storage, slug):
    """Validate and store an uploaded experience photo; returns its public URL."""
    if not current_app.config.get('UPLOADS_ENABLED', True):
        raise ValidationError('Photo upload is not available on this hosting (files cannot be stored on the server). '
                              'Paste an image URL instead.')
    filename = file_storage.filename or ''
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in IMAGE_SIGNATURES:
        raise ValidationError('Photo must be a JPG, PNG or WEBP image.')
    head = file_storage.stream.read(16)
    file_storage.stream.seek(0)
    if not any(head.startswith(sig) for sig in IMAGE_SIGNATURES[ext]) or (ext == 'webp' and head[8:12] != b'WEBP'):
        raise ValidationError('The uploaded file is not a valid image.')
    name = f"{slug[:60]}-{uuid.uuid4().hex[:8]}.{ext}"
    folder = current_app.config['UPLOAD_FOLDER']
    try:
        os.makedirs(folder, exist_ok=True)
        file_storage.save(os.path.join(folder, name))
    except OSError:
        raise ValidationError('The photo could not be saved on this server. Paste an image URL instead.')
    return f"/static/uploads/experiences/{name}"


def _experience_from_form(form, files, existing=None):
    name = require_text(form.get('name'), 'Name', 150)
    slug = (form.get('slug') or '').strip().lower() or _slugify(name)
    if not SLUG_RE.match(slug):
        raise ValidationError('Slug may only contain lowercase letters, numbers and single hyphens.')
    data = {
        'category_id': parse_int(form.get('category_id'), 'Category', min_value=1),
        'supplier_id': parse_int(form.get('supplier_id'), 'Supplier', min_value=1) if form.get('supplier_id') else None,
        'name': name,
        'slug': slug,
        'short_desc': require_text(form.get('short_desc'), 'Short description', 255),
        'full_desc': require_text(form.get('full_desc'), 'Full description', 5000),
        'pricing_type': require_choice(form.get('pricing_type'), 'Pricing type', ('per_person', 'per_booking')),
        'base_price': parse_float(form.get('base_price'), 'Base price', min_value=0, max_value=10_000_000),
        'duration_minutes': parse_int(form.get('duration_minutes'), 'Duration', min_value=1, max_value=1440),
        'min_party_size': parse_int(form.get('min_party_size'), 'Minimum party size', default=1, min_value=1, max_value=25),
        'max_party_size': parse_int(form.get('max_party_size'), 'Maximum party size', default=10, min_value=1, max_value=25),
        'capacity_per_slot': parse_int(form.get('capacity_per_slot'), 'Capacity per slot', min_value=1, max_value=500),
        'safety_instructions': require_text(form.get('safety_instructions'), 'Safety instructions', 2000, required=False),
        'age_restrictions': require_text(form.get('age_restrictions'), 'Age restrictions', 100, required=False),
        'accessibility_info': require_text(form.get('accessibility_info'), 'Accessibility info', 2000, required=False),
        'eco_impact_score': parse_int(form.get('eco_impact_score'), 'Eco impact score', default=85, min_value=1, max_value=100),
        'is_low_impact': 1 if form.get('is_low_impact') == '1' else 0,
        'is_active': 1 if form.get('is_active') == '1' else 0,
    }
    if data['min_party_size'] > data['max_party_size']:
        raise ValidationError('Minimum party size cannot exceed maximum party size.')
    if not query_db("SELECT 1 FROM experience_categories WHERE category_id = %s", (data['category_id'],), one=True):
        raise ValidationError('Selected category does not exist.')

    upload = files.get('image_file')
    image_url = (form.get('image_url') or '').strip()
    if upload and upload.filename:
        image_url = _save_uploaded_image(upload, slug)
    elif image_url and not (image_url.startswith('/static/') or image_url.startswith('https://')):
        raise ValidationError('Image URL must start with /static/ or https://')
    data['image_url'] = (image_url or (existing or {}).get('image_url') or '')[:255] or None
    return data


def _form_lists():
    categories = query_db("SELECT * FROM experience_categories ORDER BY display_order")
    suppliers = query_db("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name")
    return categories, suppliers


@admin_bp.route('/experiences/new', methods=['GET', 'POST'])
@login_required
@role_required(['admin'])
def experience_new():
    categories, suppliers = _form_lists()
    if request.method == 'POST':
        try:
            data = _experience_from_form(request.form, request.files)
            cols = ', '.join(data.keys())
            with get_db_transaction() as cursor:
                cursor.execute(f"INSERT INTO experiences ({cols}) VALUES ({', '.join(['%s'] * len(data))})",
                               tuple(data.values()))
                new_id = cursor.lastrowid
                log_audit_action(session['user_id'], 'CREATE_EXPERIENCE', 'experiences', new_id, None,
                                 {'name': data['name'], 'price': data['base_price']}, cursor=cursor)
        except ValidationError as err:
            flash(str(err), 'danger')
            return render_template('admin/experience_form.html', experience=request.form, categories=categories,
                                   suppliers=suppliers, is_new=True), 400
        except pymysql.err.IntegrityError:
            flash('An experience with this slug already exists. Please choose another slug.', 'danger')
            return render_template('admin/experience_form.html', experience=request.form, categories=categories,
                                   suppliers=suppliers, is_new=True), 400
        flash(f'Experience "{data["name"]}" created. Generate schedule slots so guests can book it.', 'success')
        return redirect(url_for('admin.schedules', experience_id=new_id))

    return render_template('admin/experience_form.html', experience=None, categories=categories,
                           suppliers=suppliers, is_new=True)


@admin_bp.route('/experiences/edit/<int:experience_id>', methods=['GET', 'POST'])
@login_required
@role_required(['admin'])
def experience_edit(experience_id):
    exp = query_db("SELECT * FROM experiences WHERE experience_id = %s", (experience_id,), one=True)
    if not exp:
        flash('Experience not found.', 'danger')
        return redirect(url_for('admin.experiences'))
    categories, suppliers = _form_lists()

    if request.method == 'POST':
        try:
            data = _experience_from_form(request.form, request.files, existing=exp)
            assignments = ', '.join(f"{col} = %s" for col in data)
            with get_db_transaction() as cursor:
                cursor.execute(f"UPDATE experiences SET {assignments} WHERE experience_id = %s",
                               tuple(data.values()) + (experience_id,))
                log_audit_action(session['user_id'], 'UPDATE_EXPERIENCE', 'experiences', experience_id,
                                 {'name': exp['name'], 'price': exp['base_price'], 'is_active': exp['is_active']},
                                 {'name': data['name'], 'price': data['base_price'], 'is_active': data['is_active']},
                                 cursor=cursor)
        except ValidationError as err:
            flash(str(err), 'danger')
            merged = dict(exp, **request.form.to_dict())
            return render_template('admin/experience_form.html', experience=merged, categories=categories,
                                   suppliers=suppliers, is_new=False), 400
        except pymysql.err.IntegrityError:
            flash('Another experience already uses this slug.', 'danger')
            return redirect(url_for('admin.experience_edit', experience_id=experience_id))
        flash(f'Experience "{data["name"]}" updated successfully.', 'success')
        return redirect(url_for('admin.experiences'))

    return render_template('admin/experience_form.html', experience=exp, categories=categories,
                           suppliers=suppliers, is_new=False)


@admin_bp.route('/experiences/toggle-status/<int:experience_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def experience_toggle_status(experience_id):
    exp = query_db("SELECT is_active, name FROM experiences WHERE experience_id = %s", (experience_id,), one=True)
    if not exp:
        flash('Experience not found.', 'danger')
        return redirect(url_for('admin.experiences'))
    new_status = 0 if exp['is_active'] else 1
    with get_db_transaction() as cursor:
        cursor.execute("UPDATE experiences SET is_active = %s WHERE experience_id = %s", (new_status, experience_id))
        log_audit_action(session['user_id'], 'TOGGLE_EXPERIENCE_STATUS', 'experiences', experience_id,
                         {'is_active': exp['is_active']}, {'is_active': new_status}, cursor=cursor)
    flash(f'"{exp["name"]}" is now {"active" if new_status else "inactive"}.', 'info')
    return redirect(url_for('admin.experiences'))


@admin_bp.route('/experiences/delete/<int:experience_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def experience_delete(experience_id):
    exp = query_db("""
        SELECT e.name, (SELECT COUNT(*) FROM bookings b WHERE b.experience_id = e.experience_id) AS bookings
        FROM experiences e WHERE e.experience_id = %s
    """, (experience_id,), one=True)
    if not exp:
        flash('Experience not found.', 'danger')
    elif exp['bookings']:
        flash(f'"{exp["name"]}" has {exp["bookings"]} booking(s) and cannot be deleted (bookings.experience_id is '
              f'ON DELETE RESTRICT). Deactivate it instead to hide it from guests.', 'warning')
    else:
        with get_db_transaction() as cursor:
            cursor.execute("DELETE FROM experiences WHERE experience_id = %s", (experience_id,))
            log_audit_action(session['user_id'], 'DELETE_EXPERIENCE', 'experiences', experience_id,
                             {'name': exp['name']}, None, cursor=cursor)
        flash(f'Experience "{exp["name"]}" and its slots/requirements were deleted (ON DELETE CASCADE).', 'success')
    return redirect(url_for('admin.experiences'))


# ---------------------------------------------------------------------------
# Schedules & slots
# ---------------------------------------------------------------------------
@admin_bp.route('/schedules', methods=['GET', 'POST'])
@login_required
@role_required(['admin'])
def schedules():
    if request.method == 'POST':
        try:
            exp_id = parse_int(request.form.get('experience_id'), 'Experience', min_value=1)
            slot_date = parse_date(request.form.get('slot_date'), 'Date', required=True)
            start_time = parse_time(request.form.get('start_time'), 'Start time')
            end_time = parse_time(request.form.get('end_time'), 'End time')
            max_cap = parse_int(request.form.get('max_capacity'), 'Capacity', min_value=1, max_value=500)
            if slot_date < date.today():
                raise ValidationError('Slots cannot be created in the past.')
            if end_time <= start_time:
                raise ValidationError('End time must be after the start time.')
            with get_db_transaction() as cursor:
                cursor.execute("""
                    INSERT INTO experience_slots (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status)
                    VALUES (%s, %s, %s, %s, %s, 0, 'available')
                """, (exp_id, slot_date, start_time, end_time, max_cap))
                log_audit_action(session['user_id'], 'CREATE_SLOT', 'experience_slots', cursor.lastrowid, None,
                                 {'experience_id': exp_id, 'date': slot_date, 'start': start_time}, cursor=cursor)
            flash('New schedule slot created.', 'success')
        except ValidationError as err:
            flash(str(err), 'danger')
        except pymysql.err.IntegrityError:
            flash('A slot for this experience already exists at that date and start time.', 'warning')
        return redirect(url_for('admin.schedules', experience_id=request.form.get('experience_id')))

    exp_filter = request.args.get('experience_id', type=int)
    status_filter = request.args.get('status', '')
    try:
        date_from = parse_date(request.args.get('date_from'), 'From') or date.today()
        date_to = parse_date(request.args.get('date_to'), 'To') or (date_from + timedelta(days=13))
    except ValidationError:
        date_from, date_to = date.today(), date.today() + timedelta(days=13)

    where = " WHERE es.slot_date BETWEEN %s AND %s"
    params = [date_from, date_to]
    if exp_filter:
        where += " AND es.experience_id = %s"
        params.append(exp_filter)
    if status_filter in ('available', 'locked', 'cancelled', 'completed'):
        where += " AND es.slot_status = %s"
        params.append(status_filter)

    total = query_db("SELECT COUNT(*) AS n FROM experience_slots es" + where, tuple(params), one=True)['n']
    page = _page()
    slots = query_db("""
        SELECT es.*, e.name AS experience_name, e.pricing_type, c.name AS category_name,
               (es.max_capacity - es.booked_capacity) AS available_capacity,
               (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = es.slot_id) AS booking_count
        FROM experience_slots es
        JOIN experiences e ON es.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
    """ + where + " ORDER BY es.slot_date ASC, es.start_time ASC LIMIT %s OFFSET %s",
        tuple(params) + (PAGE_SIZE, (page - 1) * PAGE_SIZE))
    experiences_list = query_db("""
        SELECT experience_id, name, capacity_per_slot, duration_minutes FROM experiences
        WHERE is_active = 1 ORDER BY name
    """)
    return render_template('admin/schedules.html', slots=slots, experiences=experiences_list,
                           exp_filter=exp_filter, status_filter=status_filter, date_from=date_from,
                           date_to=date_to, page=page, total=total, page_size=PAGE_SIZE)


@admin_bp.route('/schedules/generate', methods=['POST'])
@login_required
@role_required(['admin'])
def schedules_generate():
    try:
        exp_id = parse_int(request.form.get('experience_id'), 'Experience', min_value=1)
        start_date = parse_date(request.form.get('start_date'), 'Start date', required=True)
        end_date = parse_date(request.form.get('end_date'), 'End date', required=True)
        start_time = parse_time(request.form.get('start_time'), 'Start time')
        end_time = parse_time(request.form.get('end_time'), 'End time')
        capacity = parse_int(request.form.get('max_capacity'), 'Capacity', min_value=1, max_value=500)
        if start_date < date.today():
            raise ValidationError('Generation cannot start in the past.')
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('admin.schedules'))

    try:
        with get_db_transaction() as cursor:
            # Stored procedure sp_generate_slots loops over the date range (INSERT IGNORE on uq_slot_time)
            cursor.execute("CALL sp_generate_slots(%s, %s, %s, %s, %s, %s, @slots_created)",
                           (exp_id, start_date, end_date, start_time, end_time, capacity))
            while cursor.nextset():
                pass
            cursor.execute("SELECT @slots_created AS created")
            created = cursor.fetchone()['created'] or 0
            log_audit_action(session['user_id'], 'GENERATE_SLOTS', 'experience_slots', None, None,
                             {'experience_id': exp_id, 'from': start_date, 'to': end_date, 'created': created},
                             cursor=cursor)
    except pymysql.err.OperationalError as err:
        # SIGNAL SQLSTATE '45000' raised by the procedure's validation
        flash(f'Slot generation rejected by the database: {err.args[1] if len(err.args) > 1 else err}', 'danger')
        return redirect(url_for('admin.schedules', experience_id=exp_id))

    days = (end_date - start_date).days + 1
    flash(f'sp_generate_slots created {created} new slot(s) across {days} day(s); '
          f'{days - created} existing slot(s) were skipped.', 'success')
    return redirect(url_for('admin.schedules', experience_id=exp_id, date_from=start_date, date_to=end_date))


@admin_bp.route('/schedules/<int:slot_id>/edit', methods=['POST'])
@login_required
@role_required(['admin'])
def slot_edit(slot_id):
    slot = query_db("SELECT * FROM experience_slots WHERE slot_id = %s", (slot_id,), one=True)
    if not slot:
        flash('Slot not found.', 'danger')
        return redirect(url_for('admin.schedules'))
    try:
        start_time = parse_time(request.form.get('start_time'), 'Start time')
        end_time = parse_time(request.form.get('end_time'), 'End time')
        max_cap = parse_int(request.form.get('max_capacity'), 'Capacity', min_value=1, max_value=500)
        if end_time <= start_time:
            raise ValidationError('End time must be after the start time.')
        if max_cap < slot['booked_capacity']:
            raise ValidationError(f'Capacity cannot be lower than the {slot["booked_capacity"]} unit(s) already booked.')
        with get_db_transaction() as cursor:
            cursor.execute("""
                UPDATE experience_slots SET start_time = %s, end_time = %s, max_capacity = %s WHERE slot_id = %s
            """, (start_time, end_time, max_cap, slot_id))
            log_audit_action(session['user_id'], 'UPDATE_SLOT', 'experience_slots', slot_id,
                             {'start': slot['start_time'], 'end': slot['end_time'], 'cap': slot['max_capacity']},
                             {'start': start_time, 'end': end_time, 'cap': max_cap}, cursor=cursor)
        flash('Slot updated.', 'success')
    except ValidationError as err:
        flash(str(err), 'danger')
    except pymysql.err.IntegrityError:
        flash('Another slot of this experience already starts at that time.', 'warning')
    return redirect(request.referrer or url_for('admin.schedules'))


@admin_bp.route('/schedules/<int:slot_id>/status', methods=['POST'])
@login_required
@role_required(['admin'])
def slot_status(slot_id):
    new_status = request.form.get('slot_status')
    slot = query_db("""
        SELECT es.*, (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = es.slot_id
                        AND b.booking_status IN ('pending', 'confirmed')) AS active_bookings
        FROM experience_slots es WHERE es.slot_id = %s
    """, (slot_id,), one=True)
    if not slot or new_status not in ('available', 'locked', 'cancelled'):
        flash('Invalid slot status change.', 'danger')
    elif new_status == 'cancelled' and slot['active_bookings']:
        flash(f'This slot has {slot["active_bookings"]} active booking(s). Cancel those bookings first.', 'warning')
    else:
        with get_db_transaction() as cursor:
            cursor.execute("UPDATE experience_slots SET slot_status = %s WHERE slot_id = %s", (new_status, slot_id))
            log_audit_action(session['user_id'], 'SLOT_STATUS', 'experience_slots', slot_id,
                             {'status': slot['slot_status']}, {'status': new_status}, cursor=cursor)
        flash(f'Slot is now {new_status}.', 'info')
    return redirect(request.referrer or url_for('admin.schedules'))


@admin_bp.route('/schedules/<int:slot_id>/delete', methods=['POST'])
@login_required
@role_required(['admin'])
def slot_delete(slot_id):
    try:
        with get_db_transaction() as cursor:
            cursor.execute("DELETE FROM experience_slots WHERE slot_id = %s", (slot_id,))
            deleted = cursor.rowcount
            if deleted:
                log_audit_action(session['user_id'], 'DELETE_SLOT', 'experience_slots', slot_id, None, None, cursor=cursor)
        flash('Slot deleted.' if deleted else 'Slot not found.', 'success' if deleted else 'warning')
    except pymysql.err.IntegrityError:
        flash('This slot is referenced by bookings (fk_bk_slot ON DELETE RESTRICT) and cannot be deleted. '
              'Cancel it instead.', 'warning')
    return redirect(request.referrer or url_for('admin.schedules'))


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------
BOOKING_TRANSITIONS = {
    'pending': {'cancelled'},
    'failed': {'cancelled'},
    'confirmed': {'completed', 'cancelled'},
}


@admin_bp.route('/bookings')
@login_required
@role_required(['admin'])
def bookings():
    status_filter = request.args.get('status', '')
    q = request.args.get('q', '').strip()[:100]
    sql = """
        SELECT b.*, e.name AS experience_name, u.full_name AS guest_name, u.email AS guest_email,
               es.slot_date, es.start_time, es.end_time,
               p.payment_status, p.payment_method, p.transaction_reference
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN users u ON g.guest_id = u.user_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        LEFT JOIN payments p ON p.payment_id = (
            SELECT p2.payment_id FROM payments p2 WHERE p2.booking_id = b.booking_id
            ORDER BY p2.paid_at DESC, p2.payment_id DESC LIMIT 1)
        WHERE 1 = 1
    """
    params = []
    if status_filter in ('pending', 'confirmed', 'completed', 'cancelled', 'failed'):
        sql += " AND b.booking_status = %s"
        params.append(status_filter)
    if q:
        sql += " AND (b.booking_reference LIKE %s OR u.full_name LIKE %s OR u.email LIKE %s OR e.name LIKE %s)"
        params += [f'%{q}%'] * 4
    page = _page()
    total = query_db("SELECT COUNT(*) AS n FROM (" + sql + ") t", tuple(params), one=True)['n']
    sql += " ORDER BY b.created_at DESC, b.booking_id DESC LIMIT %s OFFSET %s"
    all_bookings = query_db(sql, tuple(params) + (PAGE_SIZE, (page - 1) * PAGE_SIZE))
    counts = {r['booking_status']: r['n'] for r in query_db(
        "SELECT booking_status, COUNT(*) AS n FROM bookings GROUP BY booking_status")}

    return render_template('admin/bookings.html', bookings=all_bookings, active_filter=status_filter, q=q,
                           counts=counts, transitions=BOOKING_TRANSITIONS, page=page, total=total,
                           page_size=PAGE_SIZE)


@admin_bp.route('/bookings/update-status/<int:booking_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def update_booking_status(booking_id):
    new_status = request.form.get('new_status')

    with get_db_transaction() as cursor:
        cursor.execute("SELECT * FROM bookings WHERE booking_id = %s FOR UPDATE", (booking_id,))
        b = cursor.fetchone()
        if not b:
            flash('Booking not found.', 'danger')
            return redirect(url_for('admin.bookings'))

        old_status = b['booking_status']
        if new_status not in BOOKING_TRANSITIONS.get(old_status, set()):
            flash(f'Transition {old_status} → {new_status or "?"} is not allowed.', 'danger')
            return redirect(url_for('admin.bookings'))

        if new_status == 'cancelled':
            refund = b['total_amount'] if old_status == 'confirmed' else 0
            cursor.execute("""
                UPDATE bookings SET booking_status = 'cancelled', refund_amount = %s,
                       cancellation_reason = COALESCE(cancellation_reason, 'Cancelled by resort administration')
                WHERE booking_id = %s
            """, (refund, booking_id))
            if old_status == 'confirmed':
                release_booking_resources(cursor, booking_id)
                cursor.execute("""
                    UPDATE payments SET payment_status = 'refunded'
                    WHERE booking_id = %s AND payment_status = 'successful'
                """, (booking_id,))
        else:  # confirmed -> completed
            cursor.execute("UPDATE bookings SET booking_status = 'completed' WHERE booking_id = %s", (booking_id,))
            cursor.execute("UPDATE staff_assignments SET assignment_status = 'completed' WHERE booking_id = %s",
                           (booking_id,))

        log_audit_action(session['user_id'], 'UPDATE_BOOKING_STATUS', 'bookings', booking_id,
                         {'status': old_status}, {'status': new_status}, cursor=cursor)

    flash(f'Booking {b["booking_reference"]} moved from {old_status} to {new_status}.', 'success')
    return redirect(request.referrer or url_for('admin.bookings'))


# ---------------------------------------------------------------------------
# Reports & audit
# ---------------------------------------------------------------------------
@admin_bp.route('/reports')
@login_required
@role_required(['admin'])
def reports():
    try:
        date_from = parse_date(request.args.get('date_from'), 'From') or date.today()
        date_to = parse_date(request.args.get('date_to'), 'To') or (date_from + timedelta(days=13))
    except ValidationError:
        date_from, date_to = date.today(), date.today() + timedelta(days=13)

    cat_summary = query_db("SELECT * FROM v_sustainability_metrics ORDER BY total_category_revenue DESC")

    res_util = query_db("""
        SELECT r.name, r.resource_type, r.total_quantity, r.condition_status,
               COALESCE(SUM(ra.quantity_allocated), 0) AS total_times_allocated,
               COUNT(DISTINCT ra.slot_id) AS slots_used
        FROM resources r
        LEFT JOIN resource_allocations ra ON r.resource_id = ra.resource_id AND ra.allocation_status = 'reserved'
        GROUP BY r.resource_id
        ORDER BY total_times_allocated DESC
    """)

    staff_workload = query_db("SELECT * FROM v_staff_workload ORDER BY total_assignments DESC")

    # Stored procedure demonstration inside the real application
    occupancy = call_procedure('sp_experience_occupancy', (date_from, date_to))

    payment_mix = query_db("""
        SELECT payment_method, payment_status, COUNT(*) AS n, SUM(amount) AS amount
        FROM payments GROUP BY payment_method, payment_status ORDER BY payment_method, payment_status
    """)

    top_guests = query_db("""
        SELECT u.full_name, COUNT(b.booking_id) AS bookings, SUM(b.total_amount) AS spend
        FROM bookings b JOIN users u ON u.user_id = b.guest_id
        WHERE b.booking_status IN ('confirmed', 'completed')
        GROUP BY b.guest_id, u.full_name
        HAVING SUM(b.total_amount) > 0
        ORDER BY spend DESC LIMIT 5
    """)

    return render_template('admin/reports.html', cat_summary=cat_summary, res_util=res_util,
                           staff_workload=staff_workload, occupancy=occupancy, payment_mix=payment_mix,
                           top_guests=top_guests, date_from=date_from, date_to=date_to)


@admin_bp.route('/audit-logs')
@login_required
@role_required(['admin'])
def audit_logs():
    action = request.args.get('action', '')
    entity = request.args.get('entity', '')
    where, params = " WHERE 1 = 1", []
    if action:
        where += " AND al.action_type = %s"
        params.append(action)
    if entity:
        where += " AND al.entity_name = %s"
        params.append(entity)
    page = _page()
    total = query_db("SELECT COUNT(*) AS n FROM audit_logs al" + where, tuple(params), one=True)['n']
    logs = query_db("""
        SELECT al.*, u.full_name AS user_name, u.email AS user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.user_id
    """ + where + " ORDER BY al.created_at DESC, al.log_id DESC LIMIT %s OFFSET %s",
        tuple(params) + (PAGE_SIZE, (page - 1) * PAGE_SIZE))
    actions = [r['action_type'] for r in query_db("SELECT DISTINCT action_type FROM audit_logs ORDER BY action_type")]
    entities = [r['entity_name'] for r in query_db("SELECT DISTINCT entity_name FROM audit_logs ORDER BY entity_name")]
    return render_template('admin/audit_logs.html', logs=logs, actions=actions, entities=entities,
                           active_action=action, active_entity=entity, page=page, total=total, page_size=PAGE_SIZE)
