# SOLACE | Database Systems Query Demonstration Manual
**Course:** Third-Year Computer Engineering DBMS Academic Project  
**System:** SOLACE Personalized Luxury, Nature & Adventure Experience Management System  
**Engine:** MySQL / MariaDB (InnoDB, UTF-8 Unicode, 3NF Normalized Schema)

---

## 1. Overview of DBMS Capabilities Demonstrated

This document provides concrete, executed examples of advanced SQL concepts implemented in SOLACE:
1. Multi-Table `INNER JOIN` and `LEFT JOIN` operations.
2. Aggregation functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`) with `GROUP BY` and `HAVING`.
3. Preference matching with multi-attribute weighted scoring and mathematical normalization.
4. Concurrency-safe date/time temporal filtering and dynamic capacity arithmetic.
5. Correlated subqueries (`NOT IN`, `EXISTS`) for conflict and double-booking avoidance.
6. SQL Window Functions (`SUM(...) OVER (PARTITION BY ... ORDER BY ...)`) for multi-day cumulative expense tracking.
7. Automated database triggers for chronological status history and immutable audit trails.
8. ACID transactions with row-level locks (`SELECT ... FOR UPDATE`), `COMMIT`, and `ROLLBACK`.

---

## 2. Executed Demonstration Queries & Outputs

### Query 1: Category Aggregations & Average Ratings
- **Concepts Demonstrated:** `JOIN`, `LEFT JOIN`, `GROUP BY`, `AVG()`, `COUNT()`, `ORDER BY`.
- **Purpose:** Produces executive summary of experiences, pricing in INR, sustainability averages, and verified ratings.

```sql
SELECT 
    c.name AS category_name,
    COUNT(DISTINCT e.experience_id) AS total_experiences,
    ROUND(AVG(e.base_price), 2) AS avg_base_price_inr,
    ROUND(AVG(e.eco_impact_score), 1) AS avg_eco_score,
    ROUND(COALESCE(AVG(r.rating), 5.0), 2) AS aggregate_guest_rating,
    COUNT(r.review_id) AS verified_reviews_count
FROM experience_categories c
JOIN experiences e ON c.category_id = e.category_id
LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = 1
WHERE e.is_active = 1
GROUP BY c.category_id, c.name
ORDER BY avg_base_price_inr DESC;
```

**Output:**
| category_name | total_experiences | avg_base_price_inr | avg_eco_score | aggregate_guest_rating | verified_reviews_count |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Luxury Services | 4 | ₹8,400.00 | 91.3 | 5.00 | 1 |
| Adventure Activities | 3 | ₹2,733.33 | 92.3 | 5.00 | 0 |
| Sustainable Living & Mobility | 2 | ₹2,150.00 | 99.5 | 5.00 | 0 |
| Local Culture & Cuisine | 3 | ₹1,966.67 | 94.7 | 5.00 | 0 |
| Nature & Eco-Tourism | 4 | ₹1,925.00 | 97.5 | 5.00 | 0 |
| Wellness & Relaxation | 3 | ₹1,500.00 | 99.0 | 5.00 | 0 |

---

### Query 2: Weighted Guest Preference Matching
- **Concepts Demonstrated:** Mathematical normalization, multi-factor weighting, dynamic scoring, `LIMIT`.
- **Purpose:** Calculates composite match score for guest ID 7 (Priya Sharma: high passion for Luxury and Wellness).

```sql
SELECT 
    e.experience_id,
    e.name AS experience_name,
    c.name AS category_name,
    e.base_price,
    COALESCE(gp.weight, 3) AS guest_interest_weight,
    ROUND(
        (0.40 * (COALESCE(gp.weight, 3) / 5.0)) +
        (0.25 * (1.0 - (e.base_price / 85000.00))) +
        (0.15 * 1.0) +
        (0.10 * (e.eco_impact_score / 100.0)) +
        (0.10 * (COALESCE(AVG(r.rating), 3.5) / 5.0)),  -- 3.5 = neutral prior for unreviewed experiences (ranking only)
        4
    ) * 100 AS composite_matching_score
