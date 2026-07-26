"""Estado de suscripción → nivel de acceso, y su enforcement real sobre la
API. Los tests de enforcement usan un JWT de verdad, no `force_authenticate`:
la regla vive en la capa de autenticación y `force_authenticate` la saltea
por completo — un test que la use pasaría en verde sin probar nada."""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.activities.tests.factories import activity_payload, make_activity, make_user
from apps.billing.access import level_for_organization
from apps.billing.models import AccessLevel, Subscription

# Credenciales de mentira, pero presentes: is_configured() solo mira que las
# tres estén, nunca las usa si no se sale a la red.
BILLING_ON = dict(
    LEMONSQUEEZY_API_KEY="test-key",
    LEMONSQUEEZY_STORE_ID="1",
    LEMONSQUEEZY_VARIANT_ID_CLOUD="777",
    LEMONSQUEEZY_WEBHOOK_SECRET="s3cr3t",
)


def make_subscription(org, **overrides):
    defaults = {
        "organization": org,
        "status": Subscription.Status.ACTIVE,
        "plan": "cloud",
        "provider_subscription_id": "9001",
    }
    defaults.update(overrides)
    return Subscription.objects.create(**defaults)


class AccessLevelTests(TestCase):
    def setUp(self):
        self.user = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.user.organization

    def test_active_is_full(self):
        sub = make_subscription(self.org, status=Subscription.Status.ACTIVE)
        self.assertEqual(sub.access_level, AccessLevel.FULL)

    def test_trial_vigente_is_full_on_cloud(self):
        sub = make_subscription(
            self.org,
            status=Subscription.Status.TRIALING,
            trial_ends_at=timezone.now() + timedelta(days=3),
        )
        self.assertEqual(sub.access_level, AccessLevel.FULL)
        self.assertFalse(sub.trial_expired)
        self.assertEqual(sub.effective_plan, "cloud")

    def test_trial_vencido_conserva_acceso_pero_revierte_a_community(self):
        """La decisión de producto del módulo: un trial que caduca degrada el
        plan, no echa a nadie de su propia data."""
        sub = make_subscription(
            self.org,
            status=Subscription.Status.TRIALING,
            trial_ends_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(sub.access_level, AccessLevel.FULL)
        self.assertTrue(sub.trial_expired)
        self.assertEqual(sub.effective_plan, "community")

    def test_past_due_is_read_only(self):
        sub = make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        self.assertEqual(sub.access_level, AccessLevel.READ_ONLY)

    def test_paused_is_read_only(self):
        sub = make_subscription(self.org, status=Subscription.Status.PAUSED)
        self.assertEqual(sub.access_level, AccessLevel.READ_ONLY)

    def test_cancelled_con_periodo_pagado_sigue_completo(self):
        sub = make_subscription(
            self.org,
            status=Subscription.Status.CANCELLED,
            ends_at=timezone.now() + timedelta(days=10),
        )
        self.assertEqual(sub.access_level, AccessLevel.FULL)

    def test_cancelled_ya_vencida_es_solo_lectura(self):
        sub = make_subscription(
            self.org,
            status=Subscription.Status.CANCELLED,
            ends_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(sub.access_level, AccessLevel.READ_ONLY)

    def test_expired_is_blocked(self):
        sub = make_subscription(self.org, status=Subscription.Status.EXPIRED)
        self.assertEqual(sub.access_level, AccessLevel.BLOCKED)
        self.assertEqual(sub.effective_plan, "community")


class OrganizationLevelTests(TestCase):
    def setUp(self):
        self.user = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.user.organization

    def test_sin_proveedor_configurado_todo_es_completo(self):
        """El self-hosted AGPL no configura Lemon Squeezy: aunque quedara una
        fila de suscripción expirada, la facturación no gatea nada."""
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        self.assertEqual(level_for_organization(self.org), AccessLevel.FULL)

    @override_settings(**BILLING_ON)
    def test_organizacion_sin_suscripcion_es_completo(self):
        self.assertEqual(level_for_organization(self.org), AccessLevel.FULL)

    @override_settings(**BILLING_ON)
    def test_toma_la_suscripcion_viva_mas_reciente(self):
        make_subscription(
            self.org, status=Subscription.Status.TRIALING, provider_subscription_id=""
        )
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        self.assertEqual(level_for_organization(self.org), AccessLevel.READ_ONLY)

    @override_settings(**BILLING_ON)
    def test_trial_viejo_no_resucita_una_suscripcion_expirada(self):
        """Regresión del riesgo documentado en Subscription: si el trial local
        siguiera 'vivo', una suscripción de pago expirada le devolvería acceso
        completo a la organización."""
        make_subscription(
            self.org,
            status=Subscription.Status.EXPIRED,  # el trial, ya cerrado
            provider_subscription_id="",
        )
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        self.assertEqual(level_for_organization(self.org), AccessLevel.BLOCKED)


@override_settings(**BILLING_ON)
class EnforcementTests(APITestCase):
    def setUp(self):
        self.user = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.user.organization
        self.activity = make_activity(self.user)
        token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_past_due_permite_leer(self):
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_past_due_bloquea_escritura(self):
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        res = self.client.post("/api/v1/activities/", activity_payload(self.user), format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_expired_bloquea_hasta_la_lectura(self):
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_facturacion_sigue_accesible_con_la_organizacion_bloqueada(self):
        """Si el endpoint por el que se paga se bloqueara junto con el resto,
        la única salida sería soporte manual."""
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["access_level"], AccessLevel.BLOCKED)

    def test_activa_no_estorba(self):
        make_subscription(self.org, status=Subscription.Status.ACTIVE)
        res = self.client.post("/api/v1/activities/", activity_payload(self.user), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_sin_suscripcion_no_estorba(self):
        res = self.client.post("/api/v1/activities/", activity_payload(self.user), format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
