import pymysql
import pymysql.cursors
from contextlib import contextmanager
from flask import g, has_request_context, session
from config import Config


def get_db_connection(database=None, autocommit=False):
    """Create a raw database connection with DictCursor."""
    return pymysql.connect(
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=autocommit,
        connect_timeout=10,
        **Config.db_connect_args(database or Config.DB_NAME)
    )


def _set_actor(conn):
    """
    Expose the logged-in user to MySQL triggers through the session variable
    @solace_actor_id, so booking_status_history records who made each change.
    """
    actor_id = session.get('user_id') if has_request_context() else None
    with conn.cursor() as cursor:
        cursor.execute("SET @solace_actor_id = %s", (actor_id,))


def get_db():
    """Retrieve or create the Flask g database connection for the current request."""
    if 'db' not in g:
        g.db = get_db_connection()
        _set_actor(g.db)
    return g.db


def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop('db', None)
    if db is not None:
        try:
            db.rollback()  # discard any uncommitted work left by an aborted request
        finally:
            db.close()


def query_db(query, args=(), one=False):
    """Execute a SELECT query and return results as dictionary/dictionaries."""
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute(query, args)
        rv = cursor.fetchall()
        return (rv[0] if rv else None) if one else rv


def execute_db(query, args=(), commit=True):
    """Execute an INSERT/UPDATE/DELETE query and optionally commit."""
    db = get_db()
    with db.cursor() as cursor:
        cursor.execute(query, args)
        if commit:
            db.commit()
        return {
            'lastrowid': cursor.lastrowid,
            'rowcount': cursor.rowcount
        }


def call_procedure(name, args=(), cursor=None):
    """
    CALL a stored procedure and return its first result set. Remaining result sets
    (MySQL always appends a status set to CALL) are drained so the connection stays usable.
    `name` must be a trusted identifier from the code, never user input.
    """
    placeholders = ', '.join(['%s'] * len(args))

    def _run(cur):
        cur.execute(f"CALL {name}({placeholders})", args)
        rows = cur.fetchall()
        while cur.nextset():
            pass
        return rows

    if cursor is not None:
        return _run(cursor)
    with get_db().cursor() as cur:
        return _run(cur)


@contextmanager
def get_db_transaction():
    """Context manager for atomic database transactions with automatic commit and rollback."""
    db = get_db()
    try:
        with db.cursor() as cursor:
            yield cursor
        db.commit()
    except Exception:
        db.rollback()
        raise


@contextmanager
def isolated_connection():
    """
    A dedicated short-lived connection (separate from the request connection) used by the
    SQL Query Laboratory so that read-only / rolled-back demonstrations can never leak
    session state or uncommitted changes into normal application queries.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        try:
            conn.rollback()
        finally:
            conn.close()
