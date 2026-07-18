"""CRUD de maestros/catálogos: permisos por rol, unicidad por org y
protección de registros en uso."""
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Cliente

from .factories import make_activity, make_org, make_user


class CatalogCrudTests(APITestCase):
    def setUp(self):
        self.org = make_org("crud", "Crud Org")
        self.admin = make_user("admin@crud.com", "Admin", rol="admin", organization=self.org)
        self.member = make_user("member@crud.com", "Member", organization=self.org)

    def test_member_can_list_but_not_write(self):
        self.client.force_authenticate(self.member)
        res = self.client.get("/api/v1/clientes/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post("/api/v1/clientes/", {"nombre": "Nuevo"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_crud(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post("/api/v1/clientes/", {"nombre": "Globex"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        pk = res.data["id"]
        cliente = Cliente.objects.get(pk=pk)
        self.assertEqual(cliente.organization, self.org)

        res = self.client.patch(f"/api/v1/clientes/{pk}/", {"nombre": "Globex SA"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        res = self.client.delete(f"/api/v1/clientes/{pk}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_duplicate_nombre_in_org_rejected(self):
        self.client.force_authenticate(self.admin)
        self.client.post("/api/v1/clientes/", {"nombre": "Acme"}, format="json")
        res = self.client.post("/api/v1/clientes/", {"nombre": "acme"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_same_nombre_allowed_in_other_org(self):
        other_org = make_org("otra", "Otra")
        make_user("admin@otra.com", "Admin Otra", rol="admin", organization=other_org)
        Cliente.objects.create(organization=other_org, nombre="Acme")

        self.client.force_authenticate(self.admin)
        res = self.client.post("/api/v1/clientes/", {"nombre": "Acme"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_delete_in_use_returns_400_with_hint(self):
        make_activity(self.admin, empresa="EnUso")
        cliente = Cliente.objects.get(organization=self.org, nombre="EnUso")
        self.client.force_authenticate(self.admin)
        res = self.client.delete(f"/api/v1/clientes/{cliente.pk}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("archívalo", res.data["detail"])
        res = self.client.patch(f"/api/v1/clientes/{cliente.pk}/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_catalogs_isolated_between_orgs(self):
        other_org = make_org("aislada", "Aislada")
        Cliente.objects.create(organization=other_org, nombre="Invisible")
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/clientes/")
        nombres = {c["nombre"] for c in res.data}
        self.assertNotIn("Invisible", nombres)
