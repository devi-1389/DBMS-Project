"""
SQL Query Laboratory: a catalogue of demonstration queries for every SQL category
plus a guarded executor.

Execution modes
  * readonly - SELECT / SHOW / CALL of read-only routines, run inside
               START TRANSACTION READ ONLY with a statement timeout and row limit.
  * sandbox  - multi-step DML / trigger / procedure demonstrations run on an isolated
               connection and ALWAYS rolled back, so the real data never changes.
  * ddl      - DDL demonstrations executed only against session-scoped
               TEMPORARY tables named tmp_lab_*, which vanish with the connection.
  * display  - shown for study only (would permanently change the schema).
Only administrators may execute; everybody can read the catalogue.
"""
import datetime
import decimal
import re

import pymysql
from config import Config
from database.connection import isolated_connection

CATEGORIES = [
    ('ddl', 'DDL', 'Data Definition Language - CREATE, ALTER, DROP'),
    ('dml', 'DML', 'Data Manipulation Language - INSERT, UPDATE, DELETE'),
    ('dql', 'DQL', 'Data Query Language - SELECT with filtering, sorting and expressions'),
    ('joins', 'Joins', 'INNER, LEFT (anti-join), SELF and multi-table joins'),
    ('aggregates', 'Aggregate Functions', 'COUNT, SUM, AVG, MIN, MAX'),
    ('groupby', 'GROUP BY & HAVING', 'Grouping rows and filtering groups'),
    ('subqueries', 'Subqueries', 'Scalar, IN, EXISTS, correlated and derived-table subqueries'),
    ('views', 'Views', 'Virtual tables defined in schema.sql'),
    ('procedures', 'Stored Procedures & Functions', 'Server-side routines with IN/OUT parameters'),
    ('triggers', 'Triggers', 'Automatic actions fired by INSERT/UPDATE'),
]

Q = []


def _q(**kw):
    kw.setdefault('mode', 'readonly')
    kw.setdefault('steps', None)
    Q.append(kw)


# ----------------------------------------------------------------------------- DDL
_q(id='ddl-show-create', category='ddl', title='Inspect the real CREATE TABLE of bookings',
   sql="SHOW CREATE TABLE bookings;",
   explanation='Returns the exact DDL MySQL stores for the bookings table: column types, the PRIMARY KEY, '
               'UNIQUE booking_reference, three FOREIGN KEY constraints with ON DELETE RESTRICT and the CHECK '
               'constraints on party size and amount.',
   tables=['bookings'], expected='One row: Table = bookings, Create Table = full CREATE TABLE statement.')

_q(id='ddl-create-temp', category='ddl', title='CREATE TABLE with constraints (temporary sandbox)', mode='ddl',
   sql="""CREATE TEMPORARY TABLE tmp_lab_promotions (
    promo_id      INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    promo_code    VARCHAR(20) NOT NULL UNIQUE,
    discount_pct  DECIMAL(5,2) NOT NULL,
    valid_from    DATE NOT NULL,
    valid_to      DATE NOT NULL,
    CONSTRAINT chk_lab_discount CHECK (discount_pct > 0 AND discount_pct <= 50),
    CONSTRAINT chk_lab_dates CHECK (valid_to >= valid_from)
);
DESCRIBE tmp_lab_promotions;""",
   steps=[
       {'sql': """CREATE TEMPORARY TABLE tmp_lab_promotions (
    promo_id INT AUTO_INCREMENT PRIMARY KEY, experience_id INT NOT NULL,
    promo_code VARCHAR(20) NOT NULL UNIQUE, discount_pct DECIMAL(5,2) NOT NULL,
    valid_from DATE NOT NULL, valid_to DATE NOT NULL,
    CONSTRAINT chk_lab_discount CHECK (discount_pct > 0 AND discount_pct <= 50),
    CONSTRAINT chk_lab_dates CHECK (valid_to >= valid_from))"""},
       {'sql': 'DESCRIBE tmp_lab_promotions', 'label': 'DESCRIBE tmp_lab_promotions'},
   ],
   explanation='Defines a new relation with a surrogate PRIMARY KEY, a UNIQUE candidate key and CHECK '
               'constraints. It is created as a TEMPORARY table so the demonstration never alters the real schema.',
   tables=['tmp_lab_promotions (temporary)'], expected='DESCRIBE output: 6 columns with PRI/UNI keys.')

_q(id='ddl-alter', category='ddl', title='ALTER TABLE: add a column and a constraint', mode='ddl',
   sql="""CREATE TEMPORARY TABLE tmp_lab_promotions (promo_id INT PRIMARY KEY, promo_code VARCHAR(20));
ALTER TABLE tmp_lab_promotions
    ADD COLUMN max_redemptions INT NOT NULL DEFAULT 100,
    ADD CONSTRAINT chk_lab_redemptions CHECK (max_redemptions > 0),
    MODIFY promo_code VARCHAR(30) NOT NULL;
DESCRIBE tmp_lab_promotions;""",
   steps=[
       {'sql': 'CREATE TEMPORARY TABLE tmp_lab_promotions (promo_id INT PRIMARY KEY, promo_code VARCHAR(20))'},
       {'sql': 'DESCRIBE tmp_lab_promotions', 'label': 'Before ALTER'},
       {'sql': """ALTER TABLE tmp_lab_promotions
    ADD COLUMN max_redemptions INT NOT NULL DEFAULT 100,
    ADD CONSTRAINT chk_lab_redemptions CHECK (max_redemptions > 0),
    MODIFY promo_code VARCHAR(30) NOT NULL"""},
       {'sql': 'DESCRIBE tmp_lab_promotions', 'label': 'After ALTER'},
   ],
   explanation='ALTER TABLE changes an existing relation: ADD COLUMN with a DEFAULT, ADD CONSTRAINT CHECK and '
               'MODIFY to widen a VARCHAR and make it NOT NULL.',
   tables=['tmp_lab_promotions (temporary)'], expected='Two DESCRIBE results: 2 columns before, 3 columns after.')