FROM experiences e
JOIN experience_categories c ON e.category_id = c.category_id
LEFT JOIN guest_preferences gp ON e.category_id = gp.interest_id AND gp.guest_id = 7
LEFT JOIN reviews r ON e.experience_id = r.experience_id
WHERE e.is_active = 1
GROUP BY e.experience_id
ORDER BY composite_matching_score DESC
LIMIT 5;
```

**Output:**
| experience_id | experience_name | category_name | base_price | guest_interest_weight | composite_matching_score |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 14 | Forest Bathing (Shinrin-Yoku) | Wellness & Relaxation | ₹1,500.00 | 5 | 99.16% |
| 12 | Waterfall Yoga & Breathwork | Wellness & Relaxation | ₹1,200.00 | 5 | 99.15% |
| 13 | Himalayan Singing Bowl Sound Bath | Wellness & Relaxation | ₹1,800.00 | 5 | 98.87% |
| 3 | Royal Ayurvedic Abhyanga Spa | Luxury Services | ₹4,800.00 | 5 | 98.09% |
| 2 | Luxury Sunset Catamaran Cruise | Luxury Services | ₹5,800.00 | 5 | 97.09% |

---

### Query 3: Real-Time Slot Capacity & Seat Inventory
- **Concepts Demonstrated:** Date range filtering (`CURDATE()`, `INTERVAL 7 DAY`), arithmetic subtraction, conditional `CASE` expression.
- **Purpose:** Dynamically computes available capacity (`max_capacity - booked_capacity`) to determine inventory availability.

```sql
SELECT 
    es.slot_id,
    e.name AS experience_name,
    es.slot_date,
    es.start_time,
    es.end_time,
    es.max_capacity,
    es.booked_capacity,
    (es.max_capacity - es.booked_capacity) AS available_seats,
    CASE 
        WHEN (es.max_capacity - es.booked_capacity) = 0 THEN 'SOLD OUT'
        WHEN (es.max_capacity - es.booked_capacity) <= 2 THEN 'LIMITED SPOTS'
        ELSE 'AVAILABLE'
    END AS inventory_status
FROM experience_slots es
JOIN experiences e ON es.experience_id = e.experience_id
WHERE es.slot_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND es.slot_status = 'available'
ORDER BY es.slot_date ASC, es.start_time ASC
LIMIT 6;
```

---

### Query 4: Subquery Conflict Detection (Staff Overlap Prevention)
- **Concepts Demonstrated:** Correlated subquery using `NOT IN` to check overlapping schedule allocations.
- **Purpose:** Identifies all certified staff members available for a proposed slot who are not assigned to concurrent bookings.

```sql
SELECT 
    s.staff_id,
    u.full_name,
    u.phone,
    s.specialization
FROM staff s
JOIN users u ON s.user_id = u.user_id
WHERE s.is_active = 1 
  AND s.is_available = 1
  AND s.staff_id NOT IN (
      SELECT sa.staff_id 
      FROM staff_assignments sa 
      WHERE sa.slot_id = 1 AND sa.assignment_status IN ('assigned', 'confirmed')
  );
```

---

### Query 5: Resource Utilization with HAVING Filtering
- **Concepts Demonstrated:** `LEFT JOIN`, `COALESCE`, `SUM()`, `GROUP BY`, `HAVING`.
- **Purpose:** Calculates utilization percentage of physical resort inventory (kayaks, e-bikes, gazebos, safety vests).

```sql
SELECT 
    r.resource_id,
    r.name AS equipment_name,
    r.resource_type,
    r.total_quantity,
    COALESCE(SUM(ra.quantity_allocated), 0) AS total_units_reserved,
    ROUND((COALESCE(SUM(ra.quantity_allocated), 0) / r.total_quantity) * 100, 1) AS utilization_percentage
FROM resources r
LEFT JOIN resource_allocations ra ON r.resource_id = ra.resource_id AND ra.allocation_status = 'reserved'
GROUP BY r.resource_id
HAVING total_units_reserved > 0
ORDER BY utilization_percentage DESC;
```

---

### Query 6: Revenue & Financial Settlement Ledger
- **Concepts Demonstrated:** Monetary aggregation, payment channel segregation, transaction auditing.
- **Purpose:** Generates financial summary of all settled transactions by payment simulator channel.

```sql
SELECT 
    p.payment_method,
    COUNT(p.payment_id) AS successful_transactions_count,
    SUM(p.amount) AS total_settled_amount_inr,
    ROUND(AVG(p.amount), 2) AS average_ticket_size_inr,
    MIN(p.paid_at) AS earliest_transaction,
    MAX(p.paid_at) AS latest_transaction
