# SOLACE | ACADEMIC PRESENTATION SLIDE DECK

**Personalized Luxury, Nature & Adventure Experience Management System**  
*Third-Year Computer Engineering — Database Management Systems (DBMS) Academic Evaluation*

---

## SLIDE 1: Title & Project Overview

### **SOLACE**
#### *Personalized Luxury, Nature & Adventure Experience Management System*

- **Domain:** Database Management Systems (CS 304 / IT 304)
- **Target Application:** High-End Eco-Luxury Resort Operations
- **Technology Stack:** Python Flask | MySQL 8.0 / MariaDB 10.4 | Bootstrap 5 | Chart.js
- **Key DBMS Principles:** 3NF Normalization, ACID Transactions, Concurrency Row-Locks (`FOR UPDATE`), Database Triggers & Analytical Views
- **Academic Year:** Third Year Computer Engineering (Semester VI)

> *"Transforming traditional room-centric hospitality into an intelligent, multi-resource experience orchestration platform."*

---

## SLIDE 2: Problem Statement & Motivation

### The Dilemma with Legacy Property Management Systems (PMS)

- **Room-Centric Obsession:** Existing resort software (Opera, Fidelio) treats rooms as the sole primary entity; experiences are treated as disjointed calendar text notes.
- **Resource Over-Allocation:** Kayaks, safety gear, yacht charters, and private pavilions are booked without transactional inventory synchronization, leading to embarrassing guest double-bookings.
- **Personnel Scheduling Conflicts:** Expert naturalists, yoga instructors, and private chefs are frequently booked on overlapping activities.
- **Generic Concierge Recommendations:** No mathematical matching; guests receive generic flyers rather than data-driven recommendations tailored to budget, party size, and interests.
- **Missing Sustainability Metrics:** High-end guests demand low-impact eco-tourism, but legacy systems have zero tracking for eco-scores or local indigenous supplier support.

---

## SLIDE 3: The Six Experiential Pillars of SOLACE

```text
┌───────────────────────┬───────────────────────┬───────────────────────┐
│     1. LUXURY         │      2. NATURE        │     3. ADVENTURE      │
│  Private Dining,      │ Guided Forest Walks,  │ River Kayaking,       │
│  Sunset Charters,     │ Wetland Birdwatching, │ Mountain Biking,      │
│  Bespoke Chef Dinners │ Wildlife Observation  │ High-Ropes Obstacles  │
├───────────────────────┼───────────────────────┼───────────────────────┤
│     4. WELLNESS       │  5. LOCAL CULTURE     │  6. SUSTAINABILITY    │
│  Ayurvedic Spa,       │ Artisan Pottery,      │ Solar EV Transfers,   │
│  Hatha Yoga,          │ Heritage Trails,      │ Bamboo Cycles,        │
│  Sound Meditation     │ Culinary Masterclass  │ Organic Farm Visits   │
└───────────────────────┴───────────────────────┴───────────────────────┘
```

Every experience is modeled with explicit pricing types (`per_person` or `per_booking`), duration, party bounds, required gear, required personnel roles, and application-defined Eco-Impact Scores (1–10).

---

## SLIDE 4: Role-Based Authorization & System Actors

Three distinct roles enforced strictly on the backend via session tokens and database-backed role IDs:

1. **The Guest:**
   - Registers/Logs in, sets normalized preference weights (1–5).
   - Receives mathematically ranked recommendations.
   - Plans multi-day stay itineraries avoiding time-slot collisions.
   - Books slots transactionally with simulated payment checkout.
   - Submits verified reviews post-completion.

2. **Resort Administrator:**
   - Full master catalogue CRUD (experiences, categories, suppliers).
   - Resource inventory management & maintenance tracking.
   - Staff scheduling and role requirements.
   - Financial summaries, utilization graphs, eco-reports, and audit log inspection.

3. **Staff & Local Guides:**
   - Dedicated daily roster dashboard.
   - Real-time guest headcounts and equipment manifests.
   - Session completion marking (`status = 'Completed'`).
   - Operational equipment defect and maintenance reporting.

