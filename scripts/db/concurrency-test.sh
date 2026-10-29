#!/usr/bin/env bash
# Concurrency test for booking seat protection, using real parallel connections.
#
# Starts ATTEMPTS separate psql sessions that each try to book 1 seat on a slot
# with CAPACITY seats, all at the same moment. Each session holds its transaction
# open briefly, so the others queue on the slot's row lock. Expected: exactly
# CAPACITY bookings succeed, the rest fail with LXB01, and seats_booked == CAPACITY.
#
# Needs psql and a disposable, already-migrated database (local or a Neon
# development branch). Creates its own fixtures and removes them afterwards.
#
#   TEST_DATABASE_URL=postgres://… npm run db:test:concurrency
set -euo pipefail

if [[ -z "${TEST_DATABASE_URL:-}" && -f .env.local ]]; then
  TEST_DATABASE_URL="$(grep -E '^TEST_DATABASE_URL=' .env.local | head -1 | cut -d= -f2- || true)"
fi
URL="${TEST_DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set TEST_DATABASE_URL to a disposable, migrated development database (never production)." >&2
  exit 1
fi
command -v psql >/dev/null || { echo "psql is required." >&2; exit 1; }

ATTEMPTS="${ATTEMPTS:-8}"
CAPACITY="${CAPACITY:-3}"
RUN="ct$(date +%s)$$"
WORK="$(mktemp -d)"
PSQL=(psql "$URL" -X -q -v ON_ERROR_STOP=1 -tA)

cleanup() {
  "${PSQL[@]}" >/dev/null 2>&1 <<SQL || true
DELETE FROM bookings WHERE slot_id IN (SELECT s.id FROM experience_slots s JOIN experiences e ON e.id = s.experience_id WHERE e.slug = '${RUN}');
DELETE FROM experience_slots WHERE experience_id IN (SELECT id FROM experiences WHERE slug = '${RUN}');
DELETE FROM experiences WHERE slug = '${RUN}';
DELETE FROM experience_categories WHERE slug = '${RUN}';
DELETE FROM users WHERE email LIKE '${RUN}-%@example.com';
SQL
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "Creating fixtures (slot with ${CAPACITY} seats, ${ATTEMPTS} guests) …"
SLOT_ID="$("${PSQL[@]}" <<SQL
WITH category AS (
  INSERT INTO experience_categories (slug, label) VALUES ('${RUN}', 'Concurrency test') RETURNING id
), experience AS (
  INSERT INTO experiences (category_id, slug, title, summary, description, location, meeting_point,
                           difficulty, duration_minutes, max_group_size, base_price, status)
  SELECT id, '${RUN}', 'Concurrency test', 'Fixture created by the concurrency test.', 'Fixture.',
         'Test', 'Test', 'easy', 60, ${CAPACITY}, 10.00, 'published'
    FROM category RETURNING id
), guests AS (
  INSERT INTO users (email, display_name)
  SELECT '${RUN}-' || n || '@example.com', 'Test guest ' || n FROM generate_series(1, ${ATTEMPTS}) n
  RETURNING id
), profiles AS (
  INSERT INTO guest_profiles (user_id, first_name, last_name) SELECT id, 'Test', 'Guest' FROM guests
)
INSERT INTO experience_slots (experience_id, starts_at, ends_at, capacity)
SELECT id, timestamptz '2030-01-15 10:00+00', timestamptz '2030-01-15 11:00+00', ${CAPACITY} FROM experience
RETURNING id;
SQL
)"

echo "Starting ${ATTEMPTS} concurrent booking transactions …"
for n in $(seq 1 "$ATTEMPTS"); do
  (
    if "${PSQL[@]}" -v VERBOSITY=verbose >"$WORK/$n.out" 2>"$WORK/$n.err" <<SQL
BEGIN;
INSERT INTO bookings (reference, guest_id, slot_id, party_size, unit_price, status, idempotency_key)
VALUES ('LX-' || upper(substr(md5(random()::text), 1, 8)),
        (SELECT id FROM users WHERE email = '${RUN}-${n}@example.com'),
        '${SLOT_ID}', 1, 10.00, 'confirmed', gen_random_uuid());
SELECT pg_sleep(0.5);
COMMIT;
SQL
    then echo ok >"$WORK/$n.result"; else echo failed >"$WORK/$n.result"; fi
  ) &
done
wait

SUCCEEDED="$(grep -l '^ok$' "$WORK"/*.result | wc -l | tr -d ' ')"
FULL="$(grep -l 'LXB01' "$WORK"/*.err 2>/dev/null | wc -l | tr -d ' ')"
OTHER_ERRORS="$(grep -L 'LXB01' $(grep -l '^failed$' "$WORK"/*.result | sed 's/result$/err/') 2>/dev/null | wc -l | tr -d ' ')"
read -r SEATS BOOKINGS <<<"$("${PSQL[@]}" -F ' ' -c "SELECT s.seats_booked, (SELECT count(*) FROM bookings b WHERE b.slot_id = s.id AND b.status <> 'cancelled') FROM experience_slots s WHERE s.id = '${SLOT_ID}'")"

echo "  succeeded:              ${SUCCEEDED} (expected ${CAPACITY})"
echo "  rejected as full LXB01: ${FULL} (expected $((ATTEMPTS - CAPACITY)))"
echo "  other errors:           ${OTHER_ERRORS} (expected 0)"
echo "  seats_booked:           ${SEATS} (expected ${CAPACITY})"
echo "  active bookings:        ${BOOKINGS} (expected ${CAPACITY})"

if [[ "$SUCCEEDED" == "$CAPACITY" && "$FULL" == "$((ATTEMPTS - CAPACITY))" && "$OTHER_ERRORS" == "0" \
      && "$SEATS" == "$CAPACITY" && "$BOOKINGS" == "$CAPACITY" ]]; then
  echo "PASS: no overbooking under ${ATTEMPTS} concurrent attempts."
else
  echo "FAIL: see the counts above." >&2
  for f in "$WORK"/*.err; do [[ -s "$f" ]] && { echo "--- $(basename "$f")" >&2; cat "$f" >&2; }; done
  exit 1
fi
