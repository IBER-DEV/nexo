"""Tokens de acceso personal: emisión, autenticación y —lo más importante—
que un mecanismo de autenticación nuevo no se salte las reglas globales.

Los tests de enforcement usan un token real en el header, no
`force_authenticate`: la política vive en la capa de autenticación y
`force_authenticate` la saltea por completo, así que un test que la use
pasaría en verde sin probar nada."""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import activity_payload, make_activity, make_user
from apps.billing.models import Subscription
from apps.billing.tests.test_access import BILLING_ON, make_subscription
from apps.users.models import PersonalAccessToken


class IssueTests(TestCase):
    def setUp(self):
        self.user = make_user("dev@test.com", "Dev", rol="admin")

    def test_el_valor_en_claro_no_se_guarda(self):
        token, raw = PersonalAccessToken.issue(user=self.user, nombre="Claude Desktop")
        self.assertTrue(raw.startswith("nxo_"))
        self.assertNotIn(raw, token.token_hash)
        self.assertEqual(token.token_hash, PersonalAccessToken.hash_token(raw))
        # El prefijo visible alcanza para reconocerlo, no para reconstruirlo.
        self.assertTrue(raw.startswith(token.prefix))
        self.assertLess(len(token.prefix), len(raw))

    def test_dos_tokens_nunca_coinciden(self):
        _, raw1 = PersonalAccessToken.issue(user=self.user, nombre="A")
        _, raw2 = PersonalAccessToken.issue(user=self.user, nombre="B")
        self.assertNotEqual(raw1, raw2)

    def test_revocar_es_idempotente_y_no_borra(self):
        token, _ = PersonalAccessToken.issue(user=self.user, nombre="A")
        token.revoke()
        primero = token.revoked_at
        token.revoke()
        self.assertEqual(token.revoked_at, primero)
        self.assertTrue(PersonalAccessToken.objects.filter(pk=token.pk).exists())

    def test_usabilidad_segun_expiracion(self):
        vivo, _ = PersonalAccessToken.issue(
            user=self.user, nombre="vivo", expires_at=timezone.now() + timedelta(days=1)
        )
        vencido, _ = PersonalAccessToken.issue(
            user=self.user, nombre="vencido", expires_at=timezone.now() - timedelta(seconds=1)
        )
        self.assertTrue(vivo.is_usable)
        self.assertFalse(vencido.is_usable)


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = make_user("dev@test.com", "Dev", rol="admin")
        self.activity = make_activity(self.user)

    def _auth(self, raw):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")

    def test_un_token_valido_autentica(self):
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self._auth(raw)
        res = self.client.get("/api/v1/activities/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_un_token_read_write_puede_escribir(self):
        _, raw = PersonalAccessToken.issue(
            user=self.user, nombre="MCP", scope=PersonalAccessToken.Scope.READ_WRITE
        )
        self._auth(raw)
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.user), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_un_token_de_solo_lectura_lee_pero_no_escribe(self):
        """El caso de uso concreto: darle a una IA acceso al backlog sin que
        pueda modificarlo."""
        _, raw = PersonalAccessToken.issue(
            user=self.user, nombre="Claude", scope=PersonalAccessToken.Scope.READ
        )
        self._auth(raw)
        self.assertEqual(self.client.get("/api/v1/activities/").status_code, status.HTTP_200_OK)
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.user), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_token_revocado_no_autentica(self):
        token, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        token.revoke()
        self._auth(raw)
        self.assertEqual(
            self.client.get("/api/v1/activities/").status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_token_expirado_no_autentica(self):
        _, raw = PersonalAccessToken.issue(
            user=self.user, nombre="MCP", expires_at=timezone.now() - timedelta(seconds=1)
        )
        self._auth(raw)
        self.assertEqual(
            self.client.get("/api/v1/activities/").status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_token_inexistente_no_autentica(self):
        self._auth("nxo_esto-no-existe-para-nada")
        self.assertEqual(
            self.client.get("/api/v1/activities/").status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_desactivar_al_dueno_corta_sus_integraciones(self):
        """Quitarle el acceso a alguien tiene que cortarle también sus
        tokens, no solo el login del navegador."""
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        self._auth(raw)
        self.assertEqual(
            self.client.get("/api/v1/activities/").status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_el_jwt_sigue_funcionando(self):
        """Los dos mecanismos comparten el header `Bearer`: el de tokens
        tiene que devolver None ante un JWT y dejarle el paso."""
        res = self.client.post(
            "/api/v1/auth/token/",
            {"email": "dev@test.com", "password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self._auth(res.data["access"])
        self.assertEqual(self.client.get("/api/v1/activities/").status_code, status.HTTP_200_OK)

    def test_actualiza_last_used_at(self):
        token, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self.assertIsNone(token.last_used_at)
        self._auth(raw)
        self.client.get("/api/v1/activities/")
        token.refresh_from_db()
        self.assertIsNotNone(token.last_used_at)


class GlobalPolicyTests(APITestCase):
    """El motivo del refactor: agregar un mecanismo de autenticación no
    puede abrir un agujero en las reglas que valen para toda la API."""

    def setUp(self):
        self.user = make_user("dev@test.com", "Dev", rol="admin")
        self.org = self.user.organization
        self.activity = make_activity(self.user)

    def _auth(self, raw):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")

    @override_settings(**BILLING_ON)
    def test_un_token_no_escapa_al_estado_de_la_suscripcion(self):
        """Sin la política compartida, un token con la organización en
        `past_due` podría escribir mientras el navegador no puede."""
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self._auth(raw)
        self.assertEqual(self.client.get("/api/v1/activities/").status_code, status.HTTP_200_OK)
        res = self.client.post(
            "/api/v1/activities/", activity_payload(self.user), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(**BILLING_ON)
    def test_una_suscripcion_expirada_bloquea_tambien_por_token(self):
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP")
        self._auth(raw)
        self.assertEqual(
            self.client.get("/api/v1/activities/").status_code, status.HTTP_403_FORBIDDEN
        )

    def test_un_token_de_la_demo_publica_no_escribe(self):
        demo = make_user(
            "demo-admin@test.com", "Demo", rol="admin", is_demo_readonly=True,
            organization=self.org,
        )
        _, raw = PersonalAccessToken.issue(user=demo, nombre="MCP")
        self._auth(raw)
        res = self.client.post(
            "/api/v1/activities/", activity_payload(demo), format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_un_token_no_puede_gestionar_tokens(self):
        """Si pudiera, uno de solo lectura emitiría uno de escritura y el
        scope no valdría nada."""
        _, raw = PersonalAccessToken.issue(
            user=self.user, nombre="MCP", scope=PersonalAccessToken.Scope.READ_WRITE
        )
        self._auth(raw)
        self.assertEqual(
            self.client.get("/api/v1/auth/tokens/").status_code, status.HTTP_403_FORBIDDEN
        )
        res = self.client.post(
            "/api/v1/auth/tokens/", {"nombre": "escalada"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class EndpointTests(APITestCase):
    def setUp(self):
        self.user = make_user("dev@test.com", "Dev", rol="member")
        self.otro = make_user("otro@test.com", "Otro", rol="member")
        self.client.force_authenticate(self.user)

    def test_crear_devuelve_el_token_una_sola_vez(self):
        res = self.client.post(
            "/api/v1/auth/tokens/", {"nombre": "Claude Desktop"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIn("token", res.data)
        self.assertTrue(res.data["token"].startswith("nxo_"))

        # Al listarlos, el valor ya no está en ninguna parte.
        listado = self.client.get("/api/v1/auth/tokens/")
        self.assertEqual(len(listado.data), 1)
        self.assertNotIn("token", listado.data[0])

    def test_cualquier_rol_puede_emitir_para_si_mismo(self):
        """Un token no puede más que su dueño, así que no hay razón para
        que sea privilegio de admin."""
        res = self.client.post("/api/v1/auth/tokens/", {"nombre": "mio"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_solo_se_ven_los_propios(self):
        PersonalAccessToken.issue(user=self.otro, nombre="del otro")
        PersonalAccessToken.issue(user=self.user, nombre="mio")
        res = self.client.get("/api/v1/auth/tokens/")
        self.assertEqual([t["nombre"] for t in res.data], ["mio"])

    def test_no_se_puede_revocar_el_token_de_otro(self):
        ajeno, _ = PersonalAccessToken.issue(user=self.otro, nombre="del otro")
        res = self.client.delete(f"/api/v1/auth/tokens/{ajeno.pk}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        ajeno.refresh_from_db()
        self.assertIsNone(ajeno.revoked_at)

    def test_revocar_el_propio(self):
        mio, _ = PersonalAccessToken.issue(user=self.user, nombre="mio")
        res = self.client.delete(f"/api/v1/auth/tokens/{mio.pk}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        mio.refresh_from_db()
        self.assertIsNotNone(mio.revoked_at)

    def test_rechaza_una_expiracion_en_el_pasado(self):
        res = self.client.post(
            "/api/v1/auth/tokens/",
            {"nombre": "x", "expires_at": (timezone.now() - timedelta(days=1)).isoformat()},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonimo_no_puede_listar(self):
        self.client.force_authenticate(None)
        res = self.client.get("/api/v1/auth/tokens/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