---

## SLIDE 5: Multi-Tier System Architecture

```text
┌───────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (Frontend)                     │
│  • Responsive Bootstrap 5.3 Framework & Mobile Viewport Support       │
│  • Luxury Theme Tokens: Forest Green, Champagne Gold, Warm Ivory     │
│  • Dynamic Chart.js 4.4 Visualizations for Admin Analytics            │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ (HTTP / JSON / HTML)
┌───────────────────────────────────▼───────────────────────────────────┐
│                   APPLICATION LOGIC LAYER (Python Flask)              │
│  • Flask Blueprints (Auth, Guest, Catalogue, Booking, Admin, Staff)   │
│  • Recommendation Engine (5-Factor Weighted Multi-Criteria Scoring)   │
│  • Availability & Concurrency Service (Atomic Reservation Engine)     │
│  • Itinerary Planner (Range-Overlap Collision Detection)              │
│  • Security: Werkzeug Scrypt Password Hashing, CSRF & SQL Injection Guard │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ (PyMySQL Connection Factory)
┌───────────────────────────────────▼───────────────────────────────────┐
│                     DATA PERSISTENCE LAYER (MySQL)                    │
│  • 23 Normalized Tables targeting Third Normal Form (3NF)             │
│  • Pessimistic Row-Level Locking (SELECT ... FOR UPDATE)             │
│  • Automated DDL Triggers & Dynamic SQL Views                         │
│  • Explicit Foreign Key Referential Actions (ON DELETE RESTRICT)      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## SLIDE 6: Relational Schema & 3NF Normalization

The schema comprises **23 relational tables** systematically organized to eliminate insertion, update, and deletion anomalies:

- **1NF Compliance:** Atomic columns throughout; zero comma-separated values (interests split into `interests` and `guest_preferences` junction table).
- **2NF Compliance:** Elimination of partial dependencies; all non-prime attributes in composite-key tables depend on the entire primary key.
- **3NF Compliance:** Zero transitive functional dependencies ($X \rightarrow Y \rightarrow Z$).
  - Catalogue price changes do not rewrite historical bookings: `unit_price_at_booking` is explicitly captured at transaction time to preserve point-in-time financial truth.
  - Category descriptions and supplier metadata reside in their own parent entities.

---

## SLIDE 7: Entity-Relationship (ER) Architecture

- **Core Master Entities:** `users`, `guests`, `staff`, `suppliers`, `experiences`, `resources`
- **Junction & Associative Entities:**
  - `guest_preferences`: Bridges `guests` $\leftrightarrow$ `interests` with preference `weight`.
  - `experience_resources`: Bridges `experiences` $\leftrightarrow$ `resources` with `quantity_required`.
  - `experience_staff_requirements`: Bridges `experiences` $\leftrightarrow$ required staff roles.
  - `resource_allocations`: Tracks physical inventory bound to specific booking slots.
- **Transaction & Feedback Entities:** `bookings`, `booking_status_history`, `payments`, `reviews`, `audit_logs`

*(Full vector ER diagram generated in [docs/diagrams/er_diagram.svg](file:///c:/Users/Merissa/OneDrive/Desktop/college/DBMS/New%20folder/docs/diagrams/er_diagram.svg))*

---

## SLIDE 8: Data Flow Architecture (DFD Levels 0 & 1)

- **DFD Level 0 (Context Diagram):** Depicts SOLACE as an integrated operational core exchanging preferences, schedules, payments, and manifests across Guests, Administrators, Staff, and Payment Simulators.
- **DFD Level 1 (Process Decomposition):** Decomposes transactions into seven decoupled processes:
  - `1.0` Guest Profile & Weight Management
  - `2.0` Algorithmic Discovery & Matching
  - `3.0` Multi-Resource Availability Verification
  - `4.0` Concurrency-Safe Transactional Booking
  - `5.0` Payment Gateway Simulation & Escrow
  - `6.0` Inventory & Staff Allocation
  - `7.0` Post-Experience Reviews & Admin Analytics

*(Vector diagrams: [docs/diagrams/dfd_level0.svg](file:///c:/Users/Merissa/OneDrive/Desktop/college/DBMS/New%20folder/docs/diagrams/dfd_level0.svg) and [dfd_level1.svg](file:///c:/Users/Merissa/OneDrive/Desktop/college/DBMS/New%20folder/docs/diagrams/dfd_level1.svg))*

---

## SLIDE 9: The 5-Factor Weighted Recommendation Algorithm

The matching algorithm ranks candidate experiences using configurable multi-criteria decision weights:

$$\text{Final Score} = 0.40 S_{interest} + 0.25 S_{budget} + 0.15 S_{schedule} + 0.10 S_{sustainability} + 0.10 S_{rating}$$

### Scoring Formulation:
1. **Interest Match ($40\%$):** Evaluates cosine/ratio similarity of guest's 1–5 preference weights against tagged experience interests.
2. **Budget Suitability ($25\%$):** Normalizes candidate total price against guest's activity budget ($1.0 - \min(1.0, \frac{\text{Price}}{\text{Budget}})$). Rewards affordability without penalizing high budgets.
3. **Schedule Fit ($15\%$):** Checks alignment between slot times (Morning/Afternoon/Evening) and guest's preferred daily window.
4. **Sustainability ($10\%$):** Normalizes Eco-Impact Score ($\frac{\text{Eco Score}}{10.0}$).
5. **Rating Quality ($10\%$):** Normalizes verified aggregate guest ratings ($\frac{\text{Rating}}{5.0}$).

*Strict Hard Constraint Guard:* Zero recommendations bypass capacity limits, date bounds, or budget overages, regardless of match score!

---

## SLIDE 10: Multi-Day Dynamic Itinerary Planner

Guests can orchestrate complete resort stays with real-time collision detection:

```text
Day 1 (2026-11-01):
  [Morning 07:00-09:30]   Guided Wetland Birdwatching    ── ₹1,800  [Booked]
  [Afternoon 14:00-16:00] Ayurvedic Rejuvenation Spa     ── ₹4,500  [Planned]
  [Evening 19:00-21:30]   Private Starlight Dining       ── ₹8,500  [Planned]

