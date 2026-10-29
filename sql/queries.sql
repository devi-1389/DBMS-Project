-- LUXE-ECO: example DBMS queries over the seeded development data.
-- Each query starts with a "-- Qnn." header; `npm run db:verify` runs every one.
-- Times are stored as timestamptz (UTC). Sample season: 2026-11-02 to 2026-11-15.

-- Q01. Availability: open sessions with seats left on one day (uses the slot_availability view)
SELECT experience_title,
       category_slug,
       starts_at,
       seats_left,
       capacity,
       price_per_guest
  FROM slot_availability
 WHERE status = 'scheduled'
   AND starts_at >= timestamptz '2026-11-03 00:00+00'
   AND starts_at <  timestamptz '2026-11-04 00:00+00'
   AND seats_left > 0
 ORDER BY starts_at, experience_title;

-- Q02. Occupancy by category (aggregation over three joined tables)
SELECT c.label AS category,
       count(s.id) AS sessions,
       sum(s.seats_booked) AS seats_booked,
       sum(s.capacity) AS seats_offered,
       round(100.0 * sum(s.seats_booked) / nullif(sum(s.capacity), 0), 1) AS occupancy_pct
  FROM experience_categories c
  JOIN experiences e ON e.category_id = c.id
  JOIN experience_slots s ON s.experience_id = e.id AND s.status <> 'cancelled'
 GROUP BY c.id, c.label, c.sort_order
 ORDER BY c.sort_order;

-- Q03. Settled revenue by category and month, with subtotals and a grand total (ROLLUP)
SELECT CASE WHEN grouping(c.label) = 1 THEN 'All categories' ELSE c.label END AS category,
       CASE WHEN grouping(date_trunc('month', p.settled_at)) = 1 THEN 'All months'
            ELSE to_char(date_trunc('month', p.settled_at), 'YYYY-MM') END AS month,
       count(*) AS payments,
       sum(p.amount) AS revenue
  FROM payment_attempts p
  JOIN bookings b ON b.id = p.booking_id
  JOIN experience_slots s ON s.id = b.slot_id
  JOIN experiences e ON e.id = s.experience_id
  JOIN experience_categories c ON c.id = e.category_id
 WHERE p.status = 'succeeded'
 GROUP BY ROLLUP (c.label, date_trunc('month', p.settled_at))
 ORDER BY grouping(c.label), c.label, grouping(date_trunc('month', p.settled_at)), month;

-- Q04. One guest's bookings with their full status timeline (ordered string_agg over the audit table)
SELECT b.reference,
       e.title,
       s.starts_at,
       b.party_size,
       b.total_amount,
       b.status,
       string_agg(coalesce(h.from_status::text, 'new') || ' -> ' || h.to_status::text, ', '
                  ORDER BY h.changed_at, h.id) AS status_timeline
  FROM bookings b
  JOIN users u ON u.id = b.guest_id
  JOIN experience_slots s ON s.id = b.slot_id
  JOIN experiences e ON e.id = s.experience_id
  JOIN booking_status_history h ON h.booking_id = b.id
 WHERE lower(u.email) = 'sample.guest@example.com'
 GROUP BY b.id, e.title, s.starts_at
 ORDER BY s.starts_at;

-- Q05. Personalised matching in SQL: rank experiences for a guest (CTEs, weighted interests, enum ordering)
WITH guest AS (
  SELECT u.id, p.max_difficulty, p.budget_per_guest, p.usual_group_size, p.needs_step_free
    FROM users u
    JOIN guest_preferences p ON p.guest_id = u.id
   WHERE lower(u.email) = 'sample.guest@example.com'
), interest_match AS (
  SELECT ei.experience_id,
         sum(gi.weight) AS weight,
         string_agg(i.label, ', ' ORDER BY gi.weight DESC, i.label) AS shared_interests
    FROM guest g
    JOIN guest_interests gi ON gi.guest_id = g.id
    JOIN experience_interests ei ON ei.interest_id = gi.interest_id
    JOIN interests i ON i.id = gi.interest_id
   GROUP BY ei.experience_id
)
SELECT e.title,
       e.difficulty,
       e.base_price,
       im.shared_interests,
       coalesce(im.weight, 0) * 3
         + CASE WHEN g.budget_per_guest IS NULL OR e.base_price <= g.budget_per_guest THEN 1 ELSE -2 END
         + CASE WHEN e.difficulty = g.max_difficulty THEN 1 ELSE 0 END AS score
  FROM experiences e
 CROSS JOIN guest g
  LEFT JOIN interest_match im ON im.experience_id = e.id
 WHERE e.status = 'published'
   AND e.difficulty <= g.max_difficulty          -- enum order: easy < moderate < challenging
   AND e.max_group_size >= g.usual_group_size
   AND (NOT g.needs_step_free OR e.is_step_free)
 ORDER BY score DESC, e.base_price
 LIMIT 5;

