from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.tests.factories import signup_payload
from apps.organizations.models import Organization
from apps.organizations.signup import SignupError
from apps.organizations.signup import register as signup_register
from apps.users.models import User


class SignupServiceTests(TestCase):
    """Unit tests directos sobre organizations.signup.register — la
    transacción todo-o-nada que crea org+owner+plantilla."""

    def test_success_creates_org_owner_and_applies_template(self):
        org, user = signup_register(
            email="owner@acme.com",
            password="contrasena-larga-123",
            nombre="Owner Acme",
            nombre_org="Acme",
            template_key="kanban_simple",
        )
        self.assertEqual(org.slug, "acme")
        self.assertEqual(user.rol, User.Role.OWNER)
        self.assertEqual(user.organization_id, org.pk)
        self.assertEqual(WorkflowState.objects.filter(organization=org).count(), 4)
        self.assertEqual(Priority.objects.filter(organization=org).count(), 3)

    def test_duplicate_org_name_gets_suffixed_slug(self):
        org1, _ = signup_register(**_kwargs(signup_payload(email="a@acme.com")))
        org2, _ = signup_register(**_kwargs(signup_payload(email="b@acme.com")))
        self.assertEqual(org1.slug, "acme")
        self.assertEqual(org2.slug, "acme-2")

    def test_double_submit_same_email_does_not_duplicate_org(self):
        signup_register(**_kwargs(signup_payload()))
        with self.assertRaises(SignupError):
            signup_register(**_kwargs(signup_payload()))
        self.assertEqual(Organization.objects.count(), 1)
        self.assertEqual(User.objects.count(), 1)

    def test_invalid_template_rolls_back_everything(self):
        with self.assertRaises(SignupError):
            signup_register(**_kwargs(signup_payload(template="no-existe")))
        self.assertEqual(Organization.objects.count(), 0)
        self.assertEqual(User.objects.count(), 0)

    def test_only_one_owner_per_organization_db_constraint(self):
        org, _ = signup_register(**_kwargs(signup_payload()))
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    "otro@acme.com", "Otro Owner", "x", organization=org, rol=User.Role.OWNER
                )


def _kwargs(payload: dict) -> dict:
    return {
        "email": payload["email"],
        "password": payload["password"],
        "nombre": payload["nombre"],
        "nombre_org": payload["nombre_org"],
        "template_key": payload["template"],
    }


class SignupViewTests(APITestCase):
    """POST /api/v1/auth/signup/ — el endpoint público de principio a fin."""

    def test_signup_success_returns_working_tokens(self):
        res = self.client.post(
            "/api/v1/auth/signup/", signup_payload(), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertEqual(res.data["user"]["rol"], "owner")
        self.assertEqual(res.data["organization"]["slug"], "acme")

        # El access token del signup sirve de inmediato — auto-login real.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.client.get("/api/v1/users/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["email"], signup_payload()["email"])

    def test_signup_owner_passes_admin_permission(self):
        res = self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        # /api/v1/users/ solo es visible para admin/coordinador.
        listing = self.client.get("/api/v1/users/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)

    def test_signup_duplicate_email_returns_400(self):
        self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        res = self.client.post("/api/v1/auth/signup/", signup_payload(), format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Organization.objects.count(), 1)

    def test_signup_invalid_template_returns_400(self):
        res = self.client.post(
            "/api/v1/auth/signup/", signup_payload(template="no-existe"), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_weak_password_returns_400(self):
        res = self.client.post(
            "/api/v1/auth/signup/", signup_payload(password="123"), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 0)

    def test_signup_missing_field_returns_400(self):
        payload = signup_payload()
        del payload["nombre_org"]
        res = self.client.post("/api/v1/auth/signup/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_templates_is_public_and_lists_presets(self):
        res = self.client.get("/api/v1/auth/signup/templates/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        keys = {tpl["key"] for tpl in res.data}
        self.assertIn("ti_clasico", keys)
