from datetime import date, timedelta

from flask import Blueprint, jsonify, render_template, request, redirect, url_for, flash, session
from app.routes.auth_routes import login_required, role_required
from database.connection import query_db, get_db_transaction
from app.services.recommendation_engine import get_personalized_recommendations, get_guest_spent_amount
from app.services.itinerary_service import (
    get_or_create_itinerary, get_itinerary_details, add_item_to_itinerary,
    remove_item_from_itinerary, update_itinerary, sessions_for_day, TIME_BLOCKS,
)
from app.security import (
    ValidationError, parse_date, parse_float, parse_int, require_choice, require_text,
)

guest_bp = Blueprint('guest', __name__, url_prefix='/guest')

GUEST_PROFILE_SQL = """
    SELECT g.*, u.full_name, u.email, u.phone, u.created_at AS member_since
    FROM guests g
    JOIN users u ON g.guest_id = u.user_id
    WHERE g.guest_id = %s
"""


@guest_bp.route('/dashboard')
@login_required
@role_required(['guest'])
def dashboard():
    guest_id = session['user_id']
    guest = query_db(GUEST_PROFILE_SQL, (guest_id,), one=True)

    total_budget = float(guest['budget'])
    spent_amount = get_guest_spent_amount(guest_id)
    remaining_budget = max(0.0, total_budget - spent_amount)

    bookings = query_db("""
        SELECT b.*, e.name AS experience_name, e.slug, e.image_url, c.name AS category_name,
               c.slug AS category_slug, es.slot_date, es.start_time, es.end_time,
               r.review_id,
               (TIMESTAMP(es.slot_date, es.start_time) >= NOW()) AS is_future
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        LEFT JOIN reviews r ON b.booking_id = r.booking_id
        WHERE b.guest_id = %s
        ORDER BY es.slot_date ASC, es.start_time ASC
    """, (guest_id,))

    upcoming = [b for b in bookings if b['booking_status'] == 'confirmed' and b['is_future']]
    pending_payment = [b for b in bookings if b['booking_status'] in ('pending', 'failed') and b['is_future']]
    completed = [b for b in bookings if b['booking_status'] == 'completed']
    pending_reviews = [b for b in completed if not b['review_id']]

    stats = query_db("""
        SELECT COUNT(*) AS total_bookings,
               SUM(booking_status = 'completed') AS completed,
               SUM(booking_status = 'cancelled') AS cancelled,
               (SELECT COUNT(*) FROM reviews WHERE guest_id = %s) AS reviews_written
        FROM bookings WHERE guest_id = %s
    """, (guest_id, guest_id), one=True)

    category_mix = query_db("""
        SELECT c.name, COUNT(*) AS n
        FROM bookings b
        JOIN experiences e ON e.experience_id = b.experience_id
        JOIN experience_categories c ON c.category_id = e.category_id
        WHERE b.guest_id = %s AND b.booking_status IN ('confirmed', 'completed')
        GROUP BY c.category_id, c.name ORDER BY n DESC
    """, (guest_id,))

    recommendations = get_personalized_recommendations(guest_id, max_results=3)

    itinerary = get_or_create_itinerary(guest_id)
    _, itinerary_items = get_itinerary_details(itinerary['itinerary_id']) if itinerary else (None, [])

    return render_template(
        'guest/dashboard.html',
        guest=guest,
        total_budget=total_budget,
        spent_amount=spent_amount,
        remaining_budget=remaining_budget,
        upcoming_bookings=upcoming,
        pending_payment=pending_payment,
        pending_reviews=pending_reviews,
        completed_bookings=completed,
        stats=stats,
        category_mix=category_mix,
        recommendations=recommendations,
        itinerary=itinerary,
        itinerary_items=itinerary_items
    )


