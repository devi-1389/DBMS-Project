# LUXE-ECO Entity-Relationship Diagram

Source of truth: `lib/db/schema/*.ts` → migrations in `drizzle/`. Design rationale is in
[`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md). 26 tables, 2 views.

Notation (Mermaid crow's foot): `||` exactly one · `|o` zero or one · `o{` zero or more ·
`|{` one or more. Keys: **PK** primary key, **FK** foreign key, **UK** unique.

## Overview

```mermaid
erDiagram
    users ||--o{ auth_identities : "signs in with"
    users ||--o| guest_profiles : "is a guest"
    users |o--o| staff_members : "may be staff"

    guest_profiles ||--o| guest_preferences : "sets"
    guest_profiles ||--o{ guest_interests : "weights"
    interests ||--o{ guest_interests : "chosen as"
    guest_profiles ||--o{ guest_preferred_times : "prefers"

    experience_categories ||--o{ experiences : "groups"
    suppliers |o--o{ experiences : "operates"
    experiences ||--o{ experience_highlights : "lists"
    experiences ||--o{ experience_interests : "tagged with"
    interests ||--o{ experience_interests : "tags"
    experiences ||--o{ experience_slots : "scheduled as"
    experiences |o--o{ blackout_periods : "closed by"

    guest_profiles ||--o{ bookings : "makes"
    experience_slots ||--o{ bookings : "reserved by"
    bookings ||--|{ booking_status_history : "audited by"
    bookings ||--o{ payment_attempts : "paid by"
    bookings ||--o| reviews : "reviewed in"

    staff_members ||--o{ staff_assignments : "works"
    experience_slots ||--o{ staff_assignments : "staffed by"

    suppliers |o--o{ resources : "provides"
    experiences ||--o{ experience_resource_requirements : "needs"
    resources ||--o{ experience_resource_requirements : "required by"
    resources ||--o{ resource_allocations : "held in"
    experience_slots ||--o{ resource_allocations : "uses"
    bookings |o--o{ resource_allocations : "per-guest holds"
    resources ||--o{ resource_maintenance : "out of service"

    guest_profiles ||--o{ itinerary_plans : "plans"
    itinerary_plans ||--o{ itinerary_items : "contains"
    experience_slots ||--o{ itinerary_items : "planned as"
    bookings |o--o{ itinerary_items : "fulfils"
```

Audit and actor links (all `ON DELETE SET NULL`, omitted above for readability):
`booking_status_history.changed_by_user_id`, `blackout_periods.created_by_user_id`,
`reviews.moderated_by_user_id` → `users`; `payment_attempts.recorded_by_staff_id` →
`staff_members` (RESTRICT).

## Identity and preferences

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK "unique on lower(email)"
        text display_name
        user_role role "guest | staff | admin"
        timestamptz created_at
        timestamptz updated_at
    }
    auth_identities {
        uuid id PK
        uuid user_id FK "CASCADE"
        auth_provider provider "clerk"
        text provider_user_id "UK with provider"
        timestamptz last_sign_in_at
    }
    guest_profiles {
        uuid user_id PK,FK "shared PK with users; CASCADE"
        text first_name
        text last_name
        text phone "format check"
        date date_of_birth
    }
    staff_members {
        uuid id PK
        uuid user_id FK,UK "nullable; SET NULL"
        text display_name
        text job_title
        boolean is_active
        date hired_on
    }
    interests {
        smallint id PK "identity"
        text slug UK
        text label
    }
    guest_preferences {
        uuid guest_id PK,FK "CASCADE"
        difficulty max_difficulty
        numeric_10_2 budget_per_guest "NULL = no limit"
        char_3 currency
        smallint usual_group_size "1-12"
        boolean needs_step_free
        text notes "<= 500 chars"
    }
    guest_interests {
        uuid guest_id PK,FK "CASCADE"
        smallint interest_id PK,FK "RESTRICT"
        smallint weight "1-5"
    }
    guest_preferred_times {
        uuid guest_id PK,FK "CASCADE"
        time_of_day time_of_day PK "morning | daytime | evening"
    }
    users ||--o{ auth_identities : ""
    users ||--o| guest_profiles : ""
    users |o--o| staff_members : ""
    guest_profiles ||--o| guest_preferences : ""
    guest_profiles ||--o{ guest_interests : ""
    interests ||--o{ guest_interests : ""
    guest_profiles ||--o{ guest_preferred_times : ""
```

## Catalogue and schedule

```mermaid
erDiagram
    experience_categories {
        smallint id PK "identity"
        text slug UK
        text label
        text tagline
        smallint sort_order
    }
    suppliers {
        uuid id PK
        text name UK
        supplier_kind kind
        text contact_email
        boolean is_active
    }
    experiences {
        uuid id PK
        smallint category_id FK "RESTRICT"
        uuid supplier_id FK "nullable; RESTRICT"
        text slug UK
        text title
        difficulty difficulty
        integer duration_minutes "15-1440"
        smallint max_group_size "default slot capacity"
        numeric_10_2 base_price ">= 0"
        char_3 currency
        boolean is_step_free
        experience_status status "draft | published | archived"
    }
    experience_highlights {
        uuid experience_id PK,FK "CASCADE"
        smallint position PK
        text text
    }
    experience_interests {
        uuid experience_id PK,FK "CASCADE"
        smallint interest_id PK,FK "RESTRICT"
    }
    experience_slots {
        uuid id PK
        uuid experience_id FK "RESTRICT; UK with starts_at"
        timestamptz starts_at
        timestamptz ends_at "> starts_at"
        tstzrange during "generated; GiST index"
        smallint capacity
        smallint seats_booked "trigger-maintained; <= capacity"
        numeric_10_2 price_override
        slot_status status "scheduled | cancelled | completed"
        text cancelled_reason "required when cancelled"
    }
    blackout_periods {
        uuid id PK
        uuid experience_id FK "NULL = resort-wide; CASCADE"
        timestamptz starts_at
        timestamptz ends_at
        text reason
    }
    experience_categories ||--o{ experiences : ""
    suppliers |o--o{ experiences : ""
    experiences ||--o{ experience_highlights : ""
    experiences ||--o{ experience_interests : ""
    experiences ||--o{ experience_slots : ""
    experiences |o--o{ blackout_periods : ""
```

## Bookings, payments and reviews

```mermaid
erDiagram
    bookings {
        uuid id PK
        text reference UK "LX-XXXX"
        uuid guest_id FK "RESTRICT"
        uuid slot_id FK "RESTRICT"
        smallint party_size "1-100"
        numeric_10_2 unit_price "price snapshot"
        numeric_12_2 total_amount "generated: unit_price x party_size"
        booking_status status
        timestamptz hold_expires_at "required when pending"
        uuid idempotency_key "UK with guest_id"
    }
    booking_status_history {
        bigint id PK "identity"
        uuid booking_id FK "CASCADE"
        booking_status from_status "NULL on creation"
        booking_status to_status
        timestamptz changed_at
        uuid changed_by_user_id FK "SET NULL"
        text reason
    }
    payment_attempts {
        uuid id PK
        uuid booking_id FK "RESTRICT"
        numeric_12_2 amount "> 0"
        payment_method method "pay_at_resort | card"
        payment_status status "initiated | succeeded | failed | refunded"
        text provider_reference UK
        uuid recorded_by_staff_id FK "RESTRICT"
        timestamptz settled_at "set when succeeded/refunded"
    }
    reviews {
        uuid id PK
        uuid booking_id FK,UK "RESTRICT; completed bookings only"
        smallint rating "1-5"
        text title
        text body
        review_status status "pending | published | hidden"
    }
    experience_slots ||--o{ bookings : ""
    guest_profiles ||--o{ bookings : ""
    bookings ||--|{ booking_status_history : ""
    bookings ||--o{ payment_attempts : ""
    bookings ||--o| reviews : ""
```

Partial unique indexes: one *active* (pending/confirmed) booking per guest per slot; one
*succeeded* payment per booking.

## Staff and resources

```mermaid
erDiagram
    staff_assignments {
        uuid id PK
        uuid slot_id FK "CASCADE; UK with staff_id"
        uuid staff_id FK "RESTRICT"
        assignment_role role "lead | guide | support"
        assignment_status status "assigned | released"
    }
    resources {
        uuid id PK
        text name UK
        resource_kind kind
        smallint quantity_total "pooled units"
        uuid supplier_id FK "nullable; RESTRICT"
        boolean is_active
    }
    experience_resource_requirements {
        uuid experience_id PK,FK "CASCADE"
        uuid resource_id PK,FK "RESTRICT"
        requirement_basis basis "per_session | per_guest"
        smallint quantity
    }
    resource_allocations {
        uuid id PK
        uuid resource_id FK "RESTRICT"
        uuid slot_id FK "CASCADE"
        uuid booking_id FK "NULL = session-level; CASCADE"
        smallint quantity
        allocation_status status "held | released"
    }
    resource_maintenance {
        uuid id PK
        uuid resource_id FK "CASCADE"
        timestamptz starts_at
        timestamptz ends_at
        smallint quantity_out
        text reason
    }
    staff_members ||--o{ staff_assignments : ""
    experience_slots ||--o{ staff_assignments : ""
    experiences ||--o{ experience_resource_requirements : ""
    resources ||--o{ experience_resource_requirements : ""
    resources ||--o{ resource_allocations : ""
    experience_slots ||--o{ resource_allocations : ""
    bookings |o--o{ resource_allocations : ""
    resources ||--o{ resource_maintenance : ""
```

Partial unique indexes: one active *lead* per slot; one session-level hold per resource
per slot.

## Itinerary

```mermaid
erDiagram
    itinerary_plans {
        uuid id PK
        uuid guest_id FK "CASCADE"
        text name
        date arrival_date
        date departure_date ">= arrival, <= 21 nights"
    }
    itinerary_items {
        uuid id PK
        uuid plan_id FK "CASCADE; UK with slot_id"
        uuid slot_id FK "CASCADE"
        smallint party_size
        uuid booking_id FK "nullable; SET NULL"
        text note
    }
    guest_profiles ||--o{ itinerary_plans : ""
    itinerary_plans ||--o{ itinerary_items : ""
    experience_slots ||--o{ itinerary_items : ""
    bookings |o--o{ itinerary_items : ""
```

## Booking status lifecycle

Enforced by the `bookings_validate` trigger. Every status except `cancelled` holds seats
(`bookings_hold_seats`), and every change is written to `booking_status_history`.

```mermaid
stateDiagram-v2
    [*] --> pending : hold (card payment)
    [*] --> confirmed : pay at resort
    pending --> confirmed
    pending --> cancelled : guest cancels / hold expires
    confirmed --> cancelled
    confirmed --> completed
    confirmed --> no_show
    cancelled --> [*]
    completed --> [*]
    no_show --> [*]
```

## Views

| View | Purpose |
|------|---------|
| `slot_availability` | Each slot with experience, category, seats left and effective price per guest. |
| `experience_ratings` | Published review count and average rating per experience. |
