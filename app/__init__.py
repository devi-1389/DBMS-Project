import logging
import os

import pymysql
from flask import Flask, render_template, session, request, url_for
from config import Config
from database.connection import close_db, query_db
from app.security import csrf_protect, csrf_field, generate_csrf_token, apply_security_headers

CATEGORY_FALLBACK_IMAGES = {
    'luxury': '/static/images/categories/luxury.svg',
    'nature': '/static/images/categories/nature.svg',
    'adventure': '/static/images/categories/adventure.svg',
    'wellness': '/static/images/categories/wellness.svg',
    'culture': '/static/images/categories/culture.svg',
    'sustainability': '/static/images/categories/sustainability.svg',
}
DEFAULT_IMAGE = '/static/images/categories/default.svg'


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')

    # Teardown database connection
    app.teardown_appcontext(close_db)

    # On Vercel a missing setting would otherwise show up as random log-outs or a database error:
    # explain exactly which environment variable has to be added (names only, never values).
    problems = config_class.deployment_problems()
    if problems:
        @app.before_request
        def _configuration_needed():
            if request.endpoint == 'static':
                return None
            rows = ''.join(f'<li><code>{name}</code> - {purpose}</li>' for name, purpose in problems)
            return (
                '<!doctype html><title>SOLACE - configuration needed</title>'
                '<div style="font-family:system-ui,sans-serif;max-width:640px;margin:12vh auto;padding:0 20px;line-height:1.6">'
                '<h1 style="font-size:1.5rem">SOLACE is deployed, but not configured yet</h1>'
                '<p>Add or correct these settings - in <code>.env</code> on your own computer, or on Vercel under '
                'Project &rarr; Settings &rarr; Environment Variables (then redeploy):</p>'
                f'<ul>{rows}</ul>'
                '<p>The steps are described in <code>docs/DEPLOYMENT_VERCEL.md</code>.</p></div>'
            ), 503

    # Security: CSRF validation for every state-changing request + hardened headers
    app.before_request(csrf_protect)
    app.after_request(apply_security_headers)

    @app.before_request
    def _refresh_session():
        session.permanent = True

    # Register blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.guest_routes import guest_bp
    from app.routes.experience_routes import experience_bp
    from app.routes.booking_routes import booking_bp
    from app.routes.payment_routes import payment_bp
    from app.routes.review_routes import review_bp
    from app.routes.admin_routes import admin_bp
    from app.routes import admin_manage_routes  # noqa: F401  (adds CRUD routes to admin_bp)
    from app.routes.staff_routes import staff_bp
    from app.routes.dbms_routes import dbms_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(guest_bp)
    app.register_blueprint(experience_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(dbms_bp)

    try:
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    except OSError:
        # read-only project folder (serverless hosting): uploaded photos cannot be stored
        app.config['UPLOADS_ENABLED'] = False

    # Root landing page
    @app.route('/')
    def index():
        categories = query_db("""
            SELECT c.*, COUNT(e.experience_id) AS experience_count,
                   MIN(e.base_price) AS from_price
            FROM experience_categories c
            LEFT JOIN experiences e ON e.category_id = c.category_id AND e.is_active = 1
            GROUP BY c.category_id
            ORDER BY c.display_order ASC
        """)
        featured = query_db("""
            SELECT e.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
                   ROUND(AVG(r.rating), 2) AS avg_rating,
                   COUNT(r.review_id) AS total_reviews
            FROM experiences e
            JOIN experience_categories c ON e.category_id = c.category_id
            LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = 1
            WHERE e.is_active = 1
            GROUP BY e.experience_id
            ORDER BY e.eco_impact_score DESC, e.base_price DESC
            LIMIT 6
        """)
        testimonials = query_db("""
            SELECT r.*, u.full_name AS guest_name, e.name AS experience_name, e.slug AS experience_slug
            FROM reviews r
            JOIN guests g ON r.guest_id = g.guest_id
            JOIN users u ON g.guest_id = u.user_id
            JOIN experiences e ON r.experience_id = e.experience_id
            WHERE r.rating >= 4 AND r.is_approved = 1
            ORDER BY r.created_at DESC, r.review_id DESC
            LIMIT 3
        """)
        stats = query_db("""
            SELECT (SELECT COUNT(*) FROM experiences WHERE is_active = 1) AS experiences,
                   (SELECT COUNT(*) FROM suppliers WHERE is_local = 1 AND is_active = 1) AS local_partners,
                   (SELECT ROUND(AVG(eco_impact_score)) FROM experiences WHERE is_active = 1) AS avg_eco,
                   (SELECT COUNT(*) FROM experience_slots
                     WHERE slot_status = 'available' AND slot_date >= CURDATE()) AS open_sessions
        """, one=True)
        return render_template('index.html', categories=categories, featured=featured,
                               testimonials=testimonials, stats=stats)

    # Global template context
    @app.context_processor
    def inject_global_data():
        user = None
        if 'user_id' in session:
            user = {
                'id': session.get('user_id'),
                'name': session.get('full_name'),
                'email': session.get('email'),
                'role': session.get('role_name')
            }
        try:
            nav_categories = query_db("SELECT name, slug, icon FROM experience_categories ORDER BY display_order ASC")
        except pymysql.MySQLError:
            nav_categories = []
        return {
            'current_user': user,
            'nav_categories': nav_categories,
            'resort_name': Config.RESORT_NAME,
            'currency_symbol': Config.CURRENCY_SYMBOL,
            'csrf_field': csrf_field,
            'csrf_token': generate_csrf_token,
            'uploads_enabled': app.config.get('UPLOADS_ENABLED', True),
        }

    # Custom Jinja filters
    @app.template_filter('inr')
    def inr_filter(value):
        try:
            val = float(value)
            return f"₹{val:,.2f}"
        except (ValueError, TypeError):
            return f"₹{value}"

    @app.template_filter('inr0')
    def inr0_filter(value):
        try:
            return f"₹{float(value):,.0f}"
        except (ValueError, TypeError):
            return f"₹{value}"

    @app.template_filter('date_format')
    def date_format_filter(value, fmt='%d %b %Y'):
        if not value:
            return ''
        if hasattr(value, 'strftime'):
            return value.strftime(fmt)
        return str(value)

    @app.template_filter('time_format')
    def time_format_filter(value):
        if value is None or value == '':
            return ''
        if hasattr(value, 'total_seconds'):
            # timedelta object from MySQL TIME
            seconds = int(value.total_seconds())
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            suffix = 'AM' if hours < 12 else 'PM'
            h12 = hours % 12
            if h12 == 0:
                h12 = 12
            return f"{h12:02d}:{minutes:02d} {suffix}"
        if hasattr(value, 'strftime'):
            return value.strftime('%I:%M %p')
        return str(value)

    @app.template_filter('time_input')
    def time_input_filter(value):
        """MySQL TIME (timedelta) -> 'HH:MM' for <input type=time>."""
        if hasattr(value, 'total_seconds'):
            seconds = int(value.total_seconds())
            return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}"
        return str(value or '')[:5]

    @app.template_filter('rating')
    def rating_filter(value):
        if value is None:
            return 'New'
        try:
            return f"{float(value):.1f}"
        except (TypeError, ValueError):
            return 'New'

    @app.template_filter('status_class')
    def status_class_filter(status):
        return {
            'confirmed': 'status-confirmed', 'completed': 'status-completed',
            'cancelled': 'status-cancelled', 'failed': 'status-failed',
            'pending': 'status-pending', 'available': 'status-confirmed',
            'locked': 'status-pending', 'successful': 'status-confirmed',
            'refunded': 'status-completed', 'scheduled': 'status-pending',
            'in_progress': 'status-failed', 'reserved': 'status-confirmed',
            'released': 'status-cancelled', 'assigned': 'status-pending',
            'reassigned': 'status-cancelled',
        }.get(str(status), 'status-pending')

    @app.template_global()
    def asset(filename):
        """static URL with a version stamp (file modification time) so browsers never run stale CSS/JS."""
        try:
            version = int(os.path.getmtime(os.path.join(app.static_folder, filename)))
        except OSError:
            version = 0
        return url_for('static', filename=filename, v=version)

    @app.template_global()
    def fallback_image(category_slug=None):
        return CATEGORY_FALLBACK_IMAGES.get(category_slug or '', DEFAULT_IMAGE)

    @app.template_global()
    def experience_image(exp):
        """Image for an experience row: its stored image_url, else its category artwork."""
        url = (exp.get('image_url') if hasattr(exp, 'get') else None) or ''
        if url:
            return url
        return fallback_image(exp.get('category_slug') if hasattr(exp, 'get') else None)

    # Error Handlers
    def _error(code, title, message):
        return render_template('errors/error.html', error_code=code, error_title=title,
                               error_message=message), code

    @app.errorhandler(400)
    def bad_request(e):
        return _error(400, 'Request could not be processed',
                      getattr(e, 'description', None) or 'The submitted form was invalid. Please try again.')

    @app.errorhandler(403)
    def forbidden(e):
        return _error(403, 'Access restricted', 'You do not have permission to view this page.')

    @app.errorhandler(404)
    def page_not_found(e):
        return _error(404, 'Page not found', 'The experience or page you requested could not be located.')

    @app.errorhandler(405)
    def method_not_allowed(e):
        return _error(405, 'Action not allowed', 'This action must be performed using the buttons on the site.')

    @app.errorhandler(413)
    def too_large(e):
        return _error(413, 'File too large', 'Uploaded files must be 5 MB or smaller.')

    @app.errorhandler(pymysql.MySQLError)
    def database_error(e):
        app.logger.exception('Database error on %s', request.path)
        return _error(503, 'Database unavailable',
                      'The database could not complete this request. Please check that MySQL is running '
                      'and that the connection settings are correct, then try again.')

    @app.errorhandler(500)
    def internal_server_error(e):
        return _error(500, 'Something went wrong', 'An internal system error occurred. Our concierge team is notified.')

    return app
