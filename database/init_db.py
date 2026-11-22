"""
SOLACE database initializer.

Correctly executes schema.sql / seed.sql through PyMySQL, including the
`DELIMITER $$ ... $$` blocks used by triggers, functions and procedures
(a naive split on ';' breaks those blocks).

Usage (from the project root, with the virtual environment active):
    python -m database.init_db              # rebuild: DROP + CREATE + schema + seed (asks for confirmation)
    python -m database.init_db --yes        # rebuild without the confirmation prompt
    python -m database.init_db --upgrade    # non-destructive: re-create views/functions/procedures/triggers
                                            # and apply database/upgrade.sql, keeping all existing data
    python -m database.init_db --database solace_test_db --yes   # target another database
    python -m database.init_db --in-place   # rebuild inside the existing database without DROP/CREATE DATABASE
                                            # (hosted MySQL accounts that may not create databases)
    python -m database.init_db --check      # only test the connection and the privileges, change nothing

The same command initialises a hosted (cloud) MySQL server: set DATABASE_URL or the DB_* variables
to the hosted server first - see docs/DEPLOYMENT_VERCEL.md.
"""
import argparse
import os
import re
import sys

import pymysql

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config  # noqa: E402

DB_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_FILE = os.path.join(DB_DIR, 'schema.sql')
SEED_FILE = os.path.join(DB_DIR, 'seed.sql')
UPGRADE_FILE = os.path.join(DB_DIR, 'upgrade.sql')
DB_NAME_RE = re.compile(r'^[A-Za-z0-9_]{1,64}$')


def split_sql_script(script):
    """
    Split a MySQL script into statements, honouring DELIMITER directives,
    quoted strings and comments.
    """
    statements = []
    delimiter = ';'
    buf = []
    i = 0
    n = len(script)
    quote = None
    at_line_start = True

    while i < n:
        ch = script[i]

        if quote is None:
            # DELIMITER directive (only valid at the start of a line, outside a statement)
            if at_line_start and not ''.join(buf).strip():
                m = re.match(r'[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(\r?\n|$)', script[i:], re.IGNORECASE)
                if m:
                    delimiter = m.group(1)
                    buf = []
                    i += m.end()
                    at_line_start = True
                    continue
            # Comments
            if script.startswith('--', i) and (i + 2 >= n or script[i + 2] in ' \t\r\n'):
                end = script.find('\n', i)
                i = n if end == -1 else end
                continue
            if ch == '#':
                end = script.find('\n', i)
                i = n if end == -1 else end
                continue
            if script.startswith('/*', i):
                end = script.find('*/', i + 2)
                i = n if end == -1 else end + 2
                continue
            # Delimiter -> end of statement
            if script.startswith(delimiter, i):
                stmt = ''.join(buf).strip()
                if stmt:
                    statements.append(stmt)
                buf = []
                i += len(delimiter)
                at_line_start = False
                continue
            if ch in ("'", '"', '`'):
                quote = ch
        else:
            if ch == '\\' and quote != '`' and i + 1 < n:
                buf.append(ch)
                buf.append(script[i + 1])
                i += 2
                continue
            if ch == quote:
                if i + 1 < n and script[i + 1] == quote:  # doubled quote escape
                    buf.append(ch)
                    buf.append(ch)
                    i += 2
                    continue
                quote = None

        buf.append(ch)
        at_line_start = ch == '\n'
        i += 1

    tail = ''.join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _is_database_switch(stmt):
    return re.match(r'^(CREATE\s+DATABASE|USE)\b', stmt, re.IGNORECASE) is not None


def run_sql_file(conn, path):
    with open(path, 'r', encoding='utf-8') as fh:
        statements = split_sql_script(fh.read())
    with conn.cursor() as cur:
        for stmt in statements:
            if _is_database_switch(stmt):
                continue  # the target database is selected by this script instead
            cur.execute(stmt)
            while cur.nextset():  # drain result sets produced by CALL statements
                pass
    conn.commit()
    return len(statements)


class InitError(Exception):
    """A problem the user can fix (shown without a traceback)."""


# MySQL error numbers that mean "this account may not create/drop databases"
_NO_DATABASE_PRIVILEGE = (1044, 1045, 1142, 1227, 1007, 1008)
_PROBE = 'solace_privilege_probe'


