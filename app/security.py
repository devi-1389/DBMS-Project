"""
Security helpers: CSRF protection, safe redirects, security headers and
input validation utilities shared by all blueprints.
"""
import hmac
import re
import secrets
from datetime import date, datetime
from urllib.parse import urlparse

from flask import abort, current_app, flash, request, session
from markupsafe import Markup

CSRF_SESSION_KEY = '_csrf_token'
CSRF_FORM_FIELD = 'csrf_token'
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$')


# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------
def generate_csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def csrf_field():
    """Jinja helper rendering the hidden CSRF input for a form."""
    return Markup(f'<input type="hidden" name="{CSRF_FORM_FIELD}" value="{generate_csrf_token()}">')


def csrf_protect():
    """before_request hook: every state-changing request must carry a valid token."""
    if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
        return
    if not current_app.config.get('CSRF_ENABLED', True):
        return
    expected = session.get(CSRF_SESSION_KEY)
    supplied = request.form.get(CSRF_FORM_FIELD) or request.headers.get('X-CSRF-Token')
    if not expected or not supplied or not hmac.compare_digest(expected, supplied):
        abort(400, description='CSRF token missing or invalid. Please reload the page and try again.')


def apply_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response


def is_safe_redirect(target):
    """Only allow relative, same-site paths such as '/guest/dashboard'."""
    if not target:
        return False
    parsed = urlparse(target)
    return not parsed.scheme and not parsed.netloc and target.startswith('/') and not target.startswith('//')


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------
class ValidationError(ValueError):
    """Raised when user input fails validation; the message is safe to show."""


def parse_int(value, field, default=None, min_value=None, max_value=None):
    if value is None or str(value).strip() == '':
        if default is None:
            raise ValidationError(f'{field} is required.')
        return default
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValidationError(f'{field} must be a whole number.')
    if min_value is not None and number < min_value:
        raise ValidationError(f'{field} must be at least {min_value}.')
    if max_value is not None and number > max_value:
        raise ValidationError(f'{field} must be at most {max_value}.')
    return number


def parse_float(value, field, default=None, min_value=None, max_value=None):
    if value is None or str(value).strip() == '':
        if default is None:
            raise ValidationError(f'{field} is required.')
        return default
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        raise ValidationError(f'{field} must be a number.')
    if number != number or number in (float('inf'), float('-inf')):
        raise ValidationError(f'{field} must be a finite number.')
    if min_value is not None and number < min_value:
        raise ValidationError(f'{field} must be at least {min_value:,.0f}.')
    if max_value is not None and number > max_value:
        raise ValidationError(f'{field} must be at most {max_value:,.0f}.')
    return number


def parse_date(value, field, required=False):
    if value is None or str(value).strip() == '':
        if required:
            raise ValidationError(f'{field} is required.')
        return None
    try:
        return datetime.strptime(str(value).strip(), '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError(f'{field} must be a valid date (YYYY-MM-DD).')


def parse_time(value, field):
    try:
        return datetime.strptime(str(value).strip()[:5], '%H:%M').time()
    except (TypeError, ValueError):
        raise ValidationError(f'{field} must be a valid time (HH:MM).')


def require_text(value, field, max_length=255, required=True):
    text = (value or '').strip()
    if required and not text:
        raise ValidationError(f'{field} is required.')
    if len(text) > max_length:
        raise ValidationError(f'{field} must be at most {max_length} characters.')
    return text


def require_choice(value, field, choices, default=None):
    if (value is None or value == '') and default is not None:
        return default
    if value not in choices:
        raise ValidationError(f'Invalid value for {field}.')
    return value


def validate_email(value):
    email = (value or '').strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 150:
        raise ValidationError('Please enter a valid email address.')
    return email


def validate_password(password, confirm=None):
    if len(password or '') < 8:
        raise ValidationError('Password must be at least 8 characters long.')
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        raise ValidationError('Password must contain at least one letter and one number.')
    if confirm is not None and password != confirm:
        raise ValidationError('Passwords do not match.')
    return password


def flash_validation(err):
    flash(str(err), 'danger')


def today():
    return date.today()
