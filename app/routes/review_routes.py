from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.routes.auth_routes import login_required, role_required
from database.connection import query_db, get_db_transaction
from app.security import ValidationError, parse_int, require_text

review_bp = Blueprint('review', __name__)


def _review_form_values(form):
    rating = parse_int(form.get('rating'), 'Rating', min_value=1, max_value=5)
    title = require_text(form.get('review_title'), 'Title', 150, required=False)
    text = require_text(form.get('review_text'), 'Review', 2000)
    if len(text) < 10:
        raise ValidationError('Please share at least a sentence (10+ characters) about your experience.')
    return rating, title, text


@review_bp.route('/review/<int:booking_id>', methods=['GET', 'POST'])
@login_required
@role_required(['guest'])
def submit_review(booking_id):
    guest_id = session['user_id']

    b = query_db("""
        SELECT b.*, e.name AS experience_name, e.slug, e.image_url, c.slug AS category_slug,
               es.slot_date, es.start_time
        FROM bookings b
        JOIN experiences e ON b.experience_id = e.experience_id
        JOIN experience_categories c ON c.category_id = e.category_id
        JOIN experience_slots es ON b.slot_id = es.slot_id
        WHERE b.booking_id = %s AND b.guest_id = %s
    """, (booking_id, guest_id), one=True)
    if not b:
        flash('Booking record not found.', 'danger')
        return redirect(url_for('guest.my_bookings'))

    if b['booking_status'] != 'completed':
        flash('Reviews can only be submitted after your experience has been completed by resort staff.', 'warning')
        return redirect(url_for('guest.my_bookings'))

    if query_db("SELECT review_id FROM reviews WHERE booking_id = %s", (booking_id,), one=True):
        flash('You have already submitted a review for this booking. Thank you!', 'info')
        return redirect(url_for('guest.my_reviews'))

    if request.method == 'POST':
        try:
            rating, title, review_text = _review_form_values(request.form)
        except ValidationError as err:
            flash(str(err), 'warning')
            return render_template('experiences/review_form.html', booking=b, review=request.form), 400

        with get_db_transaction() as cursor:
            # trg_review_before_insert re-validates ownership and completion inside MySQL
            cursor.execute("""
                INSERT INTO reviews (booking_id, guest_id, experience_id, rating, review_title, review_text, is_approved)
                VALUES (%s, %s, %s, %s, %s, %s, 1)
            """, (booking_id, guest_id, b['experience_id'], rating, title, review_text))

        flash('Your review has been published! Thank you for helping fellow guests discover exceptional moments.', 'success')
        return redirect(url_for('experience.detail', slug=b['slug']))

    return render_template('experiences/review_form.html', booking=b, review=None)


@review_bp.route('/review/edit/<int:review_id>', methods=['GET', 'POST'])
@login_required
@role_required(['guest'])
def edit_review(review_id):
    review = query_db("""
        SELECT r.*, e.name AS experience_name, e.slug, e.image_url, c.slug AS category_slug,
               es.slot_date, es.start_time, b.booking_reference, b.booking_id, b.party_size
        FROM reviews r
        JOIN bookings b ON b.booking_id = r.booking_id
        JOIN experiences e ON e.experience_id = r.experience_id
        JOIN experience_categories c ON c.category_id = e.category_id
        JOIN experience_slots es ON es.slot_id = b.slot_id
        WHERE r.review_id = %s AND r.guest_id = %s
    """, (review_id, session['user_id']), one=True)
    if not review:
        flash('Review not found.', 'danger')
        return redirect(url_for('guest.my_reviews'))

    if request.method == 'POST':
        try:
            rating, title, review_text = _review_form_values(request.form)
        except ValidationError as err:
            flash(str(err), 'warning')
            merged = dict(review, **request.form.to_dict())
            return render_template('experiences/review_form.html', booking=review, review=merged, editing=True), 400
        with get_db_transaction() as cursor:
            cursor.execute("""
                UPDATE reviews SET rating = %s, review_title = %s, review_text = %s
                WHERE review_id = %s AND guest_id = %s
            """, (rating, title, review_text, review_id, session['user_id']))
        flash('Your review has been updated.', 'success')
        return redirect(url_for('guest.my_reviews'))

    return render_template('experiences/review_form.html', booking=review, review=review, editing=True)


@review_bp.route('/review/delete/<int:review_id>', methods=['POST'])
@login_required
@role_required(['guest'])
def delete_review(review_id):
    with get_db_transaction() as cursor:
        cursor.execute("DELETE FROM reviews WHERE review_id = %s AND guest_id = %s", (review_id, session['user_id']))
        deleted = cursor.rowcount
    flash('Your review has been removed.' if deleted else 'Review not found.', 'info' if deleted else 'danger')
    return redirect(url_for('guest.my_reviews'))
