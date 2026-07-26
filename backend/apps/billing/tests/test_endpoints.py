"""Endpoints de facturación: estado, checkout, trial y portal."""
from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.activities.tests.factories import make_user
from apps.billing.models import CheckoutSession, Subscription
from apps.billing.provider import ProviderError
from apps.billing.tests.test_access import BILLING_ON, make_subscription


class BillingStateTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        self.client.force_authenticate(self.admin)

    def test_instancia_sin_proveedor_reporta_billing_deshabilitado(self):
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["billing_enabled"])
        self.assertIsNone(res.data["subscription"])
        self.assertEqual(res.data["plan"], "community")

    @override_settings(**BILLING_ON)
    def test_reporta_la_suscripcion_y_el_nivel_de_acceso(self):
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.data["access_level"], "read_only")
        self.assertEqual(res.data["subscription"]["status"], "past_due")
        self.assertFalse(res.data["trial_available"])

    def test_un_miembro_puede_leer_el_estado_pero_no_gestionarlo(self):
        """El banner de solo lectura lo tiene que ver todo el equipo; los
        botones de pago, solo quien puede pagar."""
        member = make_user("member@test.com", "Miembro", rol="member", organization=self.org)
        self.client.force_authenticate(member)
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["can_manage"])


class TrialTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        self.client.force_authenticate(self.admin)

    def test_inicia_trial_y_sube_el_plan_a_cloud(self):
        res = self.client.post("/api/v1/billing/trial/")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, "cloud")
        sub = Subscription.objects.get()
        self.assertEqual(sub.status, Subscription.Status.TRIALING)
        # Sin tarjeta = sin nada en el proveedor todavía.
        self.assertEqual(sub.provider_subscription_id, "")

    def test_el_trial_es_de_una_sola_vez(self):
        self.client.post("/api/v1/billing/trial/")
        res = self.client.post("/api/v1/billing/trial/")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Subscription.objects.count(), 1)

    def test_un_miembro_no_puede_iniciar_el_trial(self):
        member = make_user("member@test.com", "Miembro", rol="member", organization=self.org)
        self.client.force_authenticate(member)
        res = self.client.post("/api/v1/billing/trial/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(**BILLING_ON)
class CheckoutTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        self.client.force_authenticate(self.admin)

    @patch("apps.billing.provider.create_checkout")
    def test_devuelve_la_url_y_registra_la_sesion(self, mock_create):
        mock_create.return_value = {"id": "chk_1", "url": "https://acme.lemonsqueezy.com/buy/x"}
        res = self.client.post("/api/v1/billing/checkout/")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["url"], "https://acme.lemonsqueezy.com/buy/x")

        sesion = CheckoutSession.objects.get()
        self.assertEqual(sesion.provider_checkout_id, "chk_1")
        self.assertEqual(sesion.created_by, self.admin)
        # La organización viaja en custom_data: es como el webhook sabe a
        # quién aplicarle el pago.
        self.assertEqual(mock_create.call_args.kwargs["organization_id"], self.org.pk)

    @patch("apps.billing.provider.create_checkout", side_effect=ProviderError("502 del proveedor"))
    def test_error_del_proveedor_es_502_no_500(self, _mock):
        res = self.client.post("/api/v1/billing/checkout/")
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_un_miembro_no_puede_iniciar_el_checkout(self):
        member = make_user("member@test.com", "Miembro", rol="member", organization=self.org)
        self.client.force_authenticate(member)
        res = self.client.post("/api/v1/billing/checkout/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class CheckoutSinProveedorTests(APITestCase):
    def test_self_hosted_responde_503_sin_reventar(self):
        admin = make_user("admin@test.com", "Admin", rol="admin")
        self.client.force_authenticate(admin)
        res = self.client.post("/api/v1/billing/checkout/")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


@override_settings(**BILLING_ON)
class PortalTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        self.client.force_authenticate(self.admin)

    def test_sin_suscripcion_de_pago_es_404(self):
        res = self.client.get("/api/v1/billing/portal/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.billing.provider.get_subscription")
    def test_refresca_la_url_contra_el_proveedor(self, mock_get):
        make_subscription(self.org, customer_portal_url="https://vieja/portal")
        mock_get.return_value = {
            "customer_portal_url": "https://nueva/portal",
            "update_payment_url": "https://nueva/pago",
        }
        res = self.client.get("/api/v1/billing/portal/")
        self.assertEqual(res.data["url"], "https://nueva/portal")
        self.assertFalse(res.data["stale"])

    @patch("apps.billing.provider.get_subscription", side_effect=ProviderError("caído"))
    def test_si_el_proveedor_falla_sirve_la_url_guardada(self, _mock):
        """Dejar a alguien sin forma de cancelar porque el proveedor tuvo un
        mal minuto es peor que servirle una URL posiblemente vencida."""
        make_subscription(self.org, customer_portal_url="https://vieja/portal")
        res = self.client.get("/api/v1/billing/portal/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["url"], "https://vieja/portal")
        self.assertTrue(res.data["stale"])


class ExpireTrialsCommandTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization

    def test_revierte_a_community_el_trial_vencido(self):
        make_subscription(
            self.org,
            status=Subscription.Status.TRIALING,
            provider_subscription_id="",
            trial_ends_at=timezone.now() - timedelta(days=1),
        )
        self.org.plan = "cloud"
        self.org.save(update_fields=["plan"])

        call_command("expire_trials")
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, "community")

    def test_no_toca_un_trial_vigente(self):
        make_subscription(
            self.org,
            status=Subscription.Status.TRIALING,
            provider_subscription_id="",
            trial_ends_at=timezone.now() + timedelta(days=5),
        )
        self.org.plan = "cloud"
        self.org.save(update_fields=["plan"])

        call_command("expire_trials")
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, "cloud")


@override_settings(**BILLING_ON)
class DemoUserTests(APITestCase):
    """El usuario de la demo pública tiene rol=admin (para ver el org
    completo): sin el bloqueo de la capa de autenticación podría abrir un
    checkout real desde la landing."""

    def setUp(self):
        self.demo = make_user(
            "demo-admin@test.com", "Demo", rol="admin", is_demo_readonly=True
        )
        token = str(RefreshToken.for_user(self.demo).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_no_puede_abrir_un_checkout(self):
        res = self.client.post("/api/v1/billing/checkout/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_puede_iniciar_un_trial(self):
        res = self.client.post("/api/v1/billing/trial/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_si_puede_leer_el_estado(self):
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
