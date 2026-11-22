"""
Shared test harness.

Tests never touch the development database: they rebuild a dedicated database
(TEST_DB_NAME, default `solace_test_db`) from database/schema.sql + seed.sql once per
test run, using the MySQL credentials from .env.
"""
import os
import re

from config import Config

TEST_DB_NAME = os.getenv('TEST_DB_NAME', 'solace_test_db')
_APP_DB_NAME = Config.DB_NAME  # the real database (from DB_NAME or DATABASE_URL) - never used by tests
_PREPARED = False

GUEST = ('priya.sharma@example.com', 'Guest@123')
GUEST2 = ('elena.rostova@example.com', 'Guest@123')
ADMIN = ('admin@solace.com', 'Admin@123')
STAFF = ('aarav.naturalist@solace.com', 'Staff@123')


def ensure_test_database():
    """Point the app at the test database and (re)build it once per process."""
    global _PREPARED
    if TEST_DB_NAME == _APP_DB_NAME:
        raise RuntimeError('TEST_DB_NAME must differ from DB_NAME so tests never modify real data.')
    Config.DB_NAME = TEST_DB_NAME
    if not _PREPARED:
        from database.init_db import rebuild
        rebuild(TEST_DB_NAME, seed=True, quiet=True)
        _PREPARED = True


def make_app():
    from app import create_app
    app = create_app()
    app.config['TESTING'] = True
    return app


def csrf_token(client):
    client.get('/')  # every rendered page issues the token (login redirects when already signed in)
    with client.session_transaction() as sess:
        return sess['_csrf_token']


def post(client, url, data=None, **kwargs):
    """POST with a valid CSRF token (as a real browser form would send)."""
    payload = dict(data or {})
    payload.setdefault('csrf_token', csrf_token(client))
    return client.post(url, data=payload, **kwargs)


def login(client, creds):
    email, password = creds
    return post(client, '/login', {'email': email, 'password': password})


def booking_id_from_location(location):
    return int(re.search(r'/payment/(\d+)', location).group(1))


def db(sql, args=(), one=False):
    """Run a query on a fresh autocommit connection (independent of the app's connection)."""
    from database.connection import get_db_connection
    conn = get_db_connection(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args)
            rows = cur.fetchall()
            return (rows[0] if rows else None) if one else rows
    finally:
        conn.close()


def future_slot(experience_id, min_units=1, offset=0):
    """An available slot of the experience with enough free capacity, starting at least 1 day ahead."""
    return db("""
        SELECT * FROM experience_slots
        WHERE experience_id = %s AND slot_status = 'available'
          AND slot_date > CURDATE() AND (max_capacity - booked_capacity) >= %s
        ORDER BY slot_date, start_time LIMIT 1 OFFSET %s
    """, (experience_id, min_units, offset), one=True)