def server_connection(database=None):
    return pymysql.connect(autocommit=False, connect_timeout=15, **Config.db_connect_args(database))


def check_stored_program_privilege(conn):
    """
    Triggers and stored functions are part of the SOLACE schema. Managed MySQL servers that keep a
    binary log refuse to create them (error 1419) unless the account has SUPER or the server option
    log_bin_trust_function_creators is ON. Test that here, before any data is touched.
    """
    with conn.cursor() as cur:
        try:
            cur.execute(f"DROP FUNCTION IF EXISTS {_PROBE}")
            cur.execute(f"CREATE FUNCTION {_PROBE}() RETURNS INT DETERMINISTIC RETURN 1")
            cur.execute(f"DROP FUNCTION {_PROBE}")
        except pymysql.MySQLError as exc:
            if exc.args and exc.args[0] in (1419, 1418):
                raise InitError(
                    "This MySQL server does not let your account create triggers and stored functions\n"
                    "(MySQL error 1419: binary logging is enabled and the account has no SUPER privilege).\n"
                    "SOLACE needs its 4 triggers and 2 functions, so nothing was changed.\n"
                    "Fix it in ONE of these ways, then run this command again:\n"
                    "  1. Switch ON the server option  log_bin_trust_function_creators  in your MySQL host's\n"
                    "     settings page (often listed under parameters / flags / advanced configuration), or\n"
                    "  2. Use a MySQL host that gives you an administrator (root) account."
                ) from exc
            if exc.args and exc.args[0] in (1044, 1370, 1142):
                raise InitError(
                    "Your MySQL account is not allowed to create stored routines in this database "
                    f"(MySQL error {exc.args[0]}). Ask the host for the CREATE ROUTINE and TRIGGER privileges."
                ) from exc
            raise
    conn.commit()


def reset_in_place(conn, name):
    """Remove every table, view and routine of the database without dropping the database itself."""
    with conn.cursor() as cur:
        cur.execute("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s", (name,))
        objects = cur.fetchall()
        cur.execute("SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s", (name,))
        routines = cur.fetchall()
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        for obj_name, obj_type in objects:
            kind = 'VIEW' if obj_type == 'VIEW' else 'TABLE'
            cur.execute(f"DROP {kind} IF EXISTS `{obj_name}`")   # triggers are dropped with their table
        for routine_name, routine_type in routines:
            cur.execute(f"DROP {routine_type} IF EXISTS `{routine_name}`")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()


def database_exists(name):
    conn = server_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s", (name,))
            return cur.fetchone() is not None
    finally:
        conn.close()


def rebuild(name, seed=True, quiet=False, in_place=False):
    """Drop and recreate the database, then load schema (and seed data)."""
    if not DB_NAME_RE.match(name):
        raise ValueError('Invalid database name')
    create_sql = f"CREATE DATABASE `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

    existed = database_exists(name)
    if not existed:
        conn = server_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(create_sql)
            conn.commit()
        except pymysql.MySQLError as exc:
            if exc.args and exc.args[0] in _NO_DATABASE_PRIVILEGE:
                raise InitError(
                    f"Database '{name}' does not exist and your MySQL account may not create it "
                    f"(MySQL error {exc.args[0]}).\nUse the database name your host created for you: "
                    "set DB_NAME (or the last part of DATABASE_URL) to that name and run this command again."
                ) from exc
            raise
        finally:
            conn.close()

    # privileges are verified BEFORE existing data is removed
    conn = server_connection(name)
    try:
        check_stored_program_privilege(conn)
    finally:
        conn.close()

    if existed:
        if not in_place:
            conn = server_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute(f"DROP DATABASE IF EXISTS `{name}`")
                    cur.execute(create_sql)
                conn.commit()
            except pymysql.MySQLError as exc:
                if not (exc.args and exc.args[0] in _NO_DATABASE_PRIVILEGE):
                    raise
                in_place = True   # hosted account without DROP/CREATE DATABASE: empty the database instead
                if not quiet:
                    print("  (no privilege to drop/create the database - rebuilding inside it instead)")
            finally:
                conn.close()
        if in_place:
            conn = server_connection(name)
            try:
                reset_in_place(conn, name)
            finally:
                conn.close()

    conn = server_connection(name)
    try:
        count = run_sql_file(conn, SCHEMA_FILE)
        if not quiet:
            print(f"  schema.sql  -> {count} statements executed")
        if seed:
            count = run_sql_file(conn, SEED_FILE)
            if not quiet:
                print(f"  seed.sql    -> {count} statements executed")
    finally:
        conn.close()


