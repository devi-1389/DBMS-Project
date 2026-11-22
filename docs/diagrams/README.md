# SOLACE | Database Systems Diagrammatic Specifications
**Course:** Third-Year Computer Engineering DBMS Academic Project  
**System:** SOLACE Personalized Luxury, Nature & Adventure Experience Management System

This directory contains standalone high-resolution SVG vector diagrams along with the complete editable Mermaid and text definitions for all required system models.

> **Update (Oct 2026):** `er_diagram.svg`, `relational_schema.svg`, `dfd_level0.svg` and `dfd_level1.svg` (plus PNG copies in `png/`) were re-exported from the running application's Database Explorer, which builds them from the live MySQL schema. The earlier versions showed only 12 of the 23 tables and contained a non-existent column (`preferred_tod`). The remaining UML diagrams (use case, sequence, activity, state, architecture) are conceptual and were not regenerated.

---

## 1. Directory of SVG Diagrams

| Diagram Name | File Link | Focus & Coverage |
| :--- | :--- | :--- |
| **A. Entity-Relationship (ER) Diagram** | [er_diagram.svg](er_diagram.svg) | 23 3NF normalized entities, attributes, PK/FK constraints, cardinality |
| **B. Data Flow Diagram Level 0** | [dfd_level0.svg](dfd_level0.svg) | Context-level external entities: Guest, Administrator, Staff, Payment Simulator |
| **C. Data Flow Diagram Level 1** | [dfd_level1.svg](dfd_level1.svg) | 7 sub-processes and 6 core relational data stores (D1 - D6) |
| **D. Unified Use-Case Model** | [use_case_diagram.svg](use_case_diagram.svg) | 16 system use cases partitioned across Guest, Admin, Staff & Simulator actors |
| **E1. Sequence: Recommendation Flow** | [sequence_recommendation.svg](sequence_recommendation.svg) | 5-factor weighted scoring, date filtering, and explanation generation |
| **E2. Sequence: Concurrency Booking** | [sequence_booking.svg](sequence_booking.svg) | Concurrency-safe slot locking (`FOR UPDATE`), gear reservation, payment settlement |
| **E3. Sequence: Payment Fail Rollback** | [sequence_payment_fail.svg](sequence_payment_fail.svg) | Payment decline compensation, transaction rollback without orphan allocations |
| **E4. Sequence: Cancellation & Release**| [sequence_cancellation.svg](sequence_cancellation.svg) | Cancellation deadline validation, capacity restoration, full refund calculation |
| **F. Activity Workflow Diagram** | [activity_diagram.svg](activity_diagram.svg) | End-to-end journey with decision diamonds for capacity, payment, and conflicts |
| **G. Relational Schema Architecture** | [relational_schema.svg](relational_schema.svg) | Complete physical schema topology showing table structures and relationships |
| **H. Booking State-Transition Model**| [state_transition.svg](state_transition.svg) | Finite State Machine (FSM): PENDING -> CONFIRMED -> COMPLETED / CANCELLED / FAILED |
| **I. 3-Tier System Architecture** | [system_architecture.svg](system_architecture.svg) | Presentation (Bootstrap/CSS/Chart.js), Logic (Flask Services), Data (MySQL 3NF) |

---

## 2. Editable Mermaid Source Definitions