-- Q06. Staff workload for the first week: sessions and hours per person
SELECT st.display_name,
       st.job_title,
       count(*) AS sessions,
       round((sum(extract(epoch FROM s.ends_at - s.starts_at)) / 3600)::numeric, 1) AS hours
  FROM staff_assignments a
  JOIN staff_members st ON st.id = a.staff_id
  JOIN experience_slots s ON s.id = a.slot_id
 WHERE a.status = 'assigned'
   AND s.status = 'scheduled'
   AND s.starts_at >= timestamptz '2026-11-02 00:00+00'
   AND s.starts_at <  timestamptz '2026-11-09 00:00+00'
 GROUP BY st.id, st.display_name, st.job_title
 ORDER BY hours DESC, st.display_name;

-- Q07. Integrity audit: staff with overlapping active assignments (self-join on range overlap; expect 0 rows)
SELECT st.display_name,
       e1.title AS first_session,
       s1.starts_at AS first_start,
       e2.title AS second_session,
       s2.starts_at AS second_start
  FROM staff_assignments a1
  JOIN staff_assignments a2 ON a2.staff_id = a1.staff_id AND a2.id > a1.id
  JOIN experience_slots s1 ON s1.id = a1.slot_id
  JOIN experience_slots s2 ON s2.id = a2.slot_id
  JOIN experiences e1 ON e1.id = s1.experience_id
  JOIN experiences e2 ON e2.id = s2.experience_id
  JOIN staff_members st ON st.id = a1.staff_id
 WHERE a1.status = 'assigned'
   AND a2.status = 'assigned'
   AND s1.status <> 'cancelled'
   AND s2.status <> 'cancelled'
   AND s1.during && s2.during;

-- Q08. Busy pooled-resource days: peak units in use vs units available after maintenance (LATERAL subqueries)
SELECT r.name AS resource,
       (s.starts_at AT TIME ZONE 'UTC')::date AS day,
       max(overlap.in_use) AS peak_units_in_use,
       r.quantity_total - coalesce(max(mt.out_of_service), 0) AS units_available,
       r.quantity_total
  FROM resource_allocations a
  JOIN resources r ON r.id = a.resource_id
  JOIN experience_slots s ON s.id = a.slot_id
 CROSS JOIN LATERAL (
       SELECT sum(a2.quantity) AS in_use
         FROM resource_allocations a2
         JOIN experience_slots s2 ON s2.id = a2.slot_id
        WHERE a2.resource_id = a.resource_id
          AND a2.status = 'held'
          AND s2.status <> 'cancelled'
          AND s2.during && s.during
       ) overlap
  LEFT JOIN LATERAL (
       SELECT sum(m.quantity_out) AS out_of_service
         FROM resource_maintenance m
        WHERE m.resource_id = r.id
          AND tstzrange(m.starts_at, m.ends_at, '[)') && s.during
       ) mt ON true
 WHERE a.status = 'held'
   AND s.status <> 'cancelled'
   AND r.kind <> 'venue'                          -- single venues are always fully used
 GROUP BY r.id, r.name, r.quantity_total, (s.starts_at AT TIME ZONE 'UTC')::date
HAVING max(overlap.in_use) >= r.quantity_total - coalesce(max(mt.out_of_service), 0)
 ORDER BY day, resource;