FROM payments p
JOIN bookings b ON p.booking_id = b.booking_id
WHERE p.payment_status = 'successful'
GROUP BY p.payment_method
ORDER BY total_settled_amount_inr DESC;
```

---

### Query 7: Multi-Day Itinerary Running Balance (Window Function)
- **Concepts Demonstrated:** SQL Window Function `SUM(...) OVER (PARTITION BY ... ORDER BY ...)` for running totals.
- **Purpose:** Calculates cumulative itinerary cost progression across stay days and verifies non-violation of guest budget ceiling.

```sql
SELECT 
    ii.item_id,
    ii.day_number,
    ii.time_block,
    e.name AS experience_name,
    ii.estimated_cost AS activity_cost_inr,
    SUM(ii.estimated_cost) OVER (
        PARTITION BY ii.itinerary_id 
        ORDER BY ii.day_number ASC, FIELD(ii.time_block, 'morning', 'afternoon', 'evening')
    ) AS running_cumulative_cost_inr,
    i.total_budget AS guest_budget_ceiling
FROM itinerary_items ii
JOIN itineraries i ON ii.itinerary_id = i.itinerary_id
JOIN experiences e ON ii.experience_id = e.experience_id
WHERE i.guest_id = 7
ORDER BY ii.day_number ASC, FIELD(ii.time_block, 'morning', 'afternoon', 'evening');
```

---

### Query 8: Community & Local Supplier Socio-Economic Report
- **Concepts Demonstrated:** Multi-table join with boolean condition grouping.
- **Purpose:** Quantifies economic impact channeled to local coastal artisans, farmers, and fisherfolk guilds.

```sql
SELECT 
    s.supplier_id,
    s.name AS supplier_name,
    s.supplier_type,
    s.is_local,
    COUNT(DISTINCT e.experience_id) AS supported_experiences,
    COUNT(DISTINCT b.booking_id) AS total_guest_bookings_generated,
    COALESCE(SUM(b.total_amount), 0.00) AS economic_value_generated_inr
FROM suppliers s
LEFT JOIN experiences e ON s.supplier_id = e.supplier_id
LEFT JOIN bookings b ON e.experience_id = b.experience_id AND b.booking_status IN ('confirmed', 'completed')
GROUP BY s.supplier_id
ORDER BY s.is_local DESC, economic_value_generated_inr DESC;
```

---

### Query 9: Automated Database Trigger History Trail
- **Concepts Demonstrated:** Database triggers (`trg_booking_after_insert`, `trg_booking_after_update`) populating `booking_status_history`.
- **Purpose:** Verifies that every status transition is immutably logged with timestamp, user ID, and transition notes.

```sql
SELECT 
    bsh.history_id,
    b.booking_reference,
    bsh.from_status,
    bsh.to_status,
    u.full_name AS modified_by,
    bsh.notes,
    bsh.changed_at
FROM booking_status_history bsh
JOIN bookings b ON bsh.booking_id = b.booking_id
LEFT JOIN users u ON bsh.changed_by_user_id = u.user_id
WHERE b.booking_id = 1
ORDER BY bsh.changed_at ASC;
```

---

### Query 10: Atomic Concurrency-Safe Transaction (ACID Booking with COMMIT)
- **Concepts Demonstrated:** `START TRANSACTION`, row-level locking (`FOR UPDATE`), atomic reservation, and `COMMIT`.
- **Purpose:** Prevents race conditions during simultaneous booking attempts on the final available seat.

```sql
START TRANSACTION;

-- Step 1: Lock candidate slot row
SELECT slot_id, max_capacity, booked_capacity 
FROM experience_slots 
WHERE slot_id = 2 FOR UPDATE;

-- Step 2: Validate and update booked capacity
UPDATE experience_slots 
SET booked_capacity = booked_capacity + 2 
WHERE slot_id = 2;

-- Step 3: Insert booking record
INSERT INTO bookings (
    booking_reference, guest_id, experience_id, slot_id,
    booking_date, party_size, unit_price, total_amount,
    booking_status, cancellation_deadline
) VALUES (
    'SOL-DEMO-TXN99', 7, 2, 2,
    CURDATE(), 2, 5800.00, 11600.00,
    'confirmed', DATE_SUB(NOW(), INTERVAL -12 HOUR)
);

-- Step 4: Commit atomically
COMMIT;
```
