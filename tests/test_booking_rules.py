"""Booking state machine, concurrency and trigger behaviour."""
import unittest

from tests.helpers import (ADMIN, GUEST, GUEST2, STAFF, booking_id_from_location, db, ensure_test_database,
                           future_slot, login, make_app, post)


def setUpModule():
    ensure_test_database()


class BookingRuleTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()

    def _reserve(self, client, slot_id, party):
        res = post(client, '/booking/initiate', {'slot_id': slot_id, 'party_size': party})
        self.assertEqual(res.status_code, 302, res.data[:300])
        return booking_id_from_location(res.headers['Location'])

    def _pay(self, client, booking_id, action='success'):
        return post(client, '/payment/process', {'booking_id': booking_id, 'payment_method': 'upi_sim', 'sim_action': action})

    def test_double_payment_is_rejected(self):
        login(self.client, GUEST)
        slot = future_slot(7, min_units=2)
        bid = self._reserve(self.client, slot['slot_id'], 2)
        self._pay(self.client, bid)
        self._pay(self.client, bid)  # second attempt on a confirmed booking
        self.assertEqual(db("SELECT COUNT(*) AS n FROM payments WHERE booking_id = %s", (bid,), one=True)['n'], 1)
        self.assertEqual(db("SELECT booked_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)['booked_capacity'],
                         slot['booked_capacity'] + 2)

    def test_cancelled_booking_cannot_be_paid(self):
        login(self.client, GUEST)
        slot = future_slot(7, min_units=2, offset=1)
        bid = self._reserve(self.client, slot['slot_id'], 2)
        post(self.client, f'/booking/cancel/{bid}')
        self._pay(self.client, bid)
        b = db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid,), one=True)
        self.assertEqual(b['booking_status'], 'cancelled')
        self.assertEqual(db("SELECT COUNT(*) AS n FROM payments WHERE booking_id = %s", (bid,), one=True)['n'], 0)

    def test_last_seat_race_between_two_pending_bookings(self):
        slot = future_slot(10, min_units=1)  # sea kayaking, capacity 6
        db("UPDATE experience_slots SET booked_capacity = max_capacity - 2 WHERE slot_id = %s", (slot['slot_id'],))
        a, b = self.app.test_client(), self.app.test_client()
        login(a, GUEST)
        login(b, GUEST2)
        bid_a = self._reserve(a, slot['slot_id'], 2)
        bid_b = self._reserve(b, slot['slot_id'], 2)   # both pending: capacity is consumed only at payment
        self._pay(a, bid_a)
        self._pay(b, bid_b)                             # must be re-checked and rejected
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid_a,), one=True)['booking_status'], 'confirmed')
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid_b,), one=True)['booking_status'], 'failed')
        s = db("SELECT booked_capacity, max_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)
        self.assertEqual(s['booked_capacity'], s['max_capacity'])

    def test_private_experience_uses_booking_units(self):
        login(self.client, GUEST)
        slot = future_slot(1, min_units=1)  # private cliff dining: 1 unit per slot, party up to 4
        bid = self._reserve(self.client, slot['slot_id'], 2)
        self._pay(self.client, bid)
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid,), one=True)['booking_status'], 'confirmed')
        self.assertEqual(db("SELECT booked_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)['booked_capacity'], 1)
        # The single gazebo is now taken - a second party cannot book the same slot
        other = self.app.test_client()
        login(other, GUEST2)
        res = post(other, '/booking/initiate', {'slot_id': slot['slot_id'], 'party_size': 2}, follow_redirects=True)
        self.assertIn(b'remaining', res.data)

    def test_failed_payment_holds_nothing_and_can_retry(self):
        login(self.client, GUEST)
        slot = future_slot(15, min_units=2)
        bid = self._reserve(self.client, slot['slot_id'], 2)
        self._pay(self.client, bid, 'fail')
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid,), one=True)['booking_status'], 'failed')
        self.assertEqual(db("SELECT COUNT(*) AS n FROM resource_allocations WHERE booking_id = %s", (bid,), one=True)['n'], 0)
        self._pay(self.client, bid, 'success')
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid,), one=True)['booking_status'], 'confirmed')
        self.assertEqual(db("SELECT quantity_allocated FROM resource_allocations WHERE booking_id = %s", (bid,), one=True)['quantity_allocated'], 2)
        # Cancellation refunds only the successful payment
        post(self.client, f'/booking/cancel/{bid}')
        statuses = sorted(r['payment_status'] for r in db("SELECT payment_status FROM payments WHERE booking_id = %s", (bid,)))
        self.assertEqual(statuses, ['failed', 'refunded'])

    def test_trigger_records_admin_as_actor(self):
        login(self.client, GUEST)
        slot = future_slot(16, min_units=2)
        bid = self._reserve(self.client, slot['slot_id'], 2)
        self._pay(self.client, bid)
        admin = self.app.test_client()
        login(admin, ADMIN)
        post(admin, f'/admin/bookings/update-status/{bid}', {'new_status': 'cancelled'})
        last = db("SELECT * FROM booking_status_history WHERE booking_id = %s ORDER BY history_id DESC LIMIT 1", (bid,), one=True)
        self.assertEqual(last['to_status'], 'cancelled')
        self.assertEqual(last['changed_by_user_id'], 1)  # admin, not the guest
        # Invalid transition cancelled -> confirmed is refused
        post(admin, f'/admin/bookings/update-status/{bid}', {'new_status': 'confirmed'})
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = %s", (bid,), one=True)['booking_status'], 'cancelled')

    def test_staff_completion_unlocks_review_and_trigger_guards_reviews(self):
        # Booking 5 (Arjun, mangrove kayaking) is assigned to Aarav. Move its session to yesterday so the
        # "session has started" rule holds regardless of the time of day the tests run.
        db("UPDATE experience_slots SET slot_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE slot_id = 19")
        staff = self.app.test_client()
        login(staff, STAFF)
        post(staff, '/staff/complete-booking/5')
        self.assertEqual(db("SELECT booking_status FROM bookings WHERE booking_id = 5", one=True)['booking_status'], 'completed')
        guest = self.app.test_client()
        login(guest, ('arjun.mehta@example.com', 'Guest@123'))
        res = post(guest, '/review/5', {'rating': 4, 'review_title': 'Calm channels', 'review_text': 'Saw otters and mudskippers, superb guide.'})
        self.assertEqual(res.status_code, 302)
        self.assertEqual(db("SELECT rating FROM reviews WHERE booking_id = 5", one=True)['rating'], 4)
        # Database-level guard: a review for a still-confirmed booking is rejected by trg_review_before_insert
        import pymysql
        with self.assertRaises(pymysql.err.OperationalError) as ctx:
            db("INSERT INTO reviews (booking_id, guest_id, experience_id, rating, review_text) VALUES (1, 7, 1, 5, 'too early')")
        self.assertIn('completed bookings', str(ctx.exception))

    def test_itinerary_links_slot_and_edits_dates(self):
        login(self.client, GUEST2)
        self.client.get('/guest/itinerary')
        itin = db("SELECT * FROM itineraries WHERE guest_id = 9 ORDER BY itinerary_id DESC LIMIT 1", one=True)
        res = post(self.client, '/guest/itinerary/add', {'experience_id': 7, 'day_number': 1, 'time_block': 'morning'}, follow_redirects=True)
        self.assertIn(b'linked to a scheduled session', res.data)
        item = db("SELECT * FROM itinerary_items WHERE itinerary_id = %s", (itin['itinerary_id'],), one=True)
        self.assertIsNotNone(item['slot_id'])
        res2 = post(self.client, '/guest/itinerary/update', {'title': 'Elena\'s Culture Week', 'start_date': str(itin['start_date']),
                                                             'end_date': str(itin['end_date']), 'total_budget': 50000}, follow_redirects=True)
        self.assertIn(b'Itinerary details saved', res2.data)
        self.assertEqual(db("SELECT title FROM itineraries WHERE itinerary_id = %s", (itin['itinerary_id'],), one=True)['title'], "Elena's Culture Week")


if __name__ == '__main__':
    unittest.main()
