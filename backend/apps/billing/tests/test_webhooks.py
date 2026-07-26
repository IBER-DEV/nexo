"""Webhooks de Lemon Squeezy: firma, idempotencia y efecto sobre el plan."""
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import make_user
from apps.billing.models import Subscription, WebhookEvent
from apps.billing.tests.factories import payment_failed_webhook, sign, subscription_webhook
from apps.billing.tests.test_access import BILLING_ON, make_subscription

WEBHOOK_URL = "/api/v1/billing/webhook/"


@override_settings(**BILLING_ON)
class WebhookTests(APITestCase):
    def setUp(self):
        self.user = make_user("owner@test.com", "Owner", rol="owner")
        self.org = self.user.organization

    def _post(self, payload, *, secret="s3cr3t", signature=None):
        raw, firma = sign(payload, secret)
        return self.client.post(
            WEBHOOK_URL,
            data=raw,
            content_type="application/json",
            HTTP_X_SIGNATURE=signature if signature is not None else firma,
        )

    def test_subscription_created_crea_la_suscripcion_y_sube_el_plan(self):
        res = self._post(subscription_webhook(organization_id=self.org.pk))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        sub = Subscription.objects.get(provider_subscription_id="9001")
        self.assertEqual(sub.organization_id, self.org.pk)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertEqual(sub.provider_status, "active")
        self.assertEqual(sub.customer_portal_url, "https://acme.lemonsqueezy.com/billing/portal")
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, "cloud")

    def test_firma_invalida_es_401_y_no_escribe_nada(self):
        res = self._post(subscription_webhook(organization_id=self.org.pk), signature="deadbeef")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(Subscription.objects.exists())
        self.assertFalse(WebhookEvent.objects.exists())

    def test_sin_secreto_configurado_rechaza(self):
        """Fallar cerrado: un webhook sin firma verificable puede cambiarle el
        plan a cualquier organización."""
        with override_settings(LEMONSQUEEZY_WEBHOOK_SECRET=""):
            res = self._post(subscription_webhook(organization_id=self.org.pk), secret="")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reintento_del_mismo_evento_es_idempotente(self):
        payload = subscription_webhook(organization_id=self.org.pk)
        self._post(payload)
        res = self._post(payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(WebhookEvent.objects.count(), 1)
        self.assertEqual(Subscription.objects.count(), 1)

    def test_dos_updates_distintos_se_procesan_ambos(self):
        """La deduplicación es por contenido, no por suscripción: un cambio
        real de estado no puede confundirse con un reintento."""
        self._post(subscription_webhook(organization_id=self.org.pk))
        res = self._post(
            subscription_webhook(
                organization_id=self.org.pk, event_name="subscription_updated", status="past_due"
            )
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(WebhookEvent.objects.count(), 2)
        self.assertEqual(Subscription.objects.count(), 1)
        self.assertEqual(
            Subscription.objects.get().status, Subscription.Status.PAST_DUE
        )

    def test_evento_sin_organization_id_queda_registrado_como_fallido(self):
        payload = subscription_webhook(organization_id=self.org.pk)
        payload["meta"]["custom_data"] = {}
        res = self._post(payload)
        # 200 a propósito: reintentar no lo va a arreglar, y una tormenta de
        # reintentos tapa el problema en vez de mostrarlo.
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        evento = WebhookEvent.objects.get()
        self.assertEqual(evento.status, WebhookEvent.Status.FAILED)
        self.assertFalse(Subscription.objects.exists())

    def test_subscription_expired_revierte_el_plan_a_community(self):
        self._post(subscription_webhook(organization_id=self.org.pk))
        self._post(
            subscription_webhook(
                organization_id=self.org.pk, event_name="subscription_expired", status="expired"
            )
        )
        self.org.refresh_from_db()
        self.assertEqual(self.org.plan, "community")
        self.assertEqual(Subscription.objects.get().status, Subscription.Status.EXPIRED)

    def test_payment_failed_marca_la_suscripcion_como_vencida(self):
        self._post(subscription_webhook(organization_id=self.org.pk))
        res = self._post(payment_failed_webhook(organization_id=self.org.pk))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Subscription.objects.get().status, Subscription.Status.PAST_DUE)

    def test_evento_desconocido_se_ignora_sin_romper(self):
        payload = subscription_webhook(organization_id=self.org.pk)
        payload["meta"]["event_name"] = "order_refunded"
        res = self._post(payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(WebhookEvent.objects.get().status, WebhookEvent.Status.IGNORED)

    def test_conversion_de_trial_cierra_el_trial_local(self):
        trial = make_subscription(
            self.org, status=Subscription.Status.TRIALING, provider_subscription_id=""
        )
        self._post(subscription_webhook(organization_id=self.org.pk))
        trial.refresh_from_db()
        self.assertEqual(trial.status, Subscription.Status.EXPIRED)
        self.assertEqual(Subscription.objects.filter(status="active").count(), 1)

    def test_unpaid_del_proveedor_mapea_a_past_due(self):
        self._post(subscription_webhook(organization_id=self.org.pk, status="unpaid"))
        sub = Subscription.objects.get()
        self.assertEqual(sub.status, Subscription.Status.PAST_DUE)
        self.assertEqual(sub.provider_status, "unpaid")
