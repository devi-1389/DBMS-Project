# SOLACE | User Manual & Role Workflow Guide
**Personalized Luxury, Nature & Adventure Experience Management System**  
**Academic Course:** Third-Year Computer Engineering DBMS Project  

---

## 1. System Access & Demo Credentials

The SOLACE platform provides pre-seeded accounts configured to demonstrate role-based access control and specific relational data workflows:

| Role | Demo Account Name | Email Credentials | Password | Key Operational Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Guest** | Priya Sharma | `priya.sharma@example.com` | `Guest@123` | Luxury & Ayurvedic wellness traveler with ₹85,000 budget |
| **Guest** | Arjun Mehta | `arjun.mehta@example.com` | `Guest@123` | Adventure & mountain trekking enthusiast (Party of 4) |
| **Guest** | Elena Rostova | `elena.rostova@example.com` | `Guest@123` | Cultural pottery, spice harvesting, and eco-mobility |
| **Administrator** | Resort Administrator | `admin@solace.com` | `Admin@123` | Master operations console, slot generation, SQL reports |
| **Staff Naturalist** | Aarav Deshmukh | `aarav.naturalist@solace.com` | `Staff@123` | Certified ornithologist leading rainforest canopy trails |
| **Executive Chef** | Chef Maya Kulkarni | `maya.chef@solace.com` | `Staff@123` | Private coastal culinary masterclasses & cliffside feasts |

---

## 2. Guest User Workflow

### A. Account Registration & Profile Setup
1. Open the landing page at `http://localhost:5000/`.
2. Click **"Join Solace"** or **"Plan Your Stay"**.
3. Complete the registration form:
   - Full Name, Email, and Phone number.
   - Travel Party Size (e.g. 2 guests).
   - Activity Budget Ceiling in INR (e.g. ₹45,000).
   - Check-In and Check-Out Dates.
   - Preferred Activity Window (`Morning`, `Afternoon`, `Evening`, or `Flexible`).
4. Submit to create your user record, guest profile, and default neutral interest weights.

### B. Calibrating Activity Interest Weights
1. Navigate to **"Preferences"** from the top navigation bar or dashboard.
2. Adjust the 1-to-5 sliders across the six sanctuary pillars:
   - *Luxury Services* (e.g., Private dining, catamaran cruises, Ayurvedic spas).
   - *Nature & Eco-Tourism* (e.g., Birdwatching, nocturnal trails, permaculture).
   - *Adventure Activities* (e.g., Summit ridge trekking, coastal sea kayaking).
   - *Wellness & Relaxation* (e.g., Waterfall yoga, Himalayan sound baths).
   - *Local Culture & Cuisine* (e.g., Pottery masterclass, spice blending).
   - *Sustainable Living & Mobility* (e.g., Solar EV coastal drives, bamboo bikes).
3. Click **"Save & Compute Recommendations"**.

### C. Exploring Personalized Recommendations
1. View the **"Recommended"** page.
2. Observe the composite **Match Score Percentage** (e.g., `98.5% Match`).
3. Expand the **"Matching Rationale"** card to view the algorithmic explanation detailing why this activity matches your specific interest weights, trip window, and budget limit.
4. Examine the component score badges: Interest affinity, Budget fit, Schedule suitability, Eco-impact, and Guest rating.

### D. Multi-Day Itinerary Planning
1. Navigate to **"Itinerary"**.
2. Notice your stay dates divided into sequential stay days (Day 1, Day 2, Day 3).
3. Click **"Add Activity"** to schedule experiences into morning, afternoon, or evening blocks.
4. The system validates:
   - Schedule collisions (prevents scheduling two activities in the same time block).
   - Financial budget ceiling (warns if cumulative cost exceeds your configured budget).
5. Review the running cumulative expenditure progression.

### E. Reserving an Experience & Payment Simulation
1. Click **"Reserve"** or **"Book Slot"** on any available experience slot.
2. Confirm your party size (the system automatically bounds input between experience minimum/maximum and open capacity).
3. Add any dietary or accessibility notes.
4. Click **"Proceed to Payment Simulator"**.
5. Choose your simulated payment channel:
   - Simulated Credit Card
   - Simulated UPI
   - Resort Villa Folio
6. Click **"Simulate Approved Payment"** to confirm the booking, lock seat capacity, and commit resource allocations.
7. Receive your official printable **Booking Voucher** with unique reference code (`SOL-2026-BK...`).

### F. Booking Cancellation & Automated Refund
1. Navigate to **"My Bookings"**.
2. For any confirmed booking before the 12-hour deadline, click **"Cancel Reservation"**.
3. Confirm the modal. The system will:
   - Release the reserved slot seats back into available inventory.
   - Release the allocated equipment (kayaks, life vests, bicycles).
   - Transition booking status to `cancelled` and mark payment as `refunded`.

### G. Submitting Verified Reviews
1. Once an activity has taken place and been marked as `completed` by resort staff, a notification banner appears.
2. Click **"Leave Review"**.
3. Select an overall rating (1 to 5 stars), enter a headline, and write your impressions.
4. The review is published and incorporated into the experience's aggregate rating.

---

## 3. Resort Administrator Workflow

### A. Operational Dashboard & Telemetry
1. Sign in with `admin@solace.com` / `Admin@123`.
2. Review real-time KPIs:
   - Total Registered Guests
   - Active Experiences in Catalogue
   - Confirmed & Completed Bookings Count
   - Total Settled Revenue in INR
   - Resort Average Guest Rating
3. Review interactive **Chart.js visualizations**:
   - Revenue Breakdown by Category (Bar Chart).
   - Bookings Distribution across Categories (Donut Chart).

### B. Experience Catalogue Management (CRUD)
1. Go to **"Admin Portal" -> "Manage Experiences"**.
2. View existing catalogue items, pricing, duration, slot capacity, and active flags.
3. Click **"Add New Experience"** to register a new offering:
   - Define category, partner supplier, pricing model (`per_person` or `per_booking`), INR price, safety instructions, and eco-impact score.
4. Click the eye icon to toggle an experience between Active and Inactive status.

### C. Schedule Slot Generation
1. Go to **"Admin Portal" -> "Schedules & Slots"**.
2. View scheduled slots, booked capacity, and open seats.
3. Click **"Generate New Slot"** to schedule a new experience date, start time, end time, and maximum capacity.

### D. Equipment & Resource Management
1. Go to **"Admin Portal" -> "Resource Inventory"**.
2. Monitor physical equipment stock (kayaks, life vests, bamboo e-bikes, solar buggies, dining gazebos).
3. Observe **"Currently Reserved"** counts derived from active guest reservations.
4. Review the **Maintenance Blackout Calendar** showing scheduled service periods.

### E. Master Booking Administration
1. Go to **"Admin Portal" -> "Guest Bookings"**.
2. Filter bookings by lifecycle status (`Confirmed`, `Completed`, `Pending`, `Cancelled`).
3. Administratively update statuses using the inline transition dropdown.

### F. DBMS Analytical Reports
1. Go to **"Admin Portal" -> "Analytics & Reports"**.
2. Review SQL aggregation summaries:
   - Category Financial Yield & Average Eco-Scores.
   - Equipment Utilization Percentages.
   - Staff Workload & Duty Session Counts.
3. Click **"Print Reports"** for administrative documentation.

### G. Security Audit Logs
1. Go to **"Admin Portal" -> "Security Audit Logs"**.
2. Inspect the chronological record of administrative changes, including timestamp, user identity, action code (`CREATE_EXPERIENCE`, `UPDATE_BOOKING_STATUS`), and JSON state diffs.

---

## 4. Staff & Local Guide Workflow

### A. Staff Console & Duty Roster
1. Sign in with a staff account (e.g., `aarav.naturalist@solace.com` / `Staff@123`).
2. Review your personal profile, specialization, and active duty status.
3. View the **Assigned Experience Sessions** table showing:
   - Scheduled Date and Time Window.
   - Experience Name and Category.
   - Lead Guest Name and Contact Phone.
   - Confirmed Party Size.
   - Guest Special Requests (e.g. anniversary setup, dietary preferences).

### B. Marking Sessions as Completed
1. Upon concluding an activity session with guests, locate the confirmed booking row.
2. Click **"Mark Completed"**.
3. The booking status transitions to `completed`, safely unlocking the guest's verified review privilege.

### C. Reporting Equipment Defects & Downtime
1. Click **"Report Equipment Issue"** from the staff header.
2. Select the defective equipment or vehicle.
3. Describe the observed problem (e.g., rudder wear on kayak, brake adjustment needed).
4. Enter the estimated downtime in days.
5. Click **"Log Defect & Lock Resource"**.
6. The system sets the resource to `under_maintenance` and automatically creates a record in `maintenance_periods`, preventing allocation conflicts in future bookings.
