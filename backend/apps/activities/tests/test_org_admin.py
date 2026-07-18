"""El admin de Django es, hoy, el único "onboarding" real (no hay signup
self-service todavía) — confirma que crear una organización ahí aplica la
plantilla de flujo elegida."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.activities.models import Priority, WorkflowState
from apps.organizations.models import Organization

User = get_user_model()


class OrganizationAdminTemplateTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser(
            "root@nexo.com", "Root", "secret123", organization=None
        )
        self.client.force_login(self.superuser)

    def _post_add(self, **overrides):
        data = {
            "nombre": "Nueva Org",
            "slug": "nueva-org",
            "codigo_prefix": "NEW",
            "timezone": "America/Bogota",
            "locale": "es",
            "currency": "USD",
            "plan": "community",
            "feature_flags": "{}",
            "is_active": "on",
            "appsheet_spreadsheet_id": "",
            "appsheet_worksheet_name": "",
            "next_activity_numero": "1",
            "template": "kanban_simple",
        }
        data.update(overrides)
        return self.client.post(reverse("admin:organizations_organization_add"), data)

    def test_creating_org_applies_chosen_template(self):
        res = self._post_add()
        self.assertEqual(res.status_code, 302, res.content)
        org = Organization.objects.get(slug="nueva-org")
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 4)
        self.assertEqual(Priority.objects.for_org(org).count(), 3)

    def test_default_template_is_ti_clasico(self):
        res = self._post_add(slug="otra-org", template="ti_clasico")
        self.assertEqual(res.status_code, 302, res.content)
        org = Organization.objects.get(slug="otra-org")
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 6)

    def test_editing_existing_org_does_not_reapply_template(self):
        org = Organization.objects.create(slug="existente", nombre="Existente", codigo_prefix="EXI")
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 0)
        res = self.client.post(
            reverse("admin:organizations_organization_change", args=[org.pk]),
            {
                "nombre": "Existente Editada",
                "slug": "existente",
                "codigo_prefix": "EXI",
                "timezone": "America/Bogota",
                "locale": "es",
                "currency": "USD",
                "plan": "community",
                "feature_flags": "{}",
                "is_active": "on",
                "appsheet_spreadsheet_id": "",
                "appsheet_worksheet_name": "",
                "next_activity_numero": "1",
            },
        )
        self.assertEqual(res.status_code, 302, res.content)
        # El form de edición no tiene campo "template" — no debe crear estados solo.
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 0)
