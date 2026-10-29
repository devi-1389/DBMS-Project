# LUXE-ECO Database Design

Status: schema, migrations, seed and checks implemented (Phase 4). Since Phases 3 and 5,
the guest, staff and admin areas use it through the `server-only` DAL in `lib/dal/`
(accounts, roles, preferences, itinerary plans, bookings, schedules); see
[`AUTHENTICATION.md`](./AUTHENTICATION.md). The public catalogue pages still read
`lib/placeholder/catalogue.ts`. Diagrams: [`ERD.md`](./ERD.md).
Example queries: [`../sql/queries.sql`](../sql/queries.sql).

## 1. Technology choices

| Choice | Why |
|--------|-----|
| **Neon PostgreSQL** | Serverless Postgres with branching (one branch per developer or preview). |
| **Drizzle ORM 0.45** + drizzle-kit 0.31 | Typed schema in TypeScript (`lib/db/schema/`), SQL migrations in `drizzle/`. |
| **Driver: `drizzle-orm/neon-serverless`** (WebSocket `Pool`) | Supports interactive transactions (`BEGIN` … row locks … `COMMIT`). The HTTP driver (`neon-http`) sends one statement per request and can't hold a transaction open, which booking needs. Uses the global `WebSocket` in Node.js 22+ (`package.json` `engines`). |
| Pooled vs direct URLs | `DATABASE_URL` = pooled (`-pooler` host) for the app. `DATABASE_URL_UNPOOLED` = direct, for migrations and seeding. |
| Offline verification: **PGlite** | Real PostgreSQL compiled to WebAssembly, in memory, so `npm run db:verify` needs no credentials or network. |

`lib/db/index.ts` (`server-only`) creates the client lazily, so builds and pages that
don't touch the database never need credentials.

## 2. Conventions

- **Keys.** `uuid` primary keys (`gen_random_uuid()`) for entities. `smallint` identity
  keys for lookup tables (`interests`, `experience_categories`), each with a unique
  `slug`. Composite primary keys for pure link tables. `guest_profiles` shares its
  primary key with `users` (1:1).
- **Names.** Snake case. Constraints and indexes are named explicitly (`<table>_<rule>`),
  so errors are readable and migrations are stable. All names fit PostgreSQL's
  63-character limit.
- **Time.** Every instant is `timestamptz` (stored UTC). Stay dates are `date`. The resort
  timezone is still an open decision (`lib/config.ts`).
- **Money.** `numeric(10,2)` for per-guest prices and budgets; `numeric(12,2)` for totals
  and payments. Never floating point. Drizzle returns these as strings, and
  `lib/money.ts` converts exactly to and from the app's integer minor units
  (`"420.00"` ↔ `42000`). Each amount is stored with a `char(3)` ISO currency code.
- **Enums.** PostgreSQL enums for closed sets. `difficulty` reuses `lib/difficulty.ts`,
  and `booking_status` and `time_of_day` are type-checked against the app's types, so the
  app and database can't drift. Enum order is meaningful: `easy < moderate < challenging`.
- **Lookup data as tables.** Categories and interests are tables (not enums), so they can
  grow without a migration.
- **Generated columns.** `experience_slots.during` = `tstzrange(starts_at, ends_at, '[)')`
  (GiST-indexed, for overlap queries), and `bookings.total_amount` =
  `unit_price × party_size`. Both are computed by PostgreSQL and can't drift.
- **Audit columns.** `created_at` everywhere useful; `updated_at` kept current by the
  `set_updated_at` trigger.

## 3. Tables

