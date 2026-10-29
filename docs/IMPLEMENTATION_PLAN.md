# LUXE-ECO Implementation Plan

Status: draft, 2026-10-29. Progress is tracked in `IMPLEMENTATION_STATUS.md`.
Rules are in `/CLAUDE.md`. Library versions checked on 2026-10-29: Next 16.4, React 19.3,
`@clerk/nextjs` 7.x, `drizzle-orm` 0.45, `@neondatabase/serverless` 1.x, Zod 4, Vitest 5,
Playwright 1.64. All are newer than most training data, so read their current docs first.

**MVP goal:** a guest signs in, sets preferences, gets matched experiences, books a
slot without overbooking, sees and cancels bookings, and reviews completed bookings.
Staff see their assigned slots and guest lists. Admins manage experiences, slots,
resources and staff. Payments are recorded manually (pay at resort) until online
payments are decided.

## Phases

| # | Phase | Delivers | Exit check |
|---|-------|----------|------------|
| 1 | Frontend foundation | shadcn/ui, theme, layouts, nav; Vercel preview connected | lint, tsc, build, preview loads |
| 2 | Frontend pages | Every MVP route with labelled placeholder data | build; manual walk-through |
| 3 | Auth & roles | Clerk, `proxy.ts`, role guards | guest/staff/admin access matrix checked |
| 4 | Database | Drizzle schema, migrations, seed, Vitest set up | migrate and seed on Neon dev branch |
| 5 | Reads & matching | DAL replaces placeholders; preferences; matching | unit tests (matching, DTOs) |
| 6 | Booking transactions | Book, cancel, idempotency, capacity | integration and concurrency tests |
| 7 | Operations MVP | Admin CRUD, staff/resource assignment, manifest, reviews, manual payments | integration tests |
| 8 | Release | Playwright e2e, production env, deploy | e2e on preview; prod smoke test |

Advanced features come after the MVP (see the last section).

## 1. Routes and reusable components

Route groups keep layouts separate without affecting URLs.

| Group | Routes | Access |
|-------|--------|--------|
| `(public)` | `/`, `/experiences` (filters in search params), `/experiences/[slug]` | anyone |
| `(auth)` | `/login` (built; sign-in and create-account tabs; Clerk mounts here in Phase 3) | anyone |
| `(guest)` | Built: `/dashboard`, `/preferences`, `/itinerary`, `/my-bookings`. Later: `/my-bookings/[reference]`, booking review step | guest+ |
| `(staff)` | `/staff` (my upcoming slots), `/staff/slots/[id]` (manifest, check-in) | staff, admin |
| `(admin)` | Built: `/admin` (tabs: overview, experiences, schedule, bookings). Later: edit pages, `/admin/resources`, `/admin/staff`, `/admin/reviews`, `/admin/users` | admin |
| API | `/api/webhooks/clerk` (later `/api/webhooks/payments`) | signed webhooks |

