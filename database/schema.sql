-- ============================================================================
-- SOLACE | Personalized Luxury, Nature & Adventure Experience Management System
-- Academic DBMS Schema Specification (Targeting 3NF)
-- Database Engine: MySQL / MariaDB (InnoDB)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS solace_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SET NAMES utf8mb4;
USE solace_db;

-- ----------------------------------------------------------------------------
-- 1. Table: roles
-- System access control levels
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. Table: users
-- Core authentication and identity table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. Table: guests
-- Profile information, party size, travel window, budget & preferences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
    guest_id INT PRIMARY KEY,
    party_size INT NOT NULL DEFAULT 2,
    budget DECIMAL(10,2) NOT NULL DEFAULT 35000.00,
    check_in_date DATE,
    check_out_date DATE,
    preferred_time_of_day ENUM('morning', 'afternoon', 'evening', 'any') DEFAULT 'any',
    accessibility_notes TEXT,
    sustainability_priority ENUM('low', 'medium', 'high') DEFAULT 'high',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_guests_user FOREIGN KEY (guest_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_guest_party_size CHECK (party_size >= 1 AND party_size <= 25),
    CONSTRAINT chk_guest_budget CHECK (budget >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. Table: interests
-- Master taxonomy of guest interest categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interests (
    interest_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    category_tag VARCHAR(50) NOT NULL,
    icon VARCHAR(50) DEFAULT 'bi-compass',
    description TEXT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. Table: guest_preferences
-- Normalized weights (1 to 5) for guest interests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_preferences (
    preference_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    interest_id INT NOT NULL,
    weight INT NOT NULL DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guest_interest (guest_id, interest_id),
    CONSTRAINT fk_gp_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE,
    CONSTRAINT fk_gp_interest FOREIGN KEY (interest_id) REFERENCES interests(interest_id) ON DELETE CASCADE,
    CONSTRAINT chk_gp_weight CHECK (weight BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. Table: experience_categories
-- The six primary resort experience classifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'bi-stars',
    display_order INT DEFAULT 0
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. Table: suppliers
-- Local and external sustainable partners and vendors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(150),
    phone VARCHAR(30),
    address TEXT,
    supplier_type VARCHAR(50) DEFAULT 'Local Artisan / Equipment',
    is_local BOOLEAN DEFAULT TRUE,
    products_services TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_supplier_local (is_local)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. Table: experiences
-- Catalogue of all resort activities, services, pricing and eco metrics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experiences (
    experience_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    supplier_id INT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    short_desc VARCHAR(255) NOT NULL,
    full_desc TEXT NOT NULL,
    pricing_type ENUM('per_person', 'per_booking') NOT NULL DEFAULT 'per_person',
    base_price DECIMAL(10,2) NOT NULL,
    duration_minutes INT NOT NULL,
    min_party_size INT NOT NULL DEFAULT 1,
    max_party_size INT NOT NULL DEFAULT 12,
    capacity_per_slot INT NOT NULL DEFAULT 12,
    safety_instructions TEXT,
    age_restrictions VARCHAR(100) DEFAULT 'All ages welcome (minors accompanied by adult)',
    accessibility_info TEXT,
    eco_impact_score INT NOT NULL DEFAULT 85,
    is_low_impact BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_exp_category (category_id),
    INDEX idx_exp_active (is_active),
    CONSTRAINT fk_exp_category FOREIGN KEY (category_id) REFERENCES experience_categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    CONSTRAINT chk_exp_price CHECK (base_price >= 0),
    CONSTRAINT chk_exp_eco CHECK (eco_impact_score BETWEEN 1 AND 100),
    CONSTRAINT chk_exp_duration CHECK (duration_minutes > 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. Table: experience_slots
-- Scheduled timeslots for experience instances
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_slots (
    slot_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INT NOT NULL,
    booked_capacity INT NOT NULL DEFAULT 0,
    slot_status ENUM('available', 'locked', 'cancelled', 'completed') DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slot_date (slot_date),
    INDEX idx_slot_exp_date (experience_id, slot_date),
    UNIQUE KEY uq_slot_time (experience_id, slot_date, start_time),
    CONSTRAINT fk_slot_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE,
    CONSTRAINT chk_slot_cap CHECK (booked_capacity >= 0 AND booked_capacity <= max_capacity)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. Table: resources
-- Inventory of equipment, venues, EV fleets, watercraft and gear
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
    resource_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT,
    name VARCHAR(120) NOT NULL,
    resource_type ENUM('equipment', 'venue', 'vehicle', 'gear') NOT NULL,
    total_quantity INT NOT NULL DEFAULT 1,
    condition_status ENUM('excellent', 'good', 'fair', 'under_maintenance') DEFAULT 'excellent',
    is_sustainable BOOLEAN DEFAULT TRUE,
    eco_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_res_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    CONSTRAINT chk_res_qty CHECK (total_quantity >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. Table: experience_resources
-- Mapping between experiences and required resource quantities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_resources (
    exp_resource_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    resource_id INT NOT NULL,
    quantity_required INT NOT NULL DEFAULT 1,
    calculation_type ENUM('per_person', 'per_booking') NOT NULL DEFAULT 'per_person',
    UNIQUE KEY uq_exp_resource (experience_id, resource_id),
    CONSTRAINT fk_er_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE,
    CONSTRAINT fk_er_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE,
    CONSTRAINT chk_er_qty CHECK (quantity_required > 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. Table: staff
-- Naturalists, guides, therapists, private chefs and resort crew
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
    staff_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    specialization VARCHAR(120) NOT NULL,
    contact_phone VARCHAR(30),
    bio TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. Table: experience_staff_requirements
-- Staff roles and headcount needed per experience execution
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience_staff_requirements (
    req_id INT AUTO_INCREMENT PRIMARY KEY,
    experience_id INT NOT NULL,
    role_needed VARCHAR(100) NOT NULL,
    quantity_required INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_esr_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE,
    CONSTRAINT chk_esr_qty CHECK (quantity_required > 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 14. Table: bookings
-- Guest booking transactions with reference numbers and lifecycle status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(30) UNIQUE NOT NULL,
    guest_id INT NOT NULL,
    experience_id INT NOT NULL,
    slot_id INT NOT NULL,
    booking_date DATE NOT NULL,
    party_size INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    special_requests TEXT,
    booking_status ENUM('pending', 'confirmed', 'cancelled', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    cancellation_deadline DATETIME NOT NULL,
    cancellation_reason TEXT,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_booking_guest (guest_id),
    INDEX idx_booking_slot (slot_id),
    INDEX idx_booking_status (booking_status),
    CONSTRAINT fk_bk_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE RESTRICT,
    CONSTRAINT fk_bk_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE RESTRICT,
    CONSTRAINT fk_bk_slot FOREIGN KEY (slot_id) REFERENCES experience_slots(slot_id) ON DELETE RESTRICT,
    CONSTRAINT chk_bk_party CHECK (party_size >= 1),
    CONSTRAINT chk_bk_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 15. Table: booking_status_history
-- Full audit trail of all booking state transitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id INT,
    notes TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_bsh_user FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 16. Table: resource_allocations
-- Actual reserved units of inventory for an individual booking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_allocations (
    allocation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    resource_id INT NOT NULL,
    slot_id INT NOT NULL,
    quantity_allocated INT NOT NULL,
    allocation_status ENUM('reserved', 'released') NOT NULL DEFAULT 'reserved',
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alloc_slot (slot_id),
    CONSTRAINT fk_ra_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_ra_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ra_slot FOREIGN KEY (slot_id) REFERENCES experience_slots(slot_id) ON DELETE RESTRICT,
    CONSTRAINT chk_ra_qty CHECK (quantity_allocated > 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 17. Table: staff_assignments
-- Specific staff member schedules assigned to an experience slot
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    staff_id INT NOT NULL,
    slot_id INT NOT NULL,
    assignment_status ENUM('assigned', 'confirmed', 'completed', 'reassigned') NOT NULL DEFAULT 'assigned',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sa_staff_slot (staff_id, slot_id),
    CONSTRAINT fk_sa_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_sa_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sa_slot FOREIGN KEY (slot_id) REFERENCES experience_slots(slot_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 18. Table: payments
-- Simulated payment records with transaction tokens, methods and status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    transaction_reference VARCHAR(64) UNIQUE NOT NULL,
    payment_method ENUM('credit_card_sim', 'upi_sim', 'resort_credit', 'net_banking_sim') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status ENUM('successful', 'failed', 'refunded') NOT NULL DEFAULT 'successful',
    simulated_gateway_response TEXT,
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pmt_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT chk_pmt_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 19. Table: reviews
-- Post-experience verified guest feedback (1-5 stars)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNIQUE NOT NULL,
    guest_id INT NOT NULL,
    experience_id INT NOT NULL,
    rating INT NOT NULL,
    review_title VARCHAR(150),
    review_text TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rev_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_rev_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE,
    CONSTRAINT fk_rev_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE,
    CONSTRAINT chk_rev_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 20. Table: maintenance_periods
-- Scheduled downtime periods for equipment, venues or vehicles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_periods (
    maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_id INT NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('scheduled', 'in_progress', 'completed') DEFAULT 'scheduled',
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mp_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE,
    CONSTRAINT chk_mp_dates CHECK (end_datetime > start_datetime)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 21. Table: audit_logs
-- System-wide activity and security log for administrative changes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action_type VARCHAR(50) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity_name, entity_id),
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 22. Table: itineraries
-- Multi-day trip planning bundles for guests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itineraries (
    itinerary_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_budget DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('draft', 'saved', 'booked') DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_itin_guest FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE,
    CONSTRAINT chk_itin_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 23. Table: itinerary_items
-- Selected candidate experiences mapped to stay days and schedule blocks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itinerary_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    itinerary_id INT NOT NULL,
    experience_id INT NOT NULL,
    slot_id INT,
    day_number INT NOT NULL,
    time_block ENUM('morning', 'afternoon', 'evening') NOT NULL,
    estimated_cost DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ii_itinerary FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id) ON DELETE CASCADE,
    CONSTRAINT fk_ii_experience FOREIGN KEY (experience_id) REFERENCES experiences(experience_id) ON DELETE CASCADE,
    CONSTRAINT fk_ii_slot FOREIGN KEY (slot_id) REFERENCES experience_slots(slot_id) ON DELETE SET NULL,
    CONSTRAINT chk_ii_day CHECK (day_number >= 1)
) ENGINE=InnoDB;


-- ============================================================================
-- DATABASE VIEWS
-- ============================================================================

-- View 1: v_experience_details
-- Aggregates category details, supplier information, average rating and review counts.
-- avg_rating is NULL when an experience has no approved reviews (no fabricated default).
CREATE OR REPLACE VIEW v_experience_details AS
SELECT
    e.experience_id,
    e.name AS experience_name,
    e.slug,
    e.short_desc,
    e.full_desc,
    e.pricing_type,
    e.base_price,
    e.duration_minutes,
    e.min_party_size,
    e.max_party_size,
    e.capacity_per_slot,
    e.eco_impact_score,
    e.is_low_impact,
    e.safety_instructions,
    e.age_restrictions,
    e.accessibility_info,
    e.image_url,
    e.is_active,
    c.category_id,
    c.name AS category_name,
    c.slug AS category_slug,
    c.icon AS category_icon,
    s.supplier_id,
    s.name AS supplier_name,
    s.is_local AS supplier_is_local,
    ROUND(AVG(r.rating), 2) AS avg_rating,
    COUNT(r.review_id) AS total_reviews
FROM experiences e
JOIN experience_categories c ON e.category_id = c.category_id
LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
LEFT JOIN reviews r ON e.experience_id = r.experience_id AND r.is_approved = TRUE
GROUP BY e.experience_id;

-- View 2: v_slot_availability
-- Real-time seat inventory per slot
CREATE OR REPLACE VIEW v_slot_availability AS
SELECT
    es.slot_id,
    es.experience_id,
    e.name AS experience_name,
    e.duration_minutes,
    es.slot_date,
    es.start_time,
    es.end_time,
    es.max_capacity,
    es.booked_capacity,
    (es.max_capacity - es.booked_capacity) AS available_capacity,
    es.slot_status,
    CASE
        WHEN es.slot_status != 'available' THEN 'Unavailable'
        WHEN es.booked_capacity >= es.max_capacity THEN 'Fully Booked'
        ELSE 'Bookable'
    END AS bookable_status
FROM experience_slots es
JOIN experiences e ON es.experience_id = e.experience_id;

-- View 3: v_sustainability_metrics
-- Sustainable tourism analytics
CREATE OR REPLACE VIEW v_sustainability_metrics AS
SELECT
    c.name AS category_name,
    COUNT(DISTINCT e.experience_id) AS total_experiences,
    COUNT(DISTINCT CASE WHEN e.is_low_impact = TRUE THEN e.experience_id END) AS low_impact_experiences,
    ROUND(AVG(e.eco_impact_score), 1) AS avg_eco_score,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN s.is_local = TRUE AND b.booking_id IS NOT NULL THEN 1 ELSE 0 END) AS local_supplier_linked_bookings,
    COALESCE(SUM(b.total_amount), 0.00) AS total_category_revenue
FROM experience_categories c
JOIN experiences e ON c.category_id = e.category_id
LEFT JOIN suppliers s ON e.supplier_id = s.supplier_id
LEFT JOIN bookings b ON e.experience_id = b.experience_id AND b.booking_status IN ('confirmed', 'completed')
GROUP BY c.category_id, c.name;

-- View 4: v_booking_overview
-- Denormalised read model of a booking: guest, experience, slot and latest payment
CREATE OR REPLACE VIEW v_booking_overview AS
SELECT
    b.booking_id,
    b.booking_reference,
    b.booking_status,
    u.full_name AS guest_name,
    u.email AS guest_email,
    e.name AS experience_name,
    c.name AS category_name,
    es.slot_date,
    es.start_time,
    b.party_size,
    b.total_amount,
    b.refund_amount,
    (SELECT p.payment_status FROM payments p
      WHERE p.booking_id = b.booking_id
      ORDER BY p.paid_at DESC, p.payment_id DESC LIMIT 1) AS latest_payment_status,
    b.created_at
FROM bookings b
JOIN guests g ON b.guest_id = g.guest_id
JOIN users u ON g.guest_id = u.user_id
JOIN experiences e ON b.experience_id = e.experience_id
JOIN experience_categories c ON e.category_id = c.category_id
JOIN experience_slots es ON b.slot_id = es.slot_id;

-- View 5: v_staff_workload
-- Number of active / completed assignments per staff member
CREATE OR REPLACE VIEW v_staff_workload AS
SELECT
    s.staff_id,
    u.full_name,
    s.specialization,
    s.is_available,
    COUNT(sa.assignment_id) AS total_assignments,
    SUM(CASE WHEN sa.assignment_status IN ('assigned', 'confirmed') THEN 1 ELSE 0 END) AS active_assignments,
    SUM(CASE WHEN sa.assignment_status = 'completed' THEN 1 ELSE 0 END) AS completed_assignments
FROM staff s
JOIN users u ON s.user_id = u.user_id
LEFT JOIN staff_assignments sa ON s.staff_id = sa.staff_id
GROUP BY s.staff_id, u.full_name, s.specialization, s.is_available;

-- ============================================================================
-- STORED FUNCTIONS, STORED PROCEDURES & TRIGGERS
-- The application sets the session variable @solace_actor_id to the logged-in
-- user's id on every request connection; triggers use it to attribute changes.
-- ============================================================================

DELIMITER $$

-- Function 1: remaining capacity units of a slot
DROP FUNCTION IF EXISTS fn_slot_remaining$$
CREATE FUNCTION fn_slot_remaining(p_slot_id INT)
RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_remaining INT DEFAULT NULL;
    SELECT (max_capacity - booked_capacity) INTO v_remaining
    FROM experience_slots WHERE slot_id = p_slot_id;
    RETURN v_remaining;
END$$

-- Function 2: price of an experience for a given party size (per_person vs per_booking)
DROP FUNCTION IF EXISTS fn_experience_cost$$
CREATE FUNCTION fn_experience_cost(p_experience_id INT, p_party_size INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_type VARCHAR(20);
    SELECT base_price, pricing_type INTO v_price, v_type
    FROM experiences WHERE experience_id = p_experience_id;
    IF v_type = 'per_person' THEN
        RETURN v_price * p_party_size;
    END IF;
    RETURN v_price;
END$$

-- Procedure 1: booking summary (count & value per status) for one guest
DROP PROCEDURE IF EXISTS sp_guest_booking_summary$$
CREATE PROCEDURE sp_guest_booking_summary(IN p_guest_id INT)
BEGIN
    SELECT b.booking_status,
           COUNT(*) AS bookings,
           SUM(b.party_size) AS total_guests,
           SUM(b.total_amount) AS total_value,
           SUM(b.refund_amount) AS total_refunded
    FROM bookings b
    WHERE b.guest_id = p_guest_id
    GROUP BY b.booking_status
    ORDER BY bookings DESC;
END$$

-- Procedure 2: occupancy report per experience for a date range
DROP PROCEDURE IF EXISTS sp_experience_occupancy$$
CREATE PROCEDURE sp_experience_occupancy(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT e.experience_id,
           e.name AS experience_name,
           COUNT(es.slot_id) AS slots,
           COALESCE(SUM(es.max_capacity), 0) AS capacity_units,
           COALESCE(SUM(es.booked_capacity), 0) AS booked_units,
           ROUND(100 * COALESCE(SUM(es.booked_capacity), 0) / NULLIF(SUM(es.max_capacity), 0), 1) AS occupancy_pct
    FROM experiences e
    LEFT JOIN experience_slots es
           ON es.experience_id = e.experience_id
          AND es.slot_date BETWEEN p_from AND p_to
          AND es.slot_status <> 'cancelled'
    WHERE e.is_active = TRUE
    GROUP BY e.experience_id, e.name
    ORDER BY occupancy_pct DESC, e.name;
END$$

-- Procedure 3: bulk-generate daily slots for an experience (used by Admin > Schedules)
-- Duplicate (experience, date, start_time) slots are skipped thanks to uq_slot_time.
DROP PROCEDURE IF EXISTS sp_generate_slots$$
CREATE PROCEDURE sp_generate_slots(
    IN p_experience_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_start_time TIME,
    IN p_end_time TIME,
    IN p_capacity INT,
    OUT p_created INT
)
BEGIN
    DECLARE v_day DATE;
    SET p_created = 0;

    IF p_end_date < p_start_date THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'End date must be on or after the start date';
    END IF;
    IF DATEDIFF(p_end_date, p_start_date) > 90 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A single generation run may span at most 90 days';
    END IF;
    IF p_end_time <= p_start_time THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot end time must be after the start time';
    END IF;
    IF p_capacity IS NULL OR p_capacity <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot capacity must be positive';
    END IF;

    SET v_day = p_start_date;
    WHILE v_day <= p_end_date DO
        INSERT IGNORE INTO experience_slots
            (experience_id, slot_date, start_time, end_time, max_capacity, booked_capacity, slot_status)
        VALUES
            (p_experience_id, v_day, p_start_time, p_end_time, p_capacity, 0, 'available');
        SET p_created = p_created + ROW_COUNT();
        SET v_day = DATE_ADD(v_day, INTERVAL 1 DAY);
    END WHILE;
END$$

-- Trigger 1: automatic audit trail when a booking is created
DROP TRIGGER IF EXISTS trg_booking_after_insert$$
CREATE TRIGGER trg_booking_after_insert
AFTER INSERT ON bookings
FOR EACH ROW
BEGIN
    INSERT INTO booking_status_history (
        booking_id, from_status, to_status, changed_by_user_id, notes, changed_at
    ) VALUES (
        NEW.booking_id, NULL, NEW.booking_status,
        COALESCE(@solace_actor_id, NEW.guest_id),
        'Initial booking created', NOW()
    );
END$$

-- Trigger 2: automatic audit trail when a booking status changes
DROP TRIGGER IF EXISTS trg_booking_after_update$$
CREATE TRIGGER trg_booking_after_update
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF OLD.booking_status <> NEW.booking_status THEN
        INSERT INTO booking_status_history (
            booking_id, from_status, to_status, changed_by_user_id, notes, changed_at
        ) VALUES (
            NEW.booking_id, OLD.booking_status, NEW.booking_status,
            COALESCE(@solace_actor_id, NEW.guest_id),
            CONCAT('Status transitioned from ', OLD.booking_status, ' to ', NEW.booking_status),
            NOW()
        );
    END IF;
END$$

-- Trigger 3: integrity guard - a review must belong to the guest's own completed booking
DROP TRIGGER IF EXISTS trg_review_before_insert$$
CREATE TRIGGER trg_review_before_insert
BEFORE INSERT ON reviews
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_guest INT;
    DECLARE v_experience INT;

    SELECT booking_status, guest_id, experience_id
      INTO v_status, v_guest, v_experience
    FROM bookings WHERE booking_id = NEW.booking_id;

    IF v_status IS NULL OR v_status <> 'completed' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Reviews are only allowed for completed bookings';
    END IF;
    IF v_guest <> NEW.guest_id OR v_experience <> NEW.experience_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review guest/experience must match the booking';
    END IF;
END$$

-- Trigger 4: log every price change of an experience into audit_logs (JSON diff)
DROP TRIGGER IF EXISTS trg_experience_price_audit$$
CREATE TRIGGER trg_experience_price_audit
AFTER UPDATE ON experiences
FOR EACH ROW
BEGIN
    IF OLD.base_price <> NEW.base_price THEN
        INSERT INTO audit_logs (user_id, action_type, entity_name, entity_id, old_values, new_values, ip_address)
        VALUES (@solace_actor_id, 'PRICE_CHANGE_TRIGGER', 'experiences', NEW.experience_id,
                JSON_OBJECT('base_price', OLD.base_price),
                JSON_OBJECT('base_price', NEW.base_price),
                'db-trigger');
    END IF;
END$$

DELIMITER ;