Day 2 (2026-11-02):
  [Morning 08:30-11:30]   River Kayaking Expedition      ── ₹3,200  [Planned]
  [Afternoon 15:00-17:00] Indigenous Pottery Workshop    ── ₹1,200  [Planned]
```

- **Collision Guard:** Temporal overlap query prevents booking conflicting sessions:
  $$\text{Overlap} \iff (\text{Start}_A < \text{End}_B) \land (\text{End}_A > \text{Start}_B)$$
- **Cumulative Budget Ceiling:** Real-time tracking against guest's total budget threshold.

---

## SLIDE 11: Concurrency Control & Database Locking

### How SOLACE Prevents Double-Booking Under High Concurrency

In a traditional web application, checking availability via `SELECT` followed by `INSERT` leaves a vulnerability window (Race Condition / Phantom Read).

**SOLACE's Database Transaction Strategy:**
1. Open atomic transaction: `BEGIN WORK`.
2. Query slot row using **Pessimistic Row-Level Lock**:
   ```sql
   SELECT booked_count, max_capacity 
   FROM experience_slots 
   WHERE id = :slot_id 
   FOR UPDATE;
   ```
3. Lock corresponding physical equipment rows in `resources` table:
   ```sql
   SELECT available_quantity 
   FROM resources 
   WHERE id = :res_id 
   FOR UPDATE;
   ```
4. Verify remaining capacity: `IF booked_count + party_size > max_capacity` $\rightarrow$ `ROLLBACK & ABORT`.
5. Atomic update: Deduct inventory, increment `booked_count`, insert `bookings` and `resource_allocations`.
6. Issue `COMMIT` upon simulated payment success; automatic `ROLLBACK` on payment abort.

---

## SLIDE 12: Booking State Machine & Transaction Lifecycle

```text
       ┌───────────────┐
       │   Initiated   │
       └───────┬───────┘
               │ Capacity & Inventory Verified (Pessimistic Lock)
               ▼
       ┌───────────────┐
       │    Pending    │
       └───────┬───────┘
               ├── Payment Success ─────────► [ Confirmed ]
               │                                    │
               │                                    ├── 12h Before Slot ──► [ Cancelled ]
               │                                    │                       (Resources Released,
               │                                    │                        Full Refund Logged)
               │                                    │
               │                                    └── Session Done ─────► [ Completed ]
               │                                                            (Verified Review Unlocked)
               │
               └── Payment Failed / Expired ─► [ Failed ]
                                               (Locks Released Instantly)
