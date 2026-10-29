// Driver-agnostic integrity checks and query runner, used by `npm run db:verify`.
// They expect a freshly seeded, disposable database and modify it.

export type RunSql = (text: string) => Promise<Record<string, unknown>[]>;
export type CheckResult = { name: string; ok: boolean; detail?: string };

function errorInfo(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return { code, message };
}

export async function runIntegrityChecks(run: RunSql): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const record = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  const scalar = async (text: string) => {
    const rows = await run(text);
    return rows[0] ? String(Object.values(rows[0])[0]) : "";
  };
  const expectValue = async (name: string, text: string, expected: string | number) => {
    try {
      const actual = await scalar(text);
      record(name, actual === String(expected), `expected ${expected}, got ${actual}`);
    } catch (error) {
      record(name, false, errorInfo(error).message);
    }
  };
  const expectOk = async (name: string, text: string) => {
    try {
      await run(text);
      record(name, true);
    } catch (error) {
      const { code, message } = errorInfo(error);
      record(name, false, `${code ?? "error"}: ${message}`);
    }
  };
  const expectError = async (name: string, code: string | string[], text: string) => {
    const codes = Array.isArray(code) ? code : [code];
    try {
      await run(text);
      record(name, false, `expected ${codes.join(" or ")}, but the statement succeeded`);
    } catch (error) {
      const info = errorInfo(error);
      const ok = codes.includes(info.code ?? "");
      record(name, ok, ok ? info.code : `expected ${codes.join(" or ")}, got ${info.code}: ${info.message}`);
    }
  };

  const user = (email: string) => `(SELECT id FROM users WHERE email = '${email}')`;
  const slot = (slug: string, startsAt: string) =>
    `(SELECT s.id FROM experience_slots s JOIN experiences e ON e.id = s.experience_id
       WHERE e.slug = '${slug}' AND s.starts_at = timestamptz '${startsAt}')`;
  const bookingId = (reference: string) => `(SELECT id FROM bookings WHERE reference = '${reference}')`;
  const resource = (name: string) => `(SELECT id FROM resources WHERE name = '${name}')`;
  const staff = (email: string) => `(SELECT id FROM staff_members WHERE email = '${email}')`;
  const book = (reference: string, email: string, slotSql: string, party: number, status = "confirmed") =>
    `INSERT INTO bookings (reference, guest_id, slot_id, party_size, unit_price, status, idempotency_key)
     VALUES ('${reference}', ${user(email)}, ${slotSql}, ${party}, 5500.00, '${status}', gen_random_uuid())`;

  // ---------------------------------------------------------------- seeded data
  await expectValue(
    "seed: every slot's seat counter equals its bookings",
    `SELECT count(*) FROM (
       SELECT s.id FROM experience_slots s LEFT JOIN bookings b ON b.slot_id = s.id
        GROUP BY s.id
       HAVING s.seats_booked <> coalesce(sum(b.party_size) FILTER (WHERE b.status <> 'cancelled'), 0)) x`,
    0,
  );
  await expectValue(
    "seed: no staff member has overlapping assignments",
    `SELECT count(*) FROM staff_assignments a1
       JOIN staff_assignments a2 ON a2.staff_id = a1.staff_id AND a2.id > a1.id
       JOIN experience_slots s1 ON s1.id = a1.slot_id JOIN experience_slots s2 ON s2.id = a2.slot_id
      WHERE a1.status = 'assigned' AND a2.status = 'assigned'
        AND s1.status <> 'cancelled' AND s2.status <> 'cancelled' AND s1.during && s2.during`,
    0,
  );
  await expectValue(
    "seed: status history recorded automatically (new → confirmed → completed)",
    `SELECT string_agg(coalesce(from_status::text, 'new') || '>' || to_status::text, ',' ORDER BY id)
       FROM booking_status_history WHERE booking_id = ${bookingId("LX-6RJ3")}`,
    "new>confirmed,confirmed>completed",
  );
  await expectValue(
    "seed: history records who made the change",
    `SELECT count(*) FROM booking_status_history WHERE changed_by_user_id IS NULL`,
    0,
  );
  await expectValue("money: generated total is exact (5500.00 × 2)", `SELECT total_amount::text FROM bookings WHERE reference = 'LX-8TB2'`, "11000.00");

  // ---------------------------------------------------------------- seats and concurrency rules
  const fixture = slot("canopy-sunset-dining", "2026-11-20 17:30+05:30");
  const seats = `SELECT seats_booked FROM experience_slots WHERE id = ${fixture}`;
  await expectOk(
    "slot: a session can be scheduled outside blackouts",
    `INSERT INTO experience_slots (experience_id, starts_at, ends_at, capacity)
     SELECT id, '2026-11-20 17:30+05:30', '2026-11-20 20:30+05:30', 3 FROM experiences WHERE slug = 'canopy-sunset-dining'`,
  );
  await expectOk("booking: within capacity succeeds", book("LX-TEST01", "m.okafor@example.com", fixture, 1));
  await expectError(
    "booking: second active booking for the same guest and slot is rejected",
    "23505",
    book("LX-TEST02", "m.okafor@example.com", fixture, 1),
  );
  await expectValue("booking: a rejected statement leaves the seat counter unchanged", seats, 1);
  await expectOk("booking: last seats can be taken", book("LX-TEST03", "j.lindqvist@example.com", fixture, 2));
  await expectError("booking: overbooking is rejected", "LXB01", book("LX-TEST04", "a.moreau@example.com", fixture, 1));
  await expectValue("booking: seat counter equals capacity, never more", seats, 3);
  await expectError(
    "booking: new bookings can't start as completed",
    "LXB02",
    book("LX-TEST05", "s.haddad@example.com", fixture, 1, "completed"),
  );
  await expectError(
    "booking: completed → confirmed is not an allowed transition",
    "LXB02",
    `UPDATE bookings SET status = 'confirmed' WHERE reference = 'LX-6RJ3'`,
  );
  await expectError(
    "booking: can't be moved to another slot",
    "LXB03",
    `UPDATE bookings SET slot_id = ${slot("canopy-sunset-dining", "2026-11-05 17:30+05:30")} WHERE reference = 'LX-TEST03'`,
  );
  await expectOk("booking: cancellation is allowed", `UPDATE bookings SET status = 'cancelled' WHERE reference = 'LX-TEST03'`);
  await expectValue("booking: cancellation releases seats", seats, 1);
  await expectValue(
    "booking: cancellation is recorded in the history",
    `SELECT count(*) FROM booking_status_history WHERE booking_id = ${bookingId("LX-TEST03")} AND to_status = 'cancelled'`,
    1,
  );
  await expectError(
    "booking: pending bookings need a hold expiry",
    "23514",
    `INSERT INTO bookings (reference, guest_id, slot_id, party_size, unit_price, status, idempotency_key)
     VALUES ('LX-TEST06', ${user("s.haddad@example.com")}, ${fixture}, 1, 5500.00, 'pending', gen_random_uuid())`,
  );
  await expectValue("booking: failed insert rolled back its seat change", seats, 1);
  const idempotent = (reference: string) =>
    `INSERT INTO bookings (reference, guest_id, slot_id, party_size, unit_price, status, idempotency_key)
     VALUES ('${reference}', ${user("s.haddad@example.com")}, ${fixture}, 1, 5500.00, 'confirmed',
             '22222222-2222-4222-8222-222222222222')
     ON CONFLICT (guest_id, idempotency_key) DO NOTHING`;
  await expectOk("booking: idempotent insert succeeds", idempotent("LX-TEST08"));
  await expectOk("booking: retry with the same idempotency key is a no-op", idempotent("LX-TEST09"));
  await expectValue("booking: an idempotent retry doesn't reserve seats again", seats, 2);

  // ---------------------------------------------------------------- slot rules
  await expectError(
    "slot: a booked session can't be rescheduled",
    "LXT01",
    `UPDATE experience_slots SET starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour' WHERE id = ${fixture}`,
  );
  await expectError(
    "slot: can't be cancelled while bookings are active",
    "LXT01",
    `UPDATE experience_slots SET status = 'cancelled', cancelled_reason = 'test' WHERE id = ${fixture}`,
  );
  await expectError(
    "slot: can't be scheduled inside an experience blackout",
    "LXT02",
    `INSERT INTO experience_slots (experience_id, starts_at, ends_at, capacity)
     SELECT id, '2026-11-14 10:00+05:30', '2026-11-14 12:00+05:30', 4 FROM experiences WHERE slug = 'ridge-line-summit-trek'`,
  );
  await expectError(
    "slot: can't be scheduled inside a resort-wide blackout",
    "LXT02",
    `INSERT INTO experience_slots (experience_id, starts_at, ends_at, capacity)
     SELECT id, '2026-11-16 07:00+05:30', '2026-11-16 08:30+05:30', 4 FROM experiences WHERE slug = 'lakeside-sunrise-yoga'`,
  );

  // ---------------------------------------------------------------- staff rules
  await expectError(
    "staff: overlapping assignment is rejected (canoe 06:30–09:00 vs yoga 07:00)",
    "LXS01",
    `INSERT INTO staff_assignments (slot_id, staff_id, role)
     VALUES (${slot("lakeside-sunrise-yoga", "2026-11-03 07:00+05:30")}, ${staff("mara@example.com")}, 'guide')`,
  );
  await expectOk(
    "staff: an inactive staff member can be recorded",
    `INSERT INTO staff_members (display_name, job_title, email, is_active) VALUES ('Former guide (sample)', 'Guide', 'former@example.com', false)`,
  );
  await expectError(
    "staff: inactive staff can't be assigned",
    "LXS02",
    `INSERT INTO staff_assignments (slot_id, staff_id, role)
     VALUES (${slot("lakeside-sunrise-yoga", "2026-11-04 07:00+05:30")}, ${staff("former@example.com")}, 'support')`,
  );

  // ---------------------------------------------------------------- resource rules
  await expectError(
    "resource: allocation beyond the free units is rejected (telescopes 2 of 2 held)",
    "LXR01",
    `INSERT INTO resource_allocations (resource_id, slot_id, booking_id, quantity)
     VALUES (${resource("Observatory telescope")}, ${slot("starlit-observatory", "2026-11-02 20:30+05:30")}, ${bookingId("LX-0WE2")}, 1)`,
  );
  await expectError(
    "resource: allocation must use its booking's slot",
    "LXR04",
    `INSERT INTO resource_allocations (resource_id, slot_id, booking_id, quantity)
     VALUES (${resource("Observatory telescope")}, ${slot("starlit-observatory", "2026-11-02 20:30+05:30")}, ${bookingId("LX-4KQ7")}, 1)`,
  );
  await expectError(
    "resource: maintenance can't take out units already held",
    "LXR03",
    `INSERT INTO resource_maintenance (resource_id, starts_at, ends_at, quantity_out, reason)
     VALUES (${resource("Observatory telescope")}, '2026-11-02 20:00+05:30', '2026-11-02 23:00+05:30', 1, 'Lens cleaning')`,
  );
  const canoeSlot = slot("river-wildlife-canoe", "2026-11-12 06:30+05:30");
  await expectOk("resource: a booking on a maintenance day succeeds", book("LX-TEST07", "a.moreau@example.com", canoeSlot, 1));
  await expectError(
    "resource: units in maintenance aren't available (4 held + 2 out of 6)",
    "LXR01",
    `INSERT INTO resource_allocations (resource_id, slot_id, booking_id, quantity)
     VALUES (${resource("Two-person canoe")}, ${canoeSlot}, ${bookingId("LX-TEST07")}, 1)`,
  );
  await expectValue(
    "resource: no resource is ever over-allocated",
    `SELECT count(*) FROM resource_allocations a
       JOIN resources r ON r.id = a.resource_id JOIN experience_slots s ON s.id = a.slot_id
      WHERE a.status = 'held' AND s.status <> 'cancelled'
        AND (SELECT sum(a2.quantity) FROM resource_allocations a2 JOIN experience_slots s2 ON s2.id = a2.slot_id
              WHERE a2.resource_id = a.resource_id AND a2.status = 'held' AND s2.status <> 'cancelled' AND s2.during && s.during)
          + coalesce((SELECT sum(m.quantity_out) FROM resource_maintenance m
              WHERE m.resource_id = a.resource_id AND tstzrange(m.starts_at, m.ends_at) && s.during), 0)
          > r.quantity_total`,
    0,
  );

  // ---------------------------------------------------------------- reviews, deletes, identity
  await expectError(
    "review: only completed bookings can be reviewed",
    "LXV01",
    `INSERT INTO reviews (booking_id, rating) VALUES (${bookingId("LX-8TB2")}, 5)`,
  );
  await expectError(
    "review: rating outside 1–5 is rejected",
    "23514",
    `INSERT INTO reviews (booking_id, rating) VALUES (${bookingId("LX-6RJ3")}, 6)`,
  );
  // ON DELETE RESTRICT: PostgreSQL 18+ raises restrict_violation (23001); 17 and
  // earlier raise foreign_key_violation (23503). Neon may run either.
  const RESTRICT_VIOLATION = ["23001", "23503"];
  await expectError(
    "delete: an experience with sessions is protected (RESTRICT)",
    RESTRICT_VIOLATION,
    `DELETE FROM experiences WHERE slug = 'artisan-craft-workshop'`,
  );
  await expectError(
    "delete: a guest with bookings is protected (RESTRICT through CASCADE)",
    RESTRICT_VIOLATION,
    `DELETE FROM users WHERE email = 'm.okafor@example.com'`,
  );
  await expectError(
    "delete: an interest still in use is protected (RESTRICT)",
    RESTRICT_VIOLATION,
    `DELETE FROM interests WHERE slug = 'wildlife'`,
  );
  await expectOk("delete: an unused interest can be added", `INSERT INTO interests (slug, label) VALUES ('birdwatching', 'Birdwatching')`);
  await expectValue(
    "delete: an unused interest can be removed",
    `WITH removed AS (DELETE FROM interests WHERE slug = 'birdwatching' RETURNING 1) SELECT count(*) FROM removed`,
    1,
  );
  await expectError(
    "identity: email uniqueness ignores case",
    "23505",
    `INSERT INTO users (email, display_name) VALUES ('M.OKAFOR@example.com', 'Duplicate')`,
  );
  await expectError(
    "identity: one account per Clerk user ID",
    "23505",
    `INSERT INTO auth_identities (user_id, provider, provider_user_id)
     VALUES (${user("admin@example.com")}, 'clerk', 'user_seed_002')`,
  );
  await expectOk("trigger: updated_at is maintained", `UPDATE suppliers SET contact_phone = '+1 555 0100' WHERE name = 'Lakeside Outfitters'`);
  await expectValue(
    "trigger: updated_at moved forward",
    `SELECT updated_at > created_at FROM suppliers WHERE name = 'Lakeside Outfitters'`,
    "true",
  );

  return results;
}

export type QueryResult = { name: string; rows: Record<string, unknown>[]; error?: string };

/** Splits sql/queries.sql on its "-- Qnn." headers and runs each query. */
export async function runQueryFile(run: RunSql, text: string): Promise<QueryResult[]> {
  const sections = text.split(/^(?=-- Q\d{2}\.)/m).filter((section) => section.startsWith("-- Q"));
  const results: QueryResult[] = [];
  for (const section of sections) {
    const name = section.split("\n", 1)[0].replace(/^--\s*/, "");
    const statement = section.slice(section.indexOf("\n") + 1).trim().replace(/;\s*$/, "");
    try {
      results.push({ name, rows: await run(statement) });
    } catch (error) {
      results.push({ name, rows: [], error: errorInfo(error).message });
    }
  }
  return results;
}
