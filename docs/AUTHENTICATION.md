# Authentication and authorization

The SOLACE website (built on LUXE-ECO) uses [Clerk](https://clerk.com) (`@clerk/nextjs` 7, Core 3) for sign-in and
PostgreSQL for everything else: accounts, roles, preferences and plans. Clerk proves
who someone is; the database decides what they may do.

Status (2026-10-29): implemented and covered by automated tests, with Clerk mocked
(`npm test`). **Not yet tried against a real Clerk instance.** This environment has no
Clerk keys, and clerk.com is blocked by its network policy.

## Configuration

Set these in `.env.local` for development, or in Vercel → Project → Settings →
Environment Variables. `.env.example` lists the names.

| Variable | Needed for | Public? |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Sign-in UI | Yes (Clerk publishable key) |
| `CLERK_SECRET_KEY` | Verifying sessions on the server | **No.** Never prefix with `NEXT_PUBLIC_` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `/api/webhooks/clerk` (optional) | No |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Accounts, roles, preferences, plans | No |

Sign-in and sign-up URLs (`/login`, `/sign-up`, then `/dashboard`) are set in code
(`lib/auth/config.ts`, passed to `ClerkProvider` and `clerkMiddleware`), so no
`NEXT_PUBLIC_CLERK_SIGN_*` variables are needed.

### Setup steps

1. Create an application in the Clerk Dashboard. Enable email sign-in, keep email
   verification required (the app links accounts only to verified emails), and add any
   social providers you want.
2. Copy the publishable and secret keys (API keys page) into `.env.local`.
3. Point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` at a Neon development branch, then
   run `npm run db:migrate`. Migration `0002` lets a guest profile have an empty last
   name, because Clerk doesn't require one. Optionally run `npm run db:seed`.
4. Run `npm run dev`, open `/sign-up`, and create an account. The first request after
   sign-up creates your `users`, `auth_identities` and `guest_profiles` rows, always as a
   **guest**.
5. Make yourself the first administrator from a trusted machine with database access:

   ```bash
   npm run db:set-role -- you@example.com admin
   ```

   For a production database, add `--allow-production`. After that, administrators
   change roles in `/admin` → Users. There is no web route to the bootstrap.
6. Optional webhook (deployed environments only, since Clerk can't reach localhost). In
   Clerk Dashboard → Webhooks, add `https://<your-domain>/api/webhooks/clerk` with the
   events `user.created`, `user.updated` and `user.deleted`. Copy its signing secret to
   `CLERK_WEBHOOK_SIGNING_SECRET`. Without the webhook, accounts are still created on
   first sign-in. Name and email changes, and deletions made in Clerk, sync only through
   it.

### Without credentials

The app fails closed. There's no bypass and no fallback user.

- With no Clerk keys, `ClerkProvider` and `clerkMiddleware` aren't loaded.
  `proxy.ts` redirects every protected path to `/login`, which shows a "Sign-in isn't
  configured" notice listing the missing variables. Server Actions return
  `auth-unconfigured`.
- With Clerk keys but no `DATABASE_URL`, signed-in users get "The database isn't
  configured", and actions return `db-unconfigured`.
- Public pages (`/`, `/experiences`, `/experiences/[slug]`) work either way.

## Security model

**Identity.** `auth()` gives the Clerk user ID from the verified session token.
`lib/auth/viewer.ts` maps it to a `users` row through `auth_identities`, resolved once
per request (React `cache`). On first sign-in it calls `currentUser()` and provisions an
account only if the primary email is **verified**. An existing account (for example, staff
added by an admin) is linked by verified email, unless it's already linked to another
Clerk user. In that case sign-in stops with an "identity conflict" message.

**Roles.** `users.role` (`guest` | `staff` | `admin`) is the only source of truth. Clerk
metadata is never read, and Clerk identities carry no role, so signing up can't grant
staff or admin rights. Role changes go through `changeUserRole` only. It is admin-only,
re-reads the actor's role from the database under a row lock, refuses self-changes, and
keeps one administrator. Promoting to staff creates an active `staff_members` record;
demoting deactivates it.

**Areas.** A guest can open the guest area. Staff can open the guest and staff areas.
Admins can open all three (`lib/auth/roles.ts`).

| Area | Routes |
|---|---|
| guest | `/dashboard`, `/recommendations`, `/itinerary`, `/preferences`, `/my-bookings/*` |
| staff | `/staff` |
| admin | `/admin` |

**Layers.** Each layer checks for itself; none relies on another.

1. `proxy.ts`: an early 307 to sign-in for signed-out visitors (Clerk's current guidance
   for Next.js 16). This is a convenience only, never the authorization.
2. Pages: `<Protected area="…">` (`components/auth/protected.tsx`) runs
   `checkPageAccess` inside `<Suspense>`. It calls `connection()` so access is decided per
   request and never prerendered, as Cache Components requires. Signed-out visitors are
   redirected; the wrong role gets "You don't have access".
3. Server Actions (`app/actions/*`) run four steps in order:
   1. `authorizeAction(area)`.
   2. Zod `strictObject` validation. Unknown keys such as `role` or `guestId` are
      rejected, not ignored.
   3. The DAL call.
   4. `refresh()`.
4. DAL (`lib/dal/*`, `server-only`): every guest query is scoped to the signed-in user's
   ID. Another guest's plan, item or booking behaves exactly like one that doesn't
   exist. Booking details are visible to the owner, staff assigned to that session, and
   administrators. Staff schedules show only the staff member's own assignments.
5. Webhook: public by design. It returns 503 unless the signing secret is set, and 400
   unless the Svix signature verifies.

## Personal data in PostgreSQL

| Feature | Tables | Notes |
|---|---|---|
| Preferences | `guest_preferences`, `guest_interests` (weight 1–5), `guest_preferred_times`, `guest_preferred_categories` | Saved in one transaction by `savePreferencesAction` |
| Itinerary plans | `itinerary_plans` (optional activity budget in ₹), `itinerary_items` | Up to 10 plans × 40 items; stay of at most 21 nights |
| Bookings | `bookings` and history | Read-only for now; creating bookings is Phase 6 |

**Plans are not bookings.** Adding a session to a plan never changes `seats_booked`, and
plans appear separately from bookings everywhere. Seats are checked only to give the guest
honest feedback ("Plans don't hold seats").

**Recommendations** (`lib/matching/recommend.ts`) rank published, scheduled sessions read
from the database.

- Hard filters, each counted with a stated reason: step-free access, pace, party size,
  budget cap, sessions that can't run, and a fitting session.
  - "Can't run" means no guide assigned, or a venue, boat or vehicle not held, from the
    `slot_readiness` view.
  - A fitting session is within the dates, has enough seats and shared equipment, is at
    the chosen times of day, isn't already planned and doesn't overlap the plan.
- The score is a sum of named factors, all shown to the guest: shared interests
  (weighted), favourite categories, pace, budget, time of day and choice of sessions.
  Each match also says who leads it and which resources are confirmed.
- "Suggested days" (`lib/dal/planner.ts`) builds the stay day by day:
  - Matches of at least 50% only, at most two a day, spread across the days.
  - The guest's preferred times first, never overlapping.
  - Within what's left of the plan's activity budget.
  - Nothing is saved until the guest adds a session. Adding re-checks the guide,
    resources and shared equipment on the server.

## Tests

`npm test` (Vitest) runs:

- Unit tests: roles, protected routes, validation, the matching engine and filters.
- Integration tests on PGlite with the real migrations and seed:
  - Provisioning and role guards.
  - Preferences, plans and ownership.
  - Staff scope and DB-backed recommendations.
- The Server Actions, page guards and the signed webhook, with only Clerk's session
  mocked.

The real Clerk sign-in UI and session cookies still need a manual check once keys exist.
