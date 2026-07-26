"""Cuota de MCP por plan: gratis en todos, con tope distinto."""
import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import make_user
from apps.billing.tests.test_access import BILLING_OFF, BILLING_ON
from apps.users.models import PersonalAccessToken

URL = "/api/v1/mcp/"


class ThrottleTests(APITestCase):
    def setUp(self):
        # El throttle de DRF vive en la caché: sin limpiarla, el conteo se
        # arrastra entre tests.
        cache.clear()
        self.user = make_user("dev@test.com", "Dev", rol="admin")
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")

    def tearDown(self):
        cache.clear()

    def ping(self):
        return self.client.post(
            URL,
            data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "ping"}),
            content_type="application/json",
        )

    @override_settings(**BILLING_OFF)
    def test_el_self_hosted_no_tiene_cuota(self):
        """Mismo principio que los puestos: no se limita un binario AGPL que
        corre en el servidor de otro."""
        with patch.dict("apps.mcp.throttling.PLAN_RATES", {"community": 1}):
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)

    @override_settings(**BILLING_ON)
    def test_el_tier_gratuito_tiene_tope(self):
        with patch.dict("apps.mcp.throttling.PLAN_RATES", {"community": 2}):
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
            self.assertEqual(self.ping().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(**BILLING_ON)
    def test_el_plan_de_pago_tiene_un_tope_mas_alto(self):
        self.user.organization.plan = "cloud"
        self.user.organization.save(update_fields=["plan"])
        with patch.dict("apps.mcp.throttling.PLAN_RATES", {"community": 1, "cloud": 10}):
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)

    @override_settings(**BILLING_ON)
    def test_enterprise_no_tiene_tope(self):
        self.user.organization.plan = "enterprise"
        self.user.organization.save(update_fields=["plan"])
        with patch.dict("apps.mcp.throttling.PLAN_RATES", {"enterprise": None}):
            for _ in range(3):
                self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
