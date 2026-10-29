@AGENTS.md

# LUXE-ECO

Integrated Luxury, Nature & Adventure Resort Experience Management System.
Guests discover and book resort experiences; staff manage slots, resources and
assignments; admins oversee payments, reviews and operations.

Plan: `docs/IMPLEMENTATION_PLAN.md`. Progress: `docs/IMPLEMENTATION_STATUS.md`.
Read both before starting work, and update the status file at the end of every phase.

## Stack

- Next.js 16 App Router + TypeScript (strict), React 19, Turbopack
- Tailwind CSS v4 (`app/globals.css`, no `tailwind.config`) + shadcn/ui
- Neon PostgreSQL + Drizzle ORM (migrations via drizzle-kit)
- Clerk authentication
- Vercel deployment

Installed so far: Next.js, React, Tailwind, ESLint, TypeScript and the shadcn/ui
dependencies. Check `package.json` before assuming any other library exists.
Sample data lives only in `lib/placeholder/` (catalogue in `catalogue.ts`) and is marked
`// PLACEHOLDER`. Browser-only drafts use `lib/preview-store.ts`; never present them as bookings.

## Commands

- `npm run dev`: dev server at http://localhost:3000
- `npm run lint`: ESLint (flat config, `eslint.config.mjs`)
- `npx tsc --noEmit`: type check
- `npm run build`: production build (must pass before a phase is "done")

## Next.js 16 specifics

- This Next.js version differs from older training data. Read the matching guide in
  `node_modules/next/dist/docs/` before using an unfamiliar API.
- Middleware is now `proxy.ts` at the project root. Clerk's middleware goes there.
  Proxy is only for optimistic redirects, never the sole authorization check.
- `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`.
  Request-time data (cookies, headers, the Clerk session) must be read inside a
  `<Suspense>` boundary. See `02-guides/authentication-with-cache-components.md`.
- Route props use generated helpers (`PageProps<"/route">`, `LayoutProps<"/">`).

## Architecture rules

- Build in phases: frontend first (static UI with clearly labelled placeholder
  data), then auth, then database, then backend features one at a time.
- All database access is server-side only, in modules starting with
  `import "server-only"` (planned: `lib/db/`, `lib/dal/`). Client components
  never import them.
- Secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, payment keys) are never prefixed
  with `NEXT_PUBLIC_`. Only the Clerk publishable key may be public.
  `.env*` is git-ignored. Keep `.env.example` with names only, no values.
- Mutations go through Server Actions or Route Handlers that, in order:
  authenticate, authorize (role and ownership), validate input with a schema
  (Zod), then call the DAL. Never trust client-supplied IDs, prices or roles.
- Booking writes run inside a DB transaction that re-checks slot capacity and
  resource/staff availability under a row lock or conditional update. Use the
  Neon WebSocket driver (`drizzle-orm/neon-serverless`) for transactions,
  because `neon-http` has no interactive transactions.
- Use normalized relational tables: guests, guest_preferences, experiences,
  experience_slots, bookings, resources, staff, payments, reviews, plus join
  tables where needed. Use FKs, unique/check constraints and indexes.
  Store money as integer minor units with a currency code and times as `timestamptz` (UTC).
- Stay Vercel-compatible: no long-lived servers, local file writes or custom
  Node servers. Keep code Node runtime unless edge is required.

## Code style

- Server Components by default; add `"use client"` only for interactivity.
- Path alias `@/*` maps to the project root.
- shadcn/ui components live in `components/ui/`; don't hand-edit them beyond
  theming. Feature components go in `components/<feature>/`.
- Match surrounding code. No unrelated refactors, and preserve working code.

## Working agreement

- Keep tasks short and focused. Edit files directly. Don't paste whole source
  files into chat.
- At the end of each phase, run lint, type check and build (plus tests once
  they exist), fix failures, then update `docs/IMPLEMENTATION_STATUS.md`.
- Phase report: changed files, check results (with real output on failure),
  remaining work. Nothing else.
- Be honest about status. Mock data, unverified flows and failing builds are
  never reported as working features. Label placeholder data in code and in
  the tracker.
- Don't commit, push or deploy unless asked.
