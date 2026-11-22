# SOLACE | Test Plan & Results

**Last executed:** 2026-11-22 · Python 3.13, Flask 3.1, PyMySQL

| Database server | Command | Result |
| --- | --- | --- |
| **MariaDB 10.11** (same database family as XAMPP) | `python -m unittest discover -s tests -t . -v` | `Ran 69 tests in 30.882s` — **OK (69 passed, 0 failed)** |
| **MySQL 8.0.46** | same | `Ran 69 tests in 33.408s` — **OK** |
| **MySQL 8.0.46 as a stand-in for a hosted server** (account without SUPER, binary logging on, TLS required, `DB_SSL=1`, `APP_UTC_OFFSET=+05:30`) | same | `Ran 69 tests in 34.320s` — **OK** — **OK** |

## 1. Approach

* **Isolated database** — `tests/helpers.py` rebuilds `solace_test_db` (`TEST_DB_NAME`) from `database/schema.sql` + `seed.sql` once per run; the development database is never modified (verified: `solace_db` still held its 12 seed bookings after the run).
* **Real HTTP flows** — tests drive the Flask test client exactly like a browser, including the CSRF token, and assert on both the HTML response and the resulting MySQL rows (read through a separate autocommit connection).
* **Database objects are tested directly** — views, triggers (`SIGNAL` guard, actor attribution, price audit), the `sp_generate_slots` procedure and its validation, ON DELETE CASCADE / RESTRICT behaviour.
* **SQL laboratory safety** — every one of the 40 executable lab queries is run and `CHECKSUM TABLE` over all 23 tables is compared before/after (must be identical).

## 2. Summary by module

| Module | Focus | Tests | Result |
| --- | --- | --- | --- |
| `test_admin_crud.AdminCrudTests` | Admin CRUD for experiences (incl. upload, and upload switched off on serverless hosting), slots, resources, maintenance, suppliers, staff, users, reviews; audit | 14 | PASS |
| `test_admin_crud.DashboardTests` | Guest and staff dashboards show database values | 2 | PASS |
| `test_booking_rules.BookingRuleTests` | Booking state machine, concurrency/last-seat race, capacity units, refunds, triggers | 8 | PASS |
| `test_dbms.DatabaseConnectivityTests` | Connectivity, InnoDB, schema.sql = live schema, seed referential consistency | 3 | PASS |
| `test_dbms.ExplorerPageTests` | Database Explorer pages, ER payload vs information_schema, SQL lab (all queries, data unchanged), table viewer | 7 | PASS |
| `test_itinerary.ItineraryPlannerTests` | Itinerary planner: session picker endpoint, session/day validation, time-block derivation, full/past sessions, past days | 5 | PASS |
| `test_security.SecurityTests` | CSRF, sessions, hashing, injection, open redirect, RBAC, SQL-lab guard, masking | 15 | PASS |
| `test_security.DeploymentConfigurationTests` | Hosting configuration: missing-settings page, `DATABASE_URL` parsing, TLS and time-zone options, a non-MySQL address reported instead of a crash, no demo credentials on the home and sign-in pages | 4 | PASS |
| `test_suite.SolaceSystemTests` | Original 11 end-to-end scenarios (updated for CSRF, POST logout and the isolated test DB) | 11 | PASS |

## 3. Individual test cases

### test_admin_crud.AdminCrudTests

- `test_admin_actions_are_audited` — **PASS**
- `test_all_admin_pages_render` — **PASS**
- `test_bulk_generation_rejected_by_procedure_validation` — **PASS**
- `test_dashboard_kpis_match_database` — **PASS**
- `test_experience_create_edit_toggle_delete` — **PASS**
- `test_experience_validation_and_restrict_delete` — **PASS**
- `test_photo_upload_validates_file_type` — **PASS**
- `test_resource_and_maintenance_lifecycle` — **PASS**
- `test_review_moderation_changes_public_rating` — **PASS**
- `test_slots_single_bulk_edit_delete` — **PASS**
- `test_staff_account_creation_and_login` — **PASS**
- `test_supplier_crud` — **PASS**
- `test_user_toggle_and_self_protection` — **PASS**

### test_admin_crud.DashboardTests

- `test_guest_dashboard_uses_database_values` — **PASS**
- `test_staff_dashboard_lists_assignments` — **PASS**

### test_booking_rules.BookingRuleTests

- `test_cancelled_booking_cannot_be_paid` — **PASS**
- `test_double_payment_is_rejected` — **PASS**
- `test_failed_payment_holds_nothing_and_can_retry` — **PASS**
- `test_itinerary_links_slot_and_edits_dates` — **PASS**
- `test_last_seat_race_between_two_pending_bookings` — **PASS**
- `test_private_experience_uses_booking_units` — **PASS**
- `test_staff_completion_unlocks_review_and_trigger_guards_reviews` — **PASS**
- `test_trigger_records_admin_as_actor` — **PASS**

### test_dbms.DatabaseConnectivityTests

- `test_connection_and_engine` — **PASS**
- `test_schema_file_matches_database` — **PASS**
- `test_seed_referential_consistency` — **PASS**

### test_dbms.ExplorerPageTests

- `test_er_payload_matches_information_schema` — **PASS**
- `test_every_lab_query_runs_without_changing_data` — **PASS**
- `test_guest_cannot_run_lab_queries` — **PASS**
- `test_lab_categories_cover_all_ten_topics` — **PASS**
- `test_public_pages_render` — **PASS**
- `test_schema_page_lists_constraints` — **PASS**
- `test_table_viewer_pagination_and_validation` — **PASS**

