"""API de proyectos: aislamiento, permisos y visibilidad por rol."""
from datetime import date, timedelta

from rest_framework.test import APITestCase

from apps.activities.models import WorkflowState
from apps.activities.tests.factories import ensure_masters, make_activity, make_org, make_user
from apps.projects.models import Project


def _state(org, categoria):
    return (
        WorkflowState.objects.for_org(org).filter(categoria=categoria).order_by("orden").first()
    )


class ProjectApiTests(APITestCase):
    def setUp(self):
        self.org = make_org(slug="acme-proj", nombre="Acme", codigo_prefix="ACM")
        ensure_masters(self.org)
        self.admin = make_user("admin@acme.com", "Admin", rol="admin", organization=self.org)
        self.member = make_user("miembro@acme.com", "Miembro", organization=self.org)

    def test_codigo_se_numera_por_organizacion(self):
        p1 = Project.objects.create(organization=self.org, nombre="Uno")
        p2 = Project.objects.create(organization=self.org, nombre="Dos")
        self.assertEqual(p1.codigo, "ACM-P001")
        self.assertEqual(p2.codigo, "ACM-P002")

        otra = make_org(slug="otra-proj", nombre="Otra", codigo_prefix="OTR")
        self.assertEqual(
            Project.objects.create(organization=otra, nombre="Uno").codigo, "OTR-P001"
        )

    def test_un_miembro_no_puede_crear_proyectos(self):
        self.client.force_authenticate(self.member)
        res = self.client.post("/api/v1/projects/", {"nombre": "Nuevo"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_un_miembro_si_puede_leerlos(self):
        p = Project.objects.create(organization=self.org, nombre="Visible", lider=self.member)
        self.client.force_authenticate(self.member)
        res = self.client.get("/api/v1/projects/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(p.pk, [row["pk"] for row in res.data["results"]])

    def test_un_admin_crea_y_recibe_el_codigo(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/projects/",
            {"nombre": "Portal de clientes", "estado": "active"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["id"], "ACM-P001")
        self.assertEqual(res.data["metrics"]["avance"], 0)

    def test_no_se_ven_proyectos_de_otra_organizacion(self):
        otra = make_org(slug="ajena", nombre="Ajena")
        Project.objects.create(organization=otra, nombre="Secreto")
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/projects/")
        self.assertEqual(res.data["count"], 0)

    def test_nombre_duplicado_devuelve_error_de_formulario_no_un_500(self):
        Project.objects.create(organization=self.org, nombre="Repetido")
        self.client.force_authenticate(self.admin)
        res = self.client.post("/api/v1/projects/", {"nombre": "repetido"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("nombre", res.data)

    def test_fecha_de_entrega_anterior_al_inicio_se_rechaza(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/v1/projects/",
            {
                "nombre": "Mal fechado",
                "fecha_inicio": "2026-06-01",
                "fecha_fin_estimada": "2026-05-01",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("fecha_fin_estimada", res.data)


class ProjectMetricsVisibilityTests(APITestCase):
    """El bug que esta feature podría haber tenido: que el scoping por rol
    contaminara los Count() de las métricas."""

    def setUp(self):
        self.org = make_org(slug="metricas", nombre="Metricas")
        ensure_masters(self.org)
        self.admin = make_user("admin@metricas.com", "Admin", rol="admin", organization=self.org)
        self.member = make_user("miembro@metricas.com", "Miembro", organization=self.org)
        self.project = Project.objects.create(organization=self.org, nombre="Grande")

        # 1 actividad del miembro (sin terminar) y 3 del admin (terminadas):
        # el proyecto real va en 75%.
        make_activity(
            self.member,
            organization=self.org,
            proyecto=self.project,
            estado=_state(self.org, WorkflowState.Categoria.TODO),
        )
        for _ in range(3):
            make_activity(
                self.admin,
                organization=self.org,
                proyecto=self.project,
                estado=_state(self.org, WorkflowState.Categoria.DONE),
            )

    def test_el_avance_es_del_proyecto_entero_aunque_lo_lea_un_miembro(self):
        """Si el filtro por rol se aplicara como un JOIN, Django lo
        reutilizaría en los Count() y el miembro vería 0% (solo su
        actividad pendiente) en un proyecto que va en 75%."""
        self.client.force_authenticate(self.member)
        res = self.client.get("/api/v1/projects/")
        fila = next(r for r in res.data["results"] if r["pk"] == self.project.pk)
        self.assertEqual(fila["metrics"]["total_actividades"], 4)
        self.assertEqual(fila["metrics"]["avance"], 75)

    def test_la_lista_de_actividades_si_respeta_el_rol(self):
        """Las métricas son agregadas y no filtran datos; la lista sí."""
        self.client.force_authenticate(self.member)
        res = self.client.get(f"/api/v1/projects/{self.project.pk}/activities/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_un_admin_ve_todas_las_actividades_del_proyecto(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get(f"/api/v1/projects/{self.project.pk}/activities/")
        self.assertEqual(len(res.data), 4)

    def test_un_miembro_sin_relacion_no_ve_el_proyecto(self):
        ajeno = make_user("ajeno@metricas.com", "Ajeno", organization=self.org)
        self.client.force_authenticate(ajeno)
        res = self.client.get("/api/v1/projects/")
        self.assertEqual(res.data["count"], 0)

    def test_summary_agrega_por_salud(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get("/api/v1/projects/summary/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["total"], 1)
        self.assertEqual(res.data["avance_promedio"], 75)


class ActivityProyectoTests(APITestCase):
    """La relación desde el lado de la actividad."""

    def setUp(self):
        self.org = make_org(slug="rel", nombre="Rel")
        self.masters = ensure_masters(self.org)
        self.admin = make_user("admin@rel.com", "Admin", rol="admin", organization=self.org)
        self.client.force_authenticate(self.admin)

    def _payload(self, **extra):
        data = {
            "empresa": "ACME",
            "proceso": "Soporte",
            "aplicacion": "ERP",
            "nombre": "Actividad con proyecto",
            "descripcion": "",
            "responsable_id": self.admin.pk,
            "stakeholder": "TI",
            "prioridad_id": self.masters["priorities"]["medium"].pk,
            "estado_id": self.masters["states"]["backlog"].pk,
            "fechaInicio": "2026-07-01",
            "fechaLimite": "2026-07-15",
        }
        data.update(extra)
        return data

    def test_proyecto_por_nombre_se_crea_al_vuelo(self):
        """Es la puerta que usan el sync de Sheets y el import de Excel,
        que solo conocen el texto de la columna."""
        res = self.client.post(
            "/api/v1/activities/", self._payload(proyecto="Migración SAP"), format="json"
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["proyecto"], "Migración SAP")
        self.assertTrue(Project.objects.for_org(self.org).filter(nombre="Migración SAP").exists())

    def test_el_mismo_nombre_no_duplica_el_proyecto(self):
        self.client.post("/api/v1/activities/", self._payload(proyecto="Uno"), format="json")
        self.client.post(
            "/api/v1/activities/",
            self._payload(nombre="Otra", proyecto="uno"),
            format="json",
        )
        self.assertEqual(Project.objects.for_org(self.org).filter(nombre__iexact="uno").count(), 1)

    def test_proyecto_id_de_otra_organizacion_se_rechaza(self):
        otra = make_org(slug="ajena-rel", nombre="Ajena")
        ajeno = Project.objects.create(organization=otra, nombre="Ajeno")
        res = self.client.post(
            "/api/v1/activities/", self._payload(proyecto_id=ajeno.pk), format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("proyecto_id", res.data)

    def test_el_id_gana_sobre_el_nombre(self):
        p = Project.objects.create(organization=self.org, nombre="El bueno")
        res = self.client.post(
            "/api/v1/activities/",
            self._payload(proyecto="ignorado", proyecto_id=p.pk),
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["proyecto_id"], p.pk)
        self.assertFalse(Project.objects.for_org(self.org).filter(nombre="ignorado").exists())

    def test_se_puede_desasignar_mandando_null(self):
        p = Project.objects.create(organization=self.org, nombre="Temporal")
        created = self.client.post(
            "/api/v1/activities/", self._payload(proyecto_id=p.pk), format="json"
        )
        res = self.client.patch(
            f"/api/v1/activities/{created.data['pk']}/", {"proyecto_id": None}, format="json"
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.data["proyecto_id"])

    def test_filtro_sin_proyecto_lista_el_trabajo_huerfano(self):
        self.client.post("/api/v1/activities/", self._payload(proyecto="Con"), format="json")
        self.client.post("/api/v1/activities/", self._payload(nombre="Suelta"), format="json")
        res = self.client.get("/api/v1/activities/?sin_proyecto=true")
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["nombre"], "Suelta")

    def test_archivar_un_proyecto_no_borra_sus_actividades(self):
        """SET_NULL y no CASCADE: el trabajo sobrevive al contenedor."""
        p = Project.objects.create(organization=self.org, nombre="Efímero")
        created = self.client.post(
            "/api/v1/activities/", self._payload(proyecto_id=p.pk), format="json"
        )
        p.delete()
        res = self.client.get(f"/api/v1/activities/{created.data['pk']}/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["proyecto_id"])


class ProjectFechasTests(APITestCase):
    def test_dias_restantes_se_reporta_contra_la_fecha_de_entrega(self):
        org = make_org(slug="dias", nombre="Dias")
        ensure_masters(org)
        admin = make_user("a@dias.com", "A", rol="admin", organization=org)
        p = Project.objects.create(
            organization=org,
            nombre="Con fecha",
            fecha_fin_estimada=date.today() + timedelta(days=10),
        )
        self.client.force_authenticate(admin)
        res = self.client.get(f"/api/v1/projects/{p.pk}/")
        self.assertEqual(res.data["metrics"]["dias_restantes"], 10)