| Domain | Table | Purpose and key rules |
|--------|-------|-----------------------|
| Identity | `users` | Anyone who can sign in. Unique `lower(email)`; `role` (guest/staff/admin) is the source of truth for authorization. |
| | `auth_identities` | Authentication-provider IDs (Clerk). Unique `(provider, provider_user_id)` and `(user_id, provider)`. |
| | `guest_profiles` | Guest details, 1:1 with `users`. Name length, phone format, birth-date checks. Last name may be empty (migration `0002`). |
| | `staff_members` | Staff, optionally linked to a user account (`user_id` unique, nullable). `is_active` for soft deactivation. |
| Preferences | `interests` | Interest tags shared by guests and experiences. |
| | `guest_preferences` | 1:1 scalar matching inputs: max difficulty, budget per guest (NULL = no limit), usual group size (1–12), step-free need, notes (≤ 500). |
| | `guest_interests` | Weighted (1–5) M:N guest ↔ interest. |
| | `guest_preferred_times` | Preferred times of day (multi-valued attribute in its own table). |
| Catalogue | `experience_categories` | The six categories, ordered. |
| | `suppliers` | Operators, local hosts, rental firms, transport. |
| | `experiences` | The catalogue: category (RESTRICT), optional supplier, difficulty, duration (15–1440 min), group size, `base_price`, step-free flag, `draft/published/archived` status. |
| | `experience_highlights` | Ordered bullet points, PK `(experience_id, position)`. |
| | `experience_interests` | M:N experience ↔ interest. |
| Schedule | `experience_slots` | Sessions: unique `(experience_id, starts_at)`, `ends_at > starts_at`, `capacity`, trigger-maintained `seats_booked ≤ capacity`, optional `price_override`, `scheduled/cancelled/completed` (a reason is required when cancelled). |
| | `blackout_periods` | Closures for one experience, or the whole resort when `experience_id` is NULL. |
| Bookings | `bookings` | Seats on one slot. Price snapshot `unit_price`, generated `total_amount`, status, `hold_expires_at` (required while pending), idempotency key unique per guest, at most one *active* booking per guest per slot. |
| | `booking_status_history` | Append-only audit of every status change, written by trigger, with the actor and reason. |
| | `payment_attempts` | Each attempt to pay or record payment: method, status, provider reference (unique), staff who recorded a pay-at-resort payment, `settled_at` iff succeeded/refunded, at most one success per booking. |
| | `reviews` | One per booking; rating 1–5; only for completed bookings (trigger). |
| Operations | `staff_assignments` | Staff on a slot: unique `(slot_id, staff_id)`, at most one active lead per slot, no overlapping assignments per person (trigger). |
| | `resources` | Pooled resources with `quantity_total` (6 canoes, 2 vans, 1 pavilion). |
| | `experience_resource_requirements` | What each experience needs: `per_session` (fixed) or `per_guest` (× party size). |
| | `resource_allocations` | Units held for a slot (session-level, `booking_id` NULL) or for one booking (per-guest equipment). Capacity enforced by trigger. |
| | `resource_maintenance` | Units out of service for a window. Reduces what can be allocated. |
| Itinerary | `itinerary_plans` | A guest's stay plan: arrival ≤ departure, ≤ 21 nights. |
| | `itinerary_items` | Planned sessions (unique per plan and slot), optionally linked to the booking that fulfilled them. Plans are not reservations. |

Views (created in `drizzle/0001_integrity.sql`, typed in `lib/db/schema/views.ts`):
`slot_availability` (seats left and effective price) and `experience_ratings`.

## 4. Normalization

- **1NF.** No arrays or lists in columns. Multi-valued attributes (highlights, interests,
  preferred times of day) are separate tables.
- **2NF.** Every table with a composite key (`guest_interests`, `experience_interests`,
  `experience_highlights`, `experience_resource_requirements`, `guest_preferred_times`)
  has non-key attributes that depend on the whole key.
- **3NF / BCNF.** Non-key attributes depend only on their table's key. Lookups (category,
  interest, supplier) are referenced by key rather than repeated. Contact details live
  once, on `users`, `guest_profiles` or `staff_members`.

Deliberate, controlled exceptions, each enforced by the database:

