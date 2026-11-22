import json
from database.connection import execute_db
from flask import has_request_context, request

_AUDIT_SQL = """
    INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, old_values, new_values, ip_address)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
"""


def log_audit_action(user_id, action_type, entity_name, entity_id=None, old_values=None, new_values=None, cursor=None):
    """
    Record an administrative or critical security action into audit_logs.
    Pass `cursor` when called inside an open transaction so the audit row is committed
    (or rolled back) atomically with the change it describes.
    """
    ip_addr = request.remote_addr if has_request_context() else '127.0.0.1'
    old_json = json.dumps(old_values, default=str) if old_values else None
    new_json = json.dumps(new_values, default=str) if new_values else None
    args = (user_id, action_type, entity_name, entity_id, old_json, new_json, ip_addr)

    if cursor is not None:
        cursor.execute(_AUDIT_SQL, args)
    else:
        execute_db(_AUDIT_SQL, args)