_q(id='ddl-drop', category='ddl', title='DROP TABLE', mode='ddl',
   sql="""CREATE TEMPORARY TABLE tmp_lab_scratch (id INT PRIMARY KEY);
INSERT INTO tmp_lab_scratch VALUES (1), (2), (3);
SELECT COUNT(*) AS rows_before_drop FROM tmp_lab_scratch;
DROP TEMPORARY TABLE tmp_lab_scratch;
SELECT COUNT(*) FROM tmp_lab_scratch;   -- fails: table no longer exists""",
   steps=[
       {'sql': 'CREATE TEMPORARY TABLE tmp_lab_scratch (id INT PRIMARY KEY)'},
       {'sql': 'INSERT INTO tmp_lab_scratch VALUES (1), (2), (3)'},
       {'sql': 'SELECT COUNT(*) AS rows_before_drop FROM tmp_lab_scratch', 'label': 'Before DROP'},
       {'sql': 'DROP TEMPORARY TABLE tmp_lab_scratch'},
       {'sql': 'SELECT COUNT(*) FROM tmp_lab_scratch', 'label': 'After DROP', 'expect_error': True},
   ],
   explanation='DROP TABLE removes the relation and all its rows. The final SELECT fails with error 1146 '
               '(table does not exist), proving the drop.',
   tables=['tmp_lab_scratch (temporary)'], expected='3 rows before; then error 1146 "Table doesn\'t exist".')

_q(id='ddl-index', category='ddl', title='CREATE INDEX (study example)', mode='display',
   sql="""CREATE INDEX idx_bookings_created ON bookings (created_at);
-- Undo:
DROP INDEX idx_bookings_created ON bookings;""",
   explanation='Secondary indexes speed up WHERE/ORDER BY on a column. Shown for study only because it would '
               'permanently change the real schema. The existing indexes are listed in the Relational Schema tab.',
   tables=['bookings'], expected='Query OK, 0 rows affected.')

# ----------------------------------------------------------------------------- DML
_q(id='dml-insert', category='dml', title='INSERT a new supplier', mode='sandbox',
   sql="""INSERT INTO suppliers (name, contact_person, email, supplier_type, is_local, products_services)
VALUES ('Malabar Coir Weavers Collective', 'Lakshmi Nair', 'coir@example.org',
        'Indigenous Craft Society', TRUE, 'Handwoven coir mats and hammocks');

SELECT supplier_id, name, supplier_type, is_local, created_at
FROM suppliers WHERE supplier_id = LAST_INSERT_ID();
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "SELECT COUNT(*) AS suppliers_before FROM suppliers", 'label': 'Before INSERT'},
       {'sql': """INSERT INTO suppliers (name, contact_person, email, supplier_type, is_local, products_services)
VALUES ('Malabar Coir Weavers Collective', 'Lakshmi Nair', 'coir@example.org',
        'Indigenous Craft Society', TRUE, 'Handwoven coir mats and hammocks')"""},
       {'sql': "SELECT supplier_id, name, supplier_type, is_local, created_at FROM suppliers WHERE supplier_id = LAST_INSERT_ID()",
        'label': 'Inserted row'},
       {'sql': "SELECT COUNT(*) AS suppliers_after FROM suppliers", 'label': 'After INSERT (inside the transaction)'},
   ],
   explanation='INSERT adds a tuple; AUTO_INCREMENT generates the primary key and DEFAULT fills created_at and '
               'is_active. The lab rolls the transaction back afterwards (AUTO_INCREMENT counters are not rolled '
               'back in InnoDB, so the next real id may skip a number).',
   tables=['suppliers'], expected='Count increases by 1 inside the transaction; the new row is shown.')

_q(id='dml-update', category='dml', title='UPDATE prices (fires the price-audit trigger)', mode='sandbox',
   sql="""UPDATE experiences
SET base_price = ROUND(base_price * 1.10, 2)
WHERE slug = 'waterfall-yoga-pranayama';
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "SELECT experience_id, name, base_price FROM experiences WHERE slug = 'waterfall-yoga-pranayama'",
        'label': 'Before UPDATE'},
       {'sql': "UPDATE experiences SET base_price = ROUND(base_price * 1.10, 2) WHERE slug = 'waterfall-yoga-pranayama'"},
       {'sql': "SELECT experience_id, name, base_price FROM experiences WHERE slug = 'waterfall-yoga-pranayama'",
        'label': 'After UPDATE'},
       {'sql': """SELECT action_type, entity_id, old_values, new_values, ip_address FROM audit_logs
WHERE action_type = 'PRICE_CHANGE_TRIGGER' ORDER BY log_id DESC LIMIT 1""",
        'label': 'Row written by trg_experience_price_audit'},
   ],
   explanation='UPDATE modifies attribute values of matching tuples. The AFTER UPDATE trigger '
               'trg_experience_price_audit automatically records the old and new price in audit_logs as JSON.',
   tables=['experiences', 'audit_logs'], expected='Price ₹1,200.00 → ₹1,320.00 and one PRICE_CHANGE_TRIGGER audit row.')

_q(id='dml-delete', category='dml', title='DELETE with ON DELETE CASCADE', mode='sandbox',
   sql="""SET @bk := (SELECT booking_id FROM bookings WHERE booking_status = 'cancelled'
                   ORDER BY booking_id LIMIT 1);
DELETE FROM bookings WHERE booking_id = @bk;
-- payments, booking_status_history, resource_allocations and staff_assignments rows
-- referencing the booking are removed automatically (ON DELETE CASCADE).
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "SET @bk := (SELECT booking_id FROM bookings WHERE booking_status = 'cancelled' ORDER BY booking_id LIMIT 1)"},
       {'sql': """SELECT @bk AS booking_id,
  (SELECT COUNT(*) FROM payments WHERE booking_id = @bk) AS payments,
  (SELECT COUNT(*) FROM booking_status_history WHERE booking_id = @bk) AS history_rows,
  (SELECT COUNT(*) FROM resource_allocations WHERE booking_id = @bk) AS allocations""", 'label': 'Before DELETE'},
       {'sql': "DELETE FROM bookings WHERE booking_id = @bk"},
       {'sql': """SELECT @bk AS booking_id,
  (SELECT COUNT(*) FROM bookings WHERE booking_id = @bk) AS booking_rows,
  (SELECT COUNT(*) FROM payments WHERE booking_id = @bk) AS payments,
  (SELECT COUNT(*) FROM booking_status_history WHERE booking_id = @bk) AS history_rows,
  (SELECT COUNT(*) FROM resource_allocations WHERE booking_id = @bk) AS allocations""", 'label': 'After DELETE'},
   ],
   explanation='Deleting a parent row cascades to every child table whose foreign key is declared ON DELETE '
               'CASCADE, preserving referential integrity without orphan rows.',
   tables=['bookings', 'payments', 'booking_status_history', 'resource_allocations'],
   expected='Child counts > 0 before, all 0 after.')

_q(id='dml-upsert', category='dml', title='INSERT ... ON DUPLICATE KEY UPDATE (upsert)', mode='sandbox',
   sql="""INSERT INTO guest_preferences (guest_id, interest_id, weight)
VALUES (7, 3, 4)
ON DUPLICATE KEY UPDATE weight = VALUES(weight);
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "SELECT guest_id, interest_id, weight FROM guest_preferences WHERE guest_id = 7 AND interest_id = 3",
        'label': 'Before'},
       {'sql': "INSERT INTO guest_preferences (guest_id, interest_id, weight) VALUES (7, 3, 4) "
               "ON DUPLICATE KEY UPDATE weight = VALUES(weight)"},
       {'sql': "SELECT guest_id, interest_id, weight FROM guest_preferences WHERE guest_id = 7 AND interest_id = 3",
        'label': 'After'},
   ],
   explanation='Because (guest_id, interest_id) is a UNIQUE key, the INSERT collides and becomes an UPDATE. '
               'The application uses this pattern to save preference weights.',
   tables=['guest_preferences'], expected='Weight changes from 2 to 4 for guest 7 / interest 3.')

# ----------------------------------------------------------------------------- DQL
_q(id='dql-select', category='dql', title='Filter, sort and limit the catalogue',
   sql="""SELECT name, pricing_type, base_price, duration_minutes, eco_impact_score
FROM experiences
WHERE is_active = TRUE AND base_price BETWEEN 1000 AND 3000
ORDER BY eco_impact_score DESC, base_price ASC
LIMIT 8;""",
   explanation='Projection of five attributes, selection with BETWEEN, multi-key ORDER BY and LIMIT.',
   tables=['experiences'], expected='Up to 8 experiences priced ₹1,000–₹3,000, greenest first.')

_q(id='dql-pattern', category='dql', title='Pattern matching with LIKE and IN',
   sql="""SELECT experience_id, name, category_id
FROM experiences
WHERE (name LIKE '%Kayak%' OR full_desc LIKE '%kayak%')
  AND category_id IN (2, 3);""",
   explanation='LIKE with % wildcards finds kayaking experiences; IN restricts to the Nature (2) and '
               'Adventure (3) categories.',
   tables=['experiences'], expected='The mangrove and sea-kayaking experiences.')

_q(id='dql-case', category='dql', title='Computed columns with CASE and date functions',
   sql="""SELECT slot_id, slot_date, DAYNAME(slot_date) AS weekday,
       TIME_FORMAT(start_time, '%h:%i %p') AS starts,
       CASE
         WHEN HOUR(start_time) < 12 THEN 'Morning'
         WHEN HOUR(start_time) < 17 THEN 'Afternoon'
         ELSE 'Evening'
       END AS time_block,
       max_capacity - booked_capacity AS seats_left
FROM experience_slots
WHERE slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
ORDER BY slot_date, start_time
LIMIT 15;""",
   explanation='Derived attributes: CASE classifies the start hour, DAYNAME/TIME_FORMAT format dates, and an '
               'arithmetic expression computes remaining capacity.',
   tables=['experience_slots'], expected="Today's and tomorrow's sessions with a time block label.")

