# Deploying SOLACE on Vercel with a hosted MySQL database

The full, illustrated guide is `docs/04_Deployment_Guide_Vercel_MySQL.docx`. This page is the short version.

## How it fits together
* **Vercel** runs the Flask application as a Python function (entry point `api/index.py`, framework `flask` in `vercel.json`).
* **A hosted MySQL server** stores the data. Vercel has no MySQL of its own, and XAMPP on your PC is not reachable from the internet.

## 1. Hosted MySQL
Requirements for the provider:
* MySQL 8 (or MariaDB 10.4+) reachable with host and port, accepting connections from any IP address (Vercel has no fixed IP).
* **Your account must be allowed to create triggers and stored functions.** SOLACE has 4 triggers and 2 functions. Managed servers with binary logging refuse them (MySQL error 1419) unless you have a root/administrator account or the server option `log_bin_trust_function_creators` is ON. "MySQL-compatible" services without trigger/procedure support (for example TiDB Cloud) cannot be used.

Install the database **from your PC** (PowerShell, inside the project with the venv active). The values set this way apply to this terminal window only; `.env` is not changed:

```powershell
$env:DATABASE_URL = "mysql://USER:PASSWORD@HOST:PORT/solace_db"
$env:DB_SSL = "1"
$env:APP_UTC_OFFSET = "+05:30"
python -m database.init_db --check     # tests connection and privileges, changes nothing
python -m database.init_db             # creates tables, views, routines, triggers and demo data
```

* If the provider gave you one fixed database you may not drop/create, put its name in the URL and run `python -m database.init_db --in-place`.
* Special characters in the password must be URL-encoded (`@` → `%40`, `/` → `%2F`, `#` → `%23`), or use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` instead of `DATABASE_URL`.

## 2. GitHub
Create a **private** repository and push the project. Check `git status` first: `.env` and `.venv` must not be listed (`.gitignore` excludes them).

## 3. Vercel
Import the repository (Add New → Project). Framework preset: Flask. Environment variables:

| Name | Value |
| --- | --- |
| `SECRET_KEY` | new random value: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:PORT/solace_db` |
| `DB_SSL` | `1` (encrypted connection; most hosted servers require it) |
| `APP_UTC_OFFSET` | `+05:30` (keeps "today" and session times in Indian time) |
| `DB_SSL_CA_PEM` | CA certificate text of the provider, to also verify the server (optional) |

Deploy. After changing a variable, redeploy.

## Differences from running locally
* Photo upload in Admin → Experiences is switched off (the deployed folder is read-only); enter an image URL instead.
* The session cookie is HTTPS-only automatically.
* If `SECRET_KEY` or the database address is missing, or `DATABASE_URL` is not a MySQL address (for example an old PostgreSQL/Neon one), the site shows a page naming the setting to fix.

## Before sharing the link
The website does not display the demo accounts, but their passwords are printed in this repository's documentation. Change them (user menu → Change Password) and deactivate unused demo accounts (Admin → User Accounts) before sharing the link.

## What was verified, and what was not
* `vercel build` (Vercel CLI 65.16.0) builds the project: one Python 3.12 function, every route sent to Flask, templates and static files included, no `.env` in the bundle.
* The built function was run through Vercel's own Python handler on a read-only folder: 29/29 checks passed (pages, static files, secure login cookie, booking + payment, triggers, IST offset).
* A MySQL 8 account without SUPER, with binary logging and a required TLS connection, stood in for a hosted server: installer and all 69 tests pass; without the trigger permission the installer stops before changing anything.
* **Not verified:** an actual deployment on vercel.com and an actual database provider (not reachable from the build environment).