def upgrade(name):
    """Non-destructive upgrade of an existing database created by an earlier version."""
    conn = server_connection(name)
    try:
        check_stored_program_privilege(conn)
        count = run_sql_file(conn, SCHEMA_FILE)
        print(f"  schema.sql  -> {count} statements executed (tables kept, views/routines/triggers refreshed)")
        if os.path.exists(UPGRADE_FILE):
            count = run_sql_file(conn, UPGRADE_FILE)
            print(f"  upgrade.sql -> {count} statements executed")
    finally:
        conn.close()


def check(name):
    """Connection and privilege test for a local or hosted MySQL server; nothing is changed."""
    conn = server_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT VERSION(), @@log_bin, @@log_bin_trust_function_creators, NOW()")
            version, log_bin, trust, now = cur.fetchone()
            cur.execute("SHOW STATUS LIKE 'Ssl_cipher'")
            cipher = (cur.fetchone() or ('', ''))[1]
    finally:
        conn.close()
    print(f"  connected            : server version {version}")
    print(f"  encryption           : {cipher or 'none'}")
    print(f"  server time          : {now}" + (f"  (session time zone {Config.DB_TIME_ZONE})" if Config.DB_TIME_ZONE else ''))
    print(f"  binary logging       : {'ON' if log_bin else 'OFF'}   log_bin_trust_function_creators: {'ON' if trust else 'OFF'}")
    if not database_exists(name):
        print(f"  database '{name}'    : not created yet (the installer creates it)")
        print("Connection OK. Run the same command without --check to install the database.")
        return 0
    conn = server_connection(name)
    try:
        check_stored_program_privilege(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", (name,))
            tables = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s", (name,))
            triggers = cur.fetchone()[0]
    finally:
        conn.close()
    print(f"  triggers / functions : this account may create them")
    print(f"  database '{name}'    : {tables} tables, {triggers} triggers")
    print("Connection OK." + ('' if tables else ' Run the same command without --check to install the database.'))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description='Initialise the SOLACE MySQL database.')
    parser.add_argument('--database', default=Config.DB_NAME, help='database name (default: DB_NAME from .env)')
    parser.add_argument('--upgrade', action='store_true', help='keep data; refresh schema objects only')
    parser.add_argument('--no-seed', action='store_true', help='create the schema without demo data')
    parser.add_argument('--yes', action='store_true', help='do not ask for confirmation')
    parser.add_argument('--in-place', action='store_true',
                        help='rebuild inside the existing database (no DROP/CREATE DATABASE)')
    parser.add_argument('--check', action='store_true',
                        help='only test the connection and privileges; change nothing')
    args = parser.parse_args(argv)

    name = args.database
    if not DB_NAME_RE.match(name):
        parser.error('Database name may only contain letters, digits and underscores.')

    if Config.DB_CONFIG_ERROR:
        print(f"Cannot continue: {Config.DB_CONFIG_ERROR}")
        return 3
    tls = '  |  encrypted connection required' if Config.db_ssl_context() is not None else ''
    print(f"MySQL server: {Config.DB_USER}@{Config.DB_HOST}:{Config.DB_PORT}  |  database: {name}{tls}")
    try:
        if args.check:
            return check(name)
        if args.upgrade:
            if not database_exists(name):
                parser.error(f"Database '{name}' does not exist yet - run without --upgrade first.")
            upgrade(name)
        else:
            if database_exists(name) and not args.yes:
                answer = input(f"Database '{name}' exists and will be DROPPED and rebuilt. Type YES to continue: ")
                if answer.strip() != 'YES':
                    print('Aborted - nothing was changed.')
                    return 1
            rebuild(name, seed=not args.no_seed, in_place=args.in_place)
    except InitError as exc:
        print(f"Cannot continue: {exc}")
        return 3
    except pymysql.MySQLError as exc:
        print(f"MySQL error: {exc}")
        print("Check that MySQL is running and that the connection settings are correct "
              "(DB_HOST/DB_PORT/DB_USER/DB_PASSWORD or DATABASE_URL; DB_SSL=1 for hosts that require encryption).")
        return 2
    print('Database ready.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
