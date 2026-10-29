-- Integrity rules the Drizzle schema DSL can't express: cross-row and cross-table
-- invariants enforced by triggers, plus read views. See docs/DATABASE_DESIGN.md.
--
-- Custom SQLSTATE codes (class "LX") so the app can map failures to messages:
--   LXB01 slot full or not open            LXB02 invalid booking status change
--   LXB03 booking moved to another slot    LXS01 staff member double-booked
--   LXS02 staff member inactive            LXR01 resource capacity exceeded
--   LXR02 resource or slot unavailable     LXR03 maintenance conflicts with holds
--   LXR04 allocation/booking slot mismatch LXT01 slot change blocked
--   LXT02 slot inside a blackout period    LXV01 review needs a completed booking

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER guest_profiles_set_updated_at BEFORE UPDATE ON guest_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER guest_preferences_set_updated_at BEFORE UPDATE ON guest_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER staff_members_set_updated_at BEFORE UPDATE ON staff_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER experiences_set_updated_at BEFORE UPDATE ON experiences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER experience_slots_set_updated_at BEFORE UPDATE ON experience_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER itinerary_plans_set_updated_at BEFORE UPDATE ON itinerary_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint

-- Slots: no scheduling inside blackouts; no moving slots that already have
-- bookings, staff or resources; no cancelling while bookings are still active.
CREATE FUNCTION experience_slots_check_schedule() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  times_changed boolean := TG_OP = 'INSERT';
  became_scheduled boolean := TG_OP = 'INSERT';
  closure text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.experience_id <> OLD.experience_id THEN
      RAISE EXCEPTION 'A slot cannot move to another experience' USING ERRCODE = 'LXT01';
    END IF;

    times_changed := NEW.starts_at <> OLD.starts_at OR NEW.ends_at <> OLD.ends_at;
    became_scheduled := OLD.status <> 'scheduled' AND NEW.status = 'scheduled';

    IF times_changed AND (
         OLD.seats_booked > 0
      OR EXISTS (SELECT 1 FROM staff_assignments WHERE slot_id = OLD.id AND status = 'assigned')
      OR EXISTS (SELECT 1 FROM resource_allocations WHERE slot_id = OLD.id AND status = 'held')
    ) THEN
      RAISE EXCEPTION 'Slot % has bookings, staff or resources; cancel it and schedule a new slot instead', OLD.id
        USING ERRCODE = 'LXT01';
    END IF;

    IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND EXISTS (
      SELECT 1 FROM bookings WHERE slot_id = OLD.id AND status IN ('pending', 'confirmed')
    ) THEN
      RAISE EXCEPTION 'Slot % still has active bookings; cancel them first', OLD.id USING ERRCODE = 'LXT01';
    END IF;
  END IF;

  IF NEW.status = 'scheduled' AND (times_changed OR became_scheduled) THEN
    SELECT b.reason INTO closure
      FROM blackout_periods b
     WHERE (b.experience_id IS NULL OR b.experience_id = NEW.experience_id)
       AND b.starts_at < NEW.ends_at
       AND NEW.starts_at < b.ends_at
     ORDER BY b.starts_at
     LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Slot overlaps a blackout period: %', closure USING ERRCODE = 'LXT02';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER experience_slots_check_schedule
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, status, experience_id ON experience_slots
  FOR EACH ROW EXECUTE FUNCTION experience_slots_check_schedule();
--> statement-breakpoint

-- Bookings, part 1: validate status transitions. No side effects here, because
-- BEFORE triggers also fire for rows that INSERT … ON CONFLICT DO NOTHING then skips.
CREATE FUNCTION bookings_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'A new booking must start as pending or confirmed, not %', NEW.status
        USING ERRCODE = 'LXB02';
    END IF;
  ELSE
    IF NEW.slot_id <> OLD.slot_id THEN
      RAISE EXCEPTION 'Booking % cannot move to another slot; cancel it and book again', OLD.reference
        USING ERRCODE = 'LXB03';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
         (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled'))
      OR (OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'completed', 'no_show'))
    ) THEN
      RAISE EXCEPTION 'Booking % cannot change from % to %', OLD.reference, OLD.status, NEW.status
        USING ERRCODE = 'LXB02';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_validate
  BEFORE INSERT OR UPDATE OF status, slot_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_validate();
--> statement-breakpoint

