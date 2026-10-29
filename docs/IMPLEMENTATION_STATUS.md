# LUXE-ECO Implementation Status

The SOLACE resort website, built on LUXE-ECO, its experience-management system.

Last updated: 2026-10-30 (Phase 6: online booking)

Status key: `[x]` done and verified · `[~]` in progress / partial · `[ ]` not started ·
`[mock]` UI exists but uses placeholder data (not a working feature)

## Current state

- **Online booking (Phase 6, latest):** guests can book a session from its experience
  page or from their itinerary, then change the number of guests or cancel. Payment is
  at the resort.
  - Everything runs in one database transaction that locks the session. The database
    rules have the final say on seats and shared equipment.
  - The rules: bookings close 2 hours before the start; changes and cancellations
    close 24 hours before (administrators can cancel at any time).
  - Experience pages show live sessions from the database when it's configured, and
    sample sessions (no booking) otherwise.
  - Not yet tried on the live site: sign-in isn't working there yet. The sign-in setup
    page now names the exact key problem (for example a shortened `sk_test_…` key).
- **Neon database (live):** created from GitHub Actions (`Database (Neon)` workflow).
  The tables and sample data are in the owner's Neon project. Vercel still needs the
  database and Clerk variables, then a redeploy.
- **SOLACE alignment:**
  - The site is branded SOLACE, and LUXE-ECO names the matching and planning system.
  - Prices are in ₹ and times in IST.
  - 18 experiences now cover the brief, including spa, kayaking, cycling, a local food
    trail, a heritage village walk and a cabana.
  - Matching only uses sessions with a guide, venue and shared equipment free (the
    `slot_readiness` view).
  - Guests can pick favourite categories, and plans take an activity budget with
    day-by-day suggestions.
  - See "SOLACE alignment" below. Signed-in pages for these features haven't been
    viewed in a browser (no Clerk keys); they're covered by tests.
- **Authentication and personalization are implemented, but not yet run against real
  services.** No Clerk keys or Neon credentials exist in this environment, and clerk.com
  is blocked by its network policy. Server logic is covered by automated tests (Clerk
  session mocked, real migrations on PGlite). The real Clerk sign-in UI hasn't been
  exercised. Setup: `docs/AUTHENTICATION.md`.
- Without credentials the app **fails closed**. Protected routes redirect to `/login`,
  which explains the missing variables, and Server Actions refuse with
  `auth-unconfigured`. There's no bypass or fake user.
- What reads and writes PostgreSQL (once configured):
  - The guest area: `/dashboard`, `/recommendations`, `/itinerary`, `/preferences`,
    `/my-bookings` and `/my-bookings/[reference]`.
  - `/staff` and `/admin`.
  - The "Add to my plan" button on experience pages.
- **Still placeholder data:** the public catalogue (`/`, `/experiences`,
  `/experiences/[slug]`) reads `lib/placeholder/catalogue.ts`. The DB seed holds the
  same records, and a plan item resolves its DB session by experience + start time.
- **Bookings:** real once sign-in works (Phase 6). Payments are recorded at the resort,
  not online. The seed's sample bookings are still in the database.
- Removed this phase: `localStorage` drafts (`lib/preview-store.ts`), the preview login
  forms, and `lib/matching/score.ts`. The new explainable engine replaces it.
- Database design: 27 tables, 3 views, and migrations `0000`–`0004`:
  - `0002`: a guest's last name is optional.
  - `0003`: INR defaults, favourite categories and plan budgets.
  - `0004`: the `slot_readiness` view.

  Applied to PGlite only this round; not yet to Neon. See `docs/DATABASE_DESIGN.md` and
  `docs/ERD.md`.
- Installed, in addition to Phases 0–4: `@clerk/nextjs@7.9.22` and `zod@4.6.7`; dev
  `vitest@5.0.5` and `@types/node@22`. `engines.node` is `>=22`.
- `npm audit`: production dependencies clean (0). The 4 moderate dev-only advisories are
  still in `drizzle-kit`'s bundled `esbuild`.
- **Not deployed.** No Vercel project is connected. Local production server
  (`next start`) verified in a browser; see the verification log.