-- Q09. Sessions that fall inside blackout periods, and how they were handled (range overlap with a nullable FK)
SELECT b.reason,
       coalesce(be.title, 'Whole resort') AS applies_to,
       e.title AS session,
       s.starts_at,
       s.status,
       s.cancelled_reason
  FROM blackout_periods b
  LEFT JOIN experiences be ON be.id = b.experience_id
  JOIN experience_slots s
    ON (b.experience_id IS NULL OR s.experience_id = b.experience_id)
   AND s.during && tstzrange(b.starts_at, b.ends_at, '[)')
  JOIN experiences e ON e.id = s.experience_id
 ORDER BY s.starts_at;

-- Q10. Integrity audit: seat counters that disagree with their bookings (FILTER aggregate; expect 0 rows)
SELECT s.id,
       e.title,
       s.starts_at,
       s.seats_booked,
       coalesce(sum(b.party_size) FILTER (WHERE b.status <> 'cancelled'), 0) AS seats_from_bookings
  FROM experience_slots s
  JOIN experiences e ON e.id = s.experience_id
  LEFT JOIN bookings b ON b.slot_id = s.id
 GROUP BY s.id, e.title
HAVING s.seats_booked <> coalesce(sum(b.party_size) FILTER (WHERE b.status <> 'cancelled'), 0);

-- Q11. Top-rated experiences (experience_ratings view; unrated ones last)
SELECT e.title,
       r.review_count,
       r.average_rating
  FROM experience_ratings r
  JOIN experiences e ON e.id = r.experience_id
 ORDER BY r.average_rating DESC NULLS LAST, r.review_count DESC, e.title
 LIMIT 5;

-- Q12. Booking status funnel with each status's share (window function over an aggregate)
SELECT status,
       count(*) AS bookings,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct_of_all
  FROM bookings
 GROUP BY status
 ORDER BY bookings DESC, status;

-- Q13. Experiences nobody has booked yet (anti-join with NOT EXISTS)
SELECT e.title,
       c.label AS category
  FROM experiences e
  JOIN experience_categories c ON c.id = e.category_id
 WHERE NOT EXISTS (
       SELECT 1
         FROM experience_slots s
         JOIN bookings b ON b.slot_id = s.id
        WHERE s.experience_id = e.id
          AND b.status <> 'cancelled'
       )
 ORDER BY c.sort_order, e.title;

-- Q14. Busiest session of each experience (RANK() partitioned by experience)
SELECT title,
       starts_at,
       seats_booked,
       capacity
  FROM (
       SELECT e.title,
              s.starts_at,
              s.seats_booked,
              s.capacity,
              rank() OVER (PARTITION BY e.id ORDER BY s.seats_booked DESC, s.starts_at) AS busiest_rank
         FROM experience_slots s
         JOIN experiences e ON e.id = s.experience_id
        WHERE s.status = 'scheduled'
       ) ranked
 WHERE busiest_rank = 1
   AND seats_booked > 0
 ORDER BY seats_booked DESC, title;

-- Q15. A guest's itinerary with booking status and a running cost estimate (window SUM)
SELECT p.name AS plan,
       (s.starts_at AT TIME ZONE 'UTC')::date AS day,
       e.title,
       i.party_size,
       coalesce(b.status::text, 'not booked') AS booking_status,
       coalesce(s.price_override, e.base_price) * i.party_size AS estimate,
       sum(coalesce(s.price_override, e.base_price) * i.party_size)
         OVER (PARTITION BY p.id ORDER BY s.starts_at) AS running_total
  FROM itinerary_plans p
  JOIN users u ON u.id = p.guest_id
  JOIN itinerary_items i ON i.plan_id = p.id
  JOIN experience_slots s ON s.id = i.slot_id
  JOIN experiences e ON e.id = s.experience_id
  LEFT JOIN bookings b ON b.id = i.booking_id
 WHERE lower(u.email) = 'sample.guest@example.com'
 ORDER BY s.starts_at;

-- Q16. Payment reconciliation: balance still due on confirmed and completed bookings
SELECT b.reference,
       b.status,
       b.total_amount,
       coalesce(sum(p.amount) FILTER (WHERE p.status = 'succeeded'), 0) AS paid,
       b.total_amount - coalesce(sum(p.amount) FILTER (WHERE p.status = 'succeeded'), 0) AS balance_due
  FROM bookings b
  LEFT JOIN payment_attempts p ON p.booking_id = b.id
 WHERE b.status IN ('confirmed', 'completed')
 GROUP BY b.id
 ORDER BY balance_due DESC, b.reference;
