from rest_framework import status
from rest_framework.test import APITestCase

from .factories import activity_payload, make_activity, make_user


class RoleVisibilityTests(APITestCase):
    """get_queryset filters by role: admin sees all, coordinator their team,
    member only their own."""

    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.coordinator = make_user("coord@test.com", "Coordinadora", rol="coordinator")
        self.member = make_user(
            "member@test.com", "Miembro Uno", rol="member", coordinador=self.coordinator
        )
        self.outsider = make_user("other@test.com", "Externo", rol="member")

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
            activity_payload(self.outsider, nombre="Asignación inválida", prioridad="medium"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("responsable_id", res.data)
