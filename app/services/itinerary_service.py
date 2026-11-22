from database.connection import query_db, get_db_transaction
from datetime import datetime, timedelta

TIME_BLOCKS = ('morning', 'afternoon', 'evening')
# Hour ranges used to map an experience slot onto an itinerary time block
_BLOCK_HOURS = {'morning': (0, 12), 'afternoon': (12, 17), 'evening': (17, 24)}


def get_or_create_itinerary(guest_id, title=None):
    """Retrieve existing active itinerary or create a new draft itinerary."""
    guest = query_db("""
        SELECT g.*, u.full_name FROM guests g JOIN users u ON u.user_id = g.guest_id
        WHERE g.guest_id = %s
    """, (guest_id,), one=True)
    if not guest:
        return None

    itin = query_db("""
        SELECT * FROM itineraries
        WHERE guest_id = %s AND status IN ('draft', 'saved')
        ORDER BY created_at DESC LIMIT 1
    """, (guest_id,), one=True)

    if not itin:
        start_date = guest['check_in_date'] or datetime.now().date()
        end_date = guest['check_out_date'] or (start_date + timedelta(days=3))
        if end_date < start_date:
            end_date = start_date
        first_name = (guest['full_name'] or 'Guest').split()[0]
        title = title or f"{first_name}'s Solace Stay Itinerary"

        with get_db_transaction() as cursor:
            cursor.execute("""
                INSERT INTO itineraries (guest_id, title, start_date, end_date, total_budget, estimated_cost, status)
                VALUES (%s, %s, %s, %s, %s, 0.00, 'draft')
            """, (guest_id, title, start_date, end_date, guest['budget']))
            new_id = cursor.lastrowid

        itin = query_db("SELECT * FROM itineraries WHERE itinerary_id = %s", (new_id,), one=True)

    return itin


def get_itinerary_details(itinerary_id):
    """Fetch complete itinerary structure with items grouped by day and time block."""
    itin = query_db("SELECT * FROM itineraries WHERE itinerary_id = %s", (itinerary_id,), one=True)
    if not itin:
        return None, []

    items_sql = """
        SELECT ii.*, e.name AS experience_name, e.slug, e.pricing_type, e.base_price,
               e.duration_minutes, e.image_url, c.name AS category_name, c.icon AS category_icon,
               c.slug AS category_slug,
               es.slot_date, es.start_time, es.end_time, es.slot_status,
               (es.max_capacity - es.booked_capacity) AS available_capacity,
               (TIMESTAMP(es.slot_date, es.start_time) > NOW()) AS slot_is_future
        FROM itinerary_items ii
        JOIN experiences e ON ii.experience_id = e.experience_id
        JOIN experience_categories c ON e.category_id = c.category_id
        LEFT JOIN experience_slots es ON ii.slot_id = es.slot_id
        WHERE ii.itinerary_id = %s
        ORDER BY ii.day_number ASC,
                 FIELD(ii.time_block, 'morning', 'afternoon', 'evening'),
                 es.start_time ASC
    """
    items = query_db(items_sql, (itinerary_id,))

    cumulative_cost = 0.0
    for item in items:
        cumulative_cost += float(item['estimated_cost'])
        item['cumulative_cost'] = cumulative_cost

    return itin, items


def block_for_hour(hour):
    """Map a session start hour onto the itinerary's morning / afternoon / evening blocks."""
    for block, (start_h, end_h) in _BLOCK_HOURS.items():
        if start_h <= hour < end_h:
            return block
    return 'evening'


def _hour(value):
    if isinstance(value, timedelta):  # PyMySQL returns MySQL/MariaDB TIME as timedelta
        return int(value.total_seconds()) // 3600
    return value.hour


def _fmt_time(value):
    secs = int(value.total_seconds()) if isinstance(value, timedelta) else value.hour * 3600 + value.minute * 60
    h, m = secs // 3600, (secs % 3600) // 60
    return f"{(h % 12) or 12:02d}:{m:02d} {'AM' if h < 12 else 'PM'}"


def sessions_for_day(experience_id, day_date):
    """Scheduled sessions of an experience on a given date, with remaining capacity and time block."""
    rows = query_db("""
        SELECT es.slot_id, es.start_time, es.end_time, es.slot_status,
               (es.max_capacity - es.booked_capacity) AS available,
               (TIMESTAMP(es.slot_date, es.start_time) > NOW()) AS is_future,
               e.pricing_type
        FROM experience_slots es
        JOIN experiences e ON e.experience_id = es.experience_id
        WHERE es.experience_id = %s AND es.slot_date = %s AND es.slot_status <> 'cancelled'
        ORDER BY es.start_time
    """, (experience_id, day_date))
    return [{
        'slot_id': r['slot_id'],
        'start': _fmt_time(r['start_time']),
        'end': _fmt_time(r['end_time']),
        'time_block': block_for_hour(_hour(r['start_time'])),
        'available': int(r['available']),
        'unit': 'spot' if r['pricing_type'] == 'per_person' else 'private booking',
        'bookable': bool(r['is_future']) and r['slot_status'] == 'available' and r['available'] > 0,
    } for r in rows]


def _match_slot(experience_id, slot_date, time_block):
    """Find a bookable slot of the experience on that date within the chosen time block."""
    start_h, end_h = _BLOCK_HOURS[time_block]
    return query_db("""
        SELECT slot_id FROM experience_slots
        WHERE experience_id = %s AND slot_date = %s AND slot_status = 'available'
          AND HOUR(start_time) >= %s AND HOUR(start_time) < %s
        ORDER BY start_time ASC LIMIT 1
    """, (experience_id, slot_date, start_h, end_h), one=True)