```

*(Full vector diagram: [docs/diagrams/state_transition.svg](file:///c:/Users/Merissa/OneDrive/Desktop/college/DBMS/New%20folder/docs/diagrams/state_transition.svg))*

---

## SLIDE 13: Sustainability & Community Supplier Integration

- **Eco-Impact Score (1–100):** Every activity is categorized by ecological impact (e.g., Solar EV Scenic Drive: 99/100; Mountain Biking: 94/100).
- **Local Indigenous Suppliers:** Dedicated schema tracking community partners:
  - *Sahyadri Pottery Collective* (Tribal handicraft workshops)
  - *Malabar Organic Spices & Farm* (Cooking masterclasses)
  - *EcoMobility Kerala Fleet* (EV transfers)
- **Administrative Eco-KPI Dashboard:**
  - Percentage of resort bookings classified as low-impact.
  - Total resort expenditure channeled directly into indigenous community partners.
  - Zero-emission transport reservation ratios.

---

## SLIDE 14: Administrative Analytics & Visualizations

Dynamic visual dashboard powered by **Chart.js** connecting directly to SQL aggregate views:

1. **Monthly Revenue Trajectory:** Time-series line chart tracking completed transaction volume in INR (₹).
2. **Booking Status Distribution:** Doughnut chart representing live ratio of Confirmed, Completed, Cancelled, and Pending slots.
3. **Equipment Utilization Heatmap:** Bar chart comparing allocated inventory vs available physical assets (preventing maintenance bottlenecks).
4. **Sustainability Share:** Doughnut breakdown of low-impact vs conventional experiences.
5. **Staff Allocation Roster:** Operational table indicating active assignments per guide.

---

## SLIDE 15: DBMS Query Demonstrations (Evaluation Highlights)

The system includes ten dedicated complex SQL demonstration queries:

- **Complex Joins & Aggregations:** Multi-table joins across 5 tables with `GROUP BY`, `HAVING`, and nested subqueries.
- **Dynamic Analytical Views:**
  - `vw_active_experience_catalogue`: Live catalogue with rating aggregates.
  - `vw_slot_realtime_availability`: Computes real-time open capacity.
- **Database Triggers:**
  - `trg_after_booking_insert`: Auto-increments `booked_count` and toggles `'Full'` status.
  - `trg_after_booking_cancel`: Decrements `booked_count` and restores slot status to `'Open'`.
- **Integrity Constraints:** Composite primary keys, strict `CHECK` constraints on ratings (1–5) and weights (1–5), and `UNIQUE` constraints preventing duplicate reviews per booking.

---

## SLIDE 16: Verification & Test Suite Results

An automated integration test suite (`tests/test_suite.py`) was developed and executed:

| Test ID | Objective | Tested Boundary | Result |
| :---: | :--- | :--- | :---: |
| `TC-01` | Registration & Email Uniqueness | Duplicate email rejection | **PASS** |
| `TC-02` | Authentication & RBAC Session | Invalid password & role enforcement | **PASS** |
| `TC-03` | Normalized Preference Storage | Junction table weight insertion | **PASS** |
| `TC-04` | Catalogue Search & Filtering | Category & active record retrieval | **PASS** |
| `TC-05` | 5-Factor Weighted Recommendation | Mathematical scoring & explanation | **PASS** |
| `TC-06` | Concurrency & Capacity Limits | Rejecting bookings exceeding capacity | **PASS** |
| `TC-07` | Transactional Booking Generation | Atomic insert & reference generation | **PASS** |
| `TC-08` | Payment Simulation & Confirmation | Successful transition to 'Confirmed' | **PASS** |
| `TC-09` | Payment Failure & Rollback | Compensating rollback on abort | **PASS** |
| `TC-10` | 12-Hour Cancellation Rule | Capacity restore & refund creation | **PASS** |
| `TC-11` | Verified Review Integrity | Block unverified & duplicate reviews | **PASS** |

**Final Execution Outcome:** `Ran 59 tests — OK` (isolated `solace_test_db`; see docs/test_plan_and_results.md)

---

## SLIDE 17: Live Demonstration Walkthrough

### Recommended Demonstration Sequence:
1. **Step 1: Guest Persona (`priya.sharma@example.com` / `Guest@123`)**
   - Access Profile $\rightarrow$ Adjust preference weights (Luxury: 5, Nature: 4, Eco: 5).
   - View **Recommendations Page**: Observe personalized scores & natural language rationale.
   - Access **Itinerary Planner**: Schedule multi-day activities, observe cumulative budget calculation.
   - Complete Booking $\rightarrow$ Run Simulated Payment Gateway $\rightarrow$ Download confirmed booking voucher.
2. **Step 2: Staff Persona (`aarav.naturalist@solace.com` / `Staff@123`)**
   - Inspect daily roster $\rightarrow$ Mark session as completed $\rightarrow$ Report equipment defect.
3. **Step 3: Administrator Persona (`admin@solace.com` / `Admin@123`)**
   - Review live Chart.js KPI graphs $\rightarrow$ Check Equipment Utilization $\rightarrow$ Inspect Audit Logs.

---

## SLIDE 18: Honest Limitations & Technical Disclosures

In accordance with academic rigor, the current implementation acknowledges the following design boundaries:

- **Simulated Payment Gateway:** While financial state changes and compensating rollbacks are fully functional, payment transactions are executed via an internal sandbox rather than external merchant banking webhooks.
- **Single-Node MySQL Architecture:** The project relies on a single relational database instance; enterprise deployments would introduce read replicas and Redis caching for ultra-low latency availability checks.
- **Static Daily Slot Templates:** Time slots are generated based on standardized recurring templates rather than dynamic calendar schedulers that shift according to seasonal daylight hours.

---

## SLIDE 19: Future Roadmap & Enhancements

1. **AI Natural Language Assistant:** LLM-powered conversational concierge allowing guests to state: *"Plan a 2-day romantic weekend under ₹25,000 focusing on organic food and quiet sunsets"*.
2. **Collaborative Filtering:** Transitioning from content-based weighted attribute scoring to hybrid collaborative filtering as resort guest history scales.
3. **IoT Smart Villa Integration:** Digital room key synchronization that automatically unlocks bicycle docks and EV charging stations for confirmed booking holders.
4. **Multi-Property Chain Scaling:** Extending the schema with a `resorts` master table to support global luxury hotel chains.

---

## SLIDE 20: Conclusion & Acknowledgments

### Summary of Accomplishments:
- Fully operational, database-driven luxury resort experience management system.
- Complete 23-table relational schema normalized to **Third Normal Form (3NF)**.
- Robust concurrency management via pessimistic row locking (`SELECT ... FOR UPDATE`).
- Mathematical 5-factor personalized recommendation algorithm.
- Intuitive, modern luxury interface honoring brand aesthetics and usability standards.
- 100% verified test coverage across all core operational workflows.

**Thank You!**  
*Questions & Discussion Welcome.*
