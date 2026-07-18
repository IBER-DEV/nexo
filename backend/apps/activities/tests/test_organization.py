"""GET/PATCH /api/v1/organization/ — solo admin, sin lookup por id (no hay
forma de pedir la organización de otro tenant)."""
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import make_org, make_user


class OrganizationDetailTests(APITestCase):
    def setUp(self):
        self.org = make_org("orgdetail", "Org Detail")
        self.admin = make_user("admin@orgdetail.com", "Admin", rol="admin", organization=self.org)
        self.member = make_user("member@orgdetail.com", "Member", organization=self.org)

    def test_admin_can_view_and_update(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/organization/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["slug"], "orgdetail")

        res = self.client.patch(
            "/api/v1/organization/", {"nombre": "Org Detail SA", "timezone": "UTC"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.nombre, "Org Detail SA")
        self.assertEqual(self.org.timezone, "UTC")

    def test_member_forbidden(self):
        self.client.force_authenticate(self.member)
        res = self.client.get("/api/v1/organization/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_slug_and_plan_are_read_only(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            "/api/v1/organization/", {"slug": "hackeado", "plan": "enterprise"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.slug, "orgdetail")
        self.assertEqual(self.org.plan, "community")

    def test_admin_only_sees_own_org(self):
        other_org = make_org("otradetail", "Otra Detail")
        other_admin = make_user(
            "admin@otradetail.com", "Admin Otra", rol="admin", organization=other_org
        )
        self.client.force_authenticate(other_admin)
        res = self.client.get("/api/v1/organization/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["slug"], "otradetail")
