# LUXE-ECO Implementation Status

Last updated: 2026-10-29 (Phase 4: database design)

Status key: `[x]` done and verified · `[~]` in progress / partial · `[ ]` not started ·
`[mock]` UI exists but uses placeholder data (not a working feature)

## Current state

- Frontend pages exist for `/`, `/experiences`, `/experiences/[slug]`, `/preferences`,
  `/itinerary`, `/dashboard`, `/my-bookings`, `/admin` and `/login`. All use sample data.
- **No backend features work yet.** There's no auth or booking, and no page reads the
  database yet. Nothing a visitor does reaches a server.
- **Database design is done (Phase 4)**, verified offline and on local PostgreSQL, but not
  yet applied to a Neon database (no credentials in this environment):
  - Drizzle schema: 26 normalized tables and 2 views (`lib/db/schema/`).
  - Migrations: `drizzle/0000_schema.sql` plus `0001_integrity.sql` (triggers and views).
  - Development seed reusing the catalogue (`scripts/db/`), 16 queries in `sql/queries.sql`.
  - See `docs/DATABASE_DESIGN.md` and `docs/ERD.md`.
- What does work, entirely in the browser:
  - Catalogue filtering and sorting (URL-synced).
  - Rule-based matching (`lib/matching/score.ts`, a pure function ready for server reuse).
  - Form validation.
  - Preferences and itinerary drafts saved to `localStorage` (`lib/preview-store.ts`,
    labelled "this browser only" in the UI).
- Not possible yet: bookings, cancellations, sign-in, admin saves. These actions are disabled
  or show a "not connected" message.
- All sample data lives in one module: `lib/placeholder/catalogue.ts`. It holds 12
  experiences, a deterministic 2–15 Nov 2026 session schedule (116 sessions) and 10 sample
  bookings, with async accessors shaped like the future DAL.
- Installed: `next@16.4.3`, `react@19.3.0`, Tailwind CSS v4, ESLint 9, TypeScript 5,
  shadcn/ui dependencies (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`,
  `lucide-react`, `tw-animate-css`). Phase 4 added `drizzle-orm`, `@neondatabase/serverless`
  and (dev) `drizzle-kit`, `tsx`, `@electric-sql/pglite`; `engines.node` is `>=22`.
- Not installed yet: Clerk, Zod, test framework (Vitest).
- `npm audit`: production dependencies clean. 4 moderate advisories are in an old `esbuild`
  bundled inside dev-only `drizzle-kit` (its dev-server issue; drizzle-kit doesn't use it).
- shadcn/ui registry (ui.shadcn.com) and photo hosts are blocked by this environment's
  network policy. `components/ui/*` was written by hand to the shadcn new-york pattern,
  and all imagery is generated placeholder illustration (`public/images/placeholder/`).

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
      sheet) and footer. Guest and admin layouts mark where Phase 3 auth checks go.
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
      state. The planning panel has date/time picker (full sessions disabled), guest count,
      price total and overlap warning. "Add to itinerary draft" works (browser only).
      **"Online booking coming soon" is disabled.** Unknown slugs show a not-found page.
- [mock] `/preferences`: interests, pace, budget, group size, time of day, access and notes,
      with validation and focus on the first error. Live top-3 matches with reasons. Saved
      in this browser only.
- [mock] `/itinerary`: stay dates with validation, day-by-day plan, overlap and outside-stay
      warnings, free-day links to the catalogue, estimate, and a confirm dialog to clear.
      **"Request bookings" is disabled.** Items are badged "Not reserved".
- [mock] `/dashboard`: stats, recommendations from saved preferences, up-next plan, and
      bookings shown honestly as 0.
- [mock] `/my-bookings`: empty state by default (no real bookings exist). A "Show sample
      bookings" switch reveals labelled sample data: status tabs, table on desktop, cards on
      mobile, cancel disabled.
- [mock] `/admin`: overview stats and occupancy; sortable, searchable experiences table;
      filterable, paginated schedule; sample bookings behind a switch. "New experience" form
      validates but states nothing was created. **No access control yet.**
- [mock] `/login`: sign-in and create-account tabs with validation and a password toggle.
      Submitting shows "Sign-in isn't connected yet"; nothing is sent or stored.
- [x] Loading states (`loading.tsx` for catalogue, detail, guest area, admin; skeletons while
      browser data loads), empty states, and branded `not-found` pages
- [ ] Booking review and payment steps (after the booking backend; Phase 6)
- [ ] Staff area (schedule, assignments, check-in)
- [ ] Admin: staff, resources, payments, reviews screens
- [ ] Error boundaries (`error.tsx`), to add with the first data that can fail

## Phase 3: Authentication & authorization (Clerk)

- [ ] Install Clerk, add env vars to `.env.example`, `ClerkProvider` in layout
- [ ] `proxy.ts` with `clerkMiddleware` (optimistic route protection only)
- [ ] Sign-in / sign-up: mount Clerk at `/login` (replace the preview forms; likely
      `app/(auth)/login/[[...rest]]`)
- [ ] Add `requireUser()` in `(guest)/layout.tsx` and `requireRole("admin")` in `(admin)/layout.tsx`
- [ ] Move preferences and itinerary drafts from `localStorage` to the account
- [ ] Role model (guest / staff / admin) and a server-side `requireRole()` helper
- [ ] Session reads wrapped in `<Suspense>` (Cache Components)

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
      `sql/queries.sql` (16 queries)
- [x] Checks: `npm run db:verify` (offline, PGlite) and `npm run db:test:concurrency`
      (parallel psql sessions)
- [ ] Set up Vitest (unit tests for `lib/money.ts`, matching, filters)
- [ ] Link Clerk user ID ↔ users rows (table `auth_identities` is ready; webhook in Phase 3)

## Phase 5: Backend reads & matching

- [ ] `server-only` data access layer (DAL) replacing placeholder data page by page
- [ ] Ownership-scoped queries (guests see only their own data)
- [ ] Guest preferences saved via Server Action (shape: `lib/types/guest.ts`; interests are
      the tags in `lib/interests.ts`)
- [~] Rule-based matching with reasons: implemented as a pure function and used in the UI;
      unit tests pending (no test framework yet)

## Phase 6: Bookings (transactional)

- [ ] Zod-validated booking Server Action
- [ ] Transaction: lock slot, re-check capacity, resource and staff availability, insert booking
- [ ] Cancellation / modification rules and capacity release
- [ ] Concurrency test (no overbooking under parallel requests)

## Phase 7: Operations MVP

- [ ] Admin CRUD: experiences, slots, resources, staff, user roles
- [ ] Staff and resource assignment with overlap checks (transactional)
- [ ] Staff manifest and check-in (completed / no_show)
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
The git remote is set up (`origin`, github.com/devi-1389/DBMS-Project). Next most useful step:
a Neon development branch, so `db:migrate` and `db:seed` can run against Neon.

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

Known Next 16 behaviour: the previous route stays mounted but hidden (`display: none`)
for instant back navigation, so DOM queries in tests must ignore hidden elements.
