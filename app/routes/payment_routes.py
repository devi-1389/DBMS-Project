import json
import uuid
from datetime import datetime

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.routes.auth_routes import login_required, role_required
from database.connection import query_db, get_db_transaction
from app.security import ValidationError, parse_int, require_choice
from app.services.availability_service import (
    allocate_booking_resources, check_resource_availability,
    check_slot_availability, check_staff_availability,
)

payment_bp = Blueprint('payment', __name__)

PAYMENT_METHODS = ('credit_card_sim', 'upi_sim', 'resort_credit', 'net_banking_sim')


@payment_bp.route('/payment/<int:booking_id>')
@login_required
@role_required(['guest'])
def payment_simulator(booking_id):
    booking = query_db("""
        SELECT b.*, e.name AS experience_name, e.slug, e.base_price, e.pricing_type, e.image_url,
               c.name AS category_name, c.slug AS category_slug,
               es.slot_date, es.start_time, es.end_time
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        WHERE b.booking_id = %s AND b.guest_id = %s
    """, (booking_id, session['user_id']), one=True)
    if not booking:
        flash('Booking not found.', 'warning')
        return redirect(url_for('guest.my_bookings'))

    if booking['booking_status'] in ('confirmed', 'completed'):
        return redirect(url_for('payment.confirmation', booking_id=booking_id))
    if booking['booking_status'] == 'cancelled':
        flash('This reservation was cancelled and can no longer be paid.', 'warning')
        return redirect(url_for('guest.my_bookings'))

    attempts = query_db("""
        SELECT transaction_reference, payment_method, amount, payment_status, paid_at
        FROM payments WHERE booking_id = %s ORDER BY paid_at DESC, payment_id DESC
    """, (booking_id,))
    return render_template('booking/payment_simulator.html', booking=booking, attempts=attempts)


@payment_bp.route('/payment/process', methods=['POST'])
@login_required
@role_required(['guest'])
def process_payment():
    guest_id = session['user_id']
    try:
        booking_id = parse_int(request.form.get('booking_id'), 'Booking', min_value=1)
        payment_method = require_choice(request.form.get('payment_method'), 'Payment method',
                                        PAYMENT_METHODS, default='credit_card_sim')
        action = require_choice(request.form.get('sim_action'), 'Simulation outcome', ('success', 'fail'),
                                default='success')
    except ValidationError as err:
        flash(str(err), 'danger')
        return redirect(url_for('guest.my_bookings'))

    with get_db_transaction() as cursor:
        cursor.execute("SELECT * FROM bookings WHERE booking_id = %s AND guest_id = %s FOR UPDATE",
                       (booking_id, guest_id))
        b = cursor.fetchone()
        if not b:
            flash('Booking record not found.', 'danger')
            return redirect(url_for('guest.my_bookings'))

        # Only unpaid reservations can be paid; this blocks double payment and
        # re-confirming cancelled bookings.
        if b['booking_status'] not in ('pending', 'failed'):
            flash(f'Booking {b["booking_reference"]} is already {b["booking_status"]}; no payment was taken.', 'warning')
            if b['booking_status'] in ('confirmed', 'completed'):
                return redirect(url_for('payment.confirmation', booking_id=booking_id))
            return redirect(url_for('guest.my_bookings'))

        txn_ref = f"TXN-SIM-{uuid.uuid4().hex[:10].upper()}"
        amount = b['total_amount']

        if action == 'success':
            # Capacity is only consumed at confirmation, so re-validate under row locks:
            # another guest may have taken the last seats while this booking was pending.
            ok, msg, _ = check_slot_availability(b['slot_id'], b['party_size'], cursor=cursor)
            if ok:
                ok, msg, _ = check_resource_availability(b['experience_id'], b['slot_id'], b['party_size'], cursor=cursor)
            if ok:
                ok, msg, _ = check_staff_availability(b['experience_id'], b['slot_id'], cursor=cursor)
            if not ok:
                cursor.execute("UPDATE bookings SET booking_status = 'failed' WHERE booking_id = %s", (booking_id,))
                flash(f'Payment was not taken: {msg}', 'danger')
                return redirect(url_for('guest.my_bookings'))

            gateway_resp = json.dumps({
                "status": "APPROVED",
                "auth_code": f"SIM_AUTH_{uuid.uuid4().hex[:6].upper()}",
                "method": payment_method,
                "timestamp": datetime.now().isoformat(timespec='seconds'),
            })
            cursor.execute("""
                INSERT INTO payments (booking_id, transaction_reference, payment_method, amount, payment_status, simulated_gateway_response)
                VALUES (%s, %s, %s, %s, 'successful', %s)
            """, (booking_id, txn_ref, payment_method, amount, gateway_resp))
            cursor.execute("UPDATE bookings SET booking_status = 'confirmed' WHERE booking_id = %s", (booking_id,))
            allocate_booking_resources(cursor, booking_id, b['experience_id'], b['slot_id'], b['party_size'])

            flash('Simulated payment approved! Your reservation is confirmed.', 'success')
            return redirect(url_for('payment.confirmation', booking_id=booking_id))

        gateway_resp = json.dumps({
            "status": "DECLINED",
            "reason": "SIMULATED_INSUFFICIENT_FUNDS_OR_USER_REJECT",
            "method": payment_method,
        })
        cursor.execute("""
            INSERT INTO payments (booking_id, transaction_reference, payment_method, amount, payment_status, simulated_gateway_response)
            VALUES (%s, %s, %s, %s, 'failed', %s)
        """, (booking_id, txn_ref, payment_method, amount, gateway_resp))
        cursor.execute("UPDATE bookings SET booking_status = 'failed' WHERE booking_id = %s", (booking_id,))

    flash('Simulated payment failed or was declined. No charges were made and no resources are held. You can retry below.', 'danger')
    return redirect(url_for('payment.payment_simulator', booking_id=booking_id))