- Network limits: the shadcn/ui registry and photo hosts are blocked. `components/ui/*`
  is hand-written to the shadcn new-york pattern, and imagery is generated placeholder
  illustration.

## Phase 0: Project setup ✅

- [x] Generate Next.js scaffold (TypeScript, App Router, Tailwind, ESLint, Turbopack)
- [x] Rename package to `luxe-eco`
- [x] Add `CLAUDE.md` project instructions (imports scaffold's `AGENTS.md`)
- [x] Add this progress tracker
- [x] Baseline checks pass (see verification log)
- [x] Implementation plan drafted (`docs/IMPLEMENTATION_PLAN.md`). Decisions still open.

## Phase 1: Frontend foundation

- [x] shadcn/ui set up: `components.json`, `lib/utils.ts`, `components/ui/` (alert, badge,
      button, card, checkbox, dialog, dropdown-menu, input, label, native-select, radio-group,
      sheet, skeleton, switch, table, tabs, textarea). Hand-written because the registry was
      unreachable; re-sync with `npx shadcn add` when network allows.
- [x] Brand theme tokens (forest, ivory, sage, champagne gold), Cormorant Garamond + Manrope.
      All text colour pairs checked at WCAG AA or better.
- [ ] Dark mode (not designed; `.dark` variant is opt-in only)
- [x] Root layout metadata. Route groups `(public)`, `(guest)`, `(admin)`, `(auth)` share one
      header (transparent only over the landing hero; active links; guest-area menu; mobile
      sheet) and footer. Since Phase 3 the header shows account controls (sign in / account
      menu with role links), rendered on the server inside `<Suspense>`.
- [x] Replace starter page and unused `public/*.svg` assets
- [ ] Replace placeholder illustrations with licensed resort photography
- [ ] Connect Vercel preview deployments (git remote now exists: github.com/devi-1389/DBMS-Project)

## Phase 2: Frontend pages (placeholder data, clearly labelled)

- [mock] Landing page: hero, six categories, featured experiences with category filter
      (`?category=`) and details dialog, matching explainer (illustrative example),
      sustainability, footer. Data in `lib/placeholder/`. Sustainability copy is
      unverified and must be confirmed before launch.
- [mock] `/experiences`: search, category/difficulty checkboxes with live counts, duration,
      price, date and step-free filters (sidebar, or sheet on mobile), sort, removable filter
      chips, empty state. Filters live in the URL.
- [mock] `/experiences/[slug]`: banner, facts, highlights, related experiences, reviews empty
      state, planning panel (date/time, guests, total). Catalogue data is still placeholder.
      "Add to my plan" now saves to the guest's plan in the DB (Phase 5).
      **"Online booking coming soon" is disabled.**
- `/preferences`, `/itinerary`, `/dashboard`, `/my-bookings`, `/admin`, `/login`: built
  here with sample data, now DB-backed and protected (see Phases 3 and 5).
- [x] Loading states (`loading.tsx` for catalogue, detail, guest area, admin; skeletons while
      browser data loads), empty states, and branded `not-found` pages
- [ ] Booking review and payment steps (after the booking backend; Phase 6)
- [~] Staff area: `/staff` schedule with guest manifests (Phase 5); check-in not started
- [ ] Admin: staff, resources, payments, reviews screens
- [x] Error boundaries (`error.tsx`) for the guest, staff and admin areas (`RouteError`)

## Phase 3: Authentication & authorization (Clerk)

Code complete and tested with Clerk mocked; **not yet run with real Clerk keys**.

- [x] `@clerk/nextjs` 7 installed. `ClerkProvider` is rendered only when both keys are
      valid. Variable names are in `.env.example`; setup is in `docs/AUTHENTICATION.md`.
- [x] `proxy.ts` with `clerkMiddleware`. It only sends an early sign-in redirect for
      protected paths, and fails closed without keys.
- [x] Clerk `<SignIn>` and `<SignUp>` at `/login/[[...login]]` and
      `/sign-up/[[...sign-up]]` (in `<Suspense>`). Sign-out is in the account menu.
- [x] Server-enforced areas for guest, staff and admin:
      - Pages use `<Protected>` (`checkPageAccess`, with `connection()`).
      - Actions use `authorizeAction()`, then the DAL checks.
- [x] Accounts are linked to verified Clerk user IDs (`auth_identities`):
      - Provisioned on first sign-in, from a verified primary email only.
      - The webhook `/api/webhooks/clerk` (Svix-verified) syncs creates, updates and
        deletes.
      - Conflicting links are refused.
- [x] Role model: `users.role` only, and new accounts are always guests.
      - Admin-only role changes (`/admin` → Users) re-read the actor's role under a lock,
        with no self-change and the last admin kept.
      - The first admin comes from the operator script `npm run db:set-role`.
- [x] Session reads inside `<Suspense>` (Cache Components). The header account area
      streams in.
- [~] Manual end-to-end sign-up and sign-in with a real Clerk dev instance: pending keys

## Phase 4: Database (Neon + Drizzle)

- [x] Drizzle ORM, drizzle-kit and the Neon WebSocket driver (`neon-serverless`, chosen for
      interactive transactions). Lazy `server-only` client in `lib/db/index.ts` (not used
      by any page yet).
- [x] Schema (26 tables, 2 views):
      - Guests and Clerk identity IDs.
      - Interests and preferences.
      - Categories, experiences and slots.
      - Bookings and status history.
      - Staff and assignments.
      - Resources, requirements, allocations and maintenance.
      - Suppliers, payment attempts and reviews.
      - Itineraries and blackout periods.
- [x] Constraints:
      - Primary keys, foreign keys with explicit RESTRICT/CASCADE/SET NULL rules.
      - Named unique and check constraints; partial unique indexes; GiST range index.
      - `numeric(10,2)`/`(12,2)` money; generated `during` and `total_amount` columns.
- [x] Integrity triggers:
      - Race-free seat accounting and allowed status transitions.
      - Automatic status history.
      - Staff overlap check and resource capacity incl. maintenance.
      - Blackouts, slot change protection, reviews only after completion.
      - Custom `LX…` error codes.
- [x] Migrations generated (`drizzle/`); `drizzle-kit check` clean; schema and snapshots in sync.
- [~] Migrations applied to a **Neon** dev branch: not done here (no credentials). Applied
      to local PostgreSQL 16 and PGlite (PostgreSQL 18).
- [x] Development seed (`npm run db:seed`, `db:seed:reset`). It reuses the catalogue,
      categories and interests; seed-only data is in `scripts/db/seed-data.ts`. Guarded
      against production.
- [~] Seed run against **Neon**: not done here (no credentials). Ran on PostgreSQL 16 and PGlite.
- [x] `docs/ERD.md` (Mermaid; all 7 diagrams render), `docs/DATABASE_DESIGN.md`,
      `sql/queries.sql` (16 queries; 20 since the SOLACE alignment)
- [x] Checks: `npm run db:verify` (offline, PGlite) and `npm run db:test:concurrency`
      (parallel psql sessions)
- [x] Vitest set up (`npm test`), with unit tests and PGlite integration tests in `tests/`
- [x] Link Clerk user ID ↔ users rows (Phase 3)
- [x] Migration `0002_guest_last_name_optional.sql` (Clerk doesn't require a last name)

## Phase 5: Backend reads & matching

- [x] `server-only` DAL (`lib/dal/`): identity, users, preferences, itinerary, bookings,
      catalogue, staff and admin
- [ ] Public catalogue pages on the DAL (still `lib/placeholder/catalogue.ts`)
- [x] Ownership-scoped queries. Another guest's plans, items and bookings behave as "not
      found"; staff see only their assigned sessions.
- [x] Preferences in PostgreSQL via a Server Action. Zod strict schema; interest weights
      1–5.
- [x] Itinerary plans and items in PostgreSQL. Guests can create, rename, re-date and
      delete plans, and add sessions, change guest counts and remove them.
      - Validation covers: cancelled sessions, sessions already started, party too large,
        not enough seats, outside the stay, and limits.
      - Overlaps produce a warning. **Plans hold no seats** and are shown separately from
        bookings.
- [x] Recommendations from DB records:
      - Filters: budget, dates, party size, time of day, availability and plan conflicts
        (`/recommendations`, URL-synced).
      - Each excluded experience gets a stated reason.
      - Explainable factor scores, plus "suggested days" that save nothing until added.
- [x] Booking detail page `/my-bookings/[reference]` (owner, assigned staff or admin)
- [x] Staff schedule `/staff` with guest manifests (shortened names)

## SOLACE alignment (project brief)

Brief: *Guest → Preferences → Experience Matching → Resource Availability → Booking →
Experience → Feedback*, across luxury, nature, adventure, wellness, local experiences,
sustainability and resource sharing.

- [x] Brand: SOLACE in the logo, titles, header, footer and landing copy. LUXE-ECO is
      named as the system, and the landing page shows its flow and a "Shared, not
      owned" pillar. "Local Culture" is now "Local Experiences".
- [x] Locale: INR and en-IN (`₹15,000`, `₹1,00,000`), resort time Asia/Kolkata.
      - Helpers `resortTime()` and `resortDayWindow()` build resort-local instants.
      - Converted to them: sessions, seed windows, page date windows, SQL queries and
        integrity checks.
      - DB currency default is INR (`0003`).
      - The zone is inferred from ₹; change `lib/config.ts` if the resort is elsewhere.
- [mock] Catalogue: 6 new experiences, now 18 in total. Placeholder copy, prices and
      generated illustrations.
      - Signature Spa Ritual, Lake Kayak Expedition, Valley Cycle Trail, Inlet Food
        Trail (local catch), Heritage Village Walk and Private Lakeside Cabana.
      - Seed: 5 new staff leads, 5 new resources (shared kayaks, bicycles, binoculars,
        spa suites, cabanas), new requirements, and a kayak maintenance window.
- [x] Resource availability: the `slot_readiness` view (`0004`) reports, for each
      session:
      - The staff assigned, and the per-session holds (venue, boats, vehicle).
      - How many more guests the shared per-guest pools can take after overlapping
        holds and maintenance.

      Recommendations skip sessions that can't run and cap places by equipment. Each
      match says who leads it and what's confirmed. `addItem` and party-size changes
      refuse with `slot-not-ready` or `not-enough-equipment`.
- [x] Favourite categories (`guest_preferred_categories`): chosen on `/preferences`;
      they're an explained scoring factor (3 points).
- [x] Activity budget per plan (`itinerary_plans.activity_budget`): set in the plan
      form; the itinerary shows what's left or over.
- [x] Day-by-day planner (`lib/dal/planner.ts`):
      - Fills each stay day with up to two non-overlapping sessions that can run.
      - Matches of at least 50% only, preferred times first.
      - Stays within the remaining budget and reports matches left out for budget.
      - The brief's example (3 days, nature + adventure + luxury, ₹15,000, mornings)
        is an integration test. It gives 5 sessions over 3 days for ₹11,200, with a
        morning session each day.
- [x] SQL examples Q17–Q20: readiness, shared pools, budgets, favourite categories.
- [ ] Guest gear lending (borrow a bicycle or camera outside an experience): not
      modelled yet; it would be a loan table with the same capacity trigger.
- [x] Booking step of the brief: Phase 6.
- [ ] Feedback step of the brief: Phase 7 (reviews).

## Phase 6: Bookings (transactional)

- [x] Server Actions `createBookingAction`, `cancelBookingAction` and
      `changeBookingGuestsAction` (`app/actions/bookings.ts`).
      - Each authenticates, authorizes, validates with strict Zod schemas, then calls
        the DAL.
      - The client sends only the session, the guest count and an idempotency key. The
        price always comes from the database.
- [x] Transaction (`lib/dal/booking-writes.ts`):
      - Locks the session row, then checks the session can still be booked
        (published, not started, ≥ 2 h before), the group size, the seats left and
        readiness (guide, venue, shared equipment).
      - Inserts a confirmed booking (`ON CONFLICT` on the idempotency key), then
        per-guest equipment holds in resource-id order.
      - Links the guest's plan item and records the actor in the status history.
      - Database refusals are turned into clear messages: `LXB01` → sold out,
        `LXR01` → equipment, `23505` on the active-booking index → already booked.
- [x] Cancellation: guests can cancel until 24 h before the start; administrators at
      any time. It releases the seats (trigger) and equipment holds, and the plan item
      goes back to "planned".
- [x] Change guests: until 24 h before. Seats are adjusted by the trigger and equipment
      holds are resized, both re-checked against capacity.
- [x] UI:
      - Experience page: live sessions, checked for guides and equipment, with
        **Book now** and a confirmation dialog.
      - Itinerary: **Book** on planned sessions.
      - Booking page: change guests and cancel.
- [x] Tests: 16 new (create, equipment holds, plan link, idempotent retry, second
      booking refused, every refusal, guest-only, cancel + rebook, 24 h window,
      administrator override, ownership, change guests, live sessions, actions). A
      mutation check confirmed that removing the ownership check or the 24 h rule makes
      tests fail.
- [~] Concurrency: the database-level race test (`npm run db:test:concurrency`, real
      parallel connections) still covers overbooking. The new app-level path takes the
      same slot lock but hasn't been raced in parallel (PGlite is single-connection).
- [ ] Online card payments (pay at resort only for now).

## Phase 7: Operations MVP

- [~] Admin: user role management done (Phase 3). CRUD for experiences, slots, resources
      and staff not started; "New experience" still saves nothing.
- [ ] Staff and resource assignment with overlap checks (transactional)
- [~] Staff manifest (read-only, Phase 5); check-in (completed / no_show) not started
- [ ] Reviews (only for completed bookings, one per booking)
- [ ] Manual (pay-at-resort) payment records

## Phase 8: Release

- [ ] Playwright e2e (guest booking flow, admin slot flow)
- [ ] CI: lint, tsc, unit, build, integration, e2e
- [ ] Production env vars, migration step, deployment and smoke test

## Advanced (post-MVP)

- [ ] Online payments with holds, webhooks and refunds; guest stays; waitlists;
      notifications; smarter matching. See the plan for the full list.

## Open decisions

See "Missing decisions" in `docs/IMPLEMENTATION_PLAN.md` (payments, single vs
multiple properties, stays, policies, timezone/currency, party details, images, email).
The git remote is set up (`origin`, github.com/devi-1389/DBMS-Project). Next most useful steps:
a Neon development branch and a Clerk development instance. Then run `db:migrate`, sign up
once, run `db:set-role` for the first admin, and check the flows by hand.

## Verification log

| Date       | Phase | Check                     | Result |
|------------|-------|---------------------------|--------|
| 2026-10-29 | 0     | `npm run lint`            | Pass   |
| 2026-10-29 | 0     | `npx tsc --noEmit`        | Pass   |
| 2026-10-29 | 0     | `npm run build`           | Pass (2 static routes: `/`, `/_not-found`) |
| 2026-10-29 | 1–2   | `npm run lint`            | Pass   |
| 2026-10-29 | 1–2   | `npx tsc --noEmit`        | Pass   |
| 2026-10-29 | 1–2   | `npm run build`           | Pass (`/` static) |
| 2026-10-29 | 1–2   | Playwright browser run (ad hoc script, not in repo) | 25/25 pass: nav, filters, dialog, mobile menu, 390px no overflow, reduced motion, no console errors |
| 2026-10-29 | 2     | `npm run lint`            | Pass   |
| 2026-10-29 | 2     | `npx tsc --noEmit`        | Pass   |
| 2026-10-29 | 2     | `npm run build`           | Pass (24 prerendered pages, incl. 12 experience details) |
| 2026-10-29 | 2     | Playwright browser run (ad hoc script, not in repo) | 67/67 pass: every page and interaction above, 390px no overflow on 9 routes, reduced motion, no console errors |
| 2026-10-29 | 4     | `npm run lint` / `npx tsc --noEmit` / `npm run build` | Pass (frontend unchanged: 24 prerendered pages) |
| 2026-10-29 | 4     | `npm run db:check` and `drizzle-kit generate` | Pass ("Everything's fine"; "No schema changes") |
| 2026-10-29 | 4     | `npm run db:verify` (PGlite, PostgreSQL 18.6) | 67/67 pass: migrations, seed, 47 integrity checks, 4 money checks, 16 queries |
| 2026-10-29 | 4     | Same seed, checks and queries on local PostgreSQL 16.15 (`pg` driver, scratch runner) | 47/47 checks, 16/16 queries |
| 2026-10-29 | 4     | `npm run db:test:concurrency` on PostgreSQL 16 | Pass: 8 attempts on 3 seats → 3 booked, 5 `LXB01`; 30 on 7 → 7 booked, 23 `LXB01` |
| 2026-10-29 | 4     | `db:migrate` / `db:seed` against Neon | Not run: no Neon credentials in this environment |
| 2026-10-29 | 3+5   | `npx tsc --noEmit` / `npm run lint` | Pass |
| 2026-10-29 | 3+5   | `npm test` (Vitest 5) | 77/77 pass: 35 unit (roles, routes, validation, matching, filters); 42 integration on PGlite (provisioning, role guards, preferences, plans, ownership, staff scope, DB recommendations, Server Actions, page guards, signed webhook) |
| 2026-10-29 | 3+5   | Mutation check on tests | Making new accounts admin fails 4 tests; a non-strict preferences schema fails 3 |
| 2026-10-29 | 3+5   | `npm run db:verify` / `npm run db:check` | 67/67 pass with migration 0002 / "Everything's fine" |
| 2026-10-29 | 3+5   | `npm run build` | Pass. Protected pages, `/login` and `/sign-up` are partial prerenders; the webhook is dynamic. First attempt failed (`usePathname` outside `<Suspense>` on `/my-bookings/[reference]`); fixed. |
| 2026-10-29 | 3+5   | Playwright on `next start` (no Clerk keys; ad hoc script, not in repo) | 33/33 pass: public pages 200; add-to-plan refused with a clear message; all 8 protected routes go to `/login?redirect_url=…` with no private data; raw 307; webhook 503; no overflow at 375px (fixed a pre-existing overflow on experiences with 14 session dates); no console errors |
| 2026-10-29 | 3+5   | Real Clerk sign-up/sign-in, Neon reads/writes | Not run: no Clerk keys or Neon credentials here |
| 2026-10-29 | SOLACE | `npx tsc --noEmit` / `npm run lint` | Pass |
| 2026-10-29 | SOLACE | `npm test` | 96/96 pass. New: IST and ₹ formatting; readiness filtering and equipment caps; favourite-category factor; day planner (spread, budget, 50% minimum); validation of categories and budgets; DB readiness, equipment and guide checks; the brief's ₹15,000 three-day example |
| 2026-10-29 | SOLACE | `npm run db:verify` / `npm run db:check` | 71/71 pass (migrations `0000`–`0004`, seed, 47 integrity checks, 4 money checks, 20 queries) / "Everything's fine" |
| 2026-10-29 | SOLACE | `npm run build` | Pass (35 static/partial pages incl. 18 experience pages) |
| 2026-10-29 | SOLACE | Playwright on `next start` (no Clerk keys; ad hoc scripts, not in repo) | 27/27 rebrand checks (SOLACE title and logo, LUXE-ECO copy, ₹ only, 18 experiences, 6 new detail pages, 7:00 am IST times, no overflow at 375px, no console errors) and 33/33 auth checks again |
| 2026-10-29 | SOLACE | Signed-in pages (budget, categories, day planner) in a browser | Not run: needs Clerk keys. Logic covered by integration tests |
| 2026-10-30 | 6     | `npx tsc --noEmit` / `npm run lint` / `npm run build` | Pass (lint first flagged JSX inside try/catch in the live panel; fixed) |
| 2026-10-30 | 6     | `npm test` | 112/112 pass (16 new booking and diagnostics tests); mutation check: removing ownership or the 24 h rule fails tests |
| 2026-10-30 | 6     | `npm run db:verify` / `npm run db:check` | 71/71 pass / "Everything's fine" |
| 2026-10-30 | 6     | Playwright on `next start` (no keys, no database) | Booking panel in sample mode with booking disabled (5/5); auth checks 33/33; rebrand checks 27/27. With a shortened `sk_test_o…TEaJ` key the setup page names the problem and shows no key value |
| 2026-10-30 | 6     | Booking with a real Neon database and Clerk sign-in | Not run here: no network access to Neon/Clerk from this environment |

Known Next 16 behaviour: the previous route stays mounted but hidden (`display: none`)
for instant back navigation, so DOM queries in tests must ignore hidden elements.
