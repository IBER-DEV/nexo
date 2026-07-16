"""
API tests for the activities app: auth, CRUD, and role-based visibility.
Run with `python manage.py test` (SQLite, config.settings.dev).
"""
import logging
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Activity

User = get_user_model()

# The AppSheet push signals fire on every Activity save and log a (harmless)
# error when Google Sheets isn't configured — silence them so test output
# stays readable.
logging.getLogger("apps.activities.signals").setLevel(logging.CRITICAL)


def make_activity(responsable, **overrides):
    defaults = {
        "empresa": "ACME",
        "proceso": "Soporte",
        "aplicacion": "ERP",
        "nombre": "Actividad de prueba",
        "descripcion": "",
        "stakeholder": "TI",
        "fecha_inicio": date.today(),
        "fecha_limite": date.today() + timedelta(days=7),
    }
    defaults.update(overrides)
    return Activity.objects.create(responsable=responsable, **defaults)


class AuthTests(APITestCase):
    def setUp(self):
        User.objects.create_user("admin@test.com", "Admin", "secret123", rol="admin")

    def test_token_obtain_with_valid_credentials(self):
        res = self.client.post(
            "/api/v1/auth/token/",
            {"email": "admin@test.com", "password": "secret123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_token_rejected_with_wrong_password(self):
        res = self.client.post(
            "/api/v1/auth/token/",
            {"email": "admin@test.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_activities_require_authentication(self):
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class ActivityCrudTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin@test.com", "Admin", "x", rol="admin")
        self.client.force_authenticate(self.admin)

    def payload(self, **overrides):
        data = {
            "empresa": "ACME",
            "proceso": "Soporte",
            "aplicacion": "ERP",
            "nombre": "Migrar base de datos",
            "descripcion": "detalle",
            "responsable_id": self.admin.pk,
            "stakeholder": "Operaciones",
            "prioridad": "high",
            "estado": "backlog",
            "fechaInicio": "2026-07-01",
            "fechaLimite": "2026-07-15",
        }
        data.update(overrides)
        return data

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


class RoleVisibilityTests(APITestCase):
    """get_queryset filters by role: admin sees all, coordinator their team,
    member only their own."""

    def setUp(self):
        self.admin = User.objects.create_user("admin@test.com", "Admin", "x", rol="admin")
        self.coordinator = User.objects.create_user(
            "coord@test.com", "Coordinadora", "x", rol="coordinator"
        )
        self.member = User.objects.create_user(
            "member@test.com", "Miembro Uno", "x", rol="member", coordinador=self.coordinator
        )
        self.outsider = User.objects.create_user("other@test.com", "Externo", "x", rol="member")

        self.member_activity = make_activity(self.member, nombre="Del miembro")
        self.outsider_activity = make_activity(self.outsider, nombre="Del externo")

    def list_ids(self):
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        return {row["pk"] for row in rows}

    def test_admin_sees_all(self):
        self.client.force_authenticate(self.admin)
        ids = self.list_ids()
        self.assertIn(self.member_activity.pk, ids)
        self.assertIn(self.outsider_activity.pk, ids)

    def test_member_sees_only_own(self):
        self.client.force_authenticate(self.member)
        ids = self.list_ids()
        self.assertIn(self.member_activity.pk, ids)
        self.assertNotIn(self.outsider_activity.pk, ids)

    def test_coordinator_sees_team_but_not_outsiders(self):
        self.client.force_authenticate(self.coordinator)
        ids = self.list_ids()
        self.assertIn(self.member_activity.pk, ids)
        self.assertNotIn(self.outsider_activity.pk, ids)

    def test_coordinator_cannot_assign_outside_team(self):
        self.client.force_authenticate(self.coordinator)
        res = self.client.post(
            "/api/v1/activities/",
            {
                "empresa": "ACME",
                "proceso": "Soporte",
                "aplicacion": "ERP",
                "nombre": "Asignación inválida",
                "descripcion": "",
                "responsable_id": self.outsider.pk,
                "stakeholder": "TI",
                "prioridad": "medium",
                "estado": "backlog",
                "fechaInicio": "2026-07-01",
                "fechaLimite": "2026-07-15",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("responsable_id", res.data)