@guest_bp.route('/profile', methods=['GET', 'POST'])
@login_required
@role_required(['guest'])
def profile():
    guest_id = session['user_id']

    if request.method == 'POST':
        form = request.form
        try:
            full_name = require_text(form.get('full_name'), 'Full name', 120)
            phone = require_text(form.get('phone'), 'Phone', 30, required=False)
            party_size = parse_int(form.get('party_size'), 'Party size', min_value=1, max_value=25)
            budget = parse_float(form.get('budget'), 'Budget', min_value=0, max_value=10_000_000)
            check_in = parse_date(form.get('check_in_date'), 'Check-in date')
            check_out = parse_date(form.get('check_out_date'), 'Check-out date')
            preferred_tod = require_choice(form.get('preferred_time_of_day'), 'Preferred time',
                                           ('morning', 'afternoon', 'evening', 'any'), default='any')
            accessibility = require_text(form.get('accessibility_notes'), 'Accessibility notes', 1000, required=False)
            sustainability_priority = require_choice(form.get('sustainability_priority'), 'Sustainability priority',
                                                     ('low', 'medium', 'high'), default='high')
            if check_in and check_out and check_in > check_out:
                raise ValidationError('Check-in date cannot be after check-out date.')
        except ValidationError as err:
            flash(str(err), 'danger')
            return redirect(url_for('guest.profile'))

        with get_db_transaction() as cursor:
            cursor.execute("UPDATE users SET full_name = %s, phone = %s WHERE user_id = %s",
                           (full_name, phone, guest_id))
            cursor.execute("""
                UPDATE guests
                SET party_size = %s, budget = %s, check_in_date = %s, check_out_date = %s,
                    preferred_time_of_day = %s, accessibility_notes = %s, sustainability_priority = %s
                WHERE guest_id = %s
            """, (party_size, budget, check_in, check_out, preferred_tod, accessibility,
                  sustainability_priority, guest_id))

        session['full_name'] = full_name
        flash('Your profile has been updated successfully.', 'success')
        return redirect(url_for('guest.profile'))

    guest = query_db(GUEST_PROFILE_SQL, (guest_id,), one=True)
    return render_template('guest/profile.html', guest=guest)


@guest_bp.route('/preferences', methods=['GET', 'POST'])
@login_required
@role_required(['guest'])
def preferences():
    guest_id = session['user_id']

    if request.method == 'POST':
        interests = query_db("SELECT interest_id, name FROM interests")
        try:
            weights = {
                item['interest_id']: parse_int(request.form.get(f'interest_{item["interest_id"]}'), item['name'],
                                               default=3, min_value=1, max_value=5)
                for item in interests
            }
        except ValidationError as err:
            flash(str(err), 'danger')
            return redirect(url_for('guest.preferences'))

        with get_db_transaction() as cursor:
            for interest_id, weight in weights.items():
                cursor.execute("""
                    INSERT INTO guest_preferences (guest_id, interest_id, weight)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE weight = VALUES(weight)
                """, (guest_id, interest_id, weight))

        flash('Your activity interests and preferences have been calibrated!', 'success')
        return redirect(url_for('guest.recommendations'))

    interests = query_db("""
        SELECT i.*, COALESCE(gp.weight, 3) AS current_weight
        FROM interests i
        LEFT JOIN guest_preferences gp ON i.interest_id = gp.interest_id AND gp.guest_id = %s
        ORDER BY i.interest_id ASC
    """, (guest_id,))

    return render_template('guest/preferences.html', interests=interests)


@guest_bp.route('/recommendations')
@login_required
@role_required(['guest'])
def recommendations():
    guest_id = session['user_id']
    recommendations_list = get_personalized_recommendations(guest_id, max_results=12)
    guest = query_db("SELECT * FROM guests WHERE guest_id = %s", (guest_id,), one=True)
    spent = get_guest_spent_amount(guest_id)
    remaining_budget = max(0.0, float(guest['budget']) - spent)

    return render_template(
        'guest/recommendations.html',
        recommendations=recommendations_list,
        guest=guest,
        remaining_budget=remaining_budget
    )


@guest_bp.route('/itinerary')
@login_required
@role_required(['guest'])
def itinerary():
    guest_id = session['user_id']
    itin = get_or_create_itinerary(guest_id)
    itin_obj, items = get_itinerary_details(itin['itinerary_id'])

    num_days = max(1, (itin_obj['end_date'] - itin_obj['start_date']).days + 1)

    available_exps = query_db("""
        SELECT e.experience_id, e.name, e.base_price, e.pricing_type, c.name AS category_name
        FROM experiences e
        JOIN experience_categories c ON e.category_id = c.category_id
        WHERE e.is_active = 1
        ORDER BY c.display_order, e.name
    """)

    today = date.today()
    days = []
    for day in range(1, num_days + 1):
        day_date = itin_obj['start_date'] + timedelta(days=day - 1)
        days.append({
            'number': day,
            'date': day_date,
            'is_past': day_date < today,
            'is_today': day_date == today,
            'items': [i for i in items if i['day_number'] == day],
        })
    plannable_days = [d for d in days if not d['is_past']]

    return render_template(
        'guest/itinerary.html',
        itinerary=itin_obj,
        items=items,
        days=days,
        plannable_days=plannable_days,
        num_days=num_days,
        time_blocks=TIME_BLOCKS,
        available_experiences=available_exps
    )


@guest_bp.route('/itinerary/sessions')
@login_required
@role_required(['guest'])
def itinerary_sessions():
    """JSON list of scheduled sessions of an experience on one itinerary day (used by the planner pop-up)."""
    itin = get_or_create_itinerary(session['user_id'])
    try:
        experience_id = parse_int(request.args.get('experience_id'), 'Experience', min_value=1)
        day_number = parse_int(request.args.get('day'), 'Day', min_value=1, max_value=60)
    except ValidationError as err:
        return jsonify({'ok': False, 'error': str(err)}), 400
    day_date = itin['start_date'] + timedelta(days=day_number - 1)
    return jsonify({'ok': True, 'date': day_date.isoformat(), 'sessions': sessions_for_day(experience_id, day_date)})


