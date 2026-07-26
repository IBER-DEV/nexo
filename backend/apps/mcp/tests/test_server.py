"""Servidor MCP: protocolo, herramientas y —lo crítico— que hablar
JSON-RPC sobre POST no sirva para saltarse las reglas del API."""
import json

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Activity
from apps.activities.tests.factories import ensure_masters, make_activity, make_user
from apps.billing.models import Subscription
from apps.billing.tests.test_access import BILLING_ON, make_subscription
from apps.mcp.protocol import METHOD_NOT_FOUND, PROTOCOL_VERSION
from apps.users.models import PersonalAccessToken

URL = "/api/v1/mcp/"


class McpTestCase(APITestCase):
    def setUp(self):
        self.user = make_user("dev@test.com", "Dev", rol="admin")
        self.org = self.user.organization
        self.masters = ensure_masters(self.org)
        self.actividad = make_activity(self.user, nombre="Migrar el ERP")

    def auth(self, scope=PersonalAccessToken.Scope.READ_WRITE):
        _, raw = PersonalAccessToken.issue(user=self.user, nombre="MCP", scope=scope)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")

    def rpc(self, method, params=None, request_id=1):
        cuerpo = {"jsonrpc": "2.0", "method": method}
        if request_id is not None:
            cuerpo["id"] = request_id
        if params is not None:
            cuerpo["params"] = params
        return self.client.post(
            URL, data=json.dumps(cuerpo), content_type="application/json"
        )

    def call(self, name, arguments=None):
        res = self.rpc("tools/call", {"name": name, "arguments": arguments or {}})
        return res.data["result"]

    def text(self, name, arguments=None):
        return self.call(name, arguments)["content"][0]["text"]


