"""Itinerary planner: session picker endpoint, session/day validation, time-block derivation and past days."""
import re
import unittest

from tests.helpers import db, ensure_test_database, login, make_app, post

ARJUN = ('arjun.mehta@example.com', 'Guest@123')


def setUpModule():
    ensure_test_database()


class ItineraryPlannerTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()
        login(self.client, ARJUN)
        self.client.get('/guest/itinerary')  # creates Arjun's itinerary on first visit
        self.itin = db("SELECT * FROM itineraries WHERE guest_id = 8 ORDER BY itinerary_id DESC LIMIT 1", one=True)
        db("DELETE FROM itinerary_items WHERE itinerary_id = %s", (self.itin['itinerary_id'],))
        db("UPDATE itineraries SET start_date = CURDATE(), end_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY), estimated_cost = 0 "
           "WHERE itinerary_id = %s", (self.itin['itinerary_id'],))

    def _items(self):
        return db("SELECT * FROM itinerary_items WHERE itinerary_id = %s ORDER BY item_id", (self.itin['itinerary_id'],))

    def test_page_contains_working_planner_modal(self):
        html = self.client.get('/guest/itinerary').data.decode()
        self.assertIn('id="addItemModal"', html)
        self.assertIn('id="slot_id"', html)
        self.assertIn('/guest/itinerary/sessions', html)

    def test_sessions_endpoint_lists_real_sessions_for_the_day(self):
        res = self.client.get('/guest/itinerary/sessions?experience_id=12&day=2')  # waterfall yoga, tomorrow
        data = res.get_json()
        self.assertTrue(data['ok'])
        self.assertEqual(len(data['sessions']), 1)
        s = data['sessions'][0]
        self.assertEqual(s['start'], '07:00 AM')
        self.assertEqual(s['time_block'], 'morning')
        self.assertTrue(s['bookable'])
        slot = db("SELECT slot_date FROM experience_slots WHERE slot_id = %s", (s['slot_id'],), one=True)
        self.assertEqual(slot['slot_date'].isoformat(), data['date'])
        self.assertEqual(self.client.get('/guest/itinerary/sessions?experience_id=abc&day=1').status_code, 400)

    def _bookable(self, experience_id, days=(2, 3, 4)):
        for day in days:
            for s in self.client.get(f'/guest/itinerary/sessions?experience_id={experience_id}&day={day}').get_json()['sessions']:
                if s['bookable']:
                    return day, s
        self.fail('no bookable session found')

    def test_time_block_is_derived_from_the_chosen_session(self):
        day, dining = self._bookable(1)  # private cliff dining: one 18:30 session per day
        res = post(self.client, '/guest/itinerary/add', {'experience_id': 1, 'day_number': day, 'time_block': 'morning',
                                                         'slot_id': dining['slot_id']}, follow_redirects=True)
        self.assertIn(b'linked to a scheduled session', res.data)
        item = self._items()[0]
        self.assertEqual(item['time_block'], 'evening')  # 18:30 session -> evening, not the requested morning
        self.assertEqual(item['slot_id'], dining['slot_id'])
        page = self.client.get('/guest/itinerary').data.decode()
        self.assertIn(f'/book/{dining["slot_id"]}', page)  # bookable straight from the itinerary

    def test_session_from_another_day_is_rejected(self):
        other_day = self.client.get('/guest/itinerary/sessions?experience_id=12&day=3').get_json()['sessions'][0]
        res = post(self.client, '/guest/itinerary/add', {'experience_id': 12, 'day_number': 2, 'time_block': 'morning',
                                                         'slot_id': other_day['slot_id']}, follow_redirects=True)
        self.assertIn(b'not on Day 2', res.data)
        self.assertEqual(self._items(), ())

    def test_past_days_are_locked(self):
        db("UPDATE itineraries SET start_date = DATE_SUB(CURDATE(), INTERVAL 2 DAY) WHERE itinerary_id = %s",
           (self.itin['itinerary_id'],))
        res = post(self.client, '/guest/itinerary/add', {'experience_id': 7, 'day_number': 1, 'time_block': 'morning'},
                   follow_redirects=True)
        self.assertIn(b'already in the past', res.data)
        self.assertEqual(self._items(), ())
        # a full session cannot be planned either
        day, yoga = self._bookable(12)
        original = db("SELECT booked_capacity FROM experience_slots WHERE slot_id = %s", (yoga['slot_id'],), one=True)['booked_capacity']
        db("UPDATE experience_slots SET booked_capacity = max_capacity WHERE slot_id = %s", (yoga['slot_id'],))
        try:
            res_full = post(self.client, '/guest/itinerary/add', {'experience_id': 12, 'day_number': day, 'time_block': 'morning',
                                                                  'slot_id': yoga['slot_id']}, follow_redirects=True)
            self.assertIn(b'fully booked', res_full.data)
        finally:
            db("UPDATE experience_slots SET booked_capacity = %s WHERE slot_id = %s", (original, yoga['slot_id']))
        html = self.client.get('/guest/itinerary').data.decode()
        self.assertEqual(len(re.findall(r'>Past</span>', html)), 2)       # day 1 and day 2 are past
        self.assertEqual(html.count('data-day="1"'), 0)                   # no "Plan" buttons on past days
        self.assertIn('data-day="3"', html)                               # today is still plannable
        post(self.client, '/guest/itinerary/add', {'experience_id': 7, 'day_number': 3, 'time_block': 'morning'})
        self.assertEqual(len(self._items()), 1)


if __name__ == '__main__':
    unittest.main()
