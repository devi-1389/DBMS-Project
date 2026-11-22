from flask import Blueprint, render_template, request, abort
from database.connection import query_db
from app.security import ValidationError, parse_date

experience_bp = Blueprint('experience', __name__)

SORT_OPTIONS = {
    'recommended': "c.display_order ASC, e.experience_id ASC",
    'price_asc': "e.base_price ASC",
    'price_desc': "e.base_price DESC",
    'rating': "avg_rating IS NULL, avg_rating DESC, total_reviews DESC",
    'eco': "e.eco_impact_score DESC",
    'duration': "e.duration_minutes ASC",
}


@experience_bp.route('/experiences')
def catalogue():
    category_slug = request.args.get('category') or None
    search_q = request.args.get('q', '').strip()[:100]
    sort_by = request.args.get('sort', 'recommended')
    if sort_by not in SORT_OPTIONS:
        sort_by = 'recommended'
    eco_filter = request.args.get('eco_only') == '1'
    max_price = request.args.get('max_price', '').strip()
    try:
        on_date = parse_date(request.args.get('date'), 'Date')
    except ValidationError:
        on_date = None

    categories = query_db("""
        SELECT c.*, COUNT(e.experience_id) AS experience_count
        FROM experience_categories c
        LEFT JOIN experiences e ON c.category_id = e.category_id AND e.is_active = 1
        GROUP BY c.category_id
        ORDER BY c.display_order ASC
    """)

    sql = """
        SELECT e.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               s.name AS supplier_name, s.is_local AS supplier_is_local,
               ROUND(AVG(r.rating), 2) AS avg_rating,
               COUNT(r.review_id) AS total_reviews,
               (SELECT COUNT(*) FROM experience_slots es
                 WHERE es.experience_id = e.experience_id AND es.slot_status = 'available'
                   AND es.booked_capacity < es.max_capacity
                   AND TIMESTAMP(es.slot_date, es.start_time) > NOW()) AS open_slots
        FROM experiences e
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
        LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = 1
        WHERE e.is_active = 1
    """
    params = []

    if category_slug:
        sql += " AND c.slug = %s"
        params.append(category_slug)

    if search_q:
        sql += " AND (e.name LIKE %s OR e.short_desc LIKE %s OR e.full_desc LIKE %s OR c.name LIKE %s)"
        like_term = f"%{search_q}%"
        params.extend([like_term] * 4)

    if eco_filter:
        sql += " AND e.is_low_impact = 1 AND e.eco_impact_score >= 90"

    if max_price.isdigit():
        sql += " AND e.base_price <= %s"
        params.append(float(max_price))

    if on_date:
        sql += """ AND EXISTS (SELECT 1 FROM experience_slots d
                               WHERE d.experience_id = e.experience_id AND d.slot_date = %s
                                 AND d.slot_status = 'available' AND d.booked_capacity < d.max_capacity)"""
        params.append(on_date)

    sql += " GROUP BY e.experience_id ORDER BY " + SORT_OPTIONS[sort_by]
    experiences = query_db(sql, tuple(params))

    return render_template(
        'experiences/catalogue.html',
        categories=categories,
        experiences=experiences,
        active_category=category_slug,
        search_query=search_q,
        active_sort=sort_by,
        eco_filter=eco_filter,
        max_price=max_price,
        on_date=on_date,
    )


@experience_bp.route('/experiences/<slug>')
def detail(slug):
    experience = query_db("""
        SELECT e.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               s.supplier_id, s.name AS supplier_name, s.supplier_type, s.is_local AS supplier_is_local,
               s.products_services AS supplier_products,
               ROUND(AVG(r.rating), 2) AS avg_rating,
               COUNT(r.review_id) AS total_reviews
        FROM experiences e
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
        LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = 1
        WHERE e.slug = %s AND e.is_active = 1
        GROUP BY e.experience_id
    """, (slug,), one=True)
    if not experience:
        abort(404)
    exp_id = experience['experience_id']

    slots = query_db("""
        SELECT es.*, (es.max_capacity - es.booked_capacity) AS available_capacity
        FROM experience_slots es
        WHERE es.experience_id = %s
          AND es.slot_status = 'available'
          AND TIMESTAMP(es.slot_date, es.start_time) > NOW()
        ORDER BY es.slot_date ASC, es.start_time ASC
        LIMIT 21
    """, (exp_id,))

    resources = query_db("""
        SELECT er.*, r.name AS resource_name, r.resource_type, r.is_sustainable, r.eco_notes, r.condition_status
        FROM experience_resources er
        JOIN resources r ON er.resource_id = r.resource_id
        WHERE er.experience_id = %s
    """, (exp_id,))

    staff_reqs = query_db("SELECT * FROM experience_staff_requirements WHERE experience_id = %s", (exp_id,))

    reviews = query_db("""
        SELECT r.*, u.full_name AS guest_name
        FROM reviews r
        JOIN guests g ON r.guest_id = g.guest_id
        JOIN users u ON g.guest_id = u.user_id
        WHERE r.experience_id = %s AND r.is_approved = 1
        ORDER BY r.created_at DESC
    """, (exp_id,))

    rating_breakdown = {row['rating']: row['n'] for row in query_db("""
        SELECT rating, COUNT(*) AS n FROM reviews
        WHERE experience_id = %s AND is_approved = 1 GROUP BY rating
    """, (exp_id,))}

    related = query_db("""
        SELECT e.experience_id, e.name, e.slug, e.image_url, e.base_price, e.pricing_type,
               e.duration_minutes, c.slug AS category_slug, c.name AS category_name
        FROM experiences e
        JOIN experience_categories c ON c.category_id = e.category_id
        WHERE e.category_id = %s AND e.experience_id <> %s AND e.is_active = 1
        ORDER BY e.eco_impact_score DESC LIMIT 3
    """, (experience['category_id'], exp_id))

    return render_template(
        'experiences/detail.html',
        experience=experience,
        slots=slots,
        resources=resources,
        staff_requirements=staff_reqs,
        reviews=reviews,
        rating_breakdown=rating_breakdown,
        related=related,
    )
