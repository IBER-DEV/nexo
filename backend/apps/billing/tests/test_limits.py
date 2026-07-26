"""Límites por plan: puestos, sus dos puertas de entrada y la
sincronización de la cantidad facturada."""
from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.tests.factories import make_org, make_user
from apps.billing import service
from apps.billing.limits import PLAN_LIMITS, LimitExceeded, check_can_add_member, limits_for
from apps.billing.models import Subscription
from apps.billing.tests.test_access import BILLING_ON, make_subscription
from apps.organizations.membership import MembershipError, add_member, generate_access_code
from apps.users.models import User

TECHO_FREE = PLAN_LIMITS["community"]["max_active_users"]


def llenar_org(org, cuantos):
    for i in range(cuantos):
        make_user(f"relleno{i}@test.com", f"Relleno {i}", rol="member", organization=org)


class SelfHostedTests(TestCase):
    """El principio que no se negocia: sin proveedor de pagos configurado
    —el caso del self-hosted AGPL— no hay techo de nada."""

    def test_sin_proveedor_no_hay_limite_de_puestos(self):
        org = make_org(slug="selfhost")
        llenar_org(org, TECHO_FREE + 3)
        self.assertIsNone(limits_for(org)["max_active_users"])
        check_can_add_member(org)  # no levanta


@override_settings(**BILLING_ON)
class SeatLimitTests(TestCase):
    def setUp(self):
        self.org = make_org(slug="cloudfree")

    def test_el_tier_gratuito_tiene_techo(self):
        self.assertEqual(limits_for(self.org)["max_active_users"], TECHO_FREE)

    def test_permite_hasta_el_techo(self):
        llenar_org(self.org, TECHO_FREE - 1)
        check_can_add_member(self.org)  # no levanta

    def test_bloquea_al_pasarse(self):
        llenar_org(self.org, TECHO_FREE)
        with self.assertRaises(LimitExceeded):
            check_can_add_member(self.org)

    def test_los_desactivados_no_ocupan_puesto(self):
        """La válvula de escape de quien baja de plan: desactivar libera
        sin echar a nadie de la organización."""
        llenar_org(self.org, TECHO_FREE)
        User.objects.filter(organization=self.org).first().__class__.objects.filter(
            organization=self.org
        ).update(is_active=False)
        check_can_add_member(self.org)  # no levanta

    def test_el_plan_de_pago_no_tiene_techo(self):
        make_subscription(self.org, status=Subscription.Status.ACTIVE)
        self.org.plan = "cloud"
        self.org.save(update_fields=["plan"])
        llenar_org(self.org, TECHO_FREE + 5)
        self.assertIsNone(limits_for(self.org)["max_active_users"])
        check_can_add_member(self.org)

    def test_un_trial_vencido_recupera_el_techo_sin_esperar_al_cron(self):
        """`organization.plan` todavía dice cloud hasta que corra
        expire_trials; los límites resuelven el plan efectivo en caliente,
        igual que el nivel de acceso."""
        make_subscription(
            self.org,
            status=Subscription.Status.TRIALING,
            provider_subscription_id="",
            trial_ends_at=timezone.now() - timedelta(days=1),
        )
        self.org.plan = "cloud"
        self.org.save(update_fields=["plan"])
        self.assertEqual(limits_for(self.org)["max_active_users"], TECHO_FREE)


