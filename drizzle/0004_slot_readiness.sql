-- Session readiness for LUXE-ECO matching (Guest → Preferences → Matching → Resource
-- availability → Booking). A session can run only when a guide or host is assigned and
-- every per-session resource (venue, boats, vehicle) is held for it. Per-guest equipment
-- comes from shared pools (kayaks, bicycles, binoculars), so the view also reports how
-- many more guests those pools can take once other overlapping holds and maintenance are
-- counted. Overlaps are summed conservatively, as in resource_allocations_check().
CREATE VIEW slot_readiness AS
SELECT s.id AS slot_id,
       coalesce(staff.assigned, 0) AS staff_assigned,
       coalesce(staff.names, '{}') AS staff_names,
       coalesce(res.confirmed, '{}') AS resources_confirmed,
       coalesce(res.missing, '{}') AS resources_missing,
       res.guest_limit,
       res.limiting_resource,
       (s.status = 'scheduled'
        AND coalesce(staff.assigned, 0) > 0
        AND coalesce(cardinality(res.missing), 0) = 0) AS ready,
       CASE
         WHEN s.status = 'scheduled'
          AND coalesce(staff.assigned, 0) > 0
          AND coalesce(cardinality(res.missing), 0) = 0
         THEN greatest(least(s.capacity - s.seats_booked, coalesce(res.guest_limit, s.capacity - s.seats_booked)), 0)
         ELSE 0
       END::integer AS bookable_seats
  FROM experience_slots s
  LEFT JOIN LATERAL (
       SELECT count(*)::integer AS assigned,
              array_agg(sm.display_name ORDER BY sa.role, sm.display_name) AS names
         FROM staff_assignments sa
         JOIN staff_members sm ON sm.id = sa.staff_id
        WHERE sa.slot_id = s.id
          AND sa.status = 'assigned'
          AND sm.is_active
       ) staff ON true
  LEFT JOIN LATERAL (
       SELECT array_agg(q.name ORDER BY q.name) FILTER (WHERE q.ok) AS confirmed,
              array_agg(q.name ORDER BY q.name) FILTER (WHERE NOT q.ok) AS missing,
              min(q.guests_supported)::integer AS guest_limit,
              (array_agg(q.name ORDER BY q.guests_supported) FILTER (WHERE q.guests_supported IS NOT NULL))[1] AS limiting_resource
         FROM (
              SELECT r.name,
                     CASE WHEN er.basis = 'per_session'
                          THEN r.is_active AND held.units >= er.quantity
                          ELSE r.is_active AND free.units >= er.quantity
                     END AS ok,
                     CASE WHEN er.basis = 'per_guest'
                          THEN CASE WHEN r.is_active THEN greatest(free.units, 0) / er.quantity ELSE 0 END
                     END AS guests_supported
                FROM experience_resource_requirements er
                JOIN resources r ON r.id = er.resource_id
               CROSS JOIN LATERAL (
                     SELECT coalesce(sum(a.quantity), 0) AS units
                       FROM resource_allocations a
                      WHERE a.slot_id = s.id
                        AND a.resource_id = r.id
                        AND a.booking_id IS NULL
                        AND a.status = 'held'
                     ) held
               CROSS JOIN LATERAL (
                     SELECT r.quantity_total
                            - coalesce((SELECT sum(a.quantity)
                                          FROM resource_allocations a
                                          JOIN experience_slots s2 ON s2.id = a.slot_id
                                         WHERE a.resource_id = r.id
                                           AND a.status = 'held'
                                           AND s2.status <> 'cancelled'
                                           AND s2.during && s.during), 0)
                            - coalesce((SELECT sum(m.quantity_out)
                                          FROM resource_maintenance m
                                         WHERE m.resource_id = r.id
                                           AND tstzrange(m.starts_at, m.ends_at, '[)') && s.during), 0) AS units
                     ) free
               WHERE er.experience_id = s.experience_id
              ) q
       ) res ON true;
