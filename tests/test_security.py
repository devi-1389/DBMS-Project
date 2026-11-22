"""Security tests: CSRF, sessions, password hashing, injection, RBAC and the SQL lab guard."""
import unittest
import uuid

from tests.helpers import ADMIN, GUEST, GUEST2, STAFF, csrf_token, db, ensure_test_database, login, make_app, post


def setUpModule():
    ensure_test_database()


class SecurityTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()

    def test_csrf_required_on_post(self):
        res = self.client.post('/login', data={'email': ADMIN[0], 'password': ADMIN[1]})
        self.assertEqual(res.status_code, 400)
        csrf_token(self.client)
        res_bad = self.client.post('/login', data={'email': ADMIN[0], 'password': ADMIN[1], 'csrf_token': 'forged'})
        self.assertEqual(res_bad.status_code, 400)
        res_ok = login(self.client, ADMIN)
        self.assertEqual(res_ok.status_code, 302)

    def test_logout_is_post_only_and_clears_session(self):
        login(self.client, GUEST)
        self.assertEqual(self.client.get('/logout').status_code, 405)
        post(self.client, '/logout')
        with self.client.session_transaction() as sess:
            self.assertNotIn('user_id', sess)
        self.assertEqual(self.client.get('/guest/dashboard').status_code, 302)

    def test_open_redirect_blocked(self):
        csrf = csrf_token(self.client)
        res = self.client.post('/login?next=https://evil.example.com/steal',
                               data={'email': GUEST[0], 'password': GUEST[1], 'csrf_token': csrf})
        self.assertEqual(res.status_code, 302)
        self.assertNotIn('evil.example.com', res.headers['Location'])
        self.assertIn('/guest/dashboard', res.headers['Location'])

    def test_safe_next_redirect_allowed(self):
        csrf = csrf_token(self.client)
        res = self.client.post('/login?next=/guest/itinerary', data={'email': GUEST[0], 'password': GUEST[1], 'csrf_token': csrf})
        self.assertTrue(res.headers['Location'].endswith('/guest/itinerary'))

    def test_session_cookie_flags_and_security_headers(self):
        res = login(self.client, GUEST)
        cookie = res.headers.get('Set-Cookie', '')
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Lax', cookie)
        page = self.client.get('/')
        self.assertEqual(page.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(page.headers.get('X-Frame-Options'), 'SAMEORIGIN')

    def test_passwords_are_hashed(self):
        rows = db("SELECT password_hash FROM users")
        self.assertTrue(rows)
        for r in rows:
            self.assertRegex(r['password_hash'], r'^(scrypt|pbkdf2):')
            self.assertNotIn('Guest@123', r['password_hash'])

    def test_weak_password_rejected_on_registration(self):
        email = f"weak.{uuid.uuid4().hex[:6]}@example.com"
        res = post(self.client, '/register', {'full_name': 'Weak', 'email': email, 'password': 'short',
                                               'confirm_password': 'short', 'party_size': 2, 'budget': 1000})
        self.assertEqual(res.status_code, 400)
        self.assertIsNone(db("SELECT user_id FROM users WHERE email = %s", (email,), one=True))

    def test_invalid_numeric_input_does_not_crash(self):
        login(self.client, GUEST)
        res = post(self.client, '/booking/initiate', {'slot_id': 'abc', 'party_size': 'lots'}, follow_redirects=True)
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'whole number', res.data)

    def test_sql_injection_in_search_and_login(self):
        res = self.client.get("/experiences?q=' OR 1=1 -- ")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'No experiences match your filters', res.data)
        res_login = post(self.client, '/login', {'email': "' OR '1'='1", 'password': "' OR '1'='1"})
        self.assertEqual(res_login.status_code, 401)
        self.assertEqual(db("SELECT COUNT(*) AS n FROM users", one=True)['n'] >= 9, True)

    def test_deactivated_user_cannot_login(self):
        email = f"inactive.{uuid.uuid4().hex[:6]}@example.com"
        post(self.client, '/register', {'full_name': 'Soon Inactive', 'email': email, 'password': 'Password123',
                                        'confirm_password': 'Password123', 'party_size': 1, 'budget': 1000})
        post(self.client, '/logout')
        db("UPDATE users SET is_active = 0 WHERE email = %s", (email,))
        res = login(self.client, (email, 'Password123'))
        self.assertEqual(res.status_code, 403)

    def test_guest_cannot_view_another_guests_voucher(self):
        login(self.client, GUEST2)  # Elena; booking 1 belongs to Priya
        res = self.client.get('/booking/confirmation/1')
        self.assertEqual(res.status_code, 302)

    def test_staff_cannot_complete_unassigned_booking(self):
        login(self.client, STAFF)  # Aarav (staff 1) is not assigned to booking 2 (Rohan's trek)
        post(self.client, '/staff/complete-booking/2')
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = 2", one=True)['booking_status'], 'confirmed')

    def test_sql_lab_execution_is_admin_only(self):
        login(self.client, GUEST)
        res = post(self.client, '/dbms/sql-lab/console', {'sql': 'SELECT 1'})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(self.client.get('/dbms/tables').status_code, 302)

    def test_sql_console_blocks_writes_and_tricks(self):
        login(self.client, ADMIN)
        blocked = [
            "UPDATE users SET full_name = 'x'",
            "SELECT 1; DROP TABLE users",
            "SELECT * FROM users INTO OUTFILE '/tmp/x'",
            "/*!50000 DELETE FROM reviews */ SELECT 1",
            "SELECT SLEEP(10)",
            "SELECT * FROM mysql.user",
            "SELECT * FROM bookings FOR UPDATE",
        ]
        for sql in blocked:
            res = post(self.client, '/dbms/sql-lab/console', {'sql': sql})
            self.assertEqual(res.status_code, 400, sql)
            self.assertFalse(res.get_json()['ok'], sql)
        ok = post(self.client, '/dbms/sql-lab/console', {'sql': 'SELECT COUNT(*) AS n FROM experiences'}).get_json()
        self.assertTrue(ok['ok'])
        self.assertEqual(ok['results'][0]['rows'][0][0], db("SELECT COUNT(*) AS n FROM experiences", one=True)['n'])

    def test_password_hashes_masked_in_lab_and_viewer(self):
        login(self.client, ADMIN)
        res = post(self.client, '/dbms/sql-lab/console', {'sql': 'SELECT email, password_hash AS h FROM users'}).get_json()
        self.assertTrue(all('hidden' in row[1] for row in res['results'][0]['rows']))
        page = self.client.get('/dbms/tables?table=users')
        self.assertEqual(page.status_code, 200)
        self.assertNotIn(b'scrypt:', page.data)