_q(id='dql-distinct', category='dql', title='DISTINCT values',
   sql="""SELECT DISTINCT resource_type, condition_status
FROM resources
ORDER BY resource_type;""",
   explanation='DISTINCT removes duplicate (resource_type, condition_status) combinations.',
   tables=['resources'], expected='One row per distinct type/condition pair.')

# ----------------------------------------------------------------------------- Joins
_q(id='join-inner', category='joins', title='INNER JOIN across five tables',
   sql="""SELECT b.booking_reference, u.full_name AS guest, e.name AS experience,
       c.name AS category, es.slot_date, es.start_time, b.party_size, b.total_amount, b.booking_status
FROM bookings b
INNER JOIN users u                 ON u.user_id = b.guest_id
INNER JOIN experiences e           ON e.experience_id = b.experience_id
INNER JOIN experience_categories c ON c.category_id = e.category_id
INNER JOIN experience_slots es     ON es.slot_id = b.slot_id
ORDER BY es.slot_date, es.start_time;""",
   explanation='Each INNER JOIN follows a foreign key; only bookings with matching rows in every table appear.',
   tables=['bookings', 'users', 'experiences', 'experience_categories', 'experience_slots'],
   expected='One row per booking with guest, experience, category and session time.')

_q(id='join-left', category='joins', title='LEFT JOIN anti-join: experiences never booked',
   sql="""SELECT e.experience_id, e.name, e.base_price
FROM experiences e
LEFT JOIN bookings b ON b.experience_id = e.experience_id
WHERE b.booking_id IS NULL
ORDER BY e.name;""",
   explanation='LEFT JOIN keeps every experience; rows with no matching booking have NULL booking columns, '
               'which the WHERE clause selects.',
   tables=['experiences', 'bookings'], expected='Experiences that have no bookings yet.')

_q(id='join-self', category='joins', title='SELF JOIN: cheaper alternatives in the same category',
   sql="""SELECT a.name AS experience, a.base_price,
       b.name AS cheaper_alternative, b.base_price AS alternative_price
FROM experiences a
JOIN experiences b
  ON b.category_id = a.category_id
 AND b.base_price < a.base_price
 AND b.pricing_type = a.pricing_type
WHERE a.base_price > 2500
ORDER BY a.name, b.base_price;""",
   explanation='The experiences table is joined with itself (aliases a and b) to pair each premium experience '
               'with lower-priced experiences of the same category and pricing model.',
   tables=['experiences'], expected='Pairs of (premium, cheaper) experiences.')

_q(id='join-roster', category='joins', title='Staff duty roster (users ⋈ staff ⋈ assignments ⋈ slots)',
   sql="""SELECT u.full_name AS staff_member, s.specialization, e.name AS experience,
       es.slot_date, es.start_time, sa.assignment_status
FROM staff_assignments sa
JOIN staff s              ON s.staff_id = sa.staff_id
JOIN users u              ON u.user_id = s.user_id
JOIN experience_slots es  ON es.slot_id = sa.slot_id
JOIN experiences e        ON e.experience_id = es.experience_id
ORDER BY es.slot_date, es.start_time;""",
   explanation='Resolves the staff_assignments relationship to readable names by joining through staff to users '
               'and through the slot to the experience.',
   tables=['staff_assignments', 'staff', 'users', 'experience_slots', 'experiences'],
   expected='Every assignment with staff name and session.')

# ----------------------------------------------------------------------------- Aggregates
_q(id='agg-revenue', category='aggregates', title='Overall payment statistics',
   sql="""SELECT COUNT(*)            AS transactions,
       SUM(amount)         AS gross_amount,
       AVG(amount)         AS average_ticket,
       MIN(amount)         AS smallest,
       MAX(amount)         AS largest
FROM payments
WHERE payment_status = 'successful';""",
   explanation='Aggregate functions collapse all successful payments into one summary row.',
   tables=['payments'], expected='A single row with count, sum, average, minimum and maximum.')

_q(id='agg-rating', category='aggregates', title='Rating statistics per reviewed experience',
   sql="""SELECT e.name, COUNT(r.review_id) AS reviews,
       ROUND(AVG(r.rating), 2) AS avg_rating, MIN(r.rating) AS lowest, MAX(r.rating) AS highest
FROM experiences e
JOIN reviews r ON r.experience_id = e.experience_id AND r.is_approved = TRUE
GROUP BY e.experience_id, e.name
ORDER BY avg_rating DESC;""",
   explanation='Aggregates computed per experience (the GROUP BY makes one group per experience).',
   tables=['experiences', 'reviews'], expected='One row per experience that has approved reviews.')

_q(id='agg-capacity', category='aggregates', title='Capacity sold in the next 7 days',
   sql="""SELECT SUM(max_capacity) AS capacity_units,
       SUM(booked_capacity) AS booked_units,
       ROUND(100 * SUM(booked_capacity) / SUM(max_capacity), 1) AS occupancy_pct,
       COUNT(DISTINCT experience_id) AS experiences_scheduled
FROM experience_slots
WHERE slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 6 DAY)
  AND slot_status <> 'cancelled';""",
   explanation='SUM and COUNT(DISTINCT ...) over the coming week give resort-wide occupancy.',
   tables=['experience_slots'], expected='One row with capacity, booked units and occupancy %.')

