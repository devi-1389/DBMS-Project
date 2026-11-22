# SOLACE – Implementation & Testing Report (October 2026 round)

## 1. Summary
The existing Flask + MySQL project was kept: same blueprints, raw parameterised SQL through PyMySQL, and the same 23-table schema. It was extended into a complete, tested DBMS showcase. No framework or database migration was made, and no existing module was removed.

| Area | Outcome |
| --- | --- |
| Backend & DB | Booking/payment state machine fixed (no double payment, re-check at payment, refunds only for successful payments). Capacity measured in units, so private experiences work. Staff assignment avoids overlapping duties and shares one guide per session. Audit logging is transactional. 2 new views, 2 functions, 3 procedures and 2 new triggers were added, and the 2 existing triggers became actor-aware via `@solace_actor_id`. A correct initializer (`python -m database.init_db`) and a non-destructive `--upgrade` were added. |
| CRUD | Admin CRUD for experiences (+ photo upload), slots (single, bulk via `sp_generate_slots`, edit, lock, cancel, delete), resources, maintenance, suppliers, staff accounts, user activation and review moderation. Guests can change their password, edit the itinerary, and edit or delete reviews. Staff have a profile/availability page and can only complete their own sessions. |
| Security | CSRF on every POST, session hardening, env-only secret, safe redirects, validation helpers, security headers, upload signature checks, friendly DB error page, guarded SQL console. |
| DBMS showcase | `/dbms`: live ER diagram, relational schema, DFD L0/L1, SQL lab (41 queries / 10 categories), table viewer. |
| UI/UX | Redesigned design system (forest/sage/sand/champagne) with self-hosted fonts and libraries (works offline), new layouts for every page, an admin sidebar console, toasts, charts, responsive down to 390 px, and subject-specific artwork for all 19 experiences. |
| Data | Seed corrected. Every booking now references a slot of its own experience; occupancy is derived from bookings; there is a two-week schedule for all 19 experiences; more realistic bookings and reviews were added; ratings are no longer fabricated. |
| Tests | 64 automated tests on an isolated `solace_test_db`, all passing on both MySQL 8.0 and MariaDB 10.11 (XAMPP's database family). A Playwright crawl as 4 roles found 0 HTTP errors, 0 broken images and 0 JS errors, and all 10 pop-up windows were verified to be clickable. |

## 2. Database design highlights
* **3NF**: atomic attributes; associative entities (`guest_preferences`, `experience_resources`) use UNIQUE composite keys; `guests`/`staff` are 1:1 specialisations of `users`.
* **Integrity**: 33 foreign keys with deliberate `CASCADE` / `RESTRICT` / `SET NULL` actions, 18 CHECK constraints, and UNIQUE keys such as `uq_slot_time` and `reviews.booking_id`.
* **Business rules in the DB**: `trg_review_before_insert` (`SIGNAL`) only accepts reviews for the guest's own completed booking. `trg_booking_after_insert/update` write the status history, attributed to the logged-in user. `trg_experience_price_audit` writes JSON before/after values. `sp_generate_slots` validates its input and uses `INSERT IGNORE` with an `OUT` count.
* **Concurrency**: slot rows are locked with `SELECT … FOR UPDATE` both when a reservation is created and when it is paid. Capacity, equipment and guide availability are re-checked inside the payment transaction, and the losing party in a last-seat race is marked `failed`.

## 3. Database Explorer – how it guarantees correctness
* The ER diagram and relational schema are built from `information_schema` (TABLES, COLUMNS, KEY_COLUMN_USAGE, REFERENTIAL_CONSTRAINTS, STATISTICS, CHECK_CONSTRAINTS, VIEWS, ROUTINES, TRIGGERS) at request time, so they cannot drift from the real schema. Tests assert that the 23 tables and 33 FKs match, and that `schema.sql` declares exactly the live tables, views, routines and triggers.
* Cardinalities are derived, not drawn by hand. A NOT NULL FK gives parent `||`, a nullable FK gives `|o`. A child FK that is unique on its own gives `o|` (1:1), otherwise `o{` (1:N). An FK that is part of the child's PK is drawn as an identifying (solid) line.
* SQL Lab execution is administrator-only, with three modes:
  * Read-only `START TRANSACTION READ ONLY` with a timeout and row limit.
  * Rolled-back sandbox for DML and triggers; steps that would cause an implicit commit are refused.
  * TEMPORARY-table-only DDL.

  A test runs all 40 executable queries and compares `CHECKSUM TABLE` for all 23 tables before and after; they are identical.
* `docs/diagrams/{er_diagram,relational_schema,dfd_level0,dfd_level1}.svg` and the PNG copies were exported from the running Explorer.

## 4. Testing
See `docs/test_plan_and_results.md` for the full list. Command: `python -m unittest discover -s tests -t . -v`, result `Ran 64 tests … OK` on MySQL 8.0 and on MariaDB 10.11.

| Suite | Tests |
| --- | --- |
| Original scenarios (`test_suite`) | 11 |
| Security (`test_security`) | 15 |
| Booking rules & triggers (`test_booking_rules`) | 8 |
| Admin CRUD & dashboards (`test_admin_crud`) | 15 |
| Itinerary planner (`test_itinerary`) | 5 |
| DB connectivity, schema consistency, Explorer, SQL lab (`test_dbms`) | 10 |

Browser QA (Playwright/Chromium):
* About 375 page loads crawled across anonymous, guest, staff and admin.
* A 390 px responsive check on 31 pages.
* A visual review of the main screens.

Every issue found was fixed and re-checked; see section 5 of the test document.

## 5. Remaining limitations (honest disclosure)
1. **Images are illustrations, not photographs.** The build environment's network policy blocked image hosts (Unsplash, Wikimedia), so no stock photo could be downloaded or verified. Each experience therefore uses a bundled, subject-specific SVG illustration with category fallbacks. Real photos can be uploaded per experience in Admin → Experiences.
2. **Tested on Linux with MySQL 8.0.46 and MariaDB 10.11.** It was not run on Windows itself. XAMPP ships an older MariaDB (10.4), which supports every feature used, but that exact version was not available to test.
3. Payments are simulated. There is no login rate limiting / account lockout. No Content-Security-Policy header is sent, because templates use small inline scripts.
4. Diagrams require JavaScript in the browser (Mermaid). The exported DFD SVGs use HTML labels (`foreignObject`), which some non-browser viewers do not render, so use the PNG copies in reports.
5. Sandbox lab queries roll back their data, but InnoDB `AUTO_INCREMENT` counters do not roll back, so ids may skip numbers.
6. Seed sessions cover the 14 days after initialisation. Afterwards, regenerate them with Admin → Schedules → Bulk generate, or re-run the initializer.
7. The older narrative documents (`project_report.md`, `user_manual.md`, the UML/sequence SVGs) predate this round. Their stale figures were corrected where found, but they were not rewritten.

## 6. Update – 31 October 2026 (XAMPP report: itinerary tab not working)
* **Root cause:** all pop-up windows were drawn underneath their own grey backdrop and could not be clicked. The page's fade-in animation (`animation-fill-mode: both`) left a stacking context on `<main>`, which trapped Bootstrap modals inside it. On the itinerary this blocked *Add activity* and *Edit details*. The same bug affected the cancel-booking dialog and every admin form dialog. It was a front-end bug, not a database one, which is why the HTTP-level tests did not catch it.
* **Fix:** the animation now uses `backwards` fill-mode, and `main.js` moves every modal directly under `<body>` at start-up (Bootstrap's recommended placement). CSS/JS URLs are now version-stamped so browsers load the fixed files.
* **Planner improvements:**
  * The *Add activity* dialog lists the real sessions of the chosen experience on the chosen day, with places left, and sets the time block from the session.
  * Days in the past are marked and locked.
  * The server rejects sessions on another day, sessions that have already started and full sessions.
  * A linked session that fills up shows *Full · other session* instead of *Book*.
* **Verification:** reproduced and verified on MariaDB 10.11 (XAMPP's database family). There are 5 new itinerary tests (64 in total, all passing on MariaDB and MySQL). A browser walkthrough covered add, edit, remove and book from the itinerary, and an automated click-check of all 10 pop-ups passed 10/10.

## 7. Update – 15 November 2026 (Vercel deployment and project documents)
* **Vercel-ready:** `api/index.py` (entry point), `vercel.json` (Flask preset), `.python-version` (3.12), `.gitignore` (keeps `.env` and `.venv` out of Git), `.vercelignore`.
* **Hosted MySQL support in `config.py`:** `DATABASE_URL`, encrypted connections (`DB_SSL`, `DB_SSL_CA`, `DB_SSL_CA_PEM`), `APP_UTC_OFFSET` (servers run on UTC), secure cookie switched on automatically on Vercel. Without these variables nothing changes on a local PC.
* **Serverless file system:** photo upload is switched off where the project folder is read-only; the form offers the image-URL field instead. Missing `SECRET_KEY`/database settings on Vercel produce a page that names the missing variables.
* **Installer:** `python -m database.init_db --check` tests connection, encryption and the trigger/function privilege; installation stops *before* touching data if a hosted server refuses triggers (MySQL error 1419); `--in-place` rebuilds inside a fixed database.
* **Verification:** `vercel build` (CLI 65.16.0) succeeded; the built function passed 29/29 checks through Vercel's own Python handler on a read-only folder; a restricted MySQL 8 account with binary logging and required TLS stood in for a hosted server. 68 tests pass on MySQL 8.0, MariaDB 10.11 and the hosted-server stand-in. **Not verified:** a real deployment on vercel.com and a real database provider (not reachable from the build environment).
* **Documents (Word, in `docs/`):** project overview, website user guide, front-end/back-end/database report with MySQL connection guide, deployment guide, database design and normalization (Chen and crow's-foot ER, DFD levels 0/1/2, schema, data dictionary of all 196 attributes, normalization UNF→BCNF with the deliberate denormalizations analysed and checked). The project report's normalization section was corrected accordingly: four tables keep documented copies of key values and are strictly 2NF.

## 8. Update – 22 November 2026 (landing page and final check)
* **Landing page:** the panel listing the guest/admin/staff demo logins was replaced by a *Welcome to SOLACE* card in the hero's gold-on-forest style, with a normal **Sign In** button and a link to create a guest account. Signed-in visitors see *Welcome back* with a button to their own dashboard (guest dashboard, duty roster or admin console).
* **Sign-in page:** the one-click demo account buttons were removed; it is an ordinary e-mail/password form. The `SHOW_DEMO_ACCOUNTS` setting was removed because nothing is left to hide. A test checks that neither page contains any seeded e-mail or password.
* **Wrong database address:** a `DATABASE_URL` that is not MySQL (for example a PostgreSQL address left over from an earlier deployment) no longer stops the application; the site shows which setting to correct, without revealing the password, and the installer refuses to run.
* **Final verification:** 69/69 tests on MySQL 8.0 and MariaDB 10.11; browser crawl of 374 page loads as visitor, guest, staff and administrator with 0 HTTP errors, 0 broken images, 0 JavaScript errors and no horizontal overflow at phone width; all 9 pop-up windows clickable.

## 9. Files added or substantially changed
* **New**:
  * `app/security.py`, `app/routes/admin_manage_routes.py`, `app/routes/dbms_routes.py`
  * `app/services/schema_introspection.py`, `app/services/sql_lab.py`
  * `database/init_db.py`, `database/upgrade.sql`, `tools/generate_artwork.py`
  * `app/static/vendor/*`, `app/static/images/*`
  * `templates/dbms/*`, `templates/admin/{_layout,users,reviews}.html`, `templates/staff/profile.html`, `templates/guest/my_reviews.html`, `templates/auth/change_password.html`, `templates/errors/error.html`, `templates/_macros.html`
  * `tests/{helpers,test_security,test_booking_rules,test_admin_crud,test_dbms}.py`, `docs/IMPLEMENTATION_PLAN.md`, this report
* **Rewritten / extended**: every route module, the availability, itinerary and audit services, the recommendation engine fixes, `schema.sql` (views/routines/triggers section), `seed.sql` (slots → itineraries), every template, `style.css`, `main.js`, `config.py`, `run.py`, `README.md`, `.env.example`, `docs/test_plan_and_results.md`, `docs/diagrams/*`.
* **Untouched**: `.env` (your local secrets) and the bundled Windows `.venv`.