Components (shadcn primitives in `components/ui/`; feature components alongside):
- **layout/**: `SiteHeader`, `SiteFooter`, `MainNav`, `MobileNav`, `UserMenu`,
  `DashboardShell` (role-aware sidebar), `PageHeader`, `EmptyState`, `ErrorState`.
- **experiences/**: `ExperienceCard`, `ExperienceGrid`, `ExperienceFilters`,
  `CategoryBadge` (luxury, nature, adventure, wellness, local culture, sustainability), `DifficultyBadge`, `PriceTag`,
  `SlotPicker`, `MatchReasons`.
- **booking/**: `BookingSummary`, `PartySizeInput`, `BookingStatusBadge`, `CancelBookingDialog`.
- **reviews/**: `RatingStars`, `ReviewCard`, `ReviewForm`.
- **admin/**: `DataTable`, `StatCard`, `ConfirmDialog`, entity forms.
- Forms use `<form action={serverAction}>` with `useActionState`, and the same Zod schema on the server.
- Placeholder data lives in `lib/placeholder/`, marked `// PLACEHOLDER`. It returns
  the same DTO types (`lib/types/`) the DAL will return, so Phase 5 only swaps imports.

## 2. Database schema

> **Superseded by the implemented design:** see [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md)
> and [`ERD.md`](./ERD.md) (26 tables). Notable changes from this draft: money is
> `numeric(10,2)` in the database (minor units only in the app), categories are a table,
> and staff, resources, suppliers, itineraries and blackouts are fully modelled.

Conventions: `uuid` primary keys, `created_at`/`updated_at timestamptz`, money in
`*_minor integer` plus `currency char(3)`, all times in UTC, displayed in the resort's timezone.

| Table | Key columns | Constraints / indexes |
|-------|-------------|-----------------------|
| `users` | `clerk_user_id`, `email`, `role` enum(guest, staff, admin) | unique clerk_user_id, email |
| `guests` | `user_id` → users, name, phone, `fitness_level`, `max_budget_minor`, `needs_accessibility` | unique user_id |
| `tags` | `slug`, `label`, `kind` (interest, terrain, amenity) | unique slug |
| `guest_preferences` | `guest_id` → guests, `tag_id` → tags, `weight` 1–5 | PK(guest_id, tag_id), check weight |
| `experiences` | `slug`, title, summary, description, `category` enum (6 values, matching `lib/categories.ts`), `difficulty`, `duration_minutes`, `min_age`, `base_price_minor`, currency, `default_capacity`, `is_accessible`, `is_published`, `cover_image_url` | unique slug; index (category, is_published) |
| `experience_tags` | `experience_id`, `tag_id` | PK(experience_id, tag_id) |
| `experience_slots` | `experience_id`, `starts_at`, `ends_at`, `capacity`, `booked_count`, `price_override_minor`, `status` (scheduled, cancelled, completed) | check `0 ≤ booked_count ≤ capacity`, `ends_at > starts_at`; unique(experience_id, starts_at); index starts_at |
| `resources` | name, `type`, `quantity`, `is_active` | check quantity > 0 |
| `slot_resources` | `slot_id`, `resource_id`, `quantity` | PK(slot_id, resource_id) |
| `staff` | `user_id` → users, `display_name`, `job_title`, `is_active` | unique user_id |
| `slot_staff_assignments` | `slot_id`, `staff_id`, `assignment_role` (lead, assistant) | PK(slot_id, staff_id); index staff_id |
| `bookings` | `reference`, `guest_id`, `slot_id`, `party_size`, `unit_price_minor`, `total_minor`, currency, `status` (pending, confirmed, cancelled, completed, no_show), `idempotency_key`, `cancelled_at` | unique reference; unique(guest_id, idempotency_key); partial unique(guest_id, slot_id) where status in (pending, confirmed); index (slot_id, status) |
| `payments` | `booking_id`, `method` (pay_at_resort, card), `provider_ref`, `amount_minor`, currency, `status` (pending, succeeded, failed, refunded), `recorded_by` → staff | index booking_id; unique provider_ref |
| `reviews` | `booking_id`, `rating`, title, body, `status` (published, hidden) | unique booking_id; check rating 1–5 |

How the tables relate:
- One `users` row per Clerk account, with optional `guests` and `staff` profiles (one each).
- Guests have weighted preference tags. Experiences have tags.
- Each experience has many slots.
- Slots are linked to staff and resources through the two assignment tables.
- A guest has many bookings, and each booking is for one slot.
- A booking can have several payments and at most one review.
- A review's experience comes from booking → slot → experience, so it isn't stored twice.

## 3. Authentication and roles

- Clerk `ClerkProvider` goes in the root layout. `proxy.ts` uses `clerkMiddleware` to
  redirect signed-out users away from `/dashboard`, `/my-bookings`, `/itinerary`, `/staff` and `/admin`. This
  is a convenience only.
- **The role is stored in `users.role` in the database.** Every protected page, Server
  Action and Route Handler calls `requireUser()` or `requireRole(...)` from `lib/auth/`
  (request-scoped with React `cache()`).
- Users are created by a Clerk webhook (`user.created/updated/deleted`, signature
  verified). As a fallback, the user row is created on the first signed-in request,
  because webhooks can't reach localhost or protected previews.
- The first admin is created by `scripts/promote-admin.ts <email>`. After that, admins
  change roles in `/admin/users`.
- Cache Components: session reads happen inside `<Suspense>`. User-specific data is
  never inside a shared `"use cache"`. Use `redirect()` and `notFound()` rather than the
  experimental `forbidden()` and `unauthorized()`.

| Capability | Guest | Staff | Admin |
|------------|:-----:|:-----:|:-----:|
| Browse, set preferences, book/cancel own, review own completed | ✓ | ✓ | ✓ |
| View manifests for assigned slots, check guests in | | ✓ | ✓ |
| Manage experiences, slots, resources, staff, users; all bookings; payments; moderate reviews | | | ✓ |

## 4. Backend and data-access structure

```
lib/db/index.ts         server-only Drizzle client (neon-serverless Pool, pooled URL)
lib/db/schema/*.ts      tables, enums, relations
drizzle/                generated SQL migrations (committed)
lib/auth/               getCurrentUser, requireUser, requireRole
lib/dal/*.ts            server-only reads → DTOs, scoped to the signed-in user
lib/services/*.ts       server-only transactional writes (booking, cancel, assign)
lib/matching/           pure scoring functions (no DB)
lib/validation/         Zod schemas (shared by forms and actions)
lib/types/              DTO types
app/**/actions.ts       "use server": auth → validate → service → updateTag → Result
app/api/webhooks/*      Route Handlers (signature verified)
scripts/                seed, promote-admin
```

- Actions return `{ ok: true, data } | { ok: false, code, fieldErrors? }`. They never throw raw database errors.
- Caching: the public catalogue uses `"use cache"` with `cacheTag("experiences")`. Slot
  availability and anything user-specific are read fresh per request.
- Environment variables: `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (drizzle-kit),
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`.
  Names are listed in `.env.example`.

## 5. Experience matching and booking transactions

**Matching (MVP, rule-based and explainable)**, in `lib/matching/score.ts`:
1. Filter in SQL: published; has a scheduled future slot with enough seats; guest
   meets `min_age`; `is_accessible` if the guest needs it.
2. Score in TypeScript: Σ guest tag weight × matching tags (main signal), difficulty
   fit with fitness level, price within budget, sooner slots.
3. Return the top N with reasons ("Matches kayaking and wildlife"). Fall back to
   popular experiences when no preferences are set.

**`createBooking` (single transaction)**:
1. Action: `requireUser` → guest. Zod validates `{ slotId, partySize (1..10), idempotencyKey }`.
2. If this guest already has a booking with that `idempotencyKey`, return it.
3. `BEGIN`. Reserve seats with one conditional update:
   `UPDATE experience_slots SET booked_count = booked_count + :n WHERE id = :slot
   AND status = 'scheduled' AND starts_at > now() + cutoff AND booked_count + :n <= capacity
   RETURNING …`. Zero rows means `SOLD_OUT` or `UNAVAILABLE`. The `CHECK` constraint is the backstop.
4. Calculate the price on the server: `price_override ?? base_price` × party size. Prices from the client are ignored.
5. Insert the booking (`confirmed` while payment is pay-at-resort) and a `pending` payment row. `COMMIT`.
   A unique-constraint violation rolls back and returns `DUPLICATE`.
6. After commit, `updateTag` the slot and the guest's bookings.

**`cancelBooking`:** in one transaction, lock the booking (owner or admin), check the
status and the cancellation window, set it to `cancelled`, and subtract `party_size` from `booked_count`.

**Staff and resource assignment:** lock the staff or resource row with `FOR UPDATE`,
check for overlapping slots (`tstzrange &&`), then insert. For resources, the total
allocated across overlapping slots must not exceed `quantity`.

Admins can't lower a slot's capacity below `booked_count`; the database constraint enforces this.

## 6. Testing and Vercel deployment

- **Unit (Vitest):** matching, pricing, Zod schemas, cancellation policy, DTO mappers.
- **Integration (Vitest + real Postgres):** services against a Neon `test` branch that is
  reset before each run. Concurrency test: 20 parallel bookings on a slot with capacity 5
  must produce exactly 5 seats, with no negative counts or duplicates. Authorization
  tests: a guest can't read or cancel another guest's booking.
- **E2E (Playwright + `@clerk/testing`):** browse → sign in → book → see the booking →
  cancel. Admin creates a slot, and staff see it on their manifest.
- **CI (GitHub Actions):** lint, tsc, unit and build on every push; integration on the
  Neon branch; e2e against the Vercel preview.
- **Vercel:** connect the repo in Phase 1. Use the Neon integration for a database branch per
  preview. Set environment variables per environment. Run migrations as an explicit CI
  step before production deploys, and keep migrations backward compatible (add first,
  remove later). Put the function region next to the Neon region. Clerk production
  needs a custom domain.

## Advanced (after the MVP)

- Online payments (e.g. Stripe): pending holds with expiry (Vercel Cron), webhooks, refunds.
- Guest stays (arrival and departure dates) to limit matching and booking to the stay.
- Party participants, ages and waivers; waitlists; recurring slot generation; packages.
- Staff skills and certifications for auto-assignment; a resource calendar.
- Email confirmations and reminders; review rating summaries; an analytics dashboard.
- Smarter matching (booking history, embeddings with pgvector); i18n and multi-currency; audit log; rate limiting.

## Missing decisions (recommended default in brackets)

1. Payments in the MVP: online or pay at resort? [pay at resort; schema ready for card]
2. Single resort or several properties? [single; adding `property_id` later is costly, so decide now]
3. Are guest stays in scope, and can only in-house guests book? [stays post-MVP; open sign-up]
4. Cancellation window, booking cutoff and refund rules? [cancel ≥ 24 h, book ≥ 2 h before]
5. Resort timezone and currency? [one of each, set in config]
6. Does one booking cover a party with per-person details? [party size only in the MVP]
7. Where experience images are stored? [external URLs, then Vercel Blob]
8. Email provider; test database strategy [Neon test branch]; **git remote (still missing)**.

## Risks

- **Overbooking:** handled by the conditional update, the CHECK constraint and the concurrency test.
- **`neon-http` has no transactions:** use the Pool (WebSocket) driver with the pooled URL to stay within serverless connection limits.
- **Cache Components leaking or failing:** user data in a shared cache would be a leak, and uncached request data outside `<Suspense>` fails the build. Keep auth reads isolated.
- **Proxy-only auth checks can be bypassed:** guards in the DAL and actions are required.
- **Clerk webhooks blocked in dev or preview:** handled by creating the user row on first request.
- **Timezone and daylight-saving bugs in slot times:** store UTC and test across DST boundaries.
- **Production migrations:** use backward-compatible migrations and a separate CI step.
- **Placeholder screens taken for finished features:** label them in code and in the tracker.
- **No git remote and a temporary environment:** work can be lost until a repo is connected.