# ----------------------------------------------------------------------------- GROUP BY / HAVING
_q(id='grp-category', category='groupby', title='Revenue by category (GROUP BY)',
   sql="""SELECT c.name AS category, COUNT(b.booking_id) AS bookings,
       COALESCE(SUM(b.total_amount), 0) AS revenue
FROM experience_categories c
LEFT JOIN experiences e ON e.category_id = c.category_id
LEFT JOIN bookings b    ON b.experience_id = e.experience_id
                       AND b.booking_status IN ('confirmed', 'completed')
GROUP BY c.category_id, c.name
ORDER BY revenue DESC;""",
   explanation='Rows are grouped per category; aggregates are computed per group. LEFT JOINs keep categories '
               'with no bookings (revenue 0).',
   tables=['experience_categories', 'experiences', 'bookings'], expected='Six rows, one per category.')

_q(id='grp-having-guests', category='groupby', title='Guests with more than one booking (HAVING)',
   sql="""SELECT u.full_name, COUNT(*) AS bookings, SUM(b.total_amount) AS total_value
FROM bookings b
JOIN users u ON u.user_id = b.guest_id
GROUP BY b.guest_id, u.full_name
HAVING COUNT(*) > 1
ORDER BY bookings DESC;""",
   explanation='HAVING filters groups after aggregation (WHERE cannot reference COUNT(*)).',
   tables=['bookings', 'users'], expected='Guests who made at least two bookings.')

_q(id='grp-having-status', category='groupby', title='Booking status distribution per experience',
   sql="""SELECT e.name,
       SUM(b.booking_status = 'confirmed') AS confirmed,
       SUM(b.booking_status = 'completed') AS completed,
       SUM(b.booking_status = 'cancelled') AS cancelled
FROM bookings b
JOIN experiences e ON e.experience_id = b.experience_id
GROUP BY e.experience_id, e.name
HAVING SUM(b.booking_status IN ('confirmed', 'completed')) >= 1
ORDER BY e.name;""",
   explanation='Conditional aggregation (SUM of boolean expressions) pivots statuses into columns; HAVING keeps '
               'experiences with at least one active or completed booking.',
   tables=['bookings', 'experiences'], expected='Per-experience counts of each status.')

# ----------------------------------------------------------------------------- Subqueries
_q(id='sub-scalar', category='subqueries', title='Scalar subquery: priced above the average',
   sql="""SELECT name, base_price
FROM experiences
WHERE base_price > (SELECT AVG(base_price) FROM experiences)
ORDER BY base_price DESC;""",
   explanation='The inner query returns a single value (the average price) used by the outer WHERE.',
   tables=['experiences'], expected='Experiences more expensive than the catalogue average.')

_q(id='sub-in', category='subqueries', title='IN subquery: guests who booked an adventure',
   sql="""SELECT u.user_id, u.full_name, u.email
FROM users u
WHERE u.user_id IN (
    SELECT b.guest_id
    FROM bookings b
    JOIN experiences e ON e.experience_id = b.experience_id
    JOIN experience_categories c ON c.category_id = e.category_id
    WHERE c.slug = 'adventure'
);""",
   explanation='The subquery produces a set of guest ids; IN keeps users whose id is in that set.',
   tables=['users', 'bookings', 'experiences', 'experience_categories'], expected='Guests with adventure bookings.')

_q(id='sub-not-exists', category='subqueries', title='NOT EXISTS: resources never allocated',
   sql="""SELECT r.resource_id, r.name, r.resource_type
FROM resources r
WHERE NOT EXISTS (
    SELECT 1 FROM resource_allocations ra WHERE ra.resource_id = r.resource_id
);""",
   explanation='A correlated NOT EXISTS subquery is evaluated per outer row; it is true when no allocation '
               'references the resource.',
   tables=['resources', 'resource_allocations'], expected='Inventory that has never been reserved.')

_q(id='sub-correlated', category='subqueries', title='Correlated subquery: latest booking per guest',
   sql="""SELECT u.full_name, b.booking_reference, b.created_at, b.booking_status
FROM bookings b
JOIN users u ON u.user_id = b.guest_id
WHERE b.created_at = (
    SELECT MAX(b2.created_at) FROM bookings b2 WHERE b2.guest_id = b.guest_id
);""",
   explanation='The inner query references the outer row (b.guest_id), so it is re-evaluated for each booking.',
   tables=['bookings', 'users'], expected="Each guest's most recent booking(s).")

_q(id='sub-derived', category='subqueries', title='Derived table in FROM',
   sql="""SELECT t.category, t.experiences, t.avg_price
FROM (
    SELECT c.name AS category, COUNT(*) AS experiences, ROUND(AVG(e.base_price), 0) AS avg_price
    FROM experiences e JOIN experience_categories c ON c.category_id = e.category_id
    GROUP BY c.category_id, c.name
) AS t
WHERE t.avg_price > 2000;""",
   explanation='The subquery in FROM acts as a temporary relation that the outer query filters.',
   tables=['experiences', 'experience_categories'], expected='Categories whose average price exceeds ₹2,000.')

# ----------------------------------------------------------------------------- Views
_q(id='view-experience', category='views', title='v_experience_details',
   sql="""SELECT experience_name, category_name, supplier_name, base_price, avg_rating, total_reviews
FROM v_experience_details
ORDER BY total_reviews DESC, experience_name
LIMIT 10;""",
   explanation='The view hides a 4-table join with aggregation; queries treat it like a table.',
   tables=['v_experience_details → experiences, experience_categories, suppliers, reviews'],
   expected='Experiences with category, supplier and live rating (NULL when unreviewed).')

