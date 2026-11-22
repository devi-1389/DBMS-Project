import os
import re
import secrets
import ssl
import time
import warnings
from datetime import timedelta
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv

# Load environment variables from .env file (existing environment variables take precedence)
load_dotenv()


def _env_bool(name, default='0'):
    return os.getenv(name, default).strip().lower() in ('1', 'true', 'yes', 'on')


def _load_secret_key():
    key = os.getenv('SECRET_KEY', '').strip()
    if key:
        return key
    # Never fall back to a hard-coded key: generate a random one for this process.
    warnings.warn(
        "SECRET_KEY is not set in .env - using a random per-process key. "
        "Sessions will be invalidated whenever the server restarts.",
        RuntimeWarning,
    )
    return secrets.token_hex(32)


BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# True on serverless hosts such as Vercel, where the project folder is read-only
IS_SERVERLESS = bool(os.getenv('VERCEL') or os.getenv('AWS_LAMBDA_FUNCTION_NAME'))


def _database_settings():
    """
    MySQL connection settings.

    Either one connection string  DATABASE_URL=mysql://user:password@host:port/database
    (the "Service URI" / "MySQL URL" shown by hosted MySQL providers), or the individual
    DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME variables. DATABASE_URL wins when both are set.
    """
    cfg = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'name': os.getenv('DB_NAME', 'solace_db'),
        'ssl': _env_bool('DB_SSL', '0'),
    }
    url = (os.getenv('DATABASE_URL') or os.getenv('MYSQL_URL') or '').strip()
    if url:
        # A wrong value is reported on the website and by the installer instead of crashing at start-up.
        # The message never repeats the URL itself, because it contains the password.
        parts = urlparse(url)
        scheme = parts.scheme.split('+')[0].lower()
        if scheme not in ('mysql', 'mariadb'):
            cfg['error'] = (f'DATABASE_URL points to a {scheme or "non-MySQL"} database, but SOLACE uses MySQL. '
                            'Set it to mysql://user:password@host:port/database')
            return cfg
        try:
            port = parts.port
        except ValueError:
            port = None
            cfg['error'] = 'The port in DATABASE_URL is not a number.'
            return cfg
        if not parts.hostname:
            cfg['error'] = 'DATABASE_URL must look like mysql://user:password@host:port/database'
            return cfg
        cfg['host'] = parts.hostname
        cfg['port'] = port or 3306
        cfg['user'] = unquote(parts.username or '')
        cfg['password'] = unquote(parts.password or '')
        cfg['name'] = unquote(parts.path.lstrip('/')) or cfg['name']
        query = {k.lower().replace('_', '-'): v[-1].lower() for k, v in parse_qs(parts.query).items()}
        mode = query.get('ssl-mode') or query.get('sslmode') or ''
        if mode in ('required', 'require', 'verify-ca', 'verify-identity', 'verify_ca', 'verify_identity') \
                or query.get('ssl') in ('1', 'true', 'yes'):
            cfg['ssl'] = True
    return cfg


def _utc_offset():
    """APP_UTC_OFFSET such as +05:30 -> ('+05:30', seconds east of UTC); (None, None) when not set."""
    raw = os.getenv('APP_UTC_OFFSET', '').strip()
    if not raw:
        return None, None
    m = re.fullmatch(r'([+-])(\d{1,2}):?(\d{2})', raw)
    if not m or int(m.group(2)) > 14 or int(m.group(3)) > 59:
        raise RuntimeError('APP_UTC_OFFSET must look like +05:30')
    sign, hours, minutes = m.group(1), int(m.group(2)), int(m.group(3))
    return f'{sign}{hours:02d}:{minutes:02d}', (1 if sign == '+' else -1) * (hours * 3600 + minutes * 60)


