"""
Live schema introspection for the Database Explorer.

Everything shown in the ER diagram and relational schema is read from MySQL's
information_schema at request time, so the diagrams always match the real database.
Only the human-readable descriptions/domains below are maintained by hand.
"""
from config import Config
from database.connection import query_db

DOMAINS = {
    'Identity & Access': ['roles', 'users', 'guests', 'staff', 'audit_logs'],
    'Guest Preferences': ['interests', 'guest_preferences'],
    'Experience Catalogue': ['experience_categories', 'experiences', 'suppliers'],
    'Scheduling & Resources': ['experience_slots', 'resources', 'experience_resources',
                               'experience_staff_requirements', 'maintenance_periods'],
    'Bookings & Payments': ['bookings', 'booking_status_history', 'resource_allocations',
                            'staff_assignments', 'payments', 'reviews'],
    'Trip Planning': ['itineraries', 'itinerary_items'],
}

TABLE_DESCRIPTIONS = {
    'roles': 'Access-control levels (admin, guest, staff).',
    'users': 'Authentication identity: one row per account with a hashed password and role.',
    'guests': 'Guest profile (1:1 specialisation of users): party size, budget, stay dates, preferences.',
    'interests': 'Master list of interest categories used by the recommendation engine.',
    'guest_preferences': 'Associative entity: weight (1-5) a guest gives each interest (M:N guests-interests).',
    'experience_categories': 'The six experience pillars (luxury, nature, adventure, wellness, culture, sustainability).',
    'suppliers': 'Local partners and vendors that supply experiences and equipment.',
    'experiences': 'Catalogue of bookable experiences with pricing, capacity and eco metrics.',
    'experience_slots': 'Scheduled sessions of an experience with capacity counters.',
    'resources': 'Inventory of equipment, venues, vehicles and gear.',
    'experience_resources': 'Associative entity: resources an experience needs (M:N experiences-resources).',
    'staff': 'Staff profile (1:1 specialisation of users): specialisation and availability.',
    'experience_staff_requirements': 'Roles and headcount an experience requires per session.',
    'bookings': 'Guest reservations of a slot, with price, status lifecycle and refund.',
    'booking_status_history': 'Audit trail of booking status changes (written by triggers).',
    'resource_allocations': 'Units of a resource reserved by a booking for a slot.',
    'staff_assignments': 'Staff member assigned to lead a booking/slot.',
    'payments': 'Simulated payment transactions per booking.',
    'reviews': 'Verified 1-5 star review; at most one per booking (UNIQUE booking_id).',
    'maintenance_periods': 'Scheduled or in-progress downtime of a resource.',
    'audit_logs': 'Security/administrative activity log with JSON before/after values.',
    'itineraries': 'Multi-day trip plan owned by a guest.',
    'itinerary_items': 'Experiences placed on a day/time block of an itinerary.',
}

SENSITIVE_COLUMNS = {('users', 'password_hash')}


def _schema():
    return Config.DB_NAME


def domain_of(table):
    for domain, tables in DOMAINS.items():
        if table in tables:
            return domain
    return 'Other'


def list_tables():
    rows = query_db("""
        SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation_name,
               AUTO_INCREMENT AS auto_increment, CREATE_TIME AS created
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
    """, (_schema(),))
    for r in rows:
        r['domain'] = domain_of(r['name'])
        r['description'] = TABLE_DESCRIPTIONS.get(r['name'], '')
    return rows


def table_names():
    return [r['name'] for r in list_tables()]


def columns_for(table=None):
    sql = """
        SELECT TABLE_NAME AS table_name, COLUMN_NAME AS name, ORDINAL_POSITION AS position,
               COLUMN_TYPE AS column_type, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
               COLUMN_DEFAULT AS default_value, COLUMN_KEY AS column_key, EXTRA AS extra
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s
    """
    args = [_schema()]
    if table:
        sql += " AND TABLE_NAME = %s"
        args.append(table)
    sql += " ORDER BY TABLE_NAME, ORDINAL_POSITION"
    return query_db(sql, tuple(args))