_q(id='view-slots', category='views', title='v_slot_availability',
   sql="""SELECT experience_name, slot_date, start_time, available_capacity, bookable_status
FROM v_slot_availability
WHERE slot_date = CURDATE()
ORDER BY start_time;""",
   explanation='A view with a computed CASE column classifying each session as Bookable / Fully Booked / Unavailable.',
   tables=['v_slot_availability → experience_slots, experiences'], expected="Today's sessions with availability.")

_q(id='view-booking', category='views', title='v_booking_overview',
   sql="""SELECT booking_reference, guest_name, experience_name, slot_date, booking_status, latest_payment_status
FROM v_booking_overview
ORDER BY slot_date DESC;""",
   explanation='A read model that includes a correlated subquery to show each booking\'s latest payment status.',
   tables=['v_booking_overview → bookings, guests, users, experiences, experience_categories, experience_slots, payments'],
   expected='One row per booking.')

_q(id='view-workload', category='views', title='v_staff_workload & v_sustainability_metrics',
   sql="""SELECT full_name, specialization, total_assignments, active_assignments, completed_assignments
FROM v_staff_workload
ORDER BY total_assignments DESC;""",
   explanation='Aggregating view used by the admin reports and the staff profile page.',
   tables=['v_staff_workload → staff, users, staff_assignments'], expected='One row per staff member.')

_q(id='view-definition', category='views', title='View definition (SHOW CREATE VIEW)',
   sql="SHOW CREATE VIEW v_slot_availability;",
   explanation='Shows the stored SELECT that defines the view, as created by schema.sql with CREATE OR REPLACE VIEW.',
   tables=['v_slot_availability'], expected='One row with the CREATE VIEW statement.')

# ----------------------------------------------------------------------------- Procedures & functions
_q(id='proc-guest-summary', category='procedures', title='CALL sp_guest_booking_summary(7)',
   sql="CALL sp_guest_booking_summary(7);",
   explanation='A stored procedure with an IN parameter returning a result set: booking count and value per '
               'status for guest 7 (Priya Sharma).',
   tables=['bookings'], expected='One row per booking status for the guest.')

_q(id='proc-occupancy', category='procedures', title='CALL sp_experience_occupancy(today, today + 6)',
   sql="CALL sp_experience_occupancy(CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 DAY));",
   explanation='Occupancy report per experience for a date range. The Admin → Reports page calls this procedure.',
   tables=['experiences', 'experience_slots'], expected='One row per active experience with occupancy %.')

_q(id='proc-functions', category='procedures', title='Stored functions in a SELECT',
   sql="""SELECT es.slot_id, e.name,
       fn_slot_remaining(es.slot_id) AS remaining_units,
       fn_experience_cost(e.experience_id, 4) AS cost_for_party_of_4
FROM experience_slots es
JOIN experiences e ON e.experience_id = es.experience_id
WHERE es.slot_date = CURDATE()
ORDER BY es.start_time
LIMIT 10;""",
   explanation='User-defined functions (READS SQL DATA) return a scalar and can be used inside queries.',
   tables=['experience_slots', 'experiences'], expected="Today's sessions with remaining capacity and party price.")