-- Bookings, part 2: race-free seat accounting. AFTER ROW triggers fire only for rows
-- actually written, so a skipped ON CONFLICT row never reserves seats. Every status
-- except "cancelled" holds seats. The conditional UPDATE takes the slot's row lock,
-- so concurrent bookings for one slot queue and each re-checks committed seats;
-- raising here aborts the whole statement, including the booking row.
CREATE FUNCTION bookings_hold_seats() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  old_seats integer := 0;
  new_seats integer := 0;
  delta integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> 'cancelled' THEN
    old_seats := OLD.party_size;
  END IF;
  IF NEW.status <> 'cancelled' THEN
    new_seats := NEW.party_size;
  END IF;
  delta := new_seats - old_seats;

  IF delta > 0 THEN
    UPDATE experience_slots
       SET seats_booked = seats_booked + delta
     WHERE id = NEW.slot_id
       AND status = 'scheduled'
       AND seats_booked + delta <= capacity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Slot % is full or not open for booking (% seats requested)', NEW.slot_id, delta
        USING ERRCODE = 'LXB01';
    END IF;
  ELSIF delta < 0 THEN
    UPDATE experience_slots SET seats_booked = seats_booked + delta WHERE id = NEW.slot_id;
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_hold_seats
  AFTER INSERT OR UPDATE OF status, party_size ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_hold_seats();
--> statement-breakpoint

-- Status history. The app identifies the actor per transaction with
--   SELECT set_config('luxe.actor_user_id', '<uuid>', true);
--   SELECT set_config('luxe.status_reason', '<text>', true);
CREATE FUNCTION bookings_log_status() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor uuid := nullif(current_setting('luxe.actor_user_id', true), '')::uuid;
  note text := nullif(current_setting('luxe.status_reason', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id, reason)
    VALUES (NEW.id, NULL, NEW.status, actor, note);
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO booking_status_history (booking_id, from_status, to_status, changed_by_user_id, reason)
    VALUES (NEW.id, OLD.status, NEW.status, actor, note);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_log_status
  AFTER INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_log_status();
--> statement-breakpoint

-- Staff: lock the staff row, then reject overlapping active assignments.
CREATE FUNCTION staff_assignments_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  slot_range tstzrange;
  clash text;
BEGIN
  IF NEW.status <> 'assigned' THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM staff_members WHERE id = NEW.staff_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member % is inactive or does not exist', NEW.staff_id USING ERRCODE = 'LXS02';
  END IF;

  SELECT during INTO slot_range FROM experience_slots WHERE id = NEW.slot_id;

  SELECT e.title || ' at ' || to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
    INTO clash
    FROM staff_assignments a
    JOIN experience_slots s ON s.id = a.slot_id
    JOIN experiences e ON e.id = s.experience_id
   WHERE a.staff_id = NEW.staff_id
     AND a.status = 'assigned'
     AND a.id <> NEW.id
     AND s.status <> 'cancelled'
     AND s.during && slot_range
   LIMIT 1;

  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'Staff member is already assigned to %', clash USING ERRCODE = 'LXS01';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER staff_assignments_check
  BEFORE INSERT OR UPDATE OF staff_id, slot_id, status ON staff_assignments
  FOR EACH ROW EXECUTE FUNCTION staff_assignments_check();
--> statement-breakpoint

-- Resources: lock the resource row, then make sure overlapping holds plus units in
-- maintenance leave enough free. Overlaps are summed conservatively: it never
-- over-allocates, but may refuse when two existing holds don't overlap each other.
CREATE FUNCTION resource_allocations_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  total integer;
  slot_range tstzrange;
  slot_state slot_status;
  in_use integer;
  out_of_service integer;
BEGIN
  IF NEW.status <> 'held' THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM bookings WHERE id = NEW.booking_id AND slot_id = NEW.slot_id
  ) THEN
    RAISE EXCEPTION 'Allocation slot does not match the booking''s slot' USING ERRCODE = 'LXR04';
  END IF;

  SELECT quantity_total INTO total FROM resources WHERE id = NEW.resource_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resource % is inactive or does not exist', NEW.resource_id USING ERRCODE = 'LXR02';
  END IF;

  SELECT during, status INTO slot_range, slot_state FROM experience_slots WHERE id = NEW.slot_id;
  IF slot_state IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Resources can only be held for scheduled slots' USING ERRCODE = 'LXR02';
  END IF;

  SELECT coalesce(sum(a.quantity), 0) INTO in_use
    FROM resource_allocations a
    JOIN experience_slots s ON s.id = a.slot_id
   WHERE a.resource_id = NEW.resource_id
     AND a.status = 'held'
     AND a.id <> NEW.id
     AND s.status <> 'cancelled'
     AND s.during && slot_range;

  SELECT coalesce(sum(m.quantity_out), 0) INTO out_of_service
    FROM resource_maintenance m
   WHERE m.resource_id = NEW.resource_id
     AND tstzrange(m.starts_at, m.ends_at, '[)') && slot_range;

  IF in_use + out_of_service + NEW.quantity > total THEN
    RAISE EXCEPTION 'Resource % has % of % units free for this slot; % requested',
      NEW.resource_id, greatest(total - in_use - out_of_service, 0), total, NEW.quantity
      USING ERRCODE = 'LXR01';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER resource_allocations_check
  BEFORE INSERT OR UPDATE OF resource_id, slot_id, booking_id, quantity, status ON resource_allocations
  FOR EACH ROW EXECUTE FUNCTION resource_allocations_check();
