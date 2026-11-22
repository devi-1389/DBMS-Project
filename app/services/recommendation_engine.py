from database.connection import query_db
from config import Config
from datetime import datetime, time, timedelta

NEUTRAL_RATING_PRIOR = 3.5

def get_guest_profile_and_preferences(guest_id):
    """Fetch guest profile parameters and weighted interest preferences."""
    guest_sql = """
        SELECT g.guest_id, u.full_name, u.email, g.party_size, g.budget,
               g.check_in_date, g.check_out_date, g.preferred_time_of_day,
               g.accessibility_notes, g.sustainability_priority
        FROM guests g
        JOIN users u ON g.guest_id = u.user_id
        WHERE g.guest_id = %s
    """
    guest = query_db(guest_sql, (guest_id,), one=True)
    if not guest:
        return None, {}
        
    pref_sql = """
        SELECT i.category_tag, i.name AS interest_name, gp.weight
        FROM guest_preferences gp
        JOIN interests i ON gp.interest_id = i.interest_id
        WHERE gp.guest_id = %s
    """
    prefs = query_db(pref_sql, (guest_id,))
    pref_map = {p['category_tag']: p['weight'] for p in prefs}
    
    return guest, pref_map


def get_guest_spent_amount(guest_id):
    """Calculate already committed expenditure from confirmed bookings."""
    spent_sql = """
        SELECT COALESCE(SUM(total_amount), 0.00) AS total_spent
        FROM bookings
        WHERE guest_id = %s AND booking_status IN ('confirmed', 'pending')
    """
    row = query_db(spent_sql, (guest_id,), one=True)
    return float(row['total_spent']) if row else 0.0


def calculate_match_score(experience, guest, pref_map, slot, remaining_budget):
    """
    Computes normalized score (0.0 - 1.0) and generates a detailed reason.
    """
    w_interest = Config.WEIGHT_INTEREST
    w_budget = Config.WEIGHT_BUDGET
    w_sched = Config.WEIGHT_SCHEDULE
    w_sust = Config.WEIGHT_SUSTAINABILITY
    w_rating = Config.WEIGHT_RATING
    
    # 1. Interest Score (0.2 to 1.0 based on 1-5 scale)
    cat_slug = experience['category_slug']
    user_weight = pref_map.get(cat_slug, 3) # default neutral 3
    interest_score = user_weight / 5.0
    
    # 2. Budget Score
    # Cost for guest's party size
    if experience['pricing_type'] == 'per_person':
        total_cost = float(experience['base_price']) * guest['party_size']
    else:
        total_cost = float(experience['base_price'])
        
    if remaining_budget <= 0:
        budget_score = 0.1
    elif total_cost > remaining_budget:
        budget_score = 0.0
    else:
        # Sweet spot: 10% - 60% of remaining budget receives highest scores
        ratio = total_cost / remaining_budget
        if ratio <= 0.60:
            budget_score = 1.0 - (ratio * 0.4) # between 0.76 and 1.0
        else:
            budget_score = max(0.2, 1.0 - ratio)
            
    # 3. Schedule Suitability
    # Determine slot time of day
    slot_time_obj = None
    if isinstance(slot['start_time'], str):
        slot_time_obj = datetime.strptime(slot['start_time'], '%H:%M:%S').time()
    elif isinstance(slot['start_time'], time):
        slot_time_obj = slot['start_time']
    elif isinstance(slot['start_time'], timedelta):  # PyMySQL returns MySQL TIME as timedelta
        slot_time_obj = (datetime.min + slot['start_time']).time()

    hour = slot_time_obj.hour if slot_time_obj else 12
    if hour < 12:
        slot_block = 'morning'
    elif hour < 17:
        slot_block = 'afternoon'
    else:
        slot_block = 'evening'
        
    pref_tod = guest.get('preferred_time_of_day', 'any')
    if pref_tod == 'any' or pref_tod == slot_block:
        schedule_score = 1.0
    else:
        schedule_score = 0.5
        
    # 4. Sustainability Score (0.0 to 1.0)
    eco_raw = float(experience['eco_impact_score']) / 100.0
    bonus = 0.05 if experience.get('supplier_is_local') else 0.0
    sust_score = min(1.0, eco_raw + bonus)
    
    # 5. Rating Score (0.0 to 1.0)
    # Experiences without approved reviews get a neutral prior of 3.5/5 for ranking
    # purposes only; the UI shows them as "New" rather than inventing a rating.
    avg_rating = experience.get('avg_rating')
    avg_rating = float(avg_rating) if avg_rating is not None else NEUTRAL_RATING_PRIOR
    rating_score = avg_rating / 5.0
    
    # Combined Composite Weighted Score
    composite_score = (
        (w_interest * interest_score) +
        (w_budget * budget_score) +
        (w_sched * schedule_score) +
        (w_sust * sust_score) +
        (w_rating * rating_score)
    )
    
    # Construct descriptive rationale
    reasons = []
    if user_weight >= 4:
        reasons.append(f"Directly aligns with your high passion for {experience['category_name']} (rated {user_weight}/5)")
    else:
        reasons.append(f"Offers a curated introduction to {experience['category_name']}")
        
    if schedule_score == 1.0 and pref_tod != 'any':
        reasons.append(f"Fits your preferred {pref_tod} schedule perfectly")
        
    if total_cost <= (remaining_budget * 0.3):
        reasons.append(f"Comfortably within budget (₹{total_cost:,.0f} vs ₹{remaining_budget:,.0f} remaining)")
    else:
        reasons.append(f"Premium investment (₹{total_cost:,.0f} for {guest['party_size']} guest(s))")
        
    if experience['eco_impact_score'] >= 95:
        reasons.append(f"Exceptional eco-impact score of {experience['eco_impact_score']}/100")
        
    if experience.get('supplier_is_local'):
        reasons.append(f"Proudly supports local artisan partner '{experience['supplier_name']}'")
        
    explanation = ". ".join(reasons) + "."
    
    return round(composite_score * 100, 1), explanation, {
        'interest_score': round(interest_score * 100, 1),
        'budget_score': round(budget_score * 100, 1),
        'schedule_score': round(schedule_score * 100, 1),
        'sustainability_score': round(sust_score * 100, 1),
        'rating_score': round(rating_score * 100, 1),
        'total_cost': total_cost,
        'slot_block': slot_block
    }