_DB = _database_settings()
_UTC_OFFSET, _UTC_OFFSET_SECONDS = _utc_offset()
if _UTC_OFFSET and hasattr(time, 'tzset'):
    # Hosting servers run on UTC. Give the Python process the resort's local time without needing
    # time-zone files (POSIX TZ strings use the opposite sign: UTC+05:30 is written "-5:30").
    _h, _m = divmod(abs(_UTC_OFFSET_SECONDS) // 60, 60)
    os.environ['TZ'] = '<%s>%s%d:%02d' % (_UTC_OFFSET.replace(':', ''), '-' if _UTC_OFFSET_SECONDS >= 0 else '+', _h, _m)
    time.tzset()


class Config:
    SECRET_KEY = _load_secret_key()
    DEBUG = _env_bool('FLASK_DEBUG', '0')

    # Session & cookie hardening
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    # HTTPS-only session cookie: on automatically on Vercel (always HTTPS), off on http://127.0.0.1
    SESSION_COOKIE_SECURE = _env_bool('SESSION_COOKIE_SECURE', '1' if os.getenv('VERCEL') else '0')
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=int(os.getenv('SESSION_LIFETIME_MINUTES', 120)))
    CSRF_ENABLED = True

    # Uploads (experience photos)
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'app', 'static', 'uploads', 'experiences')
    # Serverless hosts (Vercel) cannot store uploaded files, so photo upload is switched off there
    # and administrators use the "image URL" field instead. Override with UPLOADS_ENABLED=0/1.
    UPLOADS_ENABLED = _env_bool('UPLOADS_ENABLED', '0' if IS_SERVERLESS else '1')

    # Database Settings (MySQL)
    DB_HOST = _DB['host']
    DB_PORT = _DB['port']
    DB_USER = _DB['user']
    DB_PASSWORD = _DB['password']
    DB_NAME = _DB['name']
    # Encrypted connections for hosted MySQL servers:
    #   DB_SSL=1          -> the connection must be encrypted (like mysql --ssl-mode=REQUIRED)
    #   DB_SSL_CA=<file>  -> also verify the server certificate against this CA certificate file
    #   DB_SSL_CA_PEM=... -> same, with the certificate text itself stored in the variable
    DB_SSL = _DB['ssl']
    DB_CONFIG_ERROR = _DB.get('error')   # wrong DATABASE_URL, shown on the website and by the installer
    DB_SSL_CA = os.getenv('DB_SSL_CA', '').strip()
    DB_SSL_CA_PEM = os.getenv('DB_SSL_CA_PEM', '').strip()
    DB_SSL_VERIFY_HOSTNAME = _env_bool('DB_SSL_VERIFY_HOSTNAME', '1')
    # Local time of the resort as a UTC offset (e.g. +05:30). Leave empty on your own PC.
    DB_TIME_ZONE = _UTC_OFFSET

    @classmethod
    def deployment_problems(cls):
        """Settings that are missing or wrong: a list of (variable, explanation); empty when fine."""
        problems = []
        if cls.DB_CONFIG_ERROR:
            problems.append(('DATABASE_URL', cls.DB_CONFIG_ERROR))
        if not IS_SERVERLESS:
            return problems
        if not os.getenv('SECRET_KEY', '').strip():
            problems.append(('SECRET_KEY', 'a long random text that signs the login session'))
        if not (os.getenv('DATABASE_URL') or os.getenv('MYSQL_URL') or os.getenv('DB_HOST')) and not cls.DB_CONFIG_ERROR:
            problems.append(('DATABASE_URL', 'the address of your hosted MySQL database, '
                                             'written as mysql://user:password@host:port/database'))
        return problems

    @classmethod
    def db_ssl_context(cls):
        """ssl.SSLContext for the MySQL connection, or None for a plain local connection."""
        if not (cls.DB_SSL or cls.DB_SSL_CA or cls.DB_SSL_CA_PEM):
            return None
        if cls.DB_SSL_CA or cls.DB_SSL_CA_PEM:
            ca_file = cls.DB_SSL_CA
            if ca_file and not os.path.isabs(ca_file):
                ca_file = os.path.join(BASE_DIR, ca_file)
            ca_text = cls.DB_SSL_CA_PEM.replace('\\n', '\n') or None
            ctx = ssl.create_default_context(cafile=ca_file or None, cadata=ca_text)
            # certificates generated by MySQL servers do not pass Python 3.13's strict X.509 checks
            ctx.verify_flags &= ~getattr(ssl, 'VERIFY_X509_STRICT', 0)
            ctx.check_hostname = cls.DB_SSL_VERIFY_HOSTNAME
            return ctx
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    @classmethod
    def db_connect_args(cls, database=None):
        """Keyword arguments shared by every pymysql.connect() call in the project."""
        args = {
            'host': cls.DB_HOST, 'port': cls.DB_PORT, 'user': cls.DB_USER, 'password': cls.DB_PASSWORD,
            'database': database, 'charset': 'utf8mb4',
        }
        ctx = cls.db_ssl_context()
        if ctx is not None:
            args['ssl'] = ctx
        if cls.DB_TIME_ZONE:
            args['init_command'] = "SET time_zone = '%s'" % cls.DB_TIME_ZONE
        return args

    # SQL Query Laboratory (Database Explorer) safety limits
    SQL_LAB_ROW_LIMIT = int(os.getenv('SQL_LAB_ROW_LIMIT', 500))
    SQL_LAB_TIMEOUT_MS = int(os.getenv('SQL_LAB_TIMEOUT_MS', 5000))

    # Recommendation Algorithm Configurable Weights
    WEIGHT_INTEREST = float(os.getenv('WEIGHT_INTEREST', 0.40))
    WEIGHT_BUDGET = float(os.getenv('WEIGHT_BUDGET', 0.25))
    WEIGHT_SCHEDULE = float(os.getenv('WEIGHT_SCHEDULE', 0.15))
    WEIGHT_SUSTAINABILITY = float(os.getenv('WEIGHT_SUSTAINABILITY', 0.10))
    WEIGHT_RATING = float(os.getenv('WEIGHT_RATING', 0.10))

    # Resort Details
    RESORT_NAME = "SOLACE Luxury Nature & Adventure Resort"
    CURRENCY_SYMBOL = "₹"
