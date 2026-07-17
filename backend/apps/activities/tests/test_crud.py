from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Activity

from .factories import activity_payload, make_activity, make_user


class ActivityCrudTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.client.force_authenticate(self.admin)

    def payload(self, **overrides):
        return activity_payload(self.admin, **overrides)

    def test_create_activity(self):
        res = self.client.post("/api/v1/activities/", self.payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["nombre"], "Migrar base de datos")
        activity = Activity.objects.get(pk=res.data["pk"])
        self.assertEqual(activity.created_by, self.admin)

    def test_create_autocomputes_planning_fields_from_dates(self):
        res = self.client.post("/api/v1/activities/", self.payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["mes_planeacion"], "2026-07")
        self.assertEqual(res.data["semana_planeacion"], 1)

    def test_partial_update(self):
        activity = make_activity(self.admin)
        res = self.client.patch(
            f"/api/v1/activities/{activity.pk}/", {"estado": "done"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        activity.refresh_from_db()
        self.assertEqual(activity.estado, "done")

    def test_delete(self):
        activity = make_activity(self.admin)
        res = self.client.delete(f"/api/v1/activities/{activity.pk}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Activity.objects.filter(pk=activity.pk).exists())

    def test_codigo_format(self):
        activity = make_activity(self.admin)
        self.assertEqual(activity.codigo, f"ACT-{activity.pk:04d}")