| Item | Why it's kept | How it stays correct |
|------|---------------|----------------------|
| `experience_slots.seats_booked` | Capacity checks must be O(1) and race-free under concurrency. | Changed only by the bookings trigger, under the slot's row lock; `CHECK (seats_booked ≤ capacity)`; audit query Q10 must return 0 rows. |
| `bookings.unit_price` | A historical fact: the price at booking time, which must not change when the catalogue does. | Snapshot, not a copy of a live value. |
| `bookings.total_amount`, `experience_slots.during` | Convenience for queries and indexes. | Generated columns, computed by PostgreSQL. |
| `resource_allocations.slot_id` when `booking_id` is set | One overlap query covers session-level and per-guest holds. | Trigger rejects an allocation whose slot differs from its booking's slot (`LXR04`). |

## 5. Deletion rules

Nothing with financial or historical meaning can be deleted by accident. Records are
retired instead (`experiences.status = 'archived'`, `staff_members.is_active`,
`resources.is_active`, `suppliers.is_active`, `slot.status = 'cancelled'`).

| Rule | Where | Effect |
|------|-------|--------|
| **RESTRICT** | bookings → guest / slot; payments and reviews → booking; experiences → category / supplier; slots → experience; assignments → staff; allocations, requirements → resource; interest links → interest; payments → recording staff | Deleting the parent fails while children exist. |
| **CASCADE** | Owned detail rows: identities, profile and preferences → user/guest; highlights, interest links, requirements, blackouts → experience; assignments, allocations, itinerary items → slot; history → booking; items → plan; maintenance → resource | Removed with their owner. A cascade still stops at any RESTRICT below it (a user with bookings can't be deleted). |
| **SET NULL** | Actor references (`changed_by_user_id`, `created_by_user_id`, `moderated_by_user_id`), `staff_members.user_id`, `itinerary_items.booking_id` | The record survives; the link is cleared. |

RESTRICT violations report SQLSTATE `23503` on PostgreSQL ≤ 17 and `23001` on
PostgreSQL 18+. The app must treat both as "in use" (the checks do).

## 6. Indexes

- Every foreign key used for joins or parent deletes is indexed, mostly through
  composite keys or unique constraints that lead with it.
- **Partial unique indexes** enforce rules on subsets of rows: one active booking per
  guest per slot, one successful payment per booking, one active lead per slot, one
  session-level hold per resource per slot.
- **Expression index:** unique `lower(email)` for case-insensitive login identity.
- **GiST** on `experience_slots.during` for range-overlap (`&&`) searches.
- **Partial index** on `experience_slots(starts_at) WHERE status = 'scheduled'` for
  availability browsing.
- Time-ordered lookups: `bookings(guest_id, created_at)`, `bookings(slot_id, status)`,
  `booking_status_history(booking_id, changed_at)`, `payment_attempts(booking_id, attempted_at)`.

## 7. Concurrency and transactions

### Booking seats (no overbooking)

Two triggers on `bookings`:

1. `bookings_validate` (`BEFORE INSERT OR UPDATE OF status, slot_id`) checks the status
   transition (see [`ERD.md`](./ERD.md#booking-status-lifecycle)) and blocks moving a
   booking to another slot. New bookings start as `pending` or `confirmed`. It has **no
   side effects**: BEFORE triggers also fire for rows that `INSERT … ON CONFLICT DO
   NOTHING` then skips. An earlier draft reserved seats here, and a probe showed an
   idempotent retry leaking seats (2 → 4).
2. `bookings_hold_seats` (`AFTER INSERT OR UPDATE OF status, party_size`) fires only for
   rows actually written. It computes the seat change (every status except `cancelled`
   holds seats) and reserves seats with one conditional update:

   ```sql
   UPDATE experience_slots
      SET seats_booked = seats_booked + delta
    WHERE id = NEW.slot_id AND status = 'scheduled'
      AND seats_booked + delta <= capacity;
   -- no row updated → RAISE 'LXB01' (full or not open)
   ```

The `UPDATE` takes the slot's **row lock**. Concurrent bookings for the same slot queue
behind it. Under `READ COMMITTED`, PostgreSQL re-evaluates the `WHERE` clause against the
newly committed row, so each waiting transaction sees the seats the previous one took.
The `CHECK (seats_booked <= capacity)` constraint is a second line of defence. The seat
change happens in the same statement as the booking row, so a failure rolls both back:
`LXB01` removes the row, and a unique or check violation means the AFTER trigger never
runs. Checks cover each case, including an `ON CONFLICT` retry reserving nothing.

Supporting rules: at most one active booking per guest per slot (partial unique index), a
per-guest idempotency key (a retried request can't book twice), and slots that can't be
rescheduled or cancelled while seats are held (`LXT01`).

**Verified with real parallel connections** on PostgreSQL 16 (`npm run
db:test:concurrency`). 8 sessions raced for 3 seats: 3 succeeded, 5 got `LXB01`,
`seats_booked = 3`. 30 sessions raced for 7 seats: 7 succeeded, 23 got `LXB01`.

### Booking transaction shape (for Phase 6)

```sql
BEGIN;  -- READ COMMITTED (default)
SELECT set_config('luxe.actor_user_id', :user_id, true);   -- recorded in the status history
INSERT INTO bookings (reference, guest_id, slot_id, party_size, unit_price, currency, status, idempotency_key)
SELECT :reference, :guest_id, s.id, :party_size,
       coalesce(s.price_override, e.base_price), e.currency, 'confirmed', :idempotency_key
  FROM experience_slots s JOIN experiences e ON e.id = s.experience_id
 WHERE s.id = :slot_id AND e.status = 'published'
ON CONFLICT (guest_id, idempotency_key) DO NOTHING       -- retried request: no second booking
RETURNING id;
-- per-guest equipment, one resource at a time, in resource-id order:
INSERT INTO resource_allocations (resource_id, slot_id, booking_id, quantity) VALUES (…);
COMMIT;
```

The price comes from the database, never the client. Map `LXB01` to "sold out", and
`23505` on `bookings_one_active_per_guest_slot` to "already booked". With `SERIALIZABLE`
isolation, retry on `40001`.

Locking order: the booking takes the slot row lock (via the trigger), then resource rows
in ascending id order. Everything that touches several resources follows the same order,
so these transactions can't deadlock each other.

### Staff and resources

- **Staff** (`staff_assignments_check`): locks the staff member's row (`FOR UPDATE`),
  then rejects any active assignment whose slot overlaps (`during && during`) → `LXS01`.
  Inactive staff → `LXS02`.
- **Resources** (`resource_allocations_check`): locks the resource row, then requires
  `overlapping holds + units in maintenance + requested ≤ quantity_total` → `LXR01`.
  Holds are only for scheduled slots (`LXR02`). The sum is conservative: it never
  over-allocates, but may refuse when two existing holds overlap the new one without
  overlapping each other.
- **Maintenance** (`resource_maintenance_check`): can't take out units already held in
  that window → `LXR03`.
- **Blackouts** (`experience_slots_check_schedule`): a slot can't be scheduled inside a
  blackout for its experience or the whole resort → `LXT02`. Sessions affected by a new
  blackout are found with query Q09 and cancelled by an admin.

### Custom error codes

| Code | Meaning |
|------|---------|
| `LXB01` | Slot full or not open for booking |
| `LXB02` | Invalid booking status, or invalid transition |
| `LXB03` | Booking moved to another slot |
| `LXS01` / `LXS02` | Staff double-booked / inactive |
| `LXR01` / `LXR02` | Resource capacity exceeded / resource or slot unavailable |
| `LXR03` / `LXR04` | Maintenance conflicts with holds / allocation slot ≠ booking slot |
| `LXT01` / `LXT02` | Slot change blocked / slot inside a blackout |
| `LXV01` | Review needs a completed booking |

## 8. Mapping to the frontend

The Phase 5 DAL must return the existing DTOs (`lib/types/*`), so pages only change
their import:

| DTO field | Source |
|-----------|--------|
| `ExperienceSummary.priceFromMinor` | `decimalToMinor(experiences.base_price)` |
| `ExperienceSummary.category` | `experience_categories.slug` |
| `ExperienceSummary.interests` | `experience_interests` → `interests.slug` |
| `ExperienceSummary.accessible` / `featured` | `is_step_free` / `is_featured` |
| `ExperienceSlot.booked` | `experience_slots.seats_booked` |
| `GuestPreferences` | `guest_preferences` + `guest_interests` + `guest_preferred_times` |
| `ItineraryDraft` | `itinerary_plans` + `itinerary_items` (titles and prices by join, not copies) |
| `BookingSummary.totalMinor` | `decimalToMinor(bookings.total_amount)` |

## 9. Seed data

`npm run db:seed` loads development data in one transaction, without duplicating the
frontend sample data:

- **From the app:** experiences, highlights, interests, the 116-session schedule and the
  10 sample bookings (`lib/placeholder/catalogue.ts`), plus category labels and copy and
  the interest list (`lib/categories.ts`, `lib/placeholder/landing.ts`, `lib/interests.ts`).
- **Seed-only** (`scripts/db/seed-data.ts`, marked PLACEHOLDER, example.com addresses):
  4 suppliers, 8 staff, 9 resources and 11 requirements, 2 maintenance windows, 2
  blackouts, the sample guest's preferences and itinerary, payments and a review.
- **Result:** 9 users (admin, 2 staff accounts, 6 guests), 118 slots (incl. 2 past ones for
  past bookings), 117 lead assignments, 82 resource holds, 10 bookings with automatic
  status history, 5 payment attempts, 1 review, 1 itinerary plan with 3 items.
- **Differences from the frontend sample:**
  - `seats_booked` starts at 0 and counts only seeded bookings. The catalogue's
    illustrative seat counts aren't real bookings.
  - The summit trek on 14 Nov is stored as cancelled because of the trail-repair blackout.
- Bookings reach their final status through valid transitions, so the history reads
  `new → confirmed → completed`.

## 10. Setup

```bash
cp .env.example .env.local        # then paste Neon dev-branch connection strings
npm run db:migrate                # apply drizzle/*.sql (uses DATABASE_URL_UNPOOLED)
npm run db:seed                   # sample data (refuses if data exists)
npm run db:seed:reset             # empty all tables, then seed again
npm run db:verify                 # offline: migrations + seed + checks + queries (PGlite)
TEST_DATABASE_URL=… npm run db:test:concurrency   # parallel booking race (psql)
npm run db:generate               # after editing lib/db/schema
npm run db:check                  # migration consistency
npm run db:studio                 # browse the database
npm run db:set-role -- you@example.com admin   # bootstrap the first admin (account must exist)
```

The seed and migrate scripts refuse to run when `NODE_ENV` or `VERCEL_ENV` is
`production`; `db:migrate --allow-production` is reserved for the release pipeline.
The scripts never print connection strings.

## 11. Limitations and next steps

- **Partial app integration.** The guest, staff and admin areas read and write through
  `lib/dal/`. The public catalogue and booking creation (Phase 6) don't yet.
- **Not run against Neon.** `db:migrate` and `db:seed` (Neon WebSocket driver) haven't run
  against a live Neon database because no credentials exist here. The same migrations,
  seed, checks and queries were verified on PostgreSQL 16 (via `pg`) and PostgreSQL 18
  (PGlite).
- **Authorization is application-level** (Phase 3): `users.role` plus owner-scoped DAL
  queries. Row-level security is a possible later hardening step.
- **Resort timezone and currency** are still placeholders (UTC / USD).
- Per-guest requirements are whole units per guest; ratios (one canoe per two guests) would
  need a `guests_per_unit` column.
- Resource peaks are computed conservatively (pairwise overlap sum), not by an exact
  timeline sweep.
