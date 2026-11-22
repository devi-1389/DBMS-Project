"""
SOLACE | Resort Experience Management System
Core integration test suite (the original 11 scenarios, updated for CSRF protection,
POST-only logout and the isolated test database).
"""

import unittest
import uuid

from tests.helpers import (ADMIN, GUEST, booking_id_from_location, db, ensure_test_database,
                           future_slot, login, make_app, post)


def setUpModule():
    ensure_test_database()


class SolaceSystemTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()

    # -------------------------------------------------------------------------
    # TEST 1: User Registration & Duplicate Email Validation
    # -------------------------------------------------------------------------
    def test_01_user_registration_and_duplicate_check(self):
        unique_email = f"test.guest.{uuid.uuid4().hex[:6]}@example.com"
        res = post(self.client, '/register', {
            'full_name': 'Test Academic Guest', 'email': unique_email, 'phone': '+91 99999 11111',
            'password': 'Password@123', 'confirm_password': 'Password@123', 'party_size': 2,
            'budget': 45000.00, 'check_in_date': '2026-11-01', 'check_out_date': '2026-11-05',
            'preferred_time_of_day': 'morning'
        }, follow_redirects=True)
        self.assertEqual(res.status_code, 200)

        user = db("SELECT * FROM users WHERE email = %s", (unique_email,), one=True)
        self.assertIsNotNone(user)
        self.assertEqual(user['role_id'], 2)  # guest role
        guest = db("SELECT * FROM guests WHERE guest_id = %s", (user['user_id'],), one=True)
        self.assertEqual(float(guest['budget']), 45000.00)
        prefs = db("SELECT COUNT(*) AS n FROM guest_preferences WHERE guest_id = %s", (user['user_id'],), one=True)
        self.assertEqual(prefs['n'], 6)  # neutral weight for every interest

        post(self.client, '/logout')
        res_dup = post(self.client, '/register', {
            'full_name': 'Duplicate Guest', 'email': unique_email, 'password': 'Password@123',
            'confirm_password': 'Password@123', 'party_size': 2, 'budget': 30000.00
        }, follow_redirects=True)
        self.assertIn(b'already exists', res_dup.data)

    # -------------------------------------------------------------------------
    # TEST 2: Authentication & Invalid Credentials Handling
    # -------------------------------------------------------------------------
    def test_02_authentication_and_invalid_credentials(self):
        res_fail = post(self.client, '/login', {'email': 'admin@solace.com', 'password': 'WrongPassword999'},
                        follow_redirects=True)
        self.assertIn(b'Invalid email or password', res_fail.data)

        res_ok = post(self.client, '/login', {'email': ADMIN[0], 'password': ADMIN[1]}, follow_redirects=True)
        self.assertEqual(res_ok.status_code, 200)
        self.assertIn(b'Resort Management Dashboard', res_ok.data)

    # -------------------------------------------------------------------------
    # TEST 3: Role-Based Authorization Enforcement (RBAC)
    # -------------------------------------------------------------------------
    def test_03_role_based_access_control(self):
        res = self.app.test_client().get('/admin/dashboard')
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login', res.headers['Location'])

        guest_client = self.app.test_client()
        login(guest_client, GUEST)
        res_denied = guest_client.get('/admin/dashboard', follow_redirects=True)
        self.assertIn(b'Access denied', res_denied.data)

    # -------------------------------------------------------------------------
    # TEST 4: Guest Preferences Normalization & Calibration
    # -------------------------------------------------------------------------
    def test_04_guest_preferences_updates(self):
        login(self.client, GUEST)
        res = post(self.client, '/guest/preferences', {
            'interest_1': 5, 'interest_2': 4, 'interest_3': 2, 'interest_4': 5, 'interest_5': 3, 'interest_6': 4
        }, follow_redirects=True)
        self.assertEqual(res.status_code, 200)
        pref = db("SELECT weight FROM guest_preferences WHERE guest_id = 7 AND interest_id = 1", one=True)
        self.assertEqual(pref['weight'], 5)

        # Out-of-range weights are rejected by validation (CHECK weight BETWEEN 1 AND 5 also guards the DB)
        res_bad = post(self.client, '/guest/preferences', {'interest_1': 9}, follow_redirects=True)
        self.assertIn(b'at most 5', res_bad.data)

    # -------------------------------------------------------------------------
    # TEST 5: Recommendation Algorithm & Constraint Filtering
    # -------------------------------------------------------------------------
    def test_05_recommendation_algorithm_ranking(self):
        with self.app.app_context():
            from app.services.recommendation_engine import get_personalized_recommendations
            recs = get_personalized_recommendations(guest_id=7, max_results=5)
        self.assertTrue(len(recs) > 0)
        scores = [r['match_score'] for r in recs]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertTrue(len(recs[0]['reason']) > 10)
        self.assertIn('breakdown', recs[0])
        # Schedule scoring uses the real slot time (MySQL TIME arrives as timedelta)
        self.assertIn(recs[0]['breakdown']['slot_block'], ('morning', 'afternoon', 'evening'))

    # -------------------------------------------------------------------------
    # TEST 6: Slot Capacity & Overbooking Prevention
    # -------------------------------------------------------------------------
    def test_06_slot_capacity_and_overbooking_prevention(self):
        slot = future_slot(12)  # waterfall yoga, per-person pricing
        original = slot['booked_capacity']
        from app.services.availability_service import check_slot_availability
        # Each check runs in its own app context (= its own connection/transaction snapshot)
        with self.app.app_context():
            ok, msg, _ = check_slot_availability(slot['slot_id'], 99)
            self.assertFalse(ok)
            self.assertIn('party size', msg.lower())
        try:
            db("UPDATE experience_slots SET booked_capacity = max_capacity - 1 WHERE slot_id = %s", (slot['slot_id'],))
            with self.app.app_context():
                ok, msg, _ = check_slot_availability(slot['slot_id'], 2)
            self.assertFalse(ok)
            self.assertIn('remaining', msg.lower())
        finally:
            db("UPDATE experience_slots SET booked_capacity = %s WHERE slot_id = %s", (original, slot['slot_id']))

    # -------------------------------------------------------------------------
    # TEST 7: Equipment & Physical Resource Allocation Verification
    # -------------------------------------------------------------------------
    def test_07_resource_availability_verification(self):
        slot = future_slot(6)  # mangrove kayaking needs kayaks + life vests
        with self.app.app_context():
            from app.services.availability_service import check_resource_availability
            ok, _, reqs = check_resource_availability(6, slot['slot_id'], 2)
            self.assertTrue(ok)
            self.assertEqual(len(reqs), 2)
            ok_big, msg, _ = check_resource_availability(6, slot['slot_id'], 50)  # 50 life vests > 24 in stock
            self.assertFalse(ok_big)
            self.assertIn('Insufficient inventory', msg)

    # -------------------------------------------------------------------------
    # TEST 8: Multi-Day Itinerary Budget & Conflict Protection
    # -------------------------------------------------------------------------
    def test_08_itinerary_budget_and_conflict_protection(self):
        with self.app.app_context():
            from app.services.itinerary_service import get_or_create_itinerary, add_item_to_itinerary
            itin = get_or_create_itinerary(guest_id=7)
            self.assertIsNotNone(itin)
            ok, msg = add_item_to_itinerary(itin['itinerary_id'], 14, None, 3, 'morning', 'Forest bathing')
            self.assertTrue(ok, msg)
            ok2, msg2 = add_item_to_itinerary(itin['itinerary_id'], 7, None, 3, 'morning', 'Clash')
            self.assertFalse(ok2)
            self.assertIn('already have an activity', msg2)

    # -------------------------------------------------------------------------
    # TEST 9: Transactional Booking & Payment Confirmation Lifecycle
    # -------------------------------------------------------------------------
    def test_09_transactional_booking_and_payment_flow(self):
        login(self.client, GUEST)
        slot = future_slot(17, min_units=2)  # heritage village trail
        before = slot['booked_capacity']

        res_init = post(self.client, '/booking/initiate',
                        {'slot_id': slot['slot_id'], 'party_size': 2, 'special_requests': 'Sunset deck seating.'})
        self.assertEqual(res_init.status_code, 302)
        booking_id = booking_id_from_location(res_init.headers['Location'])

        res_pay = post(self.client, '/payment/process', {
            'booking_id': booking_id, 'payment_method': 'credit_card_sim', 'sim_action': 'success'
        }, follow_redirects=True)
        self.assertEqual(res_pay.status_code, 200)
        self.assertIn(b'Official Experience Voucher', res_pay.data)

        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (booking_id,), one=True)['booking_status'], 'confirmed')
        self.assertEqual(db("SELECT payment_status FROM payments WHERE booking_id = %s", (booking_id,), one=True)['payment_status'], 'successful')
        self.assertEqual(db("SELECT booked_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)['booked_capacity'], before + 2)

        res_cancel = post(self.client, f'/booking/cancel/{booking_id}',
                          {'cancellation_reason': 'Automated testing refund release verification.'}, follow_redirects=True)
        self.assertIn(b'successfully cancelled', res_cancel.data)
        after = db("SELECT * FROM bookings WHERE booking_id = %s", (booking_id,), one=True)
        self.assertEqual(after['booking_status'], 'cancelled')
        self.assertTrue(float(after['refund_amount']) > 0)
        self.assertEqual(db("SELECT booked_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)['booked_capacity'], before)

    # -------------------------------------------------------------------------
    # TEST 10: Verified Review Eligibility & Duplicate Blocking
    # -------------------------------------------------------------------------
    def test_10_verified_review_duplicate_blocking(self):
        login(self.client, GUEST)
        res = self.client.get('/review/3', follow_redirects=True)  # booking 3 is completed and already reviewed
        self.assertIn(b'already submitted a review', res.data)

    # -------------------------------------------------------------------------
    # TEST 11: SQL View Integrity & Aggregate Reports
    # -------------------------------------------------------------------------
    def test_11_sql_views_integrity(self):
        v_exp = db("SELECT * FROM v_experience_details LIMIT 5")
        self.assertTrue(len(v_exp) > 0)
        self.assertIn('avg_rating', v_exp[0])
        self.assertIn('category_name', v_exp[0])
        v_slots = db("SELECT * FROM v_slot_availability LIMIT 5")
        self.assertIn('available_capacity', v_slots[0])
        self.assertTrue(len(db("SELECT * FROM v_sustainability_metrics")) > 0)
        self.assertTrue(len(db("SELECT * FROM v_booking_overview")) >= 12)
        self.assertEqual(len(db("SELECT * FROM v_staff_workload")), db("SELECT COUNT(*) AS n FROM staff", one=True)['n'])


if __name__ == '__main__':
    unittest.main()