@guest_bp.route('/itinerary/update', methods=['POST'])
@login_required
@role_required(['guest'])
def itinerary_update():
    itin = get_or_create_itinerary(session['user_id'])
    try:
        title = require_text(request.form.get('title'), 'Title', 150)
        start = parse_date(request.form.get('start_date'), 'Start date', required=True)
        end = parse_date(request.form.get('end_date'), 'End date', required=True)
        budget = parse_float(request.form.get('total_budget'), 'Budget', min_value=0, max_value=10_000_000)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('guest.itinerary'))
    ok, msg = update_itinerary(itin['itinerary_id'], title, start, end, budget)
    flash(msg, 'success' if ok else 'warning')
    return redirect(url_for('guest.itinerary'))


@guest_bp.route('/itinerary/add', methods=['POST'])
@login_required
@role_required(['guest'])
def itinerary_add():
    itin = get_or_create_itinerary(session['user_id'])
    try:
        experience_id = parse_int(request.form.get('experience_id'), 'Experience', min_value=1)
        day_number = parse_int(request.form.get('day_number'), 'Day', default=1, min_value=1, max_value=60)
        time_block = require_choice(request.form.get('time_block'), 'Time block', TIME_BLOCKS)
        slot_raw = request.form.get('slot_id')
        slot_id = parse_int(slot_raw, 'Slot', min_value=1) if slot_raw else None
        notes = require_text(request.form.get('notes'), 'Notes', 500, required=False)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('guest.itinerary'))

    success, message = add_item_to_itinerary(
        itin['itinerary_id'], experience_id, slot_id, day_number, time_block, notes
    )
    flash(message, 'success' if success else 'warning')
    return redirect(url_for('guest.itinerary'))


@guest_bp.route('/itinerary/remove/<int:item_id>', methods=['POST'])
@login_required
@role_required(['guest'])
def itinerary_remove(item_id):
    itin = get_or_create_itinerary(session['user_id'])
    success, msg = remove_item_from_itinerary(item_id, itin['itinerary_id'])
    flash(msg, 'info' if success else 'danger')
    return redirect(url_for('guest.itinerary'))


@guest_bp.route('/my-bookings')
@login_required
@role_required(['guest'])
def my_bookings():
    guest_id = session['user_id']
    status_filter = request.args.get('status', '')
    sql = """
        SELECT b.*, e.name AS experience_name, e.slug, e.image_url, e.duration_minutes,
               c.name AS category_name, c.icon AS category_icon, c.slug AS category_slug,
               es.slot_date, es.start_time, es.end_time,
               p.payment_status, p.payment_method, p.transaction_reference,
               r.review_id, r.rating,
               (NOW() < b.cancellation_deadline) AS can_cancel_free,
               (TIMESTAMP(es.slot_date, es.start_time) > NOW()) AS is_future
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        LEFT JOIN payments p ON p.payment_id = (
            SELECT p2.payment_id FROM payments p2 WHERE p2.booking_id = b.booking_id
            ORDER BY p2.paid_at DESC, p2.payment_id DESC LIMIT 1)
        LEFT JOIN reviews r ON b.booking_id = r.booking_id
        WHERE b.guest_id = %s
    """
    params = [guest_id]
    if status_filter in ('pending', 'confirmed', 'completed', 'cancelled', 'failed'):
        sql += " AND b.booking_status = %s"
        params.append(status_filter)
    sql += " ORDER BY b.created_at DESC, b.booking_id DESC"
    bookings = query_db(sql, tuple(params))

    counts = query_db("""
        SELECT booking_status, COUNT(*) AS n FROM bookings WHERE guest_id = %s GROUP BY booking_status
    """, (guest_id,))
    return render_template('guest/my_bookings.html', bookings=bookings, active_filter=status_filter,
                           counts={c['booking_status']: c['n'] for c in counts})


@guest_bp.route('/my-reviews')
@login_required
@role_required(['guest'])
def my_reviews():
    reviews = query_db("""
        SELECT r.*, e.name AS experience_name, e.slug, e.image_url, c.slug AS category_slug,
               b.booking_reference, es.slot_date
        FROM reviews r
        JOIN experiences e ON e.experience_id = r.experience_id
        JOIN experience_categories c ON c.category_id = e.category_id
        JOIN bookings b ON b.booking_id = r.booking_id
        JOIN experience_slots es ON es.slot_id = b.slot_id
        WHERE r.guest_id = %s
        ORDER BY r.created_at DESC
    """, (session['user_id'],))
    return render_template('guest/my_reviews.html', reviews=reviews)