--> statement-breakpoint

-- Maintenance can't take out units that are already held for overlapping slots.
CREATE FUNCTION resource_maintenance_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  total integer;
  window_range tstzrange := tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  in_use integer;
  other_out integer;
BEGIN
  SELECT quantity_total INTO total FROM resources WHERE id = NEW.resource_id FOR UPDATE;

  SELECT coalesce(sum(a.quantity), 0) INTO in_use
    FROM resource_allocations a
    JOIN experience_slots s ON s.id = a.slot_id
   WHERE a.resource_id = NEW.resource_id
     AND a.status = 'held'
     AND s.status <> 'cancelled'
     AND s.during && window_range;

  SELECT coalesce(sum(m.quantity_out), 0) INTO other_out
    FROM resource_maintenance m
   WHERE m.resource_id = NEW.resource_id
     AND m.id <> NEW.id
     AND tstzrange(m.starts_at, m.ends_at, '[)') && window_range;

  IF in_use + other_out + NEW.quantity_out > total THEN
    RAISE EXCEPTION 'Maintenance needs % units but only % are free in that window; release allocations first',
      NEW.quantity_out, greatest(total - in_use - other_out, 0)
      USING ERRCODE = 'LXR03';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER resource_maintenance_check
  BEFORE INSERT OR UPDATE OF resource_id, starts_at, ends_at, quantity_out ON resource_maintenance
  FOR EACH ROW EXECUTE FUNCTION resource_maintenance_check();
--> statement-breakpoint

-- Reviews belong to completed bookings only.
CREATE FUNCTION reviews_require_completed_booking() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bookings WHERE id = NEW.booking_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Only completed bookings can be reviewed' USING ERRCODE = 'LXV01';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER reviews_require_completed_booking
  BEFORE INSERT OR UPDATE OF booking_id ON reviews
  FOR EACH ROW EXECUTE FUNCTION reviews_require_completed_booking();
--> statement-breakpoint

-- Read views (typed in lib/db/schema/views.ts).
CREATE VIEW slot_availability AS
SELECT s.id AS slot_id,
       e.id AS experience_id,
       e.slug AS experience_slug,
       e.title AS experience_title,
       c.slug AS category_slug,
       s.starts_at,
       s.ends_at,
       s.capacity,
       s.seats_booked,
       (s.capacity - s.seats_booked)::integer AS seats_left,
       coalesce(s.price_override, e.base_price) AS price_per_guest,
       e.currency::text AS currency,
       s.status
  FROM experience_slots s
  JOIN experiences e ON e.id = s.experience_id
  JOIN experience_categories c ON c.id = e.category_id;
--> statement-breakpoint
CREATE VIEW experience_ratings AS
SELECT e.id AS experience_id,
       e.slug AS experience_slug,
       count(r.id)::integer AS review_count,
       round(avg(r.rating), 2) AS average_rating
  FROM experiences e
  LEFT JOIN experience_slots s ON s.experience_id = e.id
  LEFT JOIN bookings b ON b.slot_id = s.id
  LEFT JOIN reviews r ON r.booking_id = b.id AND r.status = 'published'
 GROUP BY e.id, e.slug;
