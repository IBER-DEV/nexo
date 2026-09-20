"""Cómo se calcula el avance y la salud de un proyecto (progress.py)."""
from datetime import date, timedelta

from django.test import TestCase

from apps.activities.models import WorkflowState
from apps.activities.tests.factories import ensure_masters, make_activity, make_org, make_user
from apps.projects.models import Project
from apps.projects.progress import Salud, annotate_metrics, calcular_avance, metrics_for


def _state(org, categoria):
    return (
        WorkflowState.objects.for_org(org).filter(categoria=categoria).order_by("orden").first()
    )


class AvanceTests(TestCase):
    def setUp(self):
        self.org = make_org(slug="avance")
        self.user = make_user("lider@avance.com", "Líder", rol="admin", organization=self.org)
        ensure_masters(self.org)
        self.project = Project.objects.create(organization=self.org, nombre="Migración ERP")

    def _activity(self, categoria, **extra):
        return make_activity(
            self.user,
            organization=self.org,
            proyecto=self.project,
            estado=_state(self.org, categoria),
            **extra,
        )

    def test_sin_actividades_el_avance_es_cero_y_no_divide_por_cero(self):
        m = metrics_for(self.project)
        self.assertEqual(m.avance, 0)
        self.assertEqual(m.total, 0)
        self.assertEqual(m.salud, Salud.SIN_DATOS)

    def test_avance_es_finalizadas_sobre_total(self):
        for _ in range(3):
            self._activity(WorkflowState.Categoria.DONE)
        self._activity(WorkflowState.Categoria.TODO)
        m = metrics_for(self.project)
        self.assertEqual((m.finalizadas, m.total), (3, 4))
        self.assertEqual(m.avance, 75)

    def test_las_canceladas_salen_del_denominador(self):
        """5 hechas y 5 canceladas es un proyecto terminado al 100%, no al
        50%: lo cancelado dejó de ser trabajo pendiente."""
        for _ in range(5):
            self._activity(WorkflowState.Categoria.DONE)
        for _ in range(5):
            self._activity(WorkflowState.Categoria.CANCELLED)
        m = metrics_for(self.project)
        self.assertEqual(m.avance, 100)
        self.assertEqual(m.canceladas, 5)
        self.assertEqual(m.abiertas, 0)

    def test_proyecto_solo_de_canceladas_no_revienta(self):
        self._activity(WorkflowState.Categoria.CANCELLED)
        self.assertEqual(metrics_for(self.project).avance, 0)

    def test_no_cuenta_actividades_de_otro_proyecto(self):
        otro = Project.objects.create(organization=self.org, nombre="Otro")
        self._activity(WorkflowState.Categoria.DONE)
        make_activity(
            self.user,
            organization=self.org,
            proyecto=otro,
            estado=_state(self.org, WorkflowState.Categoria.TODO),
        )
        self.assertEqual(metrics_for(self.project).total, 1)

    def test_calcular_avance_redondea(self):
        self.assertEqual(calcular_avance(1, 0, 3), 33)
        self.assertEqual(calcular_avance(2, 0, 3), 67)
        self.assertEqual(calcular_avance(0, 0, 0), 0)


class SaludTests(TestCase):
    def setUp(self):
        self.org = make_org(slug="salud")
        self.user = make_user("u@salud.com", "U", rol="admin", organization=self.org)
        ensure_masters(self.org)
        self.today = date(2026, 6, 1)

    def _project(self, **extra):
        return Project.objects.create(organization=self.org, nombre=extra.pop("nombre", "P"), **extra)

    def _activity(self, project, categoria, fecha_limite=None):
        return make_activity(
            self.user,
            organization=self.org,
            proyecto=project,
            estado=_state(self.org, categoria),
            fecha_limite=fecha_limite or (self.today + timedelta(days=30)),
        )

    def _salud(self, project):
        anotado = annotate_metrics(
            Project.objects.filter(pk=project.pk), today=self.today
        ).get()
        return metrics_for(anotado, today=self.today).salud

    def test_sin_fecha_de_entrega_no_puede_estar_atrasado(self):
        p = self._project()
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.SIN_FECHA)

    def test_pasada_la_fecha_sin_terminar_esta_atrasado(self):
        p = self._project(
            fecha_inicio=self.today - timedelta(days=60),
            fecha_fin_estimada=self.today - timedelta(days=1),
        )
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.ATRASADO)

    def test_pasada_la_fecha_pero_al_100_no_esta_atrasado(self):
        p = self._project(
            fecha_inicio=self.today - timedelta(days=60),
            fecha_fin_estimada=self.today - timedelta(days=1),
        )
        self._activity(p, WorkflowState.Categoria.DONE)
        self.assertEqual(self._salud(p), Salud.EN_TIEMPO)

    def test_una_actividad_vencida_pone_el_proyecto_en_riesgo(self):
        p = self._project(
            fecha_inicio=self.today - timedelta(days=5),
            fecha_fin_estimada=self.today + timedelta(days=60),
        )
        self._activity(
            p, WorkflowState.Categoria.TODO, fecha_limite=self.today - timedelta(days=2)
        )
        self.assertEqual(self._salud(p), Salud.EN_RIESGO)

    def test_avance_muy_por_debajo_del_esperado_es_riesgo(self):
        """A mitad del calendario (50% esperado) con 0% hecho."""
        p = self._project(
            fecha_inicio=self.today - timedelta(days=50),
            fecha_fin_estimada=self.today + timedelta(days=50),
        )
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.EN_RIESGO)

    def test_avance_acorde_al_calendario_esta_en_tiempo(self):
        p = self._project(
            fecha_inicio=self.today - timedelta(days=50),
            fecha_fin_estimada=self.today + timedelta(days=50),
        )
        self._activity(p, WorkflowState.Categoria.DONE)
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.EN_TIEMPO)

    def test_un_proyecto_cerrado_no_se_mide(self):
        p = self._project(
            estado=Project.Estado.DONE,
            fecha_inicio=self.today - timedelta(days=60),
            fecha_fin_estimada=self.today - timedelta(days=10),
        )
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.CERRADO)

    def test_cancelado_tampoco_se_mide(self):
        p = self._project(estado=Project.Estado.CANCELLED)
        self._activity(p, WorkflowState.Categoria.TODO)
        self.assertEqual(self._salud(p), Salud.CERRADO)
