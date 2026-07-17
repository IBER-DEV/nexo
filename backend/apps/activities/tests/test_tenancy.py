"""Aislamiento entre organizaciones: el test más importante del bloque
multi-tenancy. Un usuario de la org A no debe poder ver, editar ni
referenciar nada de la org B."""
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import activity_payload, make_activity, make_org, make_user


class TenancyIsolationTests(APITestCase):
    def setUp(self):
        self.org_a = make_org("org-a", "Org A")
        self.org_b = make_org("org-b", "Org B")

        self.admin_a = make_user("admin@a.com", "Admin A", rol="admin", organization=self.org_a)
        self.admin_b = make_user("admin@b.com", "Admin B", rol="admin", organization=self.org_b)

        self.activity_a = make_activity(self.admin_a, nombre="De la org A")
        self.activity_b = make_activity(self.admin_b, nombre="De la org B")

    def test_list_only_shows_own_org(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        ids = {row["pk"] for row in rows}
        self.assertIn(self.activity_a.pk, ids)
        self.assertNotIn(self.activity_b.pk, ids)

    def test_detail_of_other_org_is_404(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.get(f"/api/v1/activities/{self.activity_b.pk}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_of_other_org_is_404(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.patch(
            f"/api/v1/activities/{self.activity_b.pk}/", {"nombre": "hackeada"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_of_other_org_is_404(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.delete(f"/api/v1/activities/{self.activity_b.pk}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_assign_responsable_from_other_org(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.post(
            "/api/v1/activities/",
            activity_payload(self.admin_b),  # responsable de la org B
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("responsable_id", res.data)

    def test_created_activity_lands_in_own_org(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.post("/api/v1/activities/", activity_payload(self.admin_a), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        from apps.activities.models import Activity

        activity = Activity.objects.get(pk=res.data["pk"])
        self.assertEqual(activity.organization, self.org_a)

    def test_meta_only_reflects_own_org(self):
        make_activity(self.admin_b, empresa="SoloEnB")
        self.client.force_authenticate(self.admin_a)
        res = self.client.get("/api/v1/activities/meta/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("SoloEnB", res.data["empresas"])

    def test_user_list_only_own_org(self):
        self.client.force_authenticate(self.admin_a)
        res = self.client.get("/api/v1/users/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        emails = {u["email"] for u in res.data}
        self.assertIn("admin@a.com", emails)
        self.assertNotIn("admin@b.com", emails)

    def test_platform_superuser_without_org_sees_nothing(self):
        superuser = make_user(
            "root@nexo.com", "Root", rol="admin", organization=self.org_a
        )
        superuser.organization = None
        superuser.is_superuser = True
        superuser.save()
        self.client.force_authenticate(superuser)
        res = self.client.get("/api/v1/activities/")
        rows = res.data["results"] if isinstance(res.data, dict) else res.data
        self.assertEqual(list(rows), [])