### test_itinerary.ItineraryPlannerTests

- `test_page_contains_working_planner_modal` — **PASS**
- `test_past_days_are_locked` — **PASS**
- `test_session_from_another_day_is_rejected` — **PASS**
- `test_sessions_endpoint_lists_real_sessions_for_the_day` — **PASS**
- `test_time_block_is_derived_from_the_chosen_session` — **PASS**

### test_security.SecurityTests

- `test_csrf_required_on_post` — **PASS**
- `test_deactivated_user_cannot_login` — **PASS**
- `test_guest_cannot_view_another_guests_voucher` — **PASS**
- `test_invalid_numeric_input_does_not_crash` — **PASS**
- `test_logout_is_post_only_and_clears_session` — **PASS**
- `test_open_redirect_blocked` — **PASS**
- `test_password_hashes_masked_in_lab_and_viewer` — **PASS**
- `test_passwords_are_hashed` — **PASS**
- `test_safe_next_redirect_allowed` — **PASS**
- `test_session_cookie_flags_and_security_headers` — **PASS**
- `test_sql_console_blocks_writes_and_tricks` — **PASS**
- `test_sql_injection_in_search_and_login` — **PASS**
- `test_sql_lab_execution_is_admin_only` — **PASS**
- `test_staff_cannot_complete_unassigned_booking` — **PASS**
- `test_weak_password_rejected_on_registration` — **PASS**

### test_suite.SolaceSystemTests

- `test_01_user_registration_and_duplicate_check` — **PASS**
- `test_02_authentication_and_invalid_credentials` — **PASS**
- `test_03_role_based_access_control` — **PASS**
- `test_04_guest_preferences_updates` — **PASS**
- `test_05_recommendation_algorithm_ranking` — **PASS**
- `test_06_slot_capacity_and_overbooking_prevention` — **PASS**
- `test_07_resource_availability_verification` — **PASS**
- `test_08_itinerary_budget_and_conflict_protection` — **PASS**
- `test_09_transactional_booking_and_payment_flow` — **PASS**
- `test_10_verified_review_duplicate_blocking` — **PASS**
- `test_11_sql_views_integrity` — **PASS**

## 4. Browser checks (Playwright / Chromium)

* Crawled every internal link as anonymous visitor, guest, staff and admin (≈375 page loads): **0 HTTP errors (4xx/5xx), 0 broken images, 0 JavaScript errors**.
* Responsive check at 390 px width on 31 key pages: initially 4 pages overflowed horizontally (gutter, grid `min-width`, wrapping chips); fixed and re-checked — **no horizontal overflow**.
* Visual review of the landing page, catalogue, experience detail, guest/staff/admin dashboards, itinerary, ER diagram, DFDs and SQL lab.
* **31 Oct (XAMPP / MariaDB follow-up):** every pop-up window (itinerary add/edit, cancel booking, admin schedules, resources, staff, suppliers — 10 in total) is opened in Chromium and its action button is verified to be the top-most, clickable element: **10/10 OK**. The 4-role crawl was repeated against a MariaDB-backed server: 0 HTTP errors, 0 broken images, 0 JS errors, no overflow.
* Fixed during browser testing: Mermaid id collision that hid the DFD Level 1 diagram, ER pan/zoom fit (missing `viewBox`), card padding selector, navbar label wrapping.

## 5. Defects found and fixed during this round

| # | Defect | Fix |
| --- | --- | --- |
| 1 | `/payment/process` accepted cancelled/confirmed bookings → double allocation | Only `pending`/`failed` can be paid; capacity, resources and staff re-checked under `FOR UPDATE` |
| 2 | Two pending bookings could both confirm the last seats | Availability re-validated at payment; loser is marked `failed` (test `test_last_seat_race…`) |
| 3 | Private (per-booking) experiences could never be booked by a party > 1 | Capacity counted in units (guests vs. bookings) |
| 4 | Seed bookings referenced slots of other experiences; slot occupancy inconsistent | Seed rewritten; occupancy derived from bookings; consistency test added |
| 5 | Recommendation schedule score always “afternoon” (MySQL TIME → timedelta) | timedelta handled |
| 6 | Audit logging committed open transactions mid-way | Audit rows written on the caller's cursor |
| 7 | Refund marked failed payments as refunded | Only `successful` payments are refunded |
| 8 | Staff could complete any booking | Restricted to their own assignments, and only after the session started |
| 9 | No CSRF protection; open redirect via `?next=`; hard-coded secret fallback | CSRF tokens, safe redirect check, env-only secret |
| 10 | Fabricated 4.8 rating for unreviewed experiences | Real `AVG` or “New”; neutral prior used only for ranking |
| 11 | `test_06` permanently reset a seeded slot | Restores the original value; tests use an isolated DB |
| 12 | Pop-up windows (modals) opened underneath their grey backdrop and could not be clicked — itinerary *Add activity* / *Edit details*, cancel booking and all admin forms | The page fade-in animation no longer leaves a stacking context (`animation-fill-mode: backwards`) and all modals are moved directly under `<body>` at start-up |
| 13 | Itinerary items could be added for a time block with no session (unlinked) and on days already in the past | Planner lists the real sessions for the chosen day (`/guest/itinerary/sessions`), derives the time block from the session, rejects past days, sessions on another day, started or full sessions |
| 14 | Browsers could keep running an old cached `main.js` / `style.css` after an update | CSS/JS URLs carry a version stamp (`?v=<file time>`) |
