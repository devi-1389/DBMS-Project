from database.connection import query_db


def capacity_units(pricing_type, party_size):
    """
    Slot capacity is measured in "capacity units":
      * per_person experiences consume one unit per guest;
      * per_booking (private / exclusive) experiences consume one unit per booking,
        e.g. one cliff-side gazebo or one solar buggy regardless of party size.
    """
    return int(party_size) if pricing_type == 'per_person' else 1


def _fetch_all(cursor, sql, args):
    if cursor:
        cursor.execute(sql, args)
        return cursor.fetchall()
    return query_db(sql, args)


def _fetch_one(cursor, sql, args):
    if cursor:
        cursor.execute(sql, args)
        return cursor.fetchone()
    return query_db(sql, args, one=True)


def check_slot_availability(slot_id, party_size, cursor=None):
    """
    Check if a specific experience time slot has sufficient capacity for the party size.
    Uses SELECT ... FOR UPDATE when running within an active transaction.
    """
    sql = """
        SELECT es.slot_id, es.experience_id, es.slot_date, es.start_time, es.end_time,
               es.max_capacity, es.booked_capacity, es.slot_status,
               TIMESTAMP(es.slot_date, es.start_time) < NOW() AS has_started,
               e.name AS experience_name, e.base_price, e.pricing_type, e.is_active,
               e.min_party_size, e.max_party_size
        FROM experience_slots es
        JOIN experiences e ON es.experience_id = e.experience_id
        WHERE es.slot_id = %s
    """
    if cursor:
        sql += " FOR UPDATE"
    slot = _fetch_one(cursor, sql, (slot_id,))

    if not slot:
        return False, "Selected time slot does not exist.", None

    if not slot['is_active']:
        return False, "This experience is currently not available for booking.", slot

    if slot['slot_status'] != 'available':
        return False, f"This time slot is marked as {slot['slot_status']}.", slot

    if slot['has_started']:
        return False, "This time slot has already started and can no longer be booked.", slot

    if party_size < slot['min_party_size'] or party_size > slot['max_party_size']:
        return False, f"Party size ({party_size}) must be between {slot['min_party_size']} and {slot['max_party_size']} for this experience.", slot

    units = capacity_units(slot['pricing_type'], party_size)
    available_capacity = slot['max_capacity'] - slot['booked_capacity']
    if available_capacity < units:
        label = 'spot(s)' if slot['pricing_type'] == 'per_person' else 'private booking(s)'
        return False, f"Only {available_capacity} {label} remaining for this slot (requested: {units}).", slot

    return True, "Slot is available.", slot


def check_resource_availability(experience_id, slot_id, party_size, cursor=None):
    """
    Verify that all equipment, vehicles, gear, and venues required by the experience
    have sufficient non-reserved inventory for this slot.
    """
    requirements = _fetch_all(cursor, """
        SELECT er.resource_id, er.quantity_required, er.calculation_type,
               r.name AS resource_name, r.resource_type, r.total_quantity, r.condition_status
        FROM experience_resources er
        JOIN resources r ON er.resource_id = r.resource_id
        WHERE er.experience_id = %s
    """, (experience_id,))

    if not requirements:
        return True, "No physical resources required for this experience.", []

    for req in requirements:
        if req['condition_status'] == 'under_maintenance':
            return False, f"Required resource '{req['resource_name']}' is currently undergoing scheduled maintenance.", None

        qty_needed = req['quantity_required'] * (party_size if req['calculation_type'] == 'per_person' else 1)

        alloc_res = _fetch_one(cursor, """
            SELECT COALESCE(SUM(quantity_allocated), 0) AS total_allocated
            FROM resource_allocations
            WHERE resource_id = %s AND slot_id = %s AND allocation_status = 'reserved'
        """, (req['resource_id'], slot_id))

        allocated = int(alloc_res['total_allocated']) if alloc_res else 0
        remaining_units = req['total_quantity'] - allocated

        if remaining_units < qty_needed:
            return False, f"Insufficient inventory for '{req['resource_name']}'. Required: {qty_needed}, Available: {remaining_units}.", None

    return True, "All required resources are available.", requirements


_SLOT_STAFF_SQL = """
    SELECT DISTINCT sa.staff_id
    FROM staff_assignments sa
    WHERE sa.slot_id = %s AND sa.assignment_status IN ('assigned', 'confirmed')
"""

# Staff who are active, available and NOT already busy in another slot whose time overlaps.
_FREE_STAFF_SQL = """
    SELECT s.staff_id, u.full_name, s.specialization,
           (SELECT COUNT(*) FROM staff_assignments x
             WHERE x.staff_id = s.staff_id AND x.assignment_status IN ('assigned', 'confirmed')) AS workload
    FROM staff s
    JOIN users u ON s.user_id = u.user_id
    JOIN experience_slots target ON target.slot_id = %s
    WHERE s.is_active = 1 AND s.is_available = 1 AND u.is_active = 1
      AND NOT EXISTS (
          SELECT 1
          FROM staff_assignments sa
          JOIN experience_slots other ON other.slot_id = sa.slot_id
          WHERE sa.staff_id = s.staff_id
            AND sa.assignment_status IN ('assigned', 'confirmed')
            AND other.slot_date = target.slot_date
            AND other.start_time < target.end_time
            AND other.end_time > target.start_time
      )
    ORDER BY (s.specialization LIKE %s) DESC, workload ASC, s.staff_id ASC
"""


