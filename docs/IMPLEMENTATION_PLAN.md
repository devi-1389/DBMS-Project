# SOLACE – Audit Findings & Implementation Plan

## 1. Audit summary (state of the project before this round of work)

**Architecture (kept as-is):** Flask app factory (`app/__init__.py`) + 8 blueprints, raw
parameterized SQL through PyMySQL (`database/connection.py`), service layer
(`app/services/*`), Jinja2 + Bootstrap templates, MySQL schema of 23 InnoDB tables,
3 views and 2 triggers.

**Verified working:** schema + seed import cleanly into MySQL 8.0; all 9 seeded demo
accounts match the documented passwords; the 11 existing tests passed.

| Area | Finding |
| --- | --- |
| Images | All 19 `experiences.image_url` values point to `/static/images/*.webp`, but that folder did not exist, so every card fell back to the same single remote spa photo. README banner image also missing. |
| Security | No CSRF protection on any form. Hard-coded fallback `SECRET_KEY`. `run.py` forces `debug=True`. Open redirect via `?next=https://…`. Registration flashes raw exception text. Bad numeric input → HTTP 500. No session-cookie hardening. Logout is a GET. |
| Booking / payment | `/payment/process` did not check booking status: a cancelled or already-confirmed booking could be "paid" again, which re-allocated capacity, resources and staff. Capacity was not re-checked at payment time (two pending bookings could overbook a slot). Refund marked *failed* payments as refunded. The confirmation page could show a failed payment row. Admin could flip a cancelled booking back to confirmed without re-allocating anything. |
| Staff | Staff could complete **any** booking (not only their assignments). No profile or availability management. |
| CRUD gaps | Resources, maintenance, suppliers, staff, users, slots (edit/cancel/delete), review moderation and experience deletion were read-only or missing. No bulk slot generation, so seed slots (relative to `CURDATE()`) expire after a few days. |
| Data honesty | Ratings defaulted to a fake `4.8` when an experience had no reviews (catalogue, KPIs, view). The landing page always drew 5 stars. |
| DB objects | No stored procedures or functions. Triggers recorded the guest as `changed_by_user_id` even when an admin or staff member made the change. |
| Setup | README's Python import snippet split SQL on `;` and fails on the `DELIMITER $$` trigger blocks. |
| Tests | Tests ran against the developer database and `test_06` permanently reset a seeded slot's `booked_capacity` to 0. |
| DBMS showcase | No in-app ER / schema / DFD / SQL lab / table viewer. Static SVGs in `docs/diagrams` are not linked from the site. |

## 2. Plan (executed in phases)

1. **Backend & security**: CSRF tokens, session hardening, env-driven secret/debug, safe
   redirects, validation helpers, actor-aware triggers (`@solace_actor_id`), fixes for
   payment/booking state, stored procedures and functions, plus a correct DB initializer
   (`python -m database.init_db`).
2. **CRUD completion**: admin resources/maintenance/suppliers/staff/users/slots/reviews;
   staff profile and scoped completion; guest password change, itinerary edit and review
   management.
3. **DBMS Explorer** (`/dbms`): ER diagram and relational schema generated **live from
   `information_schema`** so they always match MySQL, DFD L0/L1, SQL Query Lab (10
   categories, admin-only safe execution in READ ONLY / rolled-back transactions), and a
   paginated table viewer.
4. **UI/UX**: locally vendored assets (offline-safe), refined luxury design system,
   subject-specific local artwork for every experience with fallbacks, admin photo
   upload, and completed dashboards.
5. **Testing**: isolated `solace_test_db`, expanded test suite, Playwright crawl for
   broken links and images.
6. **Docs**: README with Windows PowerShell setup and a final report.
