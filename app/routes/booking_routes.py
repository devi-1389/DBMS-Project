import uuid
from datetime import datetime, timedelta

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.routes.auth_routes import login_required, role_required
from database.connection import query_db, get_db_transaction
from app.security import ValidationError, parse_int, require_text
from app.services.audit_service import log_audit_action
from app.services.availability_service import (
    capacity_units, check_slot_availability, check_resource_availability,
    check_staff_availability, release_booking_resources,
)

booking_bp = Blueprint('booking', __name__)

CANCELLATION_WINDOW_HOURS = 12


@booking_bp.route('/book/<int:slot_id>')
@login_required
@role_required(['guest'])
def book_slot(slot_id):
    guest_id = session['user_id']

    slot = query_db("""
        SELECT es.*, (es.max_capacity - es.booked_capacity) AS available_capacity,
               (TIMESTAMP(es.slot_date, es.start_time) > NOW()) AS is_future,
               e.experience_id, e.name AS experience_name, e.slug, e.base_price,
               e.pricing_type, e.duration_minutes, e.min_party_size, e.max_party_size,
               e.image_url, e.safety_instructions, e.age_restrictions, e.is_active,
               c.name AS category_name, c.slug AS category_slug
        FROM experience_slots es
        JOIN experiences e ON es.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        WHERE es.slot_id = %s
    """, (slot_id,), one=True)
    if not slot:
        flash('Selected experience slot was not found.', 'danger')
        return redirect(url_for('experience.catalogue'))
    if not slot['is_active'] or slot['slot_status'] != 'available' or not slot['is_future']:
        flash('This session is no longer open for booking. Please choose another time.', 'warning')
        return redirect(url_for('experience.detail', slug=slot['slug']))

    guest = query_db("SELECT * FROM guests WHERE guest_id = %s", (guest_id,), one=True)
    default_party = min(max(guest['party_size'] if guest else 1, slot['min_party_size']), slot['max_party_size'])

    return render_template('booking/book_slot.html', slot=slot, guest=guest, default_party=default_party)


@booking_bp.route('/booking/initiate', methods=['POST'])
@login_required
@role_required(['guest'])
def initiate_booking():
    guest_id = session['user_id']
    try:
        slot_id = parse_int(request.form.get('slot_id'), 'Slot', min_value=1)
        party_size = parse_int(request.form.get('party_size'), 'Party size', default=1, min_value=1, max_value=25)
        special_requests = require_text(request.form.get('special_requests'), 'Special requests', 1000, required=False)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(request.referrer or url_for('experience.catalogue'))

    with get_db_transaction() as cursor:
        # 1. Lock the slot row and validate capacity / timing / party size
        is_avail, msg, slot = check_slot_availability(slot_id, party_size, cursor=cursor)
        if not is_avail:
            flash(msg, 'danger')
            if slot:
                return redirect(url_for('booking.book_slot', slot_id=slot_id))
            return redirect(url_for('experience.catalogue'))

        experience_id = slot['experience_id']

        # 2. Physical resources and 3. staff
        res_avail, res_msg, _ = check_resource_availability(experience_id, slot_id, party_size, cursor=cursor)
        if not res_avail:
            flash(res_msg, 'danger')
            return redirect(url_for('booking.book_slot', slot_id=slot_id))
        staff_avail, staff_msg, _ = check_staff_availability(experience_id, slot_id, cursor=cursor)
        if not staff_avail:
            flash(staff_msg, 'danger')
            return redirect(url_for('booking.book_slot', slot_id=slot_id))

        # 4. Authoritative server-side price
        unit_price = float(slot['base_price'])
        total_amount = unit_price * party_size if slot['pricing_type'] == 'per_person' else unit_price

        # 5. Free cancellation until 12 hours before the session starts
        slot_dt = datetime.combine(slot['slot_date'], (datetime.min + slot['start_time']).time())
        cancellation_deadline = slot_dt - timedelta(hours=CANCELLATION_WINDOW_HOURS)

        ref_code = f"SOL-{datetime.now():%Y}-{uuid.uuid4().hex[:8].upper()}"

        cursor.execute("""
            INSERT INTO bookings (
                booking_reference, guest_id, experience_id, slot_id,
                booking_date, party_size, unit_price, total_amount,
                special_requests, booking_status, cancellation_deadline, refund_amount
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, 0.00)
        """, (ref_code, guest_id, experience_id, slot_id, slot['slot_date'], party_size,
              unit_price, total_amount, special_requests, cancellation_deadline))
        booking_id = cursor.lastrowid

    return redirect(url_for('payment.payment_simulator', booking_id=booking_id))


@booking_bp.route('/booking/cancel/<int:booking_id>', methods=['POST'])
@login_required
@role_required(['guest', 'admin'])
def cancel_booking(booking_id):
    user_id = session['user_id']
    role = session.get('role_name')
    back = url_for('admin.bookings') if role == 'admin' else url_for('guest.my_bookings')
    try:
        reason = require_text(request.form.get('cancellation_reason') or 'Guest requested cancellation.',
                              'Cancellation reason', 1000)
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(back)

    with get_db_transaction() as cursor:
        cursor.execute("SELECT * FROM bookings WHERE booking_id = %s FOR UPDATE", (booking_id,))
        b = cursor.fetchone()

        if not b or (role != 'admin' and b['guest_id'] != user_id):
            flash('Booking not found.', 'danger')
            return redirect(back)

        status = b['booking_status']
        if status in ('pending', 'failed'):
            # Unpaid reservation: nothing is held, simply close it.
            cursor.execute("""
                UPDATE bookings SET booking_status = 'cancelled', cancellation_reason = %s, refund_amount = 0
                WHERE booking_id = %s
            """, (reason, booking_id))
            if role == 'admin':
                log_audit_action(user_id, 'CANCEL_BOOKING', 'bookings', booking_id,
                                 {'status': status}, {'status': 'cancelled'}, cursor=cursor)
            flash(f'Unpaid reservation {b["booking_reference"]} has been closed. No charges were made.', 'info')
            return redirect(back)

        if status != 'confirmed':
            flash(f'Cannot cancel a booking with status "{status}".', 'warning')
            return redirect(back)

        if role != 'admin' and datetime.now() > b['cancellation_deadline']:
            flash(f'Cancellation deadline passed on {b["cancellation_deadline"].strftime("%d %b %Y, %I:%M %p")}. '
                  f'Free cancellation is no longer permitted.', 'danger')
            return redirect(back)

        refund_amount = b['total_amount']
        cursor.execute("""
            UPDATE bookings
            SET booking_status = 'cancelled', cancellation_reason = %s, refund_amount = %s
            WHERE booking_id = %s
        """, (reason, refund_amount, booking_id))
        release_booking_resources(cursor, booking_id)
        cursor.execute("""
            UPDATE payments SET payment_status = 'refunded'
            WHERE booking_id = %s AND payment_status = 'successful'
        """, (booking_id,))
        if role == 'admin':
            log_audit_action(user_id, 'CANCEL_BOOKING', 'bookings', booking_id,
                             {'status': status}, {'status': 'cancelled', 'refund': float(refund_amount)}, cursor=cursor)

    flash(f'Booking {b["booking_reference"]} has been successfully cancelled. A full refund of '
          f'₹{refund_amount:,.2f} has been processed to the original payment method.', 'info')
    return redirect(back)
