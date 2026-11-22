"""Administrator CRUD operations, dashboards and audit logging."""
import io
import re
import unittest
import uuid
from datetime import date, timedelta

from tests.helpers import ADMIN, GUEST, STAFF, db, ensure_test_database, login, make_app, post


def setUpModule():
    ensure_test_database()


EXPERIENCE_FORM = {
    'category_id': 2, 'supplier_id': '', 'short_desc': 'Night-sky stargazing with telescopes.',
    'full_desc': 'Guided astronomy session on the eastern meadow with a resident naturalist.',
    'pricing_type': 'per_person', 'base_price': 1900, 'duration_minutes': 90, 'min_party_size': 1,
    'max_party_size': 8, 'capacity_per_slot': 8, 'eco_impact_score': 97, 'is_low_impact': '1', 'is_active': '1',
    'age_restrictions': 'Ages 8+', 'accessibility_info': 'Level meadow', 'safety_instructions': 'Bring a torch',
}


class AdminCrudTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()
        self.client = self.app.test_client()
        login(self.client, ADMIN)

    def test_dashboard_kpis_match_database(self):
        res = self.client.get('/admin/dashboard')
        self.assertEqual(res.status_code, 200)
        html = res.data.decode()

        def tile(label):
            m = re.search(re.escape(label) + r'</div>\s*<div class="stat-tile__value">([^<]+)</div>', html)
            self.assertIsNotNone(m, label)
            return m.group(1).strip()

        self.assertEqual(tile('Registered guests'), str(db("SELECT COUNT(*) AS n FROM guests", one=True)['n']))
        self.assertEqual(tile('Confirmed bookings'),
                         str(db("SELECT COUNT(*) AS n FROM bookings WHERE booking_status = 'confirmed'", one=True)['n']))
        avg = db("SELECT AVG(rating) AS a FROM reviews WHERE is_approved = 1", one=True)['a']
        self.assertEqual(tile('Average rating'), f"{float(avg):.1f}")  # real average, no fabricated default

    def test_experience_create_edit_toggle_delete(self):
        slug = f'stargazing-{uuid.uuid4().hex[:6]}'
        res = post(self.client, '/admin/experiences/new', dict(EXPERIENCE_FORM, name='Meadow Stargazing', slug=slug))
        self.assertEqual(res.status_code, 302)
        exp = db("SELECT * FROM experiences WHERE slug = %s", (slug,), one=True)
        self.assertEqual(float(exp['base_price']), 1900.0)

        post(self.client, f'/admin/experiences/edit/{exp["experience_id"]}',
             dict(EXPERIENCE_FORM, name='Meadow Stargazing Deluxe', slug=slug, base_price=2100))
        edited = db("SELECT * FROM experiences WHERE experience_id = %s", (exp['experience_id'],), one=True)
        self.assertEqual(edited['name'], 'Meadow Stargazing Deluxe')
        # price change fired trg_experience_price_audit
        self.assertIsNotNone(db("SELECT log_id FROM audit_logs WHERE action_type = 'PRICE_CHANGE_TRIGGER' AND entity_id = %s",
                                (exp['experience_id'],), one=True))

        post(self.client, f'/admin/experiences/toggle-status/{exp["experience_id"]}')
        self.assertEqual(db("SELECT is_active FROM experiences WHERE experience_id = %s", (exp['experience_id'],), one=True)['is_active'], 0)
        self.assertEqual(self.client.get(f'/experiences/{slug}').status_code, 404)  # hidden from guests

        post(self.client, f'/admin/experiences/delete/{exp["experience_id"]}')
        self.assertIsNone(db("SELECT experience_id FROM experiences WHERE experience_id = %s", (exp['experience_id'],), one=True))

    def test_experience_validation_and_restrict_delete(self):
        res = post(self.client, '/admin/experiences/new', dict(EXPERIENCE_FORM, name='Bad', slug='Bad Slug!', min_party_size=9, max_party_size=2))
        self.assertEqual(res.status_code, 400)
        post(self.client, '/admin/experiences/delete/1')  # has bookings -> ON DELETE RESTRICT
        self.assertIsNotNone(db("SELECT experience_id FROM experiences WHERE experience_id = 1", one=True))

    def test_photo_upload_validates_file_type(self):
        slug = f'upload-{uuid.uuid4().hex[:6]}'
        fake = (io.BytesIO(b'not really an image'), 'photo.jpg')
        res = post(self.client, '/admin/experiences/new', dict(EXPERIENCE_FORM, name='Upload test', slug=slug, image_file=fake),
                   content_type='multipart/form-data')
        self.assertEqual(res.status_code, 400)
        png = (io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 64), 'photo.png')
        res_ok = post(self.client, '/admin/experiences/new', dict(EXPERIENCE_FORM, name='Upload test', slug=slug, image_file=png),
                      content_type='multipart/form-data')
        self.assertEqual(res_ok.status_code, 302)
        url = db("SELECT image_url FROM experiences WHERE slug = %s", (slug,), one=True)['image_url']
        self.assertTrue(url.startswith('/static/uploads/experiences/') and url.endswith('.png'))
        import os
        from config import Config
        path = os.path.join(Config.UPLOAD_FOLDER, url.rsplit('/', 1)[1])
        self.assertTrue(os.path.exists(path))
        os.remove(path)

    def test_photo_upload_disabled_on_serverless_hosting(self):
        """On Vercel the project folder is read-only: uploads are refused politely, image URLs still work."""
        slug = f'noupload-{uuid.uuid4().hex[:6]}'
        self.app.config['UPLOADS_ENABLED'] = False
        try:
            page = self.client.get('/admin/experiences/new').get_data(as_text=True)
            self.assertIn('Photo upload is switched off', page)
            self.assertNotIn('name="image_file"', page)
            png = (io.BytesIO(b'\x89PNG\r\n\x1a\n' + b'\x00' * 64), 'photo.png')
            res = post(self.client, '/admin/experiences/new',
                       dict(EXPERIENCE_FORM, name='No upload test', slug=slug, image_file=png),
                       content_type='multipart/form-data')
            self.assertEqual(res.status_code, 400)
            self.assertIn('Photo upload is not available', res.get_data(as_text=True))
            self.assertIsNone(db("SELECT 1 FROM experiences WHERE slug = %s", (slug,), one=True))
            res_url = post(self.client, '/admin/experiences/new',
                           dict(EXPERIENCE_FORM, name='No upload test', slug=slug,
                                image_url='https://example.com/photo.jpg'))
            self.assertEqual(res_url.status_code, 302)
            self.assertEqual(db("SELECT image_url FROM experiences WHERE slug = %s", (slug,), one=True)['image_url'],
                             'https://example.com/photo.jpg')
        finally:
            self.app.config['UPLOADS_ENABLED'] = True

    def test_slots_single_bulk_edit_delete(self):
        day = date.today() + timedelta(days=40)
        post(self.client, '/admin/schedules', {'experience_id': 4, 'slot_date': day.isoformat(), 'start_time': '09:00',
                                               'end_time': '15:00', 'max_capacity': 4})
        slot = db("SELECT * FROM experience_slots WHERE experience_id = 4 AND slot_date = %s", (day,), one=True)
        self.assertIsNotNone(slot)

        post(self.client, '/admin/schedules/generate', {'experience_id': 4, 'start_date': day.isoformat(),
                                                        'end_date': (day + timedelta(days=4)).isoformat(), 'start_time': '09:00',
                                                        'end_time': '15:00', 'max_capacity': 4})
        n = db("SELECT COUNT(*) AS n FROM experience_slots WHERE experience_id = 4 AND slot_date BETWEEN %s AND %s",
               (day, day + timedelta(days=4)), one=True)['n']
        self.assertEqual(n, 5)  # 4 new + the existing one skipped by INSERT IGNORE

        post(self.client, f'/admin/schedules/{slot["slot_id"]}/edit', {'start_time': '10:00', 'end_time': '16:00', 'max_capacity': 6})
        self.assertEqual(db("SELECT max_capacity FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True)['max_capacity'], 6)

        post(self.client, f'/admin/schedules/{slot["slot_id"]}/delete')
        self.assertIsNone(db("SELECT slot_id FROM experience_slots WHERE slot_id = %s", (slot['slot_id'],), one=True))
        post(self.client, '/admin/schedules/1/delete')  # referenced by bookings -> RESTRICT
        self.assertIsNotNone(db("SELECT slot_id FROM experience_slots WHERE slot_id = 1", one=True))

    def test_bulk_generation_rejected_by_procedure_validation(self):
        res = post(self.client, '/admin/schedules/generate', {'experience_id': 4, 'start_date': date.today().isoformat(),
                                                              'end_date': (date.today() + timedelta(days=200)).isoformat(),
                                                              'start_time': '09:00', 'end_time': '10:00', 'max_capacity': 4},
                   follow_redirects=True)
        self.assertIn(b'at most 90 days', res.data)

    def test_resource_and_maintenance_lifecycle(self):
        post(self.client, '/admin/resources/save', {'name': 'Telescope Kit', 'resource_type': 'equipment', 'total_quantity': 3,
                                                   'condition_status': 'good', 'is_sustainable': '1'})
        res = db("SELECT * FROM resources WHERE name = 'Telescope Kit'", one=True)
        post(self.client, f'/admin/resources/save/{res["resource_id"]}', {'name': 'Telescope Kit', 'resource_type': 'equipment',
                                                                         'total_quantity': 5, 'condition_status': 'excellent'})
        self.assertEqual(db("SELECT total_quantity FROM resources WHERE resource_id = %s", (res['resource_id'],), one=True)['total_quantity'], 5)

        today = date.today().isoformat()
        post(self.client, '/admin/maintenance/save', {'resource_id': res['resource_id'], 'start_date': today,
                                                                     'end_date': today, 'reason': 'Lens calibration'})
        m = db("SELECT * FROM maintenance_periods WHERE resource_id = %s", (res['resource_id'],), one=True)
        post(self.client, f'/admin/maintenance/{m["maintenance_id"]}/status', {'status': 'in_progress'})
        self.assertEqual(db("SELECT condition_status FROM resources WHERE resource_id = %s", (res['resource_id'],), one=True)['condition_status'], 'under_maintenance')
        post(self.client, f'/admin/maintenance/{m["maintenance_id"]}/status', {'status': 'completed'})
        self.assertEqual(db("SELECT condition_status FROM resources WHERE resource_id = %s", (res['resource_id'],), one=True)['condition_status'], 'good')

        post(self.client, f'/admin/resources/delete/{res["resource_id"]}')
        self.assertIsNone(db("SELECT resource_id FROM resources WHERE resource_id = %s", (res['resource_id'],), one=True))
        post(self.client, '/admin/resources/delete/6')  # allocated by booking 1 -> RESTRICT
        self.assertIsNotNone(db("SELECT resource_id FROM resources WHERE resource_id = 6", one=True))

    def test_supplier_crud(self):
        post(self.client, '/admin/suppliers/save', {'name': 'Coir Weavers Test', 'is_local': '1', 'is_active': '1', 'email': 'coir@example.org'})
        sup = db("SELECT * FROM suppliers WHERE name = 'Coir Weavers Test'", one=True)
        self.assertEqual(sup['is_local'], 1)
        post(self.client, f'/admin/suppliers/save/{sup["supplier_id"]}', {'name': 'Coir Weavers Co-op', 'is_active': '1'})
        self.assertEqual(db("SELECT name, is_local FROM suppliers WHERE supplier_id = %s", (sup['supplier_id'],), one=True)['name'], 'Coir Weavers Co-op')
        post(self.client, f'/admin/suppliers/delete/{sup["supplier_id"]}')
        self.assertIsNone(db("SELECT supplier_id FROM suppliers WHERE supplier_id = %s", (sup['supplier_id'],), one=True))

    def test_staff_account_creation_and_login(self):
        email = f'guide.{uuid.uuid4().hex[:6]}@solace.com'
        post(self.client, '/admin/staff/create', {'full_name': 'Kavya Nair', 'email': email, 'password': 'Guide2026x',
                                                  'specialization': 'Astronomy Guide', 'contact_phone': '123'})
        user = db("SELECT u.*, r.name AS role FROM users u JOIN roles r USING(role_id) WHERE email = %s", (email,), one=True)
        self.assertEqual(user['role'], 'staff')
        self.assertIsNotNone(db("SELECT staff_id FROM staff WHERE user_id = %s", (user['user_id'],), one=True))
        staff_client = self.app.test_client()
        res = login(staff_client, (email, 'Guide2026x'))
        self.assertTrue(res.headers['Location'].endswith('/staff/dashboard'))

    def test_user_toggle_and_self_protection(self):
        post(self.client, '/admin/users/9/toggle')
        self.assertEqual(db("SELECT is_active FROM users WHERE user_id = 9", one=True)['is_active'], 0)
        post(self.client, '/admin/users/9/toggle')
        self.assertEqual(db("SELECT is_active FROM users WHERE user_id = 9", one=True)['is_active'], 1)
        post(self.client, '/admin/users/1/toggle')  # admin cannot deactivate self
        self.assertEqual(db("SELECT is_active FROM users WHERE user_id = 1", one=True)['is_active'], 1)

    def test_review_moderation_changes_public_rating(self):
        post(self.client, '/admin/reviews/3/toggle')  # hide Arjun's 4-star birdwatching review
        self.assertEqual(db("SELECT is_approved FROM reviews WHERE review_id = 3", one=True)['is_approved'], 0)
        v = db("SELECT avg_rating, total_reviews FROM v_experience_details WHERE experience_id = 5", one=True)
        self.assertIsNone(v['avg_rating'])
        self.assertEqual(v['total_reviews'], 0)
        post(self.client, '/admin/reviews/3/toggle')
        self.assertEqual(db("SELECT is_approved FROM reviews WHERE review_id = 3", one=True)['is_approved'], 1)

    def test_admin_actions_are_audited(self):
        before = db("SELECT COUNT(*) AS n FROM audit_logs", one=True)['n']
        post(self.client, '/admin/users/8/toggle')
        post(self.client, '/admin/users/8/toggle')
        self.assertEqual(db("SELECT COUNT(*) AS n FROM audit_logs", one=True)['n'], before + 2)
        self.assertEqual(self.client.get('/admin/audit-logs?action=TOGGLE_USER').status_code, 200)

    def test_all_admin_pages_render(self):
        for url in ['/admin/dashboard', '/admin/experiences', '/admin/experiences/new', '/admin/experiences/edit/2',
                    '/admin/schedules', '/admin/resources', '/admin/staff-suppliers', '/admin/users', '/admin/reviews',
                    '/admin/bookings', '/admin/bookings?status=confirmed', '/admin/reports', '/admin/audit-logs']:
            self.assertEqual(self.client.get(url).status_code, 200, url)


class DashboardTests(unittest.TestCase):

    def setUp(self):
        self.app = make_app()

    def test_guest_dashboard_uses_database_values(self):
        c = self.app.test_client()
        login(c, GUEST)
        res = c.get('/guest/dashboard')
        self.assertEqual(res.status_code, 200)
        spent = db("""SELECT COALESCE(SUM(total_amount), 0) AS s FROM bookings
                      WHERE guest_id = 7 AND booking_status IN ('confirmed', 'pending')""", one=True)['s']
        self.assertIn(f"₹{float(spent):,.0f}".encode(), res.data)

    def test_staff_dashboard_lists_assignments(self):
        c = self.app.test_client()
        login(c, STAFF)
        res = c.get('/staff/dashboard?view=history')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'Guided Dawn Rainforest Birdwatching', res.data)  # completed booking 7 led by Aarav


if __name__ == '__main__':
    unittest.main()
