from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import activity_payload, make_activity, make_org, make_user


class AuthTests(APITestCase):
    def setUp(self):
        make_user("admin@test.com", "Admin", rol="admin", password="secret123")

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


DEMO_EMAIL = "demo-viewer@test.com"


@override_settings(DEMO_USER_EMAIL=DEMO_EMAIL)
class DemoLoginTests(APITestCase):
    def setUp(self):
        self.org = make_org(slug="demo-test")
        self.demo_user = make_user(
            DEMO_EMAIL, "Visitante demo", rol="admin", organization=self.org,
            is_demo_readonly=True,
        )
        self.activity = make_activity(self.demo_user)

    def _demo_token(self):
        res = self.client.post("/api/v1/auth/demo-login/")
        return res.data["access"]

    def test_demo_login_returns_tokens_without_password(self):
        res = self.client.post("/api/v1/auth/demo-login/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertTrue(res.data["user"]["is_demo_readonly"])

    def test_demo_login_404_when_not_configured(self):
        # No se puede borrar: tiene actividades con FK protegida. Basta con
        # que deje de matchear la búsqueda (email, is_demo_readonly, activo).
        self.demo_user.is_active = False
        self.demo_user.save(update_fields=["is_active"])
        res = self.client.post("/api/v1/auth/demo-login/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_demo_user_sees_all_org_activities_not_just_own(self):
        # rol=admin a propósito: ActivityViewSet filtra a member a solo sus
        # propias actividades (responsable/created_by) -- el demo-viewer no
        # es responsable de nada del seed real, así que con member vería el
        # dashboard vacío. Regresión de un bug real encontrado en producción.
        other_user = make_user("otro@test.com", "Otro", rol="member", organization=self.org)
        make_activity(other_user, nombre="Actividad de otra persona")
        token = self._demo_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.get("/api/v1/activities/")
        nombres = [a["nombre"] for a in res.data["results"]] if "results" in res.data else [
            a["nombre"] for a in res.data
        ]
        self.assertIn("Actividad de otra persona", nombres)

    def test_demo_user_can_read(self):
        token = self._demo_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_demo_user_cannot_create(self):
        token = self._demo_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.demo_user), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_demo_user_cannot_update(self):
        token = self._demo_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.patch(
            f"/api/v1/activities/{self.activity.pk}/", {"nombre": "hackeado"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_demo_user_cannot_delete(self):
        token = self._demo_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        res = self.client.delete(f"/api/v1/activities/{self.activity.pk}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_regular_user_unaffected(self):
        regular = make_user(
            "regular@test.com", "Regular", rol="admin", organization=self.org
        )
        self.client.force_authenticate(user=regular)
        res = self.client.post(
            "/api/v1/activities/", activity_payload(regular), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
