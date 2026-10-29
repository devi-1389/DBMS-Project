# LUXE-ECO Implementation Status

Last updated: 2026-10-29

Status key: `[x]` done and verified · `[~]` in progress / partial · `[ ]` not started ·
`[mock]` UI exists but uses placeholder data (not a working feature)

## Current state

- Frontend pages exist for `/`, `/experiences`, `/experiences/[slug]`, `/preferences`,
  `/itinerary`, `/dashboard`, `/my-bookings`, `/admin` and `/login`. All use sample data.
- **No backend features work yet.** There's no auth, database or booking. Nothing a visitor
  does reaches a server.
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
  `lucide-react`, `tw-animate-css`). No new dependencies in Phase 2.
- Not installed yet: Clerk, Drizzle ORM, Neon driver, Zod, test framework.
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
- [ ] Connect Vercel preview deployments (needs a git remote)

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

- [ ] Install Drizzle, drizzle-kit, Neon driver; `server-only` `lib/db/` client
- [ ] Set up Vitest
- [ ] Schema: guests, guest_preferences, experiences, experience_slots, bookings,
      resources, staff, payments, reviews, plus join tables
      (e.g. slot_resources, slot_staff_assignments)
- [ ] Constraints: FKs, unique, check (capacity ≥ 0, rating 1–5), indexes
- [ ] Migrations generated and applied to a Neon dev branch
- [ ] Seed script (dev data only)
- [ ] Link Clerk user ID ↔ guests/staff rows

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
Most urgent: **git remote**. The local repo has none, so work isn't backed up outside this environment.

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

Known Next 16 behaviour: the previous route stays mounted but hidden (`display: none`)
for instant back navigation, so DOM queries in tests must ignore hidden elements.