def get_personalized_recommendations(guest_id, max_results=10):
    """
    Main recommendation engine function:
    1. Retrieves guest preferences & budget.
    2. Enforces hard eligibility constraints.
    3. Computes weighted matching score.
    4. Ranks and explains results.
    """
    guest, pref_map = get_guest_profile_and_preferences(guest_id)
    if not guest:
        return []
        
    party_size = guest['party_size']
    total_budget = float(guest['budget'])
    spent_so_far = get_guest_spent_amount(guest_id)
    remaining_budget = max(0.0, total_budget - spent_so_far)
    
    check_in = guest.get('check_in_date')
    check_out = guest.get('check_out_date')
    
    # Query candidate experiences that are active
    exp_sql = """
        SELECT e.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               s.name AS supplier_name, s.is_local AS supplier_is_local,
               ROUND(AVG(r.rating), 2) AS avg_rating,
               COUNT(r.review_id) AS total_reviews
        FROM experiences e
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
        LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = 1
        WHERE e.is_active = 1
          AND %s BETWEEN e.min_party_size AND e.max_party_size
        GROUP BY e.experience_id
    """
    experiences = query_db(exp_sql, (party_size,))
    
    recommendations = []
    
    for exp in experiences:
        # Check pricing against remaining budget
        price = float(exp['base_price'])
        exp_total_cost = price * party_size if exp['pricing_type'] == 'per_person' else price
        
        # Hard constraint: Do not recommend experiences that exceed remaining budget
        if exp_total_cost > remaining_budget and remaining_budget > 0:
            continue
            
        # Find next available eligible slot within trip dates
        units = party_size if exp['pricing_type'] == 'per_person' else 1
        slot_sql = """
            SELECT es.*
            FROM experience_slots es
            WHERE es.experience_id = %s
              AND es.slot_status = 'available'
              AND (es.max_capacity - es.booked_capacity) >= %s
              AND TIMESTAMP(es.slot_date, es.start_time) > NOW()
        """
        params = [exp['experience_id'], units]
        
        if check_in and check_out:
            slot_sql += " AND es.slot_date BETWEEN %s AND %s"
            params.extend([check_in, check_out])
            
        slot_sql += " ORDER BY es.slot_date ASC, es.start_time ASC LIMIT 1"
        
        slot = query_db(slot_sql, tuple(params), one=True)
        if not slot:
            # If no slot within exact dates, check future slots
            fallback_slot = query_db("""
                SELECT es.* FROM experience_slots es
                WHERE es.experience_id = %s AND es.slot_status = 'available'
                  AND (es.max_capacity - es.booked_capacity) >= %s
                  AND TIMESTAMP(es.slot_date, es.start_time) > NOW()
                ORDER BY es.slot_date ASC, es.start_time ASC LIMIT 1
            """, (exp['experience_id'], units), one=True)
            if not fallback_slot:
                continue
            slot = fallback_slot
            
        score, reason, breakdown = calculate_match_score(exp, guest, pref_map, slot, remaining_budget)
        
        recommendations.append({
            'experience': exp,
            'slot': slot,
            'match_score': score,
            'reason': reason,
            'breakdown': breakdown,
            'estimated_cost': exp_total_cost
        })
        
    # Sort recommendations by match_score descending
    recommendations.sort(key=lambda x: x['match_score'], reverse=True)
    return recommendations[:max_results]