class DeploymentConfigurationTests(unittest.TestCase):
    """Hosted (Vercel + cloud MySQL) configuration handling."""

    def test_wrong_database_url_shows_configuration_page(self):
        from unittest import mock
        from config import Config
        with mock.patch.object(Config, 'DB_CONFIG_ERROR', 'DATABASE_URL points to a postgresql database, but SOLACE uses MySQL.'):
            res = make_app().test_client().get('/')
            self.assertEqual(res.status_code, 503)
            self.assertIn('SOLACE uses MySQL', res.get_data(as_text=True))

    def test_missing_hosting_settings_are_explained(self):
        from unittest import mock
        from config import Config
        missing = [('SECRET_KEY', 'a long random text'), ('DATABASE_URL', 'the MySQL address')]
        with mock.patch.object(Config, 'deployment_problems', classmethod(lambda cls: missing)):
            client = make_app().test_client()
            res = client.get('/')
            self.assertEqual(res.status_code, 503)
            page = res.get_data(as_text=True)
            self.assertIn('SECRET_KEY', page)
            self.assertIn('DATABASE_URL', page)
            self.assertEqual(client.get('/static/css/style.css').status_code, 200)
        self.assertEqual(make_app().test_client().get('/').status_code, 200)

    def test_public_pages_show_no_demo_credentials(self):
        """The landing and sign-in pages offer a normal sign-in, never seeded account shortcuts."""
        client = make_app().test_client()
        home = client.get('/').get_data(as_text=True)
        login_page = client.get('/login').get_data(as_text=True)
        self.assertIn('href="/login"', home)
        self.assertIn('Welcome to SOLACE', home)
        for page in (home, login_page):
            for secret in ('Admin@123', 'Guest@123', 'Staff@123', 'admin@solace.com', 'priya.sharma@example.com'):
                self.assertNotIn(secret, page)
            self.assertNotIn('demo account', page.lower())
            self.assertNotIn('fillLogin', page)
        login(client, GUEST)
        self.assertIn('Go to My Dashboard', client.get('/').get_data(as_text=True))

    def test_database_url_and_encryption_settings(self):
        import ssl
        from unittest import mock
        import config
        url = 'mysql://app%40user:p%2Fss@db.example.com:25060/shop_db?ssl-mode=REQUIRED'
        with mock.patch.dict('os.environ', {'DATABASE_URL': url}):
            cfg = config._database_settings()
        self.assertEqual((cfg['host'], cfg['port'], cfg['user'], cfg['password'], cfg['name'], cfg['ssl']),
                         ('db.example.com', 25060, 'app@user', 'p/ss', 'shop_db', True))
        # a PostgreSQL URL (for example left over from an earlier deployment) is reported, never used,
        # and the message does not repeat the password
        with mock.patch.dict('os.environ', {'DATABASE_URL': 'postgresql://neon_user:s3cret@ep-x.neon.tech/db'}):
            bad = config._database_settings()
        self.assertIn('MySQL', bad['error'])
        self.assertNotIn('s3cret', bad['error'])
        with mock.patch.dict('os.environ', {'DATABASE_URL': 'mysql://u:p@host:notaport/db'}):
            self.assertIn('port', config._database_settings()['error'])
        with mock.patch.dict('os.environ', {'DATABASE_URL': 'mysql://u:p@db.example.com:3306/shop_db'}):
            self.assertNotIn('error', config._database_settings())
        with mock.patch.dict('os.environ', {'APP_UTC_OFFSET': '+05:30'}):
            self.assertEqual(config._utc_offset(), ('+05:30', 19800))
        with mock.patch.dict('os.environ', {'APP_UTC_OFFSET': 'India'}):
            with self.assertRaises(RuntimeError):
                config._utc_offset()

        class Hosted(config.Config):
            DB_SSL = True
            DB_TIME_ZONE = '+05:30'

        args = Hosted.db_connect_args('shop_db')
        self.assertIsInstance(args['ssl'], ssl.SSLContext)
        self.assertEqual(args['init_command'], "SET time_zone = '+05:30'")
        local = config.Config.db_connect_args('x')   # a plain local connection stays unchanged
        self.assertEqual(local['database'], 'x')
        self.assertEqual('ssl' in local, config.Config.db_ssl_context() is not None)


if __name__ == '__main__':
    unittest.main()
