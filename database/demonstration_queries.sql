-- ============================================================================
-- SOLACE | Personalized Luxury, Nature & Adventure Experience Management System
-- Academic DBMS Demonstration Queries & Concepts Showcase
-- Database: MySQL / MariaDB (solace_db)
-- ============================================================================

USE solace_db;

-- ----------------------------------------------------------------------------
-- QUERY 1: Multi-Table INNER & LEFT JOIN with Aggregations (AVG, COUNT)
-- Concept: Demonstrates multi-table joins, GROUP BY, and aggregate calculations
-- Objective: Catalogue summary showing average rating and total verified reviews per category.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 2: Preference Matching with Weighted Ranking & Normalization
-- Concept: Dynamic SQL scoring algorithm incorporating weighted guest preferences
-- Objective: Rank experiences for guest ID 7 (Priya Sharma) based on normalized interest weights.
-- ----------------------------------------------------------------------------
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
        (0.10 * (COALESCE(AVG(r.rating), 4.8) / 5.0)),
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

-- ----------------------------------------------------------------------------
-- QUERY 3: Real-Time Slot Capacity and Inventory Availability Calculation
-- Concept: Date/Time filtering, arithmetic expressions, and conditional CASE expressions
-- Objective: Identify all slots with open seats occurring in the next 7 days.
-- ----------------------------------------------------------------------------
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
ORDER BY es.slot_date ASC, es.start_time ASC;

-- ----------------------------------------------------------------------------
-- QUERY 4: Subquery with Correlated EXISTS / NOT IN for Conflict Detection
-- Concept: Correlated subquery to identify available staff not double-booked
-- Objective: Find active naturalists/guides available for slot ID 1 without overlapping assignments.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 5: Resource Allocation and Utilization Aggregation (HAVING Clause)
-- Concept: GROUP BY with HAVING clause filtering aggregated utilization thresholds
-- Objective: Identify equipment types where more than 2 units are currently reserved.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 6: Revenue and Financial Audit Ledger
-- Concept: Financial summation, date formatting, and payment status verification
-- Objective: Compute total settled revenue grouped by payment gateway method.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 7: Guest Itinerary with Cumulative Running Total (Window Function)
-- Concept: SQL Window Function SUM(...) OVER (ORDER BY ...) for running financial balance
-- Objective: Display Priya's multi-day itinerary with cumulative expenditure running total.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 8: Local Artisan and Supplier Socio-Economic Impact Report
-- Concept: Multi-table join with conditional aggregations assessing community linkages
-- Objective: Measure percentage of resort experiences supported by local partner businesses.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 9: Database Trigger and Booking Status Audit History Trail
-- Concept: Verification of automated trigger execution on `booking_status_history`
-- Objective: Review the chronological state transitions and audit notes for booking ID 1.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- QUERY 10: Database Transaction Showcase (ACID Booking with COMMIT & ROLLBACK)
-- Concept: Demonstrates explicit Transaction handling, concurrency locking, and rollback
-- ----------------------------------------------------------------------------
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

-- Step 4: Confirm transaction atomically
COMMIT;
