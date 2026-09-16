"""Cuota de MCP: decisión del operador, no un muro comercial.

Nexo es gratis en todas sus versiones, así que no hay un tope "del plan
gratis" que se levante pagando. Lo único que se acota es la infraestructura
que atiende las llamadas, y eso lo decide quien corre la instancia.
"""
import json

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import make_user
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

    @override_settings(MCP_DAILY_LIMIT=None)
    def test_sin_limite_configurado_no_hay_cuota(self):
        """El default: un self-hosted paga su propio servidor, el software no
        tiene por qué racionárselo."""
        for _ in range(5):
            self.assertEqual(self.ping().status_code, status.HTTP_200_OK)

    @override_settings(MCP_DAILY_LIMIT=2)
    def test_el_operador_puede_poner_un_tope(self):
        self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
        self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
        self.assertEqual(self.ping().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @override_settings(MCP_DAILY_LIMIT=1)
    def test_el_tope_es_por_usuario_no_global(self):
        """Una instancia con cupo compartido entre todos sería inusable en
        cuanto haya dos personas con MCP conectado."""
        self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
        otro = make_user("otra@test.com", "Otra", rol="admin")
        _, raw = PersonalAccessToken.issue(user=otro, nombre="MCP")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
        self.assertEqual(self.ping().status_code, status.HTTP_200_OK)