def _staff_plan(cursor, experience_id, slot_id):
    """
    Work out which staff members would lead this slot. Staff already leading the slot
    (for another booking in the same session) are reused; missing headcount is filled
    from staff with no overlapping duties. Returns (ok, message, staff_ids).
    """
    staff_reqs = _fetch_all(cursor, """
        SELECT req_id, role_needed, quantity_required
        FROM experience_staff_requirements
        WHERE experience_id = %s
    """, (experience_id,))
    if not staff_reqs:
        return True, "No dedicated staff requirements for this experience.", []

    existing = [row['staff_id'] for row in _fetch_all(cursor, _SLOT_STAFF_SQL, (slot_id,))]
    needed_total = sum(r['quantity_required'] for r in staff_reqs)
    chosen = list(existing[:needed_total])
    missing = needed_total - len(chosen)
    if missing <= 0:
        return True, "Session staff already assigned.", chosen

    keyword = staff_reqs[0]['role_needed'].split()[0] if staff_reqs[0]['role_needed'] else ''
    candidates = _fetch_all(cursor, _FREE_STAFF_SQL, (slot_id, f"%{keyword}%"))
    candidates = [c for c in candidates if c['staff_id'] not in chosen]
    if len(candidates) < missing:
        roles = ', '.join(r['role_needed'] for r in staff_reqs)
        return False, f"Staffing conflict: no available staff for '{roles}' during this slot.", None
    chosen.extend(c['staff_id'] for c in candidates[:missing])
    return True, "Qualified staff are available.", chosen


def check_staff_availability(experience_id, slot_id, cursor=None):
    """
    Verify that suitable instructors, naturalists or guides are available and are not
    double-booked in an overlapping time window on the same day.
    """
    return _staff_plan(cursor, experience_id, slot_id)


def allocate_booking_resources(cursor, booking_id, experience_id, slot_id, party_size):
    """
    Atomically allocate slot capacity, physical resources and staff assignments.
    Must be called within an active transaction (after the availability checks).
    """
    cursor.execute("SELECT pricing_type FROM experiences WHERE experience_id = %s", (experience_id,))
    pricing_type = cursor.fetchone()['pricing_type']

    # 1. Increment booked capacity units in experience_slots
    cursor.execute("""
        UPDATE experience_slots
        SET booked_capacity = booked_capacity + %s
        WHERE slot_id = %s
    """, (capacity_units(pricing_type, party_size), slot_id))

    # 2. Reserve equipment and venues in resource_allocations
    cursor.execute("""
        SELECT resource_id, quantity_required, calculation_type
        FROM experience_resources
        WHERE experience_id = %s
    """, (experience_id,))
    for res in cursor.fetchall():
        qty_to_reserve = res['quantity_required'] * (party_size if res['calculation_type'] == 'per_person' else 1)
        cursor.execute("""
            INSERT INTO resource_allocations (booking_id, resource_id, slot_id, quantity_allocated, allocation_status)
            VALUES (%s, %s, %s, %s, 'reserved')
        """, (booking_id, res['resource_id'], slot_id, qty_to_reserve))

    # 3. Assign staff (re-using the session's guide when one is already leading this slot)
    ok, _, staff_ids = _staff_plan(cursor, experience_id, slot_id)
    for staff_id in (staff_ids or []):
        cursor.execute("""
            INSERT INTO staff_assignments (booking_id, staff_id, slot_id, assignment_status)
            VALUES (%s, %s, %s, 'confirmed')
        """, (booking_id, staff_id, slot_id))


def release_booking_resources(cursor, booking_id):
    """
    Release slot capacity, physical resources, and staff allocations upon cancellation.
    Must be called within an active transaction and only for bookings that actually
    hold capacity (status 'confirmed').
    """
    cursor.execute("""
        SELECT b.slot_id, b.party_size, e.pricing_type
        FROM bookings b
        JOIN experiences e ON e.experience_id = b.experience_id
        WHERE b.booking_id = %s
        FOR UPDATE
    """, (booking_id,))
    b = cursor.fetchone()
    if not b:
        return

    cursor.execute("""
        UPDATE experience_slots
        SET booked_capacity = GREATEST(0, booked_capacity - %s)
        WHERE slot_id = %s
    """, (capacity_units(b['pricing_type'], b['party_size']), b['slot_id']))

    cursor.execute("""
        UPDATE resource_allocations
        SET allocation_status = 'released'
        WHERE booking_id = %s
    """, (booking_id,))

    cursor.execute("""
        UPDATE staff_assignments
        SET assignment_status = 'reassigned'
        WHERE booking_id = %s
    """, (booking_id,))
