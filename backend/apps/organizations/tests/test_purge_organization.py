"""purge_organization: el comando que limpia una organización de prueba de
una base real. Los tests importan más de lo normal porque el modo de fallo
es 'borré algo en producción'."""
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase

from apps.activities.models import Activity
from apps.activities.tests.factories import make_activity, make_org, make_user
from apps.organizations.models import Organization
from apps.users.models import PersonalAccessToken, User


class PurgeOrganizationTests(TestCase):
    def setUp(self):
        self.org = make_org(slug="acme", nombre="Acme Ltd")
        self.admin = make_user("admin@acme.com", "Admin Acme", rol="admin", organization=self.org)
        self.actividad = make_activity(self.admin, nombre="Configurar VPN")
        PersonalAccessToken.issue(user=self.admin, nombre="token de acme")

        # Organización vecina: nada de lo que se borre puede tocarla.
        self.otra = make_org(slug="vecina", nombre="Vecina")
        self.otro_user = make_user("alguien@vecina.com", "Alguien", organization=self.otra)
        self.otra_actividad = make_activity(self.otro_user, nombre="No me toques")

    def run_cmd(self, *args):
        salida = StringIO()
        call_command("purge_organization", *args, stdout=salida)
        return salida.getvalue()

    def test_dry_run_por_defecto_no_borra_nada(self):
        salida = self.run_cmd("acme")
        self.assertIn("dry-run", salida)
        self.assertTrue(Organization.objects.filter(slug="acme").exists())
        self.assertTrue(User.objects.filter(email="admin@acme.com").exists())

    def test_el_inventario_cuenta_lo_que_hay(self):
        salida = self.run_cmd("acme")
        self.assertIn("actividades", salida)
        self.assertIn("Acme Ltd", salida)

    def test_execute_borra_todo_en_el_orden_correcto(self):
        """Activity.responsable y User.organization son PROTECT: si el orden
        estuviera mal, esto reventaría con IntegrityError."""
        self.run_cmd("acme", "--execute")
        self.assertFalse(Organization.objects.filter(slug="acme").exists())
        self.assertFalse(User.objects.filter(email="admin@acme.com").exists())
        self.assertFalse(Activity.objects.filter(pk=self.actividad.pk).exists())
        self.assertFalse(PersonalAccessToken.objects.filter(user_id=self.admin.pk).exists())

    def test_no_toca_a_la_organizacion_vecina(self):
        self.run_cmd("acme", "--execute")
        self.assertTrue(Organization.objects.filter(slug="vecina").exists())
        self.assertTrue(Activity.objects.filter(pk=self.otra_actividad.pk).exists())
        self.assertTrue(User.objects.filter(email="alguien@vecina.com").exists())

    def test_se_niega_a_borrar_la_demo_publica(self):
        """Esa organización alimenta los botones 'Probar como {rol}' de la
        landing: borrarla la rompe en producción sin que nada avise."""
        make_user(
            "demo-admin@nexoengine.tech", "Demo", rol="admin",
            organization=self.org, is_demo_readonly=True,
        )
        with self.assertRaises(CommandError) as ctx:
            self.run_cmd("acme", "--execute")
        self.assertIn("demo pública", str(ctx.exception))
        self.assertTrue(Organization.objects.filter(slug="acme").exists())

    def test_force_permite_borrar_la_demo_cuando_es_a_proposito(self):
        make_user(
            "demo-admin@nexoengine.tech", "Demo", rol="admin",
            organization=self.org, is_demo_readonly=True,
        )
        self.run_cmd("acme", "--execute", "--force")
        self.assertFalse(Organization.objects.filter(slug="acme").exists())

    def test_avisa_si_hay_superusuarios(self):
        self.admin.is_superuser = True
        self.admin.save(update_fields=["is_superuser"])
        self.assertIn("superusuarios", self.run_cmd("acme"))

    def test_una_organizacion_inexistente_es_un_error_claro(self):
        with self.assertRaises(CommandError) as ctx:
            self.run_cmd("no-existe")
        self.assertIn("no-existe", str(ctx.exception))