_q(id='proc-generate', category='procedures', title='CALL sp_generate_slots(... , @created) with OUT parameter',
   mode='sandbox',
   sql="""CALL sp_generate_slots(7, DATE_ADD(CURDATE(), INTERVAL 20 DAY),
                       DATE_ADD(CURDATE(), INTERVAL 26 DAY),
                       '16:00:00', '18:00:00', 12, @created);
SELECT @created AS slots_created;
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "CALL sp_generate_slots(7, DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 26 DAY), "
               "'16:00:00', '18:00:00', 12, @created)"},
       {'sql': "SELECT @created AS slots_created", 'label': 'OUT parameter'},
       {'sql': """SELECT slot_id, slot_date, start_time, end_time, max_capacity FROM experience_slots
WHERE experience_id = 7 AND start_time = '16:00:00' ORDER BY slot_date""", 'label': 'Generated rows'},
   ],
   explanation='The procedure loops over a date range with WHILE, validates input with SIGNAL and returns the '
               'number of created slots through an OUT parameter. Admin → Schedules → Bulk Generate uses it.',
   tables=['experience_slots'], expected='slots_created = 7 and the seven generated rows.')

_q(id='proc-signal', category='procedures', title='Procedure validation with SIGNAL', mode='sandbox',
   sql="""CALL sp_generate_slots(7, CURDATE(), CURDATE(), '18:00:00', '16:00:00', 12, @created);
-- ERROR 1644 (45000): Slot end time must be after the start time""",
   steps=[
       {'sql': "CALL sp_generate_slots(7, CURDATE(), CURDATE(), '18:00:00', '16:00:00', 12, @created)",
        'label': 'CALL with end time before start time', 'expect_error': True},
   ],
   explanation='SIGNAL SQLSTATE \'45000\' raises a user-defined error from inside the procedure, rejecting bad input.',
   tables=['experience_slots'], expected='Error 1644: Slot end time must be after the start time.')

# ----------------------------------------------------------------------------- Triggers
_q(id='trg-list', category='triggers', title='Triggers defined in the database',
   sql="""SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
ORDER BY EVENT_OBJECT_TABLE;""",
   explanation='Lists every trigger with its timing (BEFORE/AFTER), event and table from the data dictionary.',
   tables=['information_schema.TRIGGERS'], expected='Four triggers on bookings, reviews and experiences.')

_q(id='trg-history', category='triggers', title='AFTER UPDATE trigger writes booking history', mode='sandbox',
   sql="""SET @solace_actor_id = 1;  -- the app sets this to the logged-in user
UPDATE bookings SET booking_status = 'completed'
WHERE booking_reference = 'SOL-2026-BK010';
SELECT * FROM booking_status_history WHERE booking_id = 10 ORDER BY history_id;
-- ROLLBACK (automatic in the lab)""",
   steps=[
       {'sql': "SELECT history_id, from_status, to_status, changed_by_user_id, notes FROM booking_status_history "
               "WHERE booking_id = (SELECT booking_id FROM bookings WHERE booking_reference = 'SOL-2026-BK010') "
               "ORDER BY history_id", 'label': 'History before'},
       {'sql': "UPDATE bookings SET booking_status = 'completed' WHERE booking_reference = 'SOL-2026-BK010'"},
       {'sql': "SELECT history_id, from_status, to_status, changed_by_user_id, notes FROM booking_status_history "
               "WHERE booking_id = (SELECT booking_id FROM bookings WHERE booking_reference = 'SOL-2026-BK010') "
               "ORDER BY history_id", 'label': 'History after (new row inserted by trg_booking_after_update)'},
   ],
   explanation='trg_booking_after_update compares OLD.booking_status with NEW.booking_status and inserts an '
               'audit row attributed to @solace_actor_id (the logged-in user).',
   tables=['bookings', 'booking_status_history'], expected='One extra history row: confirmed → completed.')

_q(id='trg-guard', category='triggers', title='BEFORE INSERT trigger rejects an invalid review', mode='sandbox',
   sql="""-- Booking 1 is still 'confirmed', so a review must be rejected
INSERT INTO reviews (booking_id, guest_id, experience_id, rating, review_title, review_text)
VALUES (1, 7, 1, 5, 'Too early', 'Trying to review before the experience happened');
-- ERROR 1644 (45000): Reviews are only allowed for completed bookings""",
   steps=[
       {'sql': "INSERT INTO reviews (booking_id, guest_id, experience_id, rating, review_title, review_text) "
               "VALUES (1, 7, 1, 5, 'Too early', 'Trying to review before the experience happened')",
        'label': 'INSERT into reviews', 'expect_error': True},
   ],
   explanation='trg_review_before_insert enforces a business rule that a CHECK constraint cannot express '
               '(it needs another table): only the guest\'s own completed booking may be reviewed.',
   tables=['reviews', 'bookings'], expected='Error 1644: Reviews are only allowed for completed bookings.')

QUERIES = {q['id']: q for q in Q}


def catalogue():
    grouped = []
    for key, label, desc in CATEGORIES:
        grouped.append({'key': key, 'label': label, 'description': desc,
                        'queries': [q for q in Q if q['category'] == key]})
    return grouped


# =============================================================================
# Execution
# =============================================================================
class LabError(Exception):
    pass


_HASH_RE = re.compile(r'^(scrypt|pbkdf2|argon2|bcrypt)[:$]')
_ALLOWED_START = ('SELECT', 'WITH', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN')
_FORBIDDEN = re.compile(
    r"\b(INTO\s+(OUTFILE|DUMPFILE)|LOAD_FILE|SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK|FOR\s+UPDATE|"
    r"LOCK\s+IN\s+SHARE\s+MODE|FOR\s+SHARE)\b|\bINTO\s+@|\b(mysql|performance_schema|sys)\s*\.",
    re.IGNORECASE)
# Statements that would cause an implicit COMMIT; never allowed in rollback sandboxes.
_IMPLICIT_COMMIT = re.compile(
    r"^\s*(CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|LOCK|UNLOCK|START\s+TRANSACTION|BEGIN|COMMIT|"
    r"SET\s+(SESSION\s+)?AUTOCOMMIT)\b", re.IGNORECASE)
_TEMP_DDL = re.compile(
    r"^\s*(CREATE\s+TEMPORARY\s+TABLE|DROP\s+TEMPORARY\s+TABLE|ALTER\s+TABLE)\s+(IF\s+(NOT\s+)?EXISTS\s+)?tmp_lab_\w+",
    re.IGNORECASE)


def _strip_comments(sql):
    sql = re.sub(r'/\*.*?\*/', ' ', sql, flags=re.S)
    sql = re.sub(r'(--\s|#)[^\n]*', ' ', sql)
    return sql


def validate_select(sql):
    """Validate an ad-hoc query typed into the admin console. Returns the cleaned statement."""
    if '/*!' in sql or '/*+' in sql:
        raise LabError('Executable comments and optimizer hints are not allowed.')
    cleaned = _strip_comments(sql).strip().rstrip(';').strip()
    if not cleaned:
        raise LabError('Please enter a query.')
    if len(cleaned) > 5000:
        raise LabError('Query is too long (max 5000 characters).')
    if ';' in cleaned:
        raise LabError('Only a single statement can be executed at a time.')
    first = cleaned.split(None, 1)[0].upper()
    if first not in _ALLOWED_START:
        raise LabError('Only read-only statements are allowed: SELECT, WITH, SHOW, DESCRIBE or EXPLAIN.')
    if _FORBIDDEN.search(cleaned):
        raise LabError('This query uses a construct that is blocked in the laboratory '
                       '(file access, locking, sleeps, variable assignment or system schemas).')
    return cleaned


def _cell(value):
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode('utf-8')
        except UnicodeDecodeError:
            return '0x' + value.hex()
    if isinstance(value, datetime.timedelta):
        secs = int(value.total_seconds())
        return f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}:{secs % 60:02d}"
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat(sep=' ') if isinstance(value, datetime.datetime) else value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, str) and _HASH_RE.match(value):
        return '•••• (password hash hidden)'
    return value


def _fetch(cursor, limit):
    if cursor.description is None:
        return None
    columns = [d[0] for d in cursor.description]
    rows = cursor.fetchmany(limit + 1)
    truncated = len(rows) > limit
    rows = rows[:limit]
    return {'columns': columns, 'rows': [[_cell(r[c]) for c in columns] for r in rows], 'truncated': truncated}


def _apply_timeout(cursor):
    ms = int(Config.SQL_LAB_TIMEOUT_MS)
    try:
        cursor.execute(f"SET SESSION MAX_EXECUTION_TIME = {ms}")        # MySQL
    except pymysql.MySQLError:
        try:
            cursor.execute(f"SET SESSION max_statement_time = {ms / 1000:.3f}")  # MariaDB
        except pymysql.MySQLError:
            pass


def _drain(cursor):
    while cursor.nextset():
        pass


def run_readonly(sql, actor_id=None):
    """Execute one read-only statement inside a READ ONLY transaction."""
    limit = int(Config.SQL_LAB_ROW_LIMIT)
    with isolated_connection() as conn:
        with conn.cursor() as cur:
            _apply_timeout(cur)
            cur.execute("SET @solace_actor_id = %s", (actor_id,))
            cur.execute("START TRANSACTION READ ONLY")
            started = datetime.datetime.now()
            cur.execute(sql)
            result = _fetch(cur, limit)
            _drain(cur)
            elapsed = (datetime.datetime.now() - started).total_seconds() * 1000
            conn.rollback()
    result = result or {'columns': [], 'rows': [], 'truncated': False}
    result.update({'label': None, 'elapsed_ms': round(elapsed, 1), 'rowcount': len(result['rows'])})
    return [result]


def _check_steps(query):
    for step in query['steps']:
        statement = step['sql']
        if query['mode'] == 'sandbox' and _IMPLICIT_COMMIT.match(statement):
            raise LabError('Sandbox step would cause an implicit commit and was blocked.')
        if query['mode'] == 'ddl' and re.match(r'^\s*(CREATE|ALTER|DROP)\b', statement, re.I) \
                and not _TEMP_DDL.match(statement):
            raise LabError('DDL demonstrations may only touch TEMPORARY tmp_lab_* tables.')
        if query['mode'] == 'ddl' and re.match(r'^\s*(INSERT|UPDATE|DELETE|REPLACE)\b', statement, re.I) \
                and 'tmp_lab_' not in statement:
            raise LabError('DDL demonstrations may only modify tmp_lab_* tables.')


def run_steps(query, actor_id=None):
    """Execute a multi-step sandbox/DDL demonstration and roll everything back."""
    _check_steps(query)
    limit = int(Config.SQL_LAB_ROW_LIMIT)
    results = []
    with isolated_connection() as conn:
        with conn.cursor() as cur:
            _apply_timeout(cur)
            cur.execute("SET @solace_actor_id = %s", (actor_id,))
            for step in query['steps']:
                started = datetime.datetime.now()
                try:
                    cur.execute(step['sql'])
                    res = _fetch(cur, limit)
                    affected = cur.rowcount
                    _drain(cur)
                except pymysql.MySQLError as exc:
                    if not step.get('expect_error'):
                        conn.rollback()
                        raise LabError(f"MySQL error {exc.args[0]}: {exc.args[1] if len(exc.args) > 1 else exc}")
                    results.append({'label': step.get('label'), 'error': f"ERROR {exc.args[0]}: {exc.args[1]}",
                                    'expected_error': True, 'columns': [], 'rows': [], 'truncated': False})
                    continue
                elapsed = round((datetime.datetime.now() - started).total_seconds() * 1000, 1)
                if res is not None and step.get('label'):
                    res.update({'label': step['label'], 'elapsed_ms': elapsed, 'rowcount': len(res['rows'])})
                    results.append(res)
                elif res is None:
                    results.append({'label': step.get('label') or _first_line(step['sql']),
                                    'message': f"Query OK, {max(affected, 0)} row(s) affected",
                                    'columns': [], 'rows': [], 'truncated': False, 'elapsed_ms': elapsed})
        conn.rollback()
    return results


def _first_line(sql):
    line = sql.strip().splitlines()[0]
    return line if len(line) < 90 else line[:87] + '...'


def execute_catalogue_query(query_id, actor_id=None):
    query = QUERIES.get(query_id)
    if not query:
        raise LabError('Unknown query.')
    if query['mode'] == 'display':
        raise LabError('This statement is shown for study only and is not executed.')
    if query['mode'] == 'readonly':
        return run_readonly(validate_select(query['sql']) if not query['sql'].lstrip().upper().startswith('CALL')
                            else query['sql'].strip().rstrip(';'), actor_id)
    return run_steps(query, actor_id)


def execute_console_query(sql, actor_id=None):
    return run_readonly(validate_select(sql), actor_id)