### A. Entity-Relationship (ER) Diagram
Generated from `information_schema` of the live database (all 23 tables, 33 foreign keys). The same model is rendered interactively at `/dbms/er-diagram`.
```mermaid
erDiagram
    audit_logs {
        int log_id PK
        int user_id FK
        varchar action_type
        varchar entity_name
        int entity_id
        json old_values
        json new_values
        varchar ip_address
        datetime created_at
    }
    booking_status_history {
        int history_id PK
        int booking_id FK
        varchar from_status
        varchar to_status
        int changed_by_user_id FK
        text notes
        datetime changed_at
    }
    bookings {
        int booking_id PK
        varchar booking_reference UK
        int guest_id FK
        int experience_id FK
        int slot_id FK
        date booking_date
        int party_size
        decimal unit_price
        decimal total_amount
        text special_requests
        enum booking_status
        datetime cancellation_deadline
        text cancellation_reason
        decimal refund_amount
        datetime created_at
        datetime updated_at
    }
    experience_categories {
        int category_id PK
        varchar name UK
        varchar slug UK
        text description
        varchar icon
        int display_order
    }
    experience_resources {
        int exp_resource_id PK
        int experience_id FK
        int resource_id FK
        int quantity_required
        enum calculation_type
    }
    experience_slots {
        int slot_id PK
        int experience_id FK
        date slot_date
        time start_time
        time end_time
        int max_capacity
        int booked_capacity
        enum slot_status
        datetime created_at
        datetime updated_at
    }
    experience_staff_requirements {
        int req_id PK
        int experience_id FK
        varchar role_needed
        int quantity_required
    }
    experiences {
        int experience_id PK
        int category_id FK
        int supplier_id FK
        varchar name
        varchar slug UK
        varchar short_desc
        text full_desc
        enum pricing_type
        decimal base_price
        int duration_minutes
        int min_party_size
        int max_party_size
        int capacity_per_slot
        text safety_instructions
        varchar age_restrictions
        text accessibility_info
        int eco_impact_score
        tinyint is_low_impact
        varchar image_url
        tinyint is_active
        datetime created_at
        datetime updated_at
    }
    guest_preferences {
        int preference_id PK
        int guest_id FK
        int interest_id FK
        int weight
        datetime created_at
        datetime updated_at
    }
    guests {
        int guest_id PK, FK
        int party_size
        decimal budget
        date check_in_date
        date check_out_date
        enum preferred_time_of_day
        text accessibility_notes
        enum sustainability_priority
        datetime created_at
        datetime updated_at
    }
    interests {
        int interest_id PK
        varchar name UK
        varchar code UK
        varchar category_tag
        varchar icon
        text description
    }
    itineraries {
        int itinerary_id PK
        int guest_id FK
        varchar title
        date start_date
        date end_date
        decimal total_budget
        decimal estimated_cost
        enum status
        datetime created_at
    }
    itinerary_items {
        int item_id PK
        int itinerary_id FK
        int experience_id FK
        int slot_id FK
        int day_number
        enum time_block
        decimal estimated_cost
        text notes
        datetime created_at
    }
    maintenance_periods {
        int maintenance_id PK
        int resource_id FK
        datetime start_datetime
        datetime end_datetime
        text reason
        enum status
        datetime logged_at
    }
    payments {
        int payment_id PK
        int booking_id FK
        varchar transaction_reference UK
        enum payment_method
        decimal amount
        enum payment_status
        text simulated_gateway_response
        datetime paid_at
    }
    resource_allocations {
        int allocation_id PK
        int booking_id FK
        int resource_id FK
        int slot_id FK
        int quantity_allocated
        enum allocation_status
        datetime allocated_at
    }
    resources {
        int resource_id PK
        int supplier_id FK
        varchar name
        enum resource_type
        int total_quantity
        enum condition_status
        tinyint is_sustainable
        text eco_notes
        datetime created_at
    }
    reviews {
        int review_id PK
        int booking_id FK, UK
        int guest_id FK
        int experience_id FK
        int rating
        varchar review_title
        text review_text
        tinyint is_approved
        datetime created_at
    }
    roles {
        int role_id PK
        varchar name UK
        text description
        datetime created_at
    }
    staff {
        int staff_id PK
        int user_id FK, UK
        varchar specialization
        varchar contact_phone
        text bio
        tinyint is_available
        tinyint is_active
    }
    staff_assignments {
        int assignment_id PK
        int booking_id FK
        int staff_id FK
        int slot_id FK
        enum assignment_status
        datetime assigned_at
    }
    suppliers {
        int supplier_id PK
        varchar name
        varchar contact_person
        varchar email
        varchar phone
        text address
        varchar supplier_type
        tinyint is_local
        text products_services
        tinyint is_active
        datetime created_at
    }
    users {
        int user_id PK
        int role_id FK
        varchar full_name
        varchar email UK
        varchar phone
        varchar password_hash
        tinyint is_active
        datetime created_at
        datetime updated_at
    }
    users |o..o{ audit_logs : "user_id"
    users |o..o{ booking_status_history : "changed_by_user_id"
    bookings ||..o{ booking_status_history : "booking_id"
    experiences ||..o{ bookings : "experience_id"
    experience_slots ||..o{ bookings : "slot_id"
    guests ||..o{ bookings : "guest_id"
    experiences ||..o{ experience_resources : "experience_id"
    resources ||..o{ experience_resources : "resource_id"
    experiences ||..o{ experience_slots : "experience_id"
    experiences ||..o{ experience_staff_requirements : "experience_id"
    experience_categories ||..o{ experiences : "category_id"
    suppliers |o..o{ experiences : "supplier_id"
    guests ||..o{ guest_preferences : "guest_id"
    interests ||..o{ guest_preferences : "interest_id"
    users ||--o| guests : "guest_id"
    guests ||..o{ itineraries : "guest_id"
    experience_slots |o..o{ itinerary_items : "slot_id"
    itineraries ||..o{ itinerary_items : "itinerary_id"
    experiences ||..o{ itinerary_items : "experience_id"
    resources ||..o{ maintenance_periods : "resource_id"
    bookings ||..o{ payments : "booking_id"
    bookings ||..o{ resource_allocations : "booking_id"
    resources ||..o{ resource_allocations : "resource_id"
    experience_slots ||..o{ resource_allocations : "slot_id"
    suppliers |o..o{ resources : "supplier_id"
    bookings ||..o| reviews : "booking_id"
    experiences ||..o{ reviews : "experience_id"
    guests ||..o{ reviews : "guest_id"
    users ||..o| staff : "user_id"
    bookings |o..o{ staff_assignments : "booking_id"
    experience_slots ||..o{ staff_assignments : "slot_id"
    staff ||..o{ staff_assignments : "staff_id"
    roles ||..o{ users : "role_id"
```

