from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import signup_payload
from apps.organizations.membership import (
    MembershipError,
    add_member,
    generate_access_code,
    redeem_access_code,
    register_with_code,
    resolve_access_code,
)
from apps.organizations.models import Organization, OrganizationAccessCode
from apps.organizations.signup import register as signup_register
from apps.users.models import User


def _make_org_with_owner(nombre="Acme", email="owner@acme.com"):
    return signup_register(
        email=email,
        password="contrasena-larga-123",
        nombre="Owner",
        nombre_org=nombre,
        template_key="kanban_simple",
    )


def _make_loose_user(email="suelto@nexo.dev"):
    """Usuario recién creado, sin organización — el estado transitorio del
    modo 'Tengo un código'."""
    return User.objects.create_user(email, "Suelto", "x")


class AddMemberTests(TestCase):
    def setUp(self):
        self.org, self.owner = _make_org_with_owner()

    def test_add_member_joins_user_with_rol(self):
        user = _make_loose_user()
        add_member(user=user, organization=self.org, rol="member")
        user.refresh_from_db()
        self.assertEqual(user.organization_id, self.org.pk)
        self.assertEqual(user.rol, "member")

    def test_add_member_rejects_owner_rol(self):
        user = _make_loose_user()
        with self.assertRaises(MembershipError):
            add_member(user=user, organization=self.org, rol="owner")

    def test_add_member_rejects_unknown_rol(self):
        user = _make_loose_user()
        with self.assertRaises(MembershipError):
            add_member(user=user, organization=self.org, rol="superjefe")

    def test_add_member_rejects_user_already_in_an_org(self):
        with self.assertRaises(MembershipError):
            add_member(user=self.owner, organization=self.org, rol="member")


class AccessCodeTests(TestCase):
    def setUp(self):
        self.org, self.owner = _make_org_with_owner()

    def _code(self, **overrides):
        defaults = {"organization": self.org, "rol": "member", "created_by": self.owner}
        defaults.update(overrides)
        return generate_access_code(**defaults)

    def test_generate_produces_formatted_unique_code(self):
        code = self._code()
        self.assertRegex(code.codigo, r"^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$")
        self.assertNotEqual(code.codigo, self._code().codigo)

    def test_generate_rejects_owner_rol(self):
        with self.assertRaises(MembershipError):
            self._code(rol="owner")

    def test_redeem_joins_and_increments_usos(self):
        code = self._code(max_usos=2)
        user = _make_loose_user()
        org = redeem_access_code(user=user, codigo=code.codigo)
        code.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(org.pk, self.org.pk)
        self.assertEqual(code.usos, 1)
        self.assertEqual(user.organization_id, self.org.pk)

    def test_redeem_is_case_and_whitespace_tolerant(self):
        code = self._code()
        user = _make_loose_user()
        redeem_access_code(user=user, codigo=f"  {code.codigo.lower()}  ")
        user.refresh_from_db()
        self.assertEqual(user.organization_id, self.org.pk)

    def test_redeem_exhausted_code_fails(self):
        code = self._code(max_usos=1)
        redeem_access_code(user=_make_loose_user("a@nexo.dev"), codigo=code.codigo)
        with self.assertRaises(MembershipError):
            redeem_access_code(user=_make_loose_user("b@nexo.dev"), codigo=code.codigo)

    def test_redeem_expired_code_fails(self):
        code = self._code(expires_at=timezone.now() - timedelta(minutes=1))
        with self.assertRaises(MembershipError):
            redeem_access_code(user=_make_loose_user(), codigo=code.codigo)

    def test_redeem_inactive_code_fails(self):
        code = self._code()
        code.is_active = False
        code.save(update_fields=["is_active"])
        with self.assertRaises(MembershipError):
            redeem_access_code(user=_make_loose_user(), codigo=code.codigo)

    def test_redeem_unknown_code_fails(self):
        with self.assertRaises(MembershipError):
            redeem_access_code(user=_make_loose_user(), codigo="AAAA-BBBB-CCCC")

    def test_failed_redeem_does_not_join_nor_count(self):
        code = self._code(expires_at=timezone.now() - timedelta(minutes=1))
        user = _make_loose_user()
        with self.assertRaises(MembershipError):
            redeem_access_code(user=user, codigo=code.codigo)
        code.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(code.usos, 0)
        self.assertIsNone(user.organization_id)

    def test_resolve_returns_org_without_consuming(self):
        code = self._code(max_usos=1)
        resolved = resolve_access_code(code.codigo)
        code.refresh_from_db()
        self.assertEqual(resolved.organization.pk, self.org.pk)
        self.assertEqual(code.usos, 0)


