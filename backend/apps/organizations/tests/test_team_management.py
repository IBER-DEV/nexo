"""Gestión de equipo por el admin: cambiar rol y activar/desactivar acceso
vía PATCH /api/v1/users/{pk}/ (Bloque C, junto a los códigos de acceso)."""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import make_user
from apps.users.models import User


class TeamManagementTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.coordinator = make_user("coord@test.com", "Coordinadora", rol="coordinator")
        self.member = make_user(
            "member@test.com", "Miembro", rol="member", coordinador=self.coordinator
        )
        self.client.force_authenticate(self.admin)

    def _patch(self, user, payload):
        return self.client.patch(f"/api/v1/users/{user.pk}/", payload, format="json")

    def test_change_rol_member_to_coordinator(self):
        res = self._patch(self.member, {"rol": "coordinator"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.rol, "coordinator")
        # Al dejar de ser member, no conserva coordinador asignado.
        self.assertIsNone(self.member.coordinador_id)

    def test_demoting_coordinator_clears_their_team(self):
        res = self._patch(self.coordinator, {"rol": "member"})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.member.refresh_from_db()
        self.assertIsNone(self.member.coordinador_id)

    def test_cannot_promote_to_owner(self):
        res = self._patch(self.member, {"rol": "owner"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_change_own_rol(self):
        res = self._patch(self.admin, {"rol": "member"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_touch_the_owner(self):
        owner = make_user("owner@test.com", "Owner", rol="owner")
        for payload in ({"rol": "member"}, {"is_active": False}):
            res = self._patch(owner, payload)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, payload)

    def test_deactivate_blocks_login_and_keeps_history(self):
        self.member.set_password("demo1234")
        self.member.save()
        res = self._patch(self.member, {"is_active": False})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)

        anon = self.client.__class__()
        login = anon.post(
            "/api/v1/auth/token/",
            {"email": self.member.email, "password": "demo1234"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reactivate_deactivated_user(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])
        res = self._patch(self.member, {"is_active": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_active)

    def test_cannot_deactivate_self(self):
        res = self._patch(self.admin, {"is_active": False})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_list_includes_deactivated_users(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])
        res = self.client.get("/api/v1/users/")
        emails = {u["email"] for u in res.data}
        self.assertIn(self.member.email, emails)
        row = next(u for u in res.data if u["email"] == self.member.email)
        self.assertFalse(row["is_active"])