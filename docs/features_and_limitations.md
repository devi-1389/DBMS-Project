# SOLACE | IMPLEMENTED FEATURES & SYSTEM LIMITATIONS AUDIT

**Personalized Luxury, Nature & Adventure Experience Management System**  
*Third-Year Computer Engineering DBMS Academic Evaluation Deliverable*

---

## 1. Executive Implementation Status

SOLACE has been developed, tested, and verified as a complete, fully functional, database-driven web application. The platform satisfies all core requirements outlined in the project specification, operating over an authentic MySQL relational database without reliance on mock data substitutes.

---

## 2. Comprehensive Inventory of Implemented Features

### Module 1: Guest Profile & Preference Management
- [x] **Secure User Authentication:** Self-registration and login with Werkzeug `scrypt` cryptographic password hashing.
- [x] **Normalized Preference Weights:** Dynamic assignment of interest weights (1 to 5) across six categories (Luxury, Nature, Adventure, Wellness, Culture, Sustainability) stored in the normalized `guest_preferences` junction table.
- [x] **Profile Parameters:** Capture of guest party size, preferred total budget ceiling, check-in and check-out dates, preferred activity time window (Morning, Afternoon, Evening), and accessibility accommodations.
- [x] **Integrity & Bounds Validation:** Server-side validation of email uniqueness, positive party sizes ($>0$), valid date ranges ($\text{check-in} < \text{check-out}$), and positive budget values.

### Module 2: Experience Catalogue & Categorization
- [x] **Six Resort Pillars:** Richly modeled experiences across Luxury, Nature & Eco-Tourism, Adventure, Wellness, Local Culture & Cuisine, and Sustainable Mobility.
- [x] **Multi-Dimensional Catalogue Modeling:** Each experience carries explicit base pricing, pricing type (`per_person` or `per_booking`), minimum and maximum party bounds, duration, required equipment, required staff roles, eco-impact scores (1–10), and local supplier tags.
- [x] **Catalogue Discovery:** Real-time search, category filtering, and multi-parameter sorting (Price: Low to High, Price: High to Low, Rating: High to Low, Eco-Impact Score, Duration).
- [x] **Detailed Experience Presentation:** Dedicated detail pages showcasing description, safety guidelines, age/accessibility notes, required gear, eco-impact badges, and community supplier affiliations.

### Module 3: Personalized Experience Matching
- [x] **Two-Phase Matching Engine:**
  - *Hard Constraint Filtering:* Automatically excludes inactive records, slots exceeding guest budget ceilings, slots outside stay dates, and experiences incompatible with party size bounds.
  - *Mathematical Multi-Criteria Scoring:* Configurable weighted scoring combining Interest Match (40%), Budget Suitability (25%), Schedule Fit (15%), Sustainability Score (10%), and Verified Rating (10%).
- [x] **Non-Penalizing Budget Formulation:** Rewards affordable experiences without penalizing guests with larger budgets.
- [x] **Explainable Recommendations:** Dynamically generates natural-language explanations justifying why each experience was recommended.

### Module 4: Multi-Day Dynamic Itinerary Planner
- [x] **Stay Calendar Mapping:** Automatically constructs a day-by-day itinerary grid matching the guest's check-in and check-out duration.
- [x] **Temporal Collision Prevention:** Detects overlapping time windows across scheduled experiences to prevent physical scheduling conflicts.
- [x] **Live Expenditure Monitoring:** Tracks cumulative planned expenditure against the guest's allocated budget ceiling with visual progress bars.
- [x] **Interactive Itinerary Actions:** One-click addition of recommended activities, item removal, and direct checkout initiation.

### Module 5: Scheduling, Availability & Concurrency Control
- [x] **Slot Management:** Granular modeling of daily time slots with start times, end times, maximum participant capacities, and real-time booked counts.
- [x] **Pessimistic Concurrency Locks:** Implements `SELECT ... FOR UPDATE` database row locks during checkout to prevent race conditions and over-allocation under concurrent booking requests.
- [x] **Multi-Resource Availability:** Real-time joint validation of participant capacity, physical equipment inventories (e.g., kayaks, life jackets, helmets), and qualified staff availability.