def add_item_to_itinerary(itinerary_id, experience_id, slot_id, day_number, time_block, notes=None):
    """
    Add experience to itinerary after validating schedule conflict and budget limit.
    If no slot is given, the matching scheduled slot for that day/time block is linked
    automatically so the guest can book it straight from the itinerary.
    """
    if time_block not in TIME_BLOCKS:
        return False, "Invalid time block."

    itin = query_db("SELECT * FROM itineraries WHERE itinerary_id = %s", (itinerary_id,), one=True)
    if not itin:
        return False, "Itinerary not found."

    num_days = (itin['end_date'] - itin['start_date']).days + 1
    if day_number < 1 or day_number > num_days:
        return False, f"Day must be between 1 and {num_days} for this itinerary."

    guest = query_db("SELECT * FROM guests WHERE guest_id = %s", (itin['guest_id'],), one=True)
    party_size = guest['party_size'] if guest else 1

    exp = query_db("SELECT * FROM experiences WHERE experience_id = %s AND is_active = 1", (experience_id,), one=True)
    if not exp:
        return False, "Experience not found."

    day_date = itin['start_date'] + timedelta(days=day_number - 1)
    if day_date < datetime.now().date():
        return False, f"Day {day_number} ({day_date:%d %b}) is already in the past. Choose a later day or edit your itinerary dates."
    if slot_id:
        slot = query_db("""SELECT slot_id, experience_id, slot_date, start_time, slot_status,
                                  (max_capacity - booked_capacity) AS available,
                                  (TIMESTAMP(slot_date, start_time) > NOW()) AS is_future
                           FROM experience_slots WHERE slot_id = %s""", (slot_id,), one=True)
        if not slot or slot['experience_id'] != exp['experience_id']:
            return False, "The selected session does not belong to this experience."
        if slot['slot_date'] != day_date:
            return False, f"The selected session is on {slot['slot_date']:%d %b}, not on Day {day_number} ({day_date:%d %b})."
        if slot['slot_status'] != 'available':
            return False, f"The selected session is {slot['slot_status']} and cannot be planned."
        if not slot['is_future']:
            return False, "The selected session has already started. Please choose a later session."
        if slot['available'] <= 0:
            return False, "The selected session is fully booked. Please choose another session."
        # The session's start time decides the time block, so the plan always matches the real schedule
        time_block = block_for_hour(_hour(slot['start_time']))
    else:
        match = _match_slot(experience_id, day_date, time_block)
        slot_id = match['slot_id'] if match else None

    existing = query_db("""
        SELECT item_id FROM itinerary_items
        WHERE itinerary_id = %s AND day_number = %s AND time_block = %s
    """, (itinerary_id, day_number, time_block), one=True)
    if existing:
        return False, f"You already have an activity scheduled for Day {day_number} ({time_block}). Please remove or replace it first."

    cost = float(exp['base_price']) * party_size if exp['pricing_type'] == 'per_person' else float(exp['base_price'])

    current_cost = float(itin['estimated_cost'])
    total_budget = float(itin['total_budget'])
    if (current_cost + cost) > total_budget and total_budget > 0:
        return False, f"Adding this activity exceeds your total budget of ₹{total_budget:,.0f} (Current: ₹{current_cost:,.0f}, Activity: ₹{cost:,.0f})."

    with get_db_transaction() as cursor:
        cursor.execute("""
            INSERT INTO itinerary_items (itinerary_id, experience_id, slot_id, day_number, time_block, estimated_cost, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (itinerary_id, experience_id, slot_id, day_number, time_block, cost, notes))
        cursor.execute("""
            UPDATE itineraries
            SET estimated_cost = estimated_cost + %s
            WHERE itinerary_id = %s
        """, (cost, itinerary_id))

    if slot_id:
        return True, "Experience added to your itinerary and linked to a scheduled session - you can book it directly."
    return True, "Experience added to your itinerary. No scheduled session matches that day/time yet - pick a slot from the experience page."


def remove_item_from_itinerary(item_id, itinerary_id):
    """Remove an item and re-calculate cost."""
    item = query_db("""
        SELECT * FROM itinerary_items
        WHERE item_id = %s AND itinerary_id = %s
    """, (item_id, itinerary_id), one=True)
    if not item:
        return False, "Itinerary item not found."

    with get_db_transaction() as cursor:
        cursor.execute("DELETE FROM itinerary_items WHERE item_id = %s", (item_id,))
        cursor.execute("""
            UPDATE itineraries
            SET estimated_cost = (
                SELECT COALESCE(SUM(estimated_cost), 0.00)
                FROM itinerary_items
                WHERE itinerary_id = %s
            )
            WHERE itinerary_id = %s
        """, (itinerary_id, itinerary_id))

    return True, "Activity removed from itinerary."


def update_itinerary(itinerary_id, title, start_date, end_date, total_budget):
    """Edit itinerary header details. Items scheduled beyond the new length are rejected."""
    if end_date < start_date:
        return False, "End date cannot be before the start date."
    num_days = (end_date - start_date).days + 1
    if num_days > 30:
        return False, "An itinerary can span at most 30 days."
    beyond = query_db("""
        SELECT COUNT(*) AS n FROM itinerary_items WHERE itinerary_id = %s AND day_number > %s
    """, (itinerary_id, num_days), one=True)
    if beyond and beyond['n']:
        return False, f"{beyond['n']} planned activit{'y is' if beyond['n'] == 1 else 'ies are'} scheduled after day {num_days}. Remove them first."
    with get_db_transaction() as cursor:
        cursor.execute("""
            UPDATE itineraries
            SET title = %s, start_date = %s, end_date = %s, total_budget = %s, status = 'saved'
            WHERE itinerary_id = %s
        """, (title, start_date, end_date, total_budget, itinerary_id))
    return True, "Itinerary details saved."