### B. Booking Lifecycle State-Transition Model
```mermaid
stateDiagram-v2
    [*] --> PENDING: Initiate Booking (Capacity Checked)
    PENDING --> CONFIRMED: Payment Approved (Resources Locked)
    PENDING --> FAILED: Payment Declined / Timeout
    FAILED --> PENDING: Retry with Alternate Method
    CONFIRMED --> COMPLETED: Staff Marks Session Completed
    CONFIRMED --> CANCELLED: Guest Cancels (NOW <= Deadline)
    CANCELLED --> [*]: Capacity Released & Refund Processed
    COMPLETED --> [*]: Verified Review Unlocked
    FAILED --> [*]: Orphan Holds Rolled Back
```

### C. Use-Case Model
```mermaid
graph LR
    subgraph Actors
        G[Guest]
        A[Administrator]
        S[Staff / Guide]
        P[Payment Simulator]
    end

    subgraph SOLACE Platform
        UC1(Register & Profile)
        UC2(Calibrate Preferences)
        UC3(Recommendation Engine)
        UC4(Multi-Day Itinerary)
        UC5(Transactional Booking)
        UC6(Simulate Payment)
        UC7(Cancel & Refund)
        UC8(Submit Review)
        UC9(Catalogue CRUD)
        UC10(Schedules & Slots)
        UC11(Resource & Staff Allocations)
        UC12(SQL Reports & Analytics)
        UC13(Mark Session Completed)
        UC14(Report Equipment Issue)
    end

    G --> UC1
    G --> UC2
    G --> UC3
    G --> UC4
    G --> UC5
    G --> UC7
    G --> UC8
    UC5 --> UC6
    UC6 --> P

    A --> UC9
    A --> UC10
    A --> UC11
    A --> UC12

    S --> UC10
    S --> UC13
    S --> UC14
```