### Module 6: Resource & Equipment Management
- [x] **Asset Inventory Master:** Comprehensive tracking of resort assets (kayaks, safety helmets, bicycles, EV buggies, spa rooms, dining venues) with condition states and maintenance availability.
- [x] **Dynamic Experience-Resource Mapping:** Configurable allocation rules defining whether resources are reserved `per_booking` (e.g., 1 private dining deck) or `per_participant` (e.g., 1 kayak + 1 life jacket per guest).
- [x] **Atomic Allocation & Release:** Automatic deduction of available quantities upon booking and instant restoration upon cancellation or payment rollback.
- [x] **Maintenance & Defect Tracking:** Staff and administrative flagging of damaged equipment to temporarily reduce available rental inventory.

### Module 7: Staff & Supplier Management
- [x] **Staff Roster & Specializations:** Staff directory capturing roles (e.g., Senior Naturalist, Wilderness Guide, Ayurvedic Therapist, Executive Chef) and current availability status.
- [x] **Experience Staff Requirements:** Configurable rules mapping required guide roles to activities.
- [x] **Local Community Suppliers:** Structured directory of local tribal artisan collectives, organic spice farms, and eco-transport operators.
- [x] **Community Revenue Reporting:** Administrative metric quantifying the proportion of resort experiences supporting local enterprises.

### Module 8: Booking Management & Lifecycle
- [x] **Deterministic State Machine:** Full lifecycle support across `Initiated`, `Pending`, `Confirmed`, `Cancelled`, `Completed`, and `Failed`.
- [x] **Unique Booking References:** Generation of alphanumeric booking references (e.g., `BK-20261030-A1B2C3D4`).
- [x] **Configurable Cancellation Policy:** Strict enforcement of a 12-hour cancellation buffer prior to slot start times. Valid cancellations automatically release reserved capacity and issue refund records.
- [x] **Digital Booking Vouchers:** Formatted confirmation vouchers with activity details, meeting points, party manifests, and financial breakdowns.

### Module 9: Payment Gateway Simulation
- [x] **Multi-Method Payment Sandbox:** Supports simulated transactions via Credit/Debit Cards, UPI / Instant QR, and Room Folio Billing.
- [x] **Two-Phase Settlement:** Reservations remain in temporary hold until payment simulation succeeds; failed or aborted payments immediately trigger compensating rollbacks.
- [x] **Zero Card Storage:** Strict compliance with security standards—no card numbers, CVVs, or banking credentials are saved in the database.
- [x] **Refund Logging:** Explicit recording of refund references and amounts upon eligible booking cancellation.

### Module 10: Feedback & Verified Ratings
- [x] **Verified Guest Review Guard:** Reviews can strictly be submitted only by authenticated guests for completed bookings (`booking_status = 'Completed'`).
- [x] **Duplicate Review Prevention:** Database `UNIQUE(booking_id)` constraint guarantees that only one review can be submitted per booking.
- [x] **Real-Time Average Calculation:** Instant recalculation and display of average star ratings (1–5) and review counts in the catalogue.

### Module 11: Sustainability & Eco-Impact Management
- [x] **Application-Defined Eco-Scores:** Objective 1–10 scoring based on energy consumption, environmental footprint, and resource reuse.
- [x] **Green Transport Integration:** Dedicated booking and tracking of zero-emission mobility assets (bamboo bicycles and solar electric buggies).
- [x] **Administrator Eco-Reports:** Visual aggregation of eco-friendly bookings and percentage revenue retained by indigenous community partners.

### Module 12: Role-Based Dashboards & Analytics
- [x] **Guest Dashboard:** Personalized greeting, saved preferences summary, top 3 recommendations, upcoming confirmed activities, and multi-day itinerary.
- [x] **Staff Dashboard:** Daily operational roster, attendee headcounts, one-click session completion toggles, and equipment defect logging.
- [x] **Administrator Master Console:** Chart.js visualizations for revenue trends, booking status distribution, equipment utilization heatmaps, staff schedules, and audit log inspection.