@override_settings(**BILLING_ON)
class PuertasDeEntradaTests(APITestCase):
    """Las dos formas de ocupar un puesto tienen que estar tapadas: si una
    queda abierta, el techo es decorativo."""

    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        llenar_org(self.org, TECHO_FREE - 1)  # + el admin = organización llena
        self.client.force_authenticate(self.admin)

    def test_add_member_respeta_el_techo(self):
        nuevo = User.objects.create_user("nuevo@test.com", "Nuevo")
        with self.assertRaises(MembershipError) as ctx:
            add_member(user=nuevo, organization=self.org, rol="member")
        self.assertIn("Actualiza a Cloud", str(ctx.exception))
        nuevo.refresh_from_db()
        self.assertIsNone(nuevo.organization_id)

    def test_no_se_burla_el_techo_desactivando_y_reactivando(self):
        victima = User.objects.for_org(self.org).filter(rol="member").first()
        res = self.client.patch(
            f"/api/v1/users/{victima.pk}/", {"is_active": False}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)

        # El puesto liberado se lo lleva alguien nuevo...
        nuevo = User.objects.create_user("nuevo@test.com", "Nuevo")
        add_member(user=nuevo, organization=self.org, rol="member")

        # ...así que reactivar a la víctima ya no cabe.
        res = self.client.patch(
            f"/api/v1/users/{victima.pk}/", {"is_active": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
        victima.refresh_from_db()
        self.assertFalse(victima.is_active)

    def test_reactivar_si_hay_puesto_libre_funciona(self):
        """El límite bloquea pasarse, no reactivar: sin este caso el test
        anterior pasaría con un check que simplemente prohíbe todo."""
        victima = User.objects.for_org(self.org).filter(rol="member").first()
        self.client.patch(f"/api/v1/users/{victima.pk}/", {"is_active": False}, format="json")
        res = self.client.patch(
            f"/api/v1/users/{victima.pk}/", {"is_active": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)


@override_settings(**BILLING_ON)
class SeatSyncTests(TestCase):
    def setUp(self):
        self.org = make_org(slug="pagando", plan="cloud")
        self.sub = make_subscription(
            self.org,
            status=Subscription.Status.ACTIVE,
            provider_item_id="item-1",
            quantity=1,
        )

    @patch("apps.billing.provider.update_quantity")
    def test_empuja_los_usuarios_activos_como_cantidad(self, mock_update):
        llenar_org(self.org, 4)
        self.assertTrue(service.sync_seats(self.org))
        mock_update.assert_called_once_with("item-1", 4)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.quantity, 4)

    @patch("apps.billing.provider.update_quantity")
    def test_no_llama_al_proveedor_si_no_cambio_nada(self, mock_update):
        llenar_org(self.org, 1)
        service.sync_seats(self.org)
        mock_update.assert_not_called()

    @patch(
        "apps.billing.provider.update_quantity",
        side_effect=service.provider.ProviderError("caído"),
    )
    def test_un_fallo_del_proveedor_no_revienta_ni_miente(self, _mock):
        """Best-effort: nadie debería quedarse sin poder sumar a un
        compañero porque el proveedor tuvo un mal minuto, y la cantidad
        local no se marca como sincronizada si no lo está."""
        llenar_org(self.org, 3)
        self.assertFalse(service.sync_seats(self.org))
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.quantity, 1)

    @patch("apps.billing.provider.update_quantity")
    def test_un_trial_no_tiene_puestos_que_facturar(self, mock_update):
        self.sub.status = Subscription.Status.TRIALING
        self.sub.save(update_fields=["status"])
        llenar_org(self.org, 4)
        self.assertFalse(service.sync_seats(self.org))
        mock_update.assert_not_called()

    @patch("apps.billing.provider.update_quantity")
    def test_el_comando_reconcilia_lo_que_el_empujon_perdio(self, mock_update):
        llenar_org(self.org, 6)
        call_command("sync_seats")
        mock_update.assert_called_once_with("item-1", 6)

    @patch("apps.billing.provider.update_quantity")
    def test_dry_run_no_toca_al_proveedor(self, mock_update):
        llenar_org(self.org, 6)
        call_command("sync_seats", "--dry-run")
        mock_update.assert_not_called()


@override_settings(**BILLING_ON)
class UsageEndpointTests(APITestCase):
    def setUp(self):
        self.admin = make_user("admin@test.com", "Admin", rol="admin")
        self.org = self.admin.organization
        self.client.force_authenticate(self.admin)

    def test_billing_reporta_puestos_usados_y_disponibles(self):
        res = self.client.get("/api/v1/billing/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["usage"]["active_users"], 1)
        self.assertEqual(res.data["usage"]["max_active_users"], TECHO_FREE)
        self.assertEqual(res.data["usage"]["seats_available"], TECHO_FREE - 1)

    def test_workspace_expone_plan_y_limites(self):
        res = self.client.get("/api/v1/workspace/")
        self.assertEqual(res.data["organization"]["plan"], "community")
        self.assertEqual(res.data["organization"]["limits"]["max_active_users"], TECHO_FREE)


@override_settings(**BILLING_ON)
class AccessCodeLimitTests(APITestCase):
    """Registrarse con un código es la puerta real por la que entra un
    equipo: si el techo no aplica ahí, no aplica en ningún lado."""

    def setUp(self):
        self.owner = make_user("owner@test.com", "Owner", rol="owner")
        self.org = self.owner.organization
        self.code = generate_access_code(
            organization=self.org, rol="member", created_by=self.owner
        )

    def test_el_signup_con_codigo_respeta_el_techo(self):
        llenar_org(self.org, TECHO_FREE - 1)  # +1 del owner = lleno
        res = self.client.post(
            "/api/v1/auth/signup/",
            {
                "email": "tarde@test.com",
                "password": "contrasena-larga-123",
                "nombre": "Llega Tarde",
                "access_code": self.code.codigo,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="tarde@test.com").exists())