def foreign_keys():
    return query_db("""
        SELECT k.CONSTRAINT_NAME AS constraint_name, k.TABLE_NAME AS child_table,
               k.COLUMN_NAME AS child_column, k.REFERENCED_TABLE_NAME AS parent_table,
               k.REFERENCED_COLUMN_NAME AS parent_column,
               rc.UPDATE_RULE AS on_update, rc.DELETE_RULE AS on_delete,
               c.IS_NULLABLE AS is_nullable
        FROM information_schema.KEY_COLUMN_USAGE k
        JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
          ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
         AND rc.TABLE_NAME = k.TABLE_NAME
        JOIN information_schema.COLUMNS c
          ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME
        WHERE k.TABLE_SCHEMA = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY k.TABLE_NAME, k.ORDINAL_POSITION
    """, (_schema(),))


def indexes(table=None):
    sql = """
        SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name, NON_UNIQUE AS non_unique,
               GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS columns,
               COUNT(*) AS column_count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = %s
    """
    args = [_schema()]
    if table:
        sql += " AND TABLE_NAME = %s"
        args.append(table)
    sql += " GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME = 'PRIMARY' DESC, INDEX_NAME"
    return query_db(sql, tuple(args))


def check_constraints():
    """CHECK constraints (MySQL 8.0.16+ / MariaDB 10.2+). Returns [] when unsupported."""
    try:
        return query_db("""
            SELECT tc.TABLE_NAME AS table_name, cc.CONSTRAINT_NAME AS constraint_name, cc.CHECK_CLAUSE AS check_clause
            FROM information_schema.TABLE_CONSTRAINTS tc
            JOIN information_schema.CHECK_CONSTRAINTS cc
              ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.TABLE_SCHEMA = %s AND tc.CONSTRAINT_TYPE = 'CHECK'
            ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME
        """, (_schema(),))
    except Exception:
        return []


def views():
    return query_db("""
        SELECT TABLE_NAME AS name, VIEW_DEFINITION AS definition, IS_UPDATABLE AS is_updatable
        FROM information_schema.VIEWS WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME
    """, (_schema(),))


def routines():
    return query_db("""
        SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS routine_type, DTD_IDENTIFIER AS returns,
               ROUTINE_DEFINITION AS definition, SQL_DATA_ACCESS AS data_access
        FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s ORDER BY ROUTINE_TYPE, ROUTINE_NAME
    """, (_schema(),))


def routine_parameters():
    rows = query_db("""
        SELECT SPECIFIC_NAME AS routine, PARAMETER_MODE AS mode, PARAMETER_NAME AS name, DTD_IDENTIFIER AS type
        FROM information_schema.PARAMETERS
        WHERE SPECIFIC_SCHEMA = %s AND PARAMETER_NAME IS NOT NULL
        ORDER BY SPECIFIC_NAME, ORDINAL_POSITION
    """, (_schema(),))
    params = {}
    for r in rows:
        params.setdefault(r['routine'], []).append(r)
    return params


def triggers():
    return query_db("""
        SELECT TRIGGER_NAME AS name, EVENT_MANIPULATION AS event, EVENT_OBJECT_TABLE AS table_name,
               ACTION_TIMING AS timing, ACTION_STATEMENT AS statement
        FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME
    """, (_schema(),))


def unique_single_columns():
    """Set of (table, column) pairs that are unique on their own (PK or single-column UNIQUE)."""
    return {(i['table_name'], i['columns']) for i in indexes() if not i['non_unique'] and i['column_count'] == 1}