class ProtocolTests(McpTestCase):
    def setUp(self):
        super().setUp()
        self.auth()

    def test_handshake(self):
        res = self.rpc("initialize", {"protocolVersion": PROTOCOL_VERSION})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        result = res.data["result"]
        self.assertEqual(result["protocolVersion"], PROTOCOL_VERSION)
        self.assertEqual(result["serverInfo"]["name"], "nexo")
        self.assertIn("tools", result["capabilities"])
        # Las instrucciones le dicen al modelo que los maestros son por
        # organización; sin eso inventa ids.
        self.assertIn("obtener_workspace", result["instructions"])

    def test_una_notificacion_no_lleva_respuesta(self):
        res = self.rpc("notifications/initialized", request_id=None)
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)

    def test_metodo_desconocido(self):
        res = self.rpc("cosas/raras")
        self.assertEqual(res.data["error"]["code"], METHOD_NOT_FOUND)

    def test_json_invalido_no_revienta(self):
        res = self.client.post(URL, data="{no es json", content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("error", res.data)

    def test_lote_de_mensajes(self):
        cuerpo = [
            {"jsonrpc": "2.0", "id": 1, "method": "ping"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        ]
        res = self.client.post(URL, data=json.dumps(cuerpo), content_type="application/json")
        self.assertEqual(len(res.data), 2)

    def test_anonimo_es_rechazado(self):
        self.client.credentials()
        res = self.rpc("tools/list")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_explica_que_es_esto(self):
        res = self.client.get(URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["authenticated_as"], "dev@test.com")


class ToolsTests(McpTestCase):
    def setUp(self):
        super().setUp()
        self.auth()

    def test_lista_las_herramientas(self):
        nombres = [t["name"] for t in self.rpc("tools/list").data["result"]["tools"]]
        self.assertIn("obtener_workspace", nombres)
        self.assertIn("crear_actividad", nombres)

    def test_workspace_expone_los_ids_de_los_maestros(self):
        texto = self.text("obtener_workspace")
        estado = self.masters["states"]["backlog"]
        self.assertIn(f"id={estado.pk}", texto)
        self.assertIn(self.org.nombre, texto)

    def test_listar_actividades(self):
        self.assertIn("Migrar el ERP", self.text("listar_actividades"))

    def test_listar_actividades_filtra_por_texto(self):
        make_activity(self.user, nombre="Otra cosa distinta")
        texto = self.text("listar_actividades", {"buscar": "ERP"})
        self.assertIn("Migrar el ERP", texto)
        self.assertNotIn("Otra cosa distinta", texto)

    def test_crear_actividad(self):
        antes = Activity.objects.count()
        texto = self.text(
            "crear_actividad",
            {"nombre": "Actualizar certificados", "descripcion": "Vencen el mes que viene"},
        )
        self.assertEqual(Activity.objects.count(), antes + 1)
        self.assertIn("Actividad creada", texto)
        creada = Activity.objects.latest("pk")
        self.assertEqual(creada.created_by, self.user)
        self.assertEqual(creada.organization, self.org)

    def test_crear_actividad_sin_nombre_avisa_que_falta(self):
        res = self.rpc("tools/call", {"name": "crear_actividad", "arguments": {}})
        self.assertIn("Faltan argumentos", res.data["error"]["message"])

    def test_actualizar_actividad(self):
        destino = self.masters["states"]["done"]
        self.text(
            "actualizar_actividad",
            {"actividad_id": self.actividad.pk, "estado_id": destino.pk},
        )
        self.actividad.refresh_from_db()
        self.assertEqual(self.actividad.estado_id, destino.pk)

    def test_actualizar_sin_campos_avisa(self):
        res = self.rpc(
            "tools/call",
            {"name": "actualizar_actividad", "arguments": {"actividad_id": self.actividad.pk}},
        )
        self.assertIn("ningún campo", res.data["error"]["message"])

    def test_herramienta_desconocida(self):
        res = self.rpc("tools/call", {"name": "borrar_todo", "arguments": {}})
        self.assertIn("desconocida", res.data["error"]["message"])

    def test_un_error_de_dominio_vuelve_como_isError_no_como_error_de_protocolo(self):
        """El modelo tiene que poder leer qué salió mal y reintentar; un
        error de JSON-RPC solo le diría que algo falló."""
        resultado = self.call(
            "crear_actividad", {"nombre": "X", "estado_id": 999999}
        )
        self.assertTrue(resultado["isError"])
        self.assertIn("No se pudo completar", resultado["content"][0]["text"])


class AislamientoTests(McpTestCase):
    """MCP no puede ser una puerta lateral al aislamiento multi-tenant ni al
    scoping por rol."""

    def test_no_ve_actividades_de_otra_organizacion(self):
        ajeno = make_user("ajeno@otra.com", "Ajeno", rol="admin", organization=None)
        from apps.activities.tests.factories import make_org

        otra = make_org(slug="otra-org")
        ajeno.organization = otra
        ajeno.save(update_fields=["organization"])
        make_activity(ajeno, nombre="Secreto de la otra empresa")

        self.auth()
        self.assertNotIn("Secreto de la otra empresa", self.text("listar_actividades"))

    def test_un_member_solo_ve_lo_suyo(self):
        otro = make_user("otro@test.com", "Otro", rol="member", organization=self.org)
        make_activity(otro, nombre="Tarea de otra persona")
        member = make_user("yo@test.com", "Yo", rol="member", organization=self.org)
        mia = make_activity(member, nombre="Mi tarea")

        _, raw = PersonalAccessToken.issue(user=member, nombre="MCP")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
        texto = self.text("listar_actividades")
        self.assertIn("Mi tarea", texto)
        self.assertNotIn("Tarea de otra persona", texto)
        self.assertIsNotNone(mia)

    def test_no_puede_editar_una_actividad_que_no_ve(self):
        otro = make_user("otro@test.com", "Otro", rol="member", organization=self.org)
        ajena = make_activity(otro, nombre="Ajena")
        member = make_user("yo@test.com", "Yo", rol="member", organization=self.org)

        _, raw = PersonalAccessToken.issue(user=member, nombre="MCP")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
        res = self.rpc(
            "tools/call",
            {
                "name": "actualizar_actividad",
                "arguments": {"actividad_id": ajena.pk, "nombre": "hackeada"},
            },
        )
        self.assertIn("No existe una actividad", res.data["error"]["message"])
        ajena.refresh_from_db()
        self.assertEqual(ajena.nombre, "Ajena")


class PoliticaTests(McpTestCase):
    """El punto delicado: MCP es todo POST, así que la regla por verbo HTTP
    no aplica y el control tiene que ser por herramienta."""

    def test_un_token_de_solo_lectura_no_ve_las_herramientas_que_escriben(self):
        self.auth(scope=PersonalAccessToken.Scope.READ)
        nombres = [t["name"] for t in self.rpc("tools/list").data["result"]["tools"]]
        self.assertIn("listar_actividades", nombres)
        self.assertNotIn("crear_actividad", nombres)

    def test_un_token_de_solo_lectura_si_puede_leer(self):
        """Regresión del riesgo del refactor: si la política se aplicara por
        verbo HTTP, un token `read` no podría ni listar, porque MCP habla
        siempre por POST."""
        self.auth(scope=PersonalAccessToken.Scope.READ)
        self.assertIn("Migrar el ERP", self.text("listar_actividades"))

    def test_un_token_de_solo_lectura_no_puede_escribir_aunque_lo_intente(self):
        self.auth(scope=PersonalAccessToken.Scope.READ)
        antes = Activity.objects.count()
        resultado = self.call("crear_actividad", {"nombre": "colada"})
        self.assertTrue(resultado["isError"])
        self.assertIn("solo lectura", resultado["content"][0]["text"].lower())
        self.assertEqual(Activity.objects.count(), antes)

    def test_un_usuario_de_la_demo_publica_no_escribe_por_mcp(self):
        demo = make_user(
            "demo-admin@test.com", "Demo", rol="admin",
            is_demo_readonly=True, organization=self.org,
        )
        _, raw = PersonalAccessToken.issue(user=demo, nombre="MCP")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {raw}")
        antes = Activity.objects.count()
        resultado = self.call("crear_actividad", {"nombre": "colada"})
        self.assertTrue(resultado["isError"])
        self.assertIn("demo", resultado["content"][0]["text"].lower())
        self.assertEqual(Activity.objects.count(), antes)

    @override_settings(**BILLING_ON)
    def test_una_suscripcion_vencida_deja_leer_pero_no_escribir(self):
        make_subscription(self.org, status=Subscription.Status.PAST_DUE)
        self.auth()
        self.assertIn("Migrar el ERP", self.text("listar_actividades"))
        resultado = self.call("crear_actividad", {"nombre": "colada"})
        self.assertTrue(resultado["isError"])
        self.assertIn("solo lectura", resultado["content"][0]["text"].lower())

    @override_settings(**BILLING_ON)
    def test_una_suscripcion_expirada_cierra_mcp_entero(self):
        make_subscription(self.org, status=Subscription.Status.EXPIRED)
        self.auth()
        res = self.rpc("tools/list")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