@payment_bp.route('/booking/confirmation/<int:booking_id>')
@login_required
def confirmation(booking_id):
    role = session.get('role_name')
    sql = """
        SELECT b.*, e.name AS experience_name, e.slug, e.duration_minutes, e.image_url,
               e.safety_instructions, e.age_restrictions, e.accessibility_info,
               c.name AS category_name, c.icon AS category_icon, c.slug AS category_slug,
               es.slot_date, es.start_time, es.end_time,
               p.transaction_reference, p.payment_method, p.paid_at, p.payment_status,
               u.full_name AS guest_name, u.email AS guest_email, u.phone AS guest_phone
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        JOIN guests g ON b.guest_id = g.guest_id
        JOIN users u ON g.guest_id = u.user_id
        LEFT JOIN payments p ON p.payment_id = (
            SELECT p2.payment_id FROM payments p2 WHERE p2.booking_id = b.booking_id
            ORDER BY (p2.payment_status <> 'failed') DESC, p2.paid_at DESC, p2.payment_id DESC LIMIT 1)
        WHERE b.booking_id = %s
    """
    params = [booking_id]
    if role == 'guest':
        sql += " AND b.guest_id = %s"
        params.append(session['user_id'])
    elif role == 'staff':
        sql += " AND EXISTS (SELECT 1 FROM staff_assignments sa JOIN staff s ON s.staff_id = sa.staff_id WHERE sa.booking_id = b.booking_id AND s.user_id = %s)"
        params.append(session['user_id'])

    booking = query_db(sql, tuple(params), one=True)
    if not booking:
        flash('Booking confirmation not available.', 'warning')
        return redirect(url_for('auth.login'))

    staff = query_db("""
        SELECT DISTINCT u.full_name, s.specialization
        FROM staff_assignments sa
        JOIN staff s ON s.staff_id = sa.staff_id
        JOIN users u ON u.user_id = s.user_id
        WHERE sa.booking_id = %s AND sa.assignment_status IN ('assigned', 'confirmed', 'completed')
    """, (booking_id,))
    history = query_db("""
        SELECT h.*, u.full_name AS changed_by
        FROM booking_status_history h
        LEFT JOIN users u ON u.user_id = h.changed_by_user_id
        WHERE h.booking_id = %s ORDER BY h.changed_at, h.history_id
    """, (booking_id,))
    return render_template('booking/confirmation.html', booking=booking, staff=staff, history=history)