def relationships():
    """
    Derive ER relationships and crow's-foot cardinalities from the foreign keys:
      parent side: exactly one (||) when the FK is NOT NULL, zero-or-one (|o) when nullable;
      child side : zero-or-one (o|) when the FK column is unique on its own, else zero-or-many (o{).
    A relationship is *identifying* when the FK column is (part of) the child's primary key.
    """
    unique = unique_single_columns()
    pk_cols = {(c['table_name'], c['name']) for c in columns_for() if c['column_key'] == 'PRI'}
    rels = []
    for fk in foreign_keys():
        child_unique = (fk['child_table'], fk['child_column']) in unique
        nullable = fk['is_nullable'] == 'YES'
        rels.append({
            **fk,
            'parent_card': '|o' if nullable else '||',
            'child_card': 'o|' if child_unique else 'o{',
            'identifying': (fk['child_table'], fk['child_column']) in pk_cols,
            'cardinality': ('1' if not nullable else '0..1') + ' : ' + ('0..1' if child_unique else '0..N'),
            'type': '1 : 1' if child_unique else '1 : N',
        })
    return rels


def full_model():
    """All metadata needed by the ER diagram, relational schema and table viewer."""
    tables = list_tables()
    cols = columns_for()
    fks = foreign_keys()
    fk_map = {(f['child_table'], f['child_column']): f for f in fks}
    uniques = unique_single_columns()
    checks = check_constraints()
    idx = indexes()

    by_table = {t['name']: {**t, 'columns': [], 'foreign_keys': [], 'checks': [], 'indexes': [],
                            'referenced_by': []} for t in tables}
    for c in cols:
        if c['table_name'] not in by_table:
            continue
        fk = fk_map.get((c['table_name'], c['name']))
        keys = []
        if c['column_key'] == 'PRI':
            keys.append('PK')
        if fk:
            keys.append('FK')
        if (c['table_name'], c['name']) in uniques and c['column_key'] != 'PRI':
            keys.append('UK')
        c = dict(c)
        c['keys'] = keys
        c['references'] = f"{fk['parent_table']}({fk['parent_column']})" if fk else None
        c['sensitive'] = (c['table_name'], c['name']) in SENSITIVE_COLUMNS
        by_table[c['table_name']]['columns'].append(c)
    for f in fks:
        if f['child_table'] in by_table:
            by_table[f['child_table']]['foreign_keys'].append(f)
        if f['parent_table'] in by_table:
            by_table[f['parent_table']]['referenced_by'].append(f)
    for ch in checks:
        if ch['table_name'] in by_table:
            by_table[ch['table_name']]['checks'].append(ch)
    for i in idx:
        if i['table_name'] in by_table:
            by_table[i['table_name']]['indexes'].append(i)
    return by_table


def er_payload():
    """Compact JSON for the client-side ER renderer."""
    model = full_model()
    return {
        'tables': [
            {
                'name': t['name'],
                'domain': t['domain'],
                'description': t['description'],
                'columns': [{'name': c['name'], 'type': c['data_type'], 'full_type': c['column_type'],
                             'keys': c['keys'], 'nullable': c['is_nullable'] == 'YES',
                             'references': c['references']} for c in t['columns']],
            } for t in model.values()
        ],
        'relationships': [
            {k: r[k] for k in ('constraint_name', 'child_table', 'child_column', 'parent_table', 'parent_column',
                               'parent_card', 'child_card', 'identifying', 'cardinality', 'type', 'on_delete')}
            for r in relationships()
        ],
        'domains': list(DOMAINS.keys()),
    }


def summary():
    return query_db("""
        SELECT
          (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE') AS tables,
          (SELECT COUNT(*) FROM information_schema.VIEWS WHERE TABLE_SCHEMA = %s) AS views,
          (SELECT COUNT(*) FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
              ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
            WHERE c.TABLE_SCHEMA = %s AND t.TABLE_TYPE = 'BASE TABLE') AS columns,
          (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = %s) AS foreign_keys,
          (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s) AS triggers,
          (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s AND ROUTINE_TYPE = 'PROCEDURE') AS procedures,
          (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = %s AND ROUTINE_TYPE = 'FUNCTION') AS functions,
          (SELECT COUNT(DISTINCT TABLE_NAME, INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = %s) AS indexes,
          VERSION() AS server_version
    """, (_schema(),) * 8, one=True)
