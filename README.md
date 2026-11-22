# SOLACE — Personalized Luxury, Nature & Adventure Experience Management System

> **Repository note:** this is the Python Flask + MySQL version of SOLACE (the DBMS mini-project). An earlier Next.js + PostgreSQL prototype is kept unchanged on the branch [`nextjs-version`](https://github.com/devi-1389/DBMS-Project/tree/nextjs-version).

A database-driven resort experience platform built with **Python Flask + MySQL** for a Database
Management Systems course. Guests discover, plan and book experiences; staff run sessions; administrators
manage the catalogue, schedules, inventory and people. A built-in **Database Explorer** presents the
live ER diagram, relational schema, DFDs, a SQL Query Laboratory and a table viewer, all generated from
the real MySQL database.

> Stack: Python 3.10+ · Flask 3 · PyMySQL · MySQL 8.0 (InnoDB) · Jinja2 · Bootstrap 5 · Chart.js · Mermaid.
> All CSS/JS libraries and fonts are bundled in `app/static/vendor`, so the site works without internet.

---

## 1. Features

| Role | What they can do |
| --- | --- |
| **Visitor** | Browse/search/filter the catalogue (category, keyword, max price, date availability, eco filter, sort), view experience details with live session availability and verified reviews, explore the Database Explorer (diagrams, schema, query catalogue). |
| **Guest** | Register / sign in, trip profile (party size, budget, dates, time preference), interest weights, 5-factor personalised recommendations, multi-day itinerary planner (auto-links scheduled sessions, edit dates/budget), booking + simulated payment, vouchers with status history, cancellation with refund, write/edit/delete verified reviews, change password. |
| **Staff** | Duty roster (today/upcoming/history) with guest party details and allocated equipment, complete their own sessions (unlocks reviews), report equipment issues (puts the resource under maintenance), edit profile & availability. |
| **Administrator** | Live KPI dashboard and charts; CRUD for experiences (incl. photo upload), schedules (single slot, bulk generation through a stored procedure, edit/lock/cancel/delete), resources & maintenance, suppliers, staff accounts, user activation, review moderation; booking state management; reports (views + stored procedure); audit log; SQL console & table viewer. |

### Database Explorer (`/dbms`)
* **ER diagram**: generated from `information_schema` on every load. Crow's-foot cardinalities are derived from the foreign keys and unique indexes. Zoom/pan, focus on a table, filter by domain, choose the attribute level, click an entity for details, export as SVG.
* **Relational schema**: all 23 tables with types, NULL/default, PK/FK/UK, CHECK constraints, indexes, referential actions, plus views, stored routines and triggers.
* **DFD Level 0 & Level 1**: external entities, 11 processes, 10 data stores mapped to real tables, 58 labelled flows (filter per process, export SVG).
* **SQL Query Laboratory**: 41 documented queries (40 executable) in 10 categories (DDL, DML, DQL, joins, aggregates, GROUP BY/HAVING, subqueries, views, procedures/functions, triggers). Each has a title, SQL, explanation, tables and expected output. Administrators can run them:
  * SELECT/SHOW/CALL run inside `START TRANSACTION READ ONLY` with a timeout and row limit.
  * DML and trigger demonstrations run in a transaction that is always rolled back.
  * DDL demonstrations only touch session-scoped `TEMPORARY` tables.
  * A guarded read-only console is also available.
* **Table viewer** (admin): every table with column metadata, record count, search, sorting and pagination. Password hashes are always masked.

### Database objects
23 normalised InnoDB tables · 33 foreign keys · 18 CHECK constraints · 5 views
(`v_experience_details`, `v_slot_availability`, `v_sustainability_metrics`, `v_booking_overview`,
`v_staff_workload`) · 3 stored procedures (`sp_generate_slots`, `sp_experience_occupancy`,
`sp_guest_booking_summary`) · 2 functions (`fn_slot_remaining`, `fn_experience_cost`) · 4 triggers
(booking history on insert/update, review integrity guard, price-change audit).

---

## 2. Project structure

```text
├── run.py                     # starts the Flask development server
├── config.py                  # settings loaded from .env (no hard-coded secrets)
├── requirements.txt
├── .env.example               # template - copy to .env
├── database/
│   ├── schema.sql             # tables, constraints, views, functions, procedures, triggers
│   ├── seed.sql               # demo data (accounts, catalogue, 2-week schedule, bookings, reviews)
│   ├── upgrade.sql            # non-destructive fixes for databases created by older versions
│   ├── init_db.py             # python -m database.init_db  (handles DELIMITER blocks correctly)
│   ├── connection.py          # PyMySQL connection, transactions, stored-procedure helper
│   └── demonstration_queries.sql
├── app/
│   ├── __init__.py            # app factory, security hooks, Jinja filters, error pages
│   ├── security.py            # CSRF, safe redirects, security headers, input validation
│   ├── routes/                # auth, guest, experience, booking, payment, review, staff,
│   │                          # admin (+ admin_manage), dbms (Database Explorer)
│   ├── services/              # recommendation engine, availability/allocation, itinerary,
│   │                          # audit log, schema introspection, SQL laboratory
│   ├── templates/             # Jinja2 pages (base, _macros, guest/, staff/, admin/, dbms/ …)
│   └── static/                # css, js, images (bundled artwork), uploads/, vendor/ libraries
├── tests/                     # 69 automated tests (isolated test database)
├── tools/generate_artwork.py  # regenerates the bundled SVG illustrations
└── docs/                      # report, test results, diagrams (SVG + PNG), user manual …
```

---

## 3. Setup on Windows (PowerShell)

### 3.1 Prerequisites
* **Python 3.10 or newer**: check with `python --version`.
* **A MySQL-compatible server**: either MySQL Server 8.0 (MySQL Installer for Windows) or **XAMPP**, which
  runs MariaDB. Tested with MySQL 8.0 and MariaDB 10.11: all 69 automated tests pass on both.
* You need the MySQL user name and password you chose during installation.

### 3.2 Start MySQL
If MySQL was installed as a Windows service (default name `MySQL80`), run PowerShell **as Administrator**:
```powershell
Get-Service MySQL80
Start-Service MySQL80
```
With **XAMPP**, open the XAMPP Control Panel and click **Start** next to *MySQL*. In `.env` use `DB_USER=root`
and leave `DB_PASSWORD=` empty, unless you set a root password in XAMPP. You do not need phpMyAdmin:
step 3.5 creates the database for you.
Check that the server answers (optional, needs the `mysql` client on PATH):
```powershell
mysql -u root -p -e "SELECT VERSION();"
```

### 3.3 Create the virtual environment and install dependencies
From the project folder:
```powershell
cd "C:\path\to\New folder"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
If activation is blocked ("running scripts is disabled"), allow it for the current window only and activate again:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 3.4 Configure `.env`
Keep your existing `.env` if you already have one. Otherwise create it from the template and edit it:
```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```
Set `DB_USER` / `DB_PASSWORD` to your MySQL account and put a long random value in `SECRET_KEY`:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3.5 Create the database
The initializer creates `solace_db` (or `DB_NAME`), runs `schema.sql`, then `seed.sql`. It correctly executes
the `DELIMITER $$` trigger and procedure blocks, so the `mysql` command-line client is not required.
```powershell
python -m database.init_db
```
If the database already exists you are asked to type `YES` before it is dropped and rebuilt (add `--yes` to skip the prompt).

**Upgrading a database created by an earlier version of this project:**
* To keep your data and only refresh views, routines and triggers (plus image paths), run:
  ```powershell
  python -m database.init_db --upgrade
  ```
* For demonstrations a full rebuild is recommended: the old seed data contained bookings linked to slots of a different experience, and that is fixed in the new `seed.sql`.

Using MySQL Workbench instead? Open and execute `database/schema.sql`, then `database/seed.sql`.

### 3.6 Run the application
```powershell
python run.py
```
Open **http://127.0.0.1:5000**. Stop the server with `Ctrl + C`.

### 3.7 Run the automated tests
The tests build and use a **separate** database `solace_test_db` (`TEST_DB_NAME`), so your demo data is never modified.
```powershell
python -m unittest discover -s tests -t . -v
```
Expected: `Ran 69 tests … OK`.

---

## 4. Demo accounts
These accounts are created by `database/seed.sql`. The passwords below were verified against the stored scrypt hashes.
The website itself does not show them: the home page has a normal **Sign In** button and the sign-in page an ordinary form.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@solace.com` | `Admin@123` |
| Staff (naturalist) | `aarav.naturalist@solace.com` | `Staff@123` |
| Staff (chef) | `maya.chef@solace.com` | `Staff@123` |
| Staff (wellness) | `ananya.wellness@solace.com` | `Staff@123` |
| Staff (adventure) | `rohan.adventure@solace.com` | `Staff@123` |
| Staff (culture) | `vikram.culture@solace.com` | `Staff@123` |
| Guest | `priya.sharma@example.com` | `Guest@123` |
| Guest | `arjun.mehta@example.com` | `Guest@123` |
| Guest | `elena.rostova@example.com` | `Guest@123` |

New guests can register at `/register`; administrators create staff accounts in **Admin → Staff & Suppliers**.
These demo passwords are public. Change them (or rebuild without `seed.sql` using `--no-seed`) before using the system anywhere real.

Suggested demonstration flow:
1. Guest Priya: dashboard → recommendations → book a session → simulated payment → voucher → cancel.
2. Staff Aarav: duty roster → **Complete** a started session.
3. Guest Arjun: write the now-allowed review.
4. Admin: dashboard KPIs → bulk-generate slots → reports → Database Explorer → run SQL Lab queries.

---

## 5. Security measures
* Passwords are hashed with Werkzeug (scrypt). Login regenerates the session (protects against session fixation). Logout is POST-only.
* A CSRF token is required on every POST form and AJAX call (`app/security.py`).
* Session cookies are HttpOnly and SameSite=Lax; `SESSION_COOKIE_SECURE` is available for HTTPS. Responses send `nosniff` and `SAMEORIGIN` security headers.
* `SECRET_KEY` comes from `.env`. There is no hard-coded fallback: a random per-process key is used, with a warning.
* Every query is parameterised. The only dynamic identifiers (table viewer table and column names) are validated against `information_schema` and back-quoted.
* Server-side validation covers types, ranges, enums, dates, email format and password policy. Invalid input shows a message instead of an HTTP 500.
* Role-based access uses decorators. Guests only see their own bookings; staff can only complete sessions assigned to them.
* Open-redirect protection guards `?next=`. Uploads are checked by extension and file signature and limited to 5 MB.
* The SQL console accepts a single read-only statement inside a READ ONLY transaction. It blocks file access, locking, sleeps, executable comments and system schemas, and masks password hashes.
* Database errors are logged server-side and shown to users only as a friendly error page.

---

## 6. Images
`experiences.image_url` points at bundled, subject-specific SVG illustrations in
`app/static/images/experiences/`, with one per category in `images/categories/`. They load offline, and
any image that fails falls back to its category illustration. To use real photographs, open
**Admin → Experiences → Edit** and upload a JPG/PNG/WEBP (stored in `app/static/uploads/experiences/`), or paste
an `https://` image URL. `python tools\generate_artwork.py` regenerates the illustrations.

---

## 7. Troubleshooting
| Problem | Fix |
| --- | --- |
| `Access denied for user 'root'@'localhost'` | Wrong `DB_USER`/`DB_PASSWORD` in `.env`. |
| `Can't connect to MySQL server on '127.0.0.1'` | MySQL service not running (section 3.2) or a different `DB_PORT`. |
| `Unknown database 'solace_db'` | Run `python -m database.init_db`. |
| `cryptography package is required` | `pip install -r requirements.txt` inside the activated venv. |
| Page shows "Database unavailable" | Same as above; details are in the terminal running `python run.py`. |
| Port 5000 busy | Set `PORT=5050` in `.env`. |
| No sessions to book (dates in the past) | Seed slots cover the 14 days after seeding. Re-run the initializer, or use **Admin → Schedules → Bulk generate**. |

---

## 8. Putting the site online (Vercel + hosted MySQL)
The project is ready for Vercel: `api/index.py` (entry point), `vercel.json` (Flask preset), `.python-version`,
`.gitignore` and `.vercelignore`. Vercel runs the Flask app; the data lives on a hosted MySQL server, which you
fill from your PC with `python -m database.init_db` after pointing `DATABASE_URL` at it. Steps, settings and
troubleshooting: `docs/DEPLOYMENT_VERCEL.md` (short) and `docs/04_Deployment_Guide_Vercel_MySQL.docx` (full).

New optional settings (all have safe defaults; nothing changes on your PC unless you set them):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `mysql://user:password@host:port/database` instead of the five `DB_` values |
| `DB_SSL`, `DB_SSL_CA`, `DB_SSL_CA_PEM` | encrypted connection to a hosted server, optionally with certificate check |
| `APP_UTC_OFFSET` | resort time zone as an offset, e.g. `+05:30` (servers run on UTC) |
| `UPLOADS_ENABLED` | photo upload; switched off automatically on Vercel |

`python -m database.init_db --check` tests any connection and the trigger/function privileges without changing anything.

---

## 9. Documentation
* Word documents in `docs/`: `SOLACE_DBMS_Project_Report.docx` (full report with certificates),
  `01_Project_Overview.docx`, `02_Website_User_Guide.docx`, `03_Frontend_Backend_Database_Report.docx`,
  `04_Deployment_Guide_Vercel_MySQL.docx`, `05_Database_Design_and_Normalization.docx`.
* `docs/FINAL_REPORT.md`: implementation and testing report for this version.
* `docs/IMPLEMENTATION_PLAN.md`: audit findings and plan.
* `docs/test_plan_and_results.md`: test inventory and actual results.
* `docs/diagrams/`: ER diagram, relational schema and DFD L0/L1 exported from the live database (SVG + PNG), plus the earlier UML diagrams.
* `docs/user_manual.md`, `docs/project_report.md`, `docs/presentation_slides.md`, `docs/demonstration_queries.md`.
