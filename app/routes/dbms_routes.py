"""
Database Explorer (DBMS showcase): live ER diagram, relational schema, DFDs,
SQL Query Laboratory and a paginated table viewer.

Access policy
  * ER diagram, relational schema, DFDs and the SQL query catalogue are public study material.
  * Executing queries and browsing table records is restricted to administrators.
"""
import logging

from flask import Blueprint, abort, flash, jsonify, redirect, render_template, request, session, url_for

from app.routes.auth_routes import login_required, role_required
from app.services import schema_introspection as si
from app.services import sql_lab
import pymysql

from config import Config
from database.connection import query_db

dbms_bp = Blueprint('dbms', __name__, url_prefix='/dbms')
log = logging.getLogger(__name__)
TABLE_PAGE_SIZES = (10, 25, 50, 100)


def _is_admin():
    return session.get('role_name') == 'admin'


@dbms_bp.route('/')
def overview():
    summary = si.summary()
    tables = si.list_tables()
    rels = si.relationships()
    domains = {}
    for t in tables:
        domains.setdefault(t['domain'], []).append(t['name'])
    counts = {}
    if _is_admin():
        for t in tables:
            counts[t['name']] = query_db(f"SELECT COUNT(*) AS n FROM `{t['name']}`", one=True)['n']
    return render_template('dbms/overview.html', summary=summary, tables=tables, domains=domains,
                           relationships=rels, counts=counts,
                           check_count=len(si.check_constraints()), active='overview')


@dbms_bp.route('/er-diagram')
def er_diagram():
    return render_template('dbms/er_diagram.html', payload=si.er_payload(), active='er')


@dbms_bp.route('/api/schema.json')
def schema_json():
    return jsonify(si.er_payload())


@dbms_bp.route('/schema')
def relational_schema():
    model = si.full_model()
    ordered = []
    for domain, names in si.DOMAINS.items():
        for name in names:
            if name in model:
                ordered.append(model[name])
    ordered += [t for n, t in model.items() if t['domain'] == 'Other']
    return render_template('dbms/schema.html', tables=ordered, relationships=si.relationships(),
                           views=si.views(), routines=si.routines(), params=si.routine_parameters(),
                           triggers=si.triggers(), active='schema')


@dbms_bp.route('/dfd')
def dfd():
    stores = {t['name']: t['domain'] for t in si.list_tables()}
    return render_template('dbms/dfd.html', stores=stores, active='dfd')


@dbms_bp.route('/sql-lab')
def sql_lab_page():
    return render_template('dbms/sql_lab.html', catalogue=sql_lab.catalogue(), can_execute=_is_admin(),
                           row_limit=Config.SQL_LAB_ROW_LIMIT, active='sql')


@dbms_bp.route('/sql-lab/run/<query_id>', methods=['POST'])
@login_required
@role_required(['admin'])
def sql_lab_run(query_id):
    if query_id not in sql_lab.QUERIES:
        abort(404)
    try:
        results = sql_lab.execute_catalogue_query(query_id, actor_id=session['user_id'])
        return jsonify({'ok': True, 'results': results, 'mode': sql_lab.QUERIES[query_id]['mode']})
    except sql_lab.LabError as err:
        return jsonify({'ok': False, 'error': str(err)}), 400
    except pymysql.MySQLError as err:
        return jsonify({'ok': False, 'error': f"MySQL error {err.args[0]}: {err.args[1] if len(err.args) > 1 else ''}"}), 400


@dbms_bp.route('/sql-lab/console', methods=['POST'])
@login_required
@role_required(['admin'])
def sql_console():
    sql = request.form.get('sql', '')
    try:
        results = sql_lab.execute_console_query(sql, actor_id=session['user_id'])
        return jsonify({'ok': True, 'results': results})
    except sql_lab.LabError as err:
        return jsonify({'ok': False, 'error': str(err)}), 400
    except pymysql.MySQLError as err:
        # MySQL errors (syntax, unknown column, READ ONLY violation, timeout) are safe to show to the admin
        code = err.args[0] if err.args else ''
        msg = err.args[1] if len(err.args) > 1 else str(err)
        return jsonify({'ok': False, 'error': f"MySQL error {code}: {msg}"}), 400


@dbms_bp.route('/tables')
@login_required
@role_required(['admin'])
def tables():
    names = si.table_names()
    selected = request.args.get('table') or (names[0] if names else None)
    if selected not in names:
        flash('Unknown table.', 'warning')
        return redirect(url_for('dbms.tables'))

    meta = si.full_model()[selected]
    column_names = [c['name'] for c in meta['columns']]
    try:
        per_page = int(request.args.get('per_page', 25))
    except ValueError:
        per_page = 25
    per_page = per_page if per_page in TABLE_PAGE_SIZES else 25
    try:
        page = max(1, int(request.args.get('page', 1)))
    except ValueError:
        page = 1

    # Identifiers cannot be bound as parameters: they are validated against information_schema
    # (table must be in `names`, columns in `column_names`) and back-quoted. Values ARE parameterised.
    search_col = request.args.get('col', '')
    search_val = request.args.get('q', '').strip()[:100]
    where, args = '', []
    if search_val and search_col in column_names:
        where = f" WHERE CAST(`{search_col}` AS CHAR) LIKE %s"
        args.append(f"%{search_val}%")

    sort = request.args.get('sort', '')
    pk_cols = [c['name'] for c in meta['columns'] if 'PK' in c['keys']]
    order_col = sort if sort in column_names else (pk_cols[0] if pk_cols else column_names[0])
    direction = 'DESC' if request.args.get('dir') == 'desc' else 'ASC'

    total = query_db(f"SELECT COUNT(*) AS n FROM `{selected}`" + where, tuple(args), one=True)['n']
    pages = max(1, (total + per_page - 1) // per_page)
    page = min(page, pages)
    rows = query_db(f"SELECT * FROM `{selected}`{where} ORDER BY `{order_col}` {direction} LIMIT %s OFFSET %s",
                    tuple(args) + (per_page, (page - 1) * per_page))
    sensitive = {c['name'] for c in meta['columns'] if c['sensitive']}
    display_rows = [[('•••• hidden' if col in sensitive and r[col] else sql_lab._cell(r[col])) for col in column_names]
                    for r in rows]

    all_counts = {n: query_db(f"SELECT COUNT(*) AS n FROM `{n}`", one=True)['n'] for n in names}
    return render_template('dbms/tables.html', names=names, selected=selected, meta=meta,
                           column_names=column_names, rows=display_rows, total=total, page=page, pages=pages,
                           per_page=per_page, page_sizes=TABLE_PAGE_SIZES, search_col=search_col,
                           search_val=search_val, sort=order_col, direction=direction, all_counts=all_counts,
                           active='tables')
