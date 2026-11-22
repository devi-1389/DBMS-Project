"""Database Explorer: connectivity, schema consistency, diagrams, SQL laboratory and table viewer."""
import os
import re
import unittest

from tests.helpers import ADMIN, GUEST, TEST_DB_NAME, db, ensure_test_database, login, make_app, post

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def setUpModule():
    ensure_test_database()


def table_checksums():
    names = [r['TABLE_NAME'] for r in db(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'",
        (TEST_DB_NAME,))]
    return {r['Table']: r['Checksum'] for r in db("CHECKSUM TABLE " + ', '.join(f'`{n}`' for n in names))}


class DatabaseConnectivityTests(unittest.TestCase):

    def test_connection_and_engine(self):
        row = db("SELECT DATABASE() AS name, VERSION() AS version", one=True)
        self.assertEqual(row['name'], TEST_DB_NAME)
        engines = {r['ENGINE'] for r in db("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", (TEST_DB_NAME,))}
        self.assertEqual(engines, {'InnoDB'})

    def test_schema_file_matches_database(self):
        with open(os.path.join(ROOT, 'database', 'schema.sql'), encoding='utf-8') as fh:
            sql = fh.read()
        declared = set(re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)', sql))
        actual = {r['TABLE_NAME'] for r in db("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", (TEST_DB_NAME,))}
        self.assertEqual(declared, actual)
        self.assertEqual(len(actual), 23)
        for kind, pattern, query in [
            ('views', r'CREATE OR REPLACE VIEW (\w+)', "SELECT TABLE_NAME AS n FROM information_schema.VIEWS WHERE TABLE_SCHEMA = %s"),
            ('triggers', r'CREATE TRIGGER (\w+)', "SELECT TRIGGER_NAME AS n FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s"),
            ('routines', r'CREATE (?:PROCEDURE|FUNCTION) (\w+)', "SELECT ROUTINE_NAME AS n FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s"),
        ]:
            self.assertEqual(set(re.findall(pattern, sql)), {r['n'] for r in db(query, (TEST_DB_NAME,))}, kind)

    def test_seed_referential_consistency(self):
        # Every booking points at a slot of the same experience, and slot occupancy matches the bookings
        self.assertEqual(db("""SELECT COUNT(*) AS n FROM bookings b JOIN experience_slots s ON s.slot_id = b.slot_id
                               WHERE s.experience_id <> b.experience_id""", one=True)['n'], 0)
        self.assertEqual(db("""SELECT COUNT(*) AS n FROM itinerary_items i JOIN experience_slots s ON s.slot_id = i.slot_id
                               WHERE s.experience_id <> i.experience_id""", one=True)['n'], 0)
        mismatched = db("""
            SELECT es.slot_id FROM experience_slots es
            WHERE es.booked_capacity <> (
                SELECT COALESCE(SUM(CASE WHEN e.pricing_type = 'per_person' THEN b.party_size ELSE 1 END), 0)
                FROM bookings b JOIN experiences e ON e.experience_id = b.experience_id
                WHERE b.slot_id = es.slot_id AND b.booking_status IN ('confirmed', 'completed'))
              AND es.slot_id <= 60""")
        self.assertEqual(list(mismatched), [])


class ExplorerPageTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()

    def test_public_pages_render(self):
        for url in ['/dbms/', '/dbms/er-diagram', '/dbms/schema', '/dbms/dfd', '/dbms/sql-lab']:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, url)
        self.assertIn(b'Read-only study mode', self.client.get('/dbms/sql-lab').data)

    def test_er_payload_matches_information_schema(self):
        payload = self.client.get('/dbms/api/schema.json').get_json()
        fk_count = db("SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = %s",
                      (TEST_DB_NAME,), one=True)['n']
        self.assertEqual(len(payload['tables']), 23)
        self.assertEqual(len(payload['relationships']), fk_count)
        names = {t['name'] for t in payload['tables']}
        for r in payload['relationships']:
            self.assertIn(r['parent_table'], names)
            self.assertIn(r['child_table'], names)
        rels = {(r['child_table'], r['child_column']): r for r in payload['relationships']}
        self.assertEqual(rels[('reviews', 'booking_id')]['type'], '1 : 1')            # UNIQUE booking_id
        self.assertEqual(rels[('bookings', 'guest_id')]['cardinality'], '1 : 0..N')
        self.assertEqual(rels[('experiences', 'supplier_id')]['parent_card'], '|o')     # nullable FK
        self.assertTrue(rels[('guests', 'guest_id')]['identifying'])                    # FK is also the PK
        users = next(t for t in payload['tables'] if t['name'] == 'users')
        self.assertIn('PK', next(c for c in users['columns'] if c['name'] == 'user_id')['keys'])
        self.assertIn('UK', next(c for c in users['columns'] if c['name'] == 'email')['keys'])

    def test_schema_page_lists_constraints(self):
        html = self.client.get('/dbms/schema').data
        for needle in [b'chk_bk_party', b'fk_bk_slot', b'uq_slot_time', b'sp_generate_slots', b'trg_review_before_insert', b'v_booking_overview']:
            self.assertIn(needle, html)

    def test_table_viewer_pagination_and_validation(self):
        login(self.client, ADMIN)
        total = db("SELECT COUNT(*) AS n FROM experience_slots", one=True)['n']
        res = self.client.get('/dbms/tables?table=experience_slots&per_page=10&page=2')
        self.assertEqual(res.status_code, 200)
        self.assertIn(f'{total} record'.encode(), res.data)
        self.assertIn(b'Page 2 of', res.data)
        self.assertEqual(self.client.get('/dbms/tables?table=users;DROP TABLE x').status_code, 302)  # unknown table
        res_search = self.client.get('/dbms/tables?table=experiences&col=name&q=Yoga')
        self.assertIn(b'Waterfall Yoga', res_search.data)
        self.assertIn(b'1 record', res_search.data)

    def test_every_lab_query_runs_without_changing_data(self):
        login(self.client, ADMIN)
        from app.services.sql_lab import QUERIES
        before = table_checksums()
        for qid, q in QUERIES.items():
            if q['mode'] == 'display':
                continue
            res = post(self.client, f'/dbms/sql-lab/run/{qid}')
            payload = res.get_json()
            self.assertTrue(payload['ok'], f"{qid}: {payload.get('error')}")
            self.assertTrue(payload['results'], qid)
        self.assertEqual(before, table_checksums())

    def test_lab_categories_cover_all_ten_topics(self):
        from app.services.sql_lab import CATEGORIES, Q
        keys = [c[0] for c in CATEGORIES]
        self.assertEqual(len(keys), 10)
        for key in keys:
            self.assertTrue([q for q in Q if q['category'] == key], key)
        for q in Q:
            for field in ('title', 'sql', 'explanation', 'tables', 'expected'):
                self.assertTrue(q[field], f"{q['id']} missing {field}")

    def test_guest_cannot_run_lab_queries(self):
        login(self.client, GUEST)
        res = post(self.client, '/dbms/sql-lab/run/dql-select')
        self.assertEqual(res.status_code, 302)


if __name__ == '__main__':
    unittest.main()