---

## 3. Database Engineering Highlights

- **23 Normalized Tables:** Achieving Third Normal Form (3NF) with zero repeating groups and zero transitive functional dependencies.
- **Relational Integrity:** Foreign keys with explicit `ON DELETE RESTRICT` actions to safeguard financial and historical audit integrity.
- **Database Triggers:**
  - `trg_after_booking_insert`: Auto-increments slot participant count and marks full capacity.
  - `trg_after_booking_cancel`: Decrements participant count and reopens availability.
- **Dynamic Analytical Views:**
  - `vw_active_experience_catalogue`: Live experience master with calculated rating statistics.
  - `vw_slot_realtime_availability`: Real-time remaining participant capacity.
  - `vw_sustainability_metrics`: Summary of eco-scores and local supplier involvement.
- **Administrative Audit Logging:** Automated recording of table mutations, action types (`CREATE`, `UPDATE`, `CANCEL`), user IDs, and JSON state diffs.

---

## 4. Known Technical Limitations & Honest Disclosures

In accordance with academic rigor, the following design boundaries and constraints are documented:

### 1. Simulated Payment Gateway
- **Status:** Fully functional simulation.
- **Disclosure:** Payments are processed via an internal academic sandbox rather than live production webhooks (e.g., Stripe, Razorpay, or PayPal). This ensures the application can be evaluated offline in any university laboratory without requiring external merchant API keys or active internet access.

### 2. Concurrency Scope (Single-Database Instance)
- **Status:** Production-grade row locking (`SELECT ... FOR UPDATE`) implemented on MySQL InnoDB.
- **Disclosure:** Concurrency control operates at the relational database level. In a multi-node distributed enterprise cluster serving millions of requests per second, a distributed cache layer (such as Redis with Redlock) would be added to throttle availability checks before querying the relational storage layer.

### 3. Fixed-Time Slot Generation
- **Status:** Administrators bulk-generate daily slots for any date range (up to 90 days per run) with the stored procedure `sp_generate_slots`; individual slots can be edited, locked, cancelled or deleted.
- **Disclosure:** Generated slots use a fixed start/end time per run rather than a calendar that shifts with seasonal sunrise/sunset. Seed data covers the 14 days after the database is initialised.

### 4. Single Resort Property Scope
- **Status:** Dedicated single-resort property management.
- **Disclosure:** The database schema is optimized for a standalone luxury resort property. Managing multi-property international chains would necessitate an additional `resorts` hierarchy table with property-level scoping on all experiences and resources.

### 5. Illustrated (not photographic) default imagery
- **Status:** Every experience ships with a locally bundled, subject-specific SVG illustration with category fallbacks; administrators can upload real photographs per experience.
- **Disclosure:** Stock photographs were not bundled because they could not be downloaded or verified in the build environment.

### 6. Local Timezone Assumption
- **Status:** Indian Standard Time (IST / UTC+05:30).
- **Disclosure:** The application formats and interprets all slot start and end timestamps in the resort's configured local timezone rather than dynamic per-guest browser timezone conversions.

---

## 5. Future Roadmap & Enhancement Opportunities

1. **AI Concierge & Natural Language Querying:** Integrating an LLM assistant capable of translating conversational guest prompts (e.g., *"Find me quiet outdoor activities for a couple under ₹10,000"*) directly into SQL query parameters.
2. **Dynamic Yield Management & Pricing:** Implementing an automated pricing algorithm that adjusts experience rates dynamically based on seasonal demand, weather forecasts, and remaining slot capacity.
3. **IoT Smart Key & Access Synchronization:** Linking confirmed reservations directly with digital villa locks, allowing guests to unlock rented bicycles or private cabanas using RFID or smartphone NFC tokens.
4. **Hybrid Collaborative Filtering:** Evolving the recommendation engine to combine content-based preference vectors with collaborative filtering as resort guest transaction history grows.
