import logging

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from database.connection import query_db, get_db_transaction
from app.security import (
    ValidationError, is_safe_redirect, parse_date, parse_float, parse_int,
    require_choice, require_text, validate_email, validate_password,
)

auth_bp = Blueprint('auth', __name__)
log = logging.getLogger(__name__)

ROLE_HOME = {'admin': 'admin.dashboard', 'staff': 'staff.dashboard', 'guest': 'guest.dashboard'}


def home_for_role(role):
    return url_for(ROLE_HOME.get(role, 'guest.dashboard'))


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('auth.login', next=request.full_path.rstrip('?') if request.method == 'GET' else None))
        return f(*args, **kwargs)
    return decorated_function


def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please log in to continue.', 'warning')
                return redirect(url_for('auth.login'))
            user_role = session.get('role_name')
            if user_role not in allowed_roles:
                flash('Access denied. You do not have permissions for this resource.', 'danger')
                return redirect(home_for_role(user_role))
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def _start_session(user):
    # Prevent session fixation: discard anything stored before authentication.
    session.clear()
    session.permanent = True
    session['user_id'] = user['user_id']
    session['full_name'] = user['full_name']
    session['email'] = user['email']
    session['role_name'] = user['role_name']


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(home_for_role(session.get('role_name')))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        if not email or not password:
            flash('Please enter both email and password.', 'danger')
            return render_template('auth/login.html', email=email), 400

        user = query_db("""
            SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, r.name AS role_name
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.email = %s
        """, (email,), one=True)

        if not user or not check_password_hash(user['password_hash'], password):
            flash('Invalid email or password. Please verify your credentials.', 'danger')
            return render_template('auth/login.html', email=email), 401

        if not user['is_active']:
            flash('Your account has been deactivated. Please contact resort management.', 'danger')
            return render_template('auth/login.html', email=email), 403

        _start_session(user)
        flash(f'Welcome back, {user["full_name"]}!', 'success')

        next_page = request.args.get('next')
        if is_safe_redirect(next_page):
            return redirect(next_page)
        return redirect(home_for_role(user['role_name']))

    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(home_for_role(session.get('role_name')))

    if request.method == 'POST':
        form = request.form
        try:
            full_name = require_text(form.get('full_name'), 'Full name', 120)
            email = validate_email(form.get('email'))
            phone = require_text(form.get('phone'), 'Phone', 30, required=False)
            password = validate_password(form.get('password', ''), form.get('confirm_password', ''))
            party_size = parse_int(form.get('party_size'), 'Party size', default=2, min_value=1, max_value=25)
            budget = parse_float(form.get('budget'), 'Budget', default=35000.0, min_value=0, max_value=10_000_000)
            check_in = parse_date(form.get('check_in_date'), 'Check-in date')
            check_out = parse_date(form.get('check_out_date'), 'Check-out date')
            time_pref = require_choice(form.get('preferred_time_of_day'), 'Preferred time',
                                       ('morning', 'afternoon', 'evening', 'any'), default='any')
            if check_in and check_out and check_out < check_in:
                raise ValidationError('Check-out date cannot be before the check-in date.')
        except ValidationError as err:
            flash(str(err), 'danger')
            return render_template('auth/register.html', form=form), 400

        if query_db("SELECT user_id FROM users WHERE email = %s", (email,), one=True):
            flash('An account with this email address already exists. Please log in.', 'warning')
            return redirect(url_for('auth.login'))

        try:
            with get_db_transaction() as cursor:
                cursor.execute("SELECT role_id FROM roles WHERE name = 'guest'")
                guest_role = cursor.fetchone()
                cursor.execute("""
                    INSERT INTO users (role_id, full_name, email, phone, password_hash, is_active)
                    VALUES (%s, %s, %s, %s, %s, 1)
                """, (guest_role['role_id'], full_name, email, phone, generate_password_hash(password)))
                user_id = cursor.lastrowid

                cursor.execute("""
                    INSERT INTO guests (guest_id, party_size, budget, check_in_date, check_out_date, preferred_time_of_day)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (user_id, party_size, budget, check_in, check_out, time_pref))

                # Seed neutral (3/5) preference weights for every master interest
                cursor.execute("""
                    INSERT INTO guest_preferences (guest_id, interest_id, weight)
                    SELECT %s, interest_id, 3 FROM interests
                """, (user_id,))
        except Exception:
            log.exception('Registration failed for %s', email)
            flash('We could not complete your registration right now. Please try again.', 'danger')
            return render_template('auth/register.html', form=form), 500

        _start_session({'user_id': user_id, 'full_name': full_name, 'email': email, 'role_name': 'guest'})
        flash('Registration successful! Welcome to Solace Resort. Tell us what you love so we can personalise your stay.', 'success')
        return redirect(url_for('guest.preferences'))

    return render_template('auth/register.html', form={})


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    flash('You have been safely logged out. We look forward to welcoming you back.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/account/password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        user = query_db("SELECT password_hash FROM users WHERE user_id = %s", (session['user_id'],), one=True)
        if not user or not check_password_hash(user['password_hash'], request.form.get('current_password', '')):
            flash('Your current password is incorrect.', 'danger')
            return render_template('auth/change_password.html'), 400
        try:
            new_password = validate_password(request.form.get('new_password', ''), request.form.get('confirm_password', ''))
        except ValidationError as err:
            flash(str(err), 'danger')
            return render_template('auth/change_password.html'), 400
        with get_db_transaction() as cursor:
            cursor.execute("UPDATE users SET password_hash = %s WHERE user_id = %s",
                           (generate_password_hash(new_password), session['user_id']))
        flash('Your password has been updated.', 'success')
        return redirect(home_for_role(session.get('role_name')))
    return render_template('auth/change_password.html')