class RegisterWithCodeTests(TestCase):
    def setUp(self):
        self.org, self.owner = _make_org_with_owner()
        self.code = generate_access_code(
            organization=self.org, rol="coordinator", created_by=self.owner
        )

    def test_creates_account_in_existing_org_with_code_rol(self):
        org, user = register_with_code(
            email="nueva@acme.com",
            password="contrasena-larga-123",
            nombre="Nueva",
            codigo=self.code.codigo,
        )
        self.assertEqual(org.pk, self.org.pk)
        self.assertEqual(user.rol, "coordinator")
        self.assertEqual(user.organization_id, self.org.pk)

    def test_invalid_code_rolls_back_user_creation(self):
        before = User.objects.count()
        with self.assertRaises(MembershipError):
            register_with_code(
                email="nueva@acme.com",
                password="contrasena-larga-123",
                nombre="Nueva",
                codigo="AAAA-BBBB-CCCC",
            )
        self.assertEqual(User.objects.count(), before)

    def test_duplicate_email_fails_without_side_effects(self):
        with self.assertRaises(MembershipError):
            register_with_code(
                email=self.owner.email,
                password="contrasena-larga-123",
                nombre="Impostor",
                codigo=self.code.codigo,
            )
        self.code.refresh_from_db()
        self.assertEqual(self.code.usos, 0)
        self.assertEqual(Organization.objects.count(), 1)


class SignupWithCodeAPITests(APITestCase):
    """POST /api/v1/auth/signup/ en modo access_code, y el resolve público."""

    def setUp(self):
        self.org, self.owner = _make_org_with_owner()
        self.code = generate_access_code(
            organization=self.org, rol="member", created_by=self.owner
        )

    def test_signup_with_code_returns_working_tokens(self):
        res = self.client.post(
            "/api/v1/auth/signup/",
            signup_payload_with_code(self.code.codigo),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["user"]["rol"], "member")
        self.assertEqual(res.data["organization"]["slug"], self.org.slug)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.client.get("/api/v1/users/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)

    def test_signup_rejects_both_modes_at_once(self):
        payload = signup_payload(access_code=self.code.codigo)
        res = self.client.post("/api/v1/auth/signup/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_rejects_neither_mode(self):
        payload = signup_payload()
        del payload["nombre_org"]
        del payload["template"]
        res = self.client.post("/api/v1/auth/signup/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signup_with_invalid_code_returns_400_and_no_user(self):
        before = User.objects.count()
        res = self.client.post(
            "/api/v1/auth/signup/",
            signup_payload_with_code("AAAA-BBBB-CCCC"),
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), before)

    def test_resolve_valid_code_is_public(self):
        res = self.client.get(f"/api/v1/auth/access-codes/resolve/?codigo={self.code.codigo}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["organization_nombre"], self.org.nombre)
        self.assertEqual(res.data["rol"], "member")

    def test_resolve_invalid_code_returns_400(self):
        res = self.client.get("/api/v1/auth/access-codes/resolve/?codigo=AAAA-BBBB-CCCC")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


def signup_payload_with_code(codigo: str, **overrides):
    data = {
        "email": "nuevo-miembro@acme.com",
        "password": "contrasena-larga-123",
        "nombre": "Nuevo Miembro",
        "access_code": codigo,
    }
    data.update(overrides)
    return data


class AccessCodeAdminAPITests(APITestCase):
    """CRUD de /api/v1/access-codes/ — solo admin/owner, org-scoped."""

    def setUp(self):
        self.org, self.owner = _make_org_with_owner()
        self.client.force_authenticate(self.owner)

    def test_create_generates_code(self):
        res = self.client.post(
            "/api/v1/access-codes/", {"rol": "member", "max_usos": 5}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertRegex(res.data["codigo"], r"^[2-9A-HJKMNP-Z]{4}-")
        self.assertEqual(res.data["usos"], 0)

    def test_create_rejects_owner_rol(self):
        res = self.client.post("/api/v1/access-codes/", {"rol": "owner"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_cannot_manage_codes(self):
        member = _make_loose_user("member@acme.com")
        add_member(user=member, organization=self.org, rol="member")
        self.client.force_authenticate(member)
        self.assertEqual(
            self.client.get("/api/v1/access-codes/").status_code, status.HTTP_403_FORBIDDEN
        )

    def test_codes_are_org_scoped(self):
        code_mine = generate_access_code(
            organization=self.org, rol="member", created_by=self.owner
        )
        other_org, other_owner = _make_org_with_owner(nombre="Otra", email="owner@otra.com")
        code_other = generate_access_code(
            organization=other_org, rol="member", created_by=other_owner
        )
        res = self.client.get("/api/v1/access-codes/")
        ids = {c["id"] for c in res.data}
        self.assertIn(code_mine.pk, ids)
        self.assertNotIn(code_other.pk, ids)
        detail = self.client.get(f"/api/v1/access-codes/{code_other.pk}/")
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_only_toggles_is_active(self):
        code = generate_access_code(
            organization=self.org, rol="member", created_by=self.owner
        )
        res = self.client.patch(
            f"/api/v1/access-codes/{code.pk}/",
            {"is_active": False, "rol": "admin"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        code.refresh_from_db()
        self.assertFalse(code.is_active)
        self.assertEqual(code.rol, "member")  # rol no cambia por PATCH
