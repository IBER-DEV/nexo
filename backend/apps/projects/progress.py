"""Cómo va un proyecto: avance y salud, derivados de sus actividades.

Vive suelto y no dentro del ViewSet porque hay más de un consumidor (el API
REST, el dashboard y —cuando se agregue— el servidor MCP), y porque una
métrica con dos implementaciones es un número que se contradice a sí mismo
según desde dónde lo mires. Mismo razonamiento que `activities/visibility.py`.

Dos reglas que no hay que romper:

1. **El avance no se teclea, se deriva.** No existe un campo `avance` en
   `Project` a propósito: un porcentaje manual se congela el día que alguien
   deja de actualizarlo y termina mintiendo peor que no tener nada.

2. **`WorkflowState.categoria` es la única fuente de verdad** para saber si
   una actividad cuenta como terminada — nunca `estado.slug` contra strings
   tipo "done" (esos slugs son el seed de la org `demo`, no existen
   garantizados en otras organizaciones).

Las canceladas salen del denominador, no cuentan como avance: un proyecto de
10 actividades donde se hicieron 5 y se cancelaron 5 está al 100%, no al 50%.
"""
from dataclasses import dataclass
from datetime import date

from django.db.models import Count, Q

from apps.activities.models import WorkflowState

DONE = WorkflowState.Categoria.DONE
CANCELLED = WorkflowState.Categoria.CANCELLED

#: Cuántos puntos porcentuales puede ir el avance real por debajo del
#: esperado antes de marcar el proyecto en riesgo. 15 pp es holgado a
#: propósito: la alerta sirve si es rara.
RIESGO_TOLERANCIA_PP = 15


class Salud:
    """Semáforo del proyecto. Es un string y no un modelo porque se calcula
    en cada lectura — no hay nada que guardar ni configurar."""

    SIN_DATOS = "sin_datos"  # sin actividades: no hay nada que medir todavía
    SIN_FECHA = "sin_fecha"  # sin compromiso de entrega: no se puede atrasar
    EN_TIEMPO = "en_tiempo"
    EN_RIESGO = "en_riesgo"
    ATRASADO = "atrasado"
    CERRADO = "cerrado"  # finalizado o cancelado: ya no se mide


@dataclass(frozen=True)
class ProjectMetrics:
    total: int
    finalizadas: int
    canceladas: int
    abiertas: int
    vencidas: int
    avance: int
    salud: str
    dias_restantes: int | None

    def as_dict(self) -> dict:
        return {
            "total_actividades": self.total,
            "actividades_finalizadas": self.finalizadas,
            "actividades_canceladas": self.canceladas,
            "actividades_abiertas": self.abiertas,
            "actividades_vencidas": self.vencidas,
            "avance": self.avance,
            "salud": self.salud,
            "dias_restantes": self.dias_restantes,
        }


def annotate_metrics(queryset, today: date | None = None):
    """Anota sobre un queryset de Project los conteos que necesita
    `metrics_for()`. Se hace en SQL y no en Python para que listar N
    proyectos siga siendo una sola consulta en vez de N+1.

    OJO: los conteos son sobre TODAS las actividades del proyecto dentro de
    la organización, sin aplicar el scoping por rol de
    `activities/visibility.py`. Es deliberado: el rol decide *qué proyectos
    ves*, no *qué tan avanzados están*. Un miembro que solo tiene asignadas
    2 de las 40 actividades de un proyecto vería "50% completado" cuando el
    proyecto real va en 90% — un número peor que no mostrar ninguno.
    """
    today = today or date.today()
    abierta = ~Q(activities__estado__categoria__in=(DONE, CANCELLED))
    return queryset.annotate(
        total_actividades=Count("activities", distinct=True),
        actividades_finalizadas=Count(
            "activities", filter=Q(activities__estado__categoria=DONE), distinct=True
        ),
        actividades_canceladas=Count(
            "activities", filter=Q(activities__estado__categoria=CANCELLED), distinct=True
        ),
        actividades_vencidas=Count(
            "activities",
            filter=Q(activities__fecha_limite__lt=today) & abierta,
            distinct=True,
        ),
    )


def calcular_avance(finalizadas: int, canceladas: int, total: int) -> int:
    """% de avance, 0-100. Las canceladas salen del denominador."""
    contables = total - canceladas
    if contables <= 0:
        return 0
    return round(finalizadas * 100 / contables)


def _avance_esperado(project, today: date) -> int | None:
    """Qué % debería llevar hoy si el trabajo avanzara parejo entre la fecha
    de inicio y la de entrega. Es una aproximación lineal —basta para
    levantar una bandera, no pretende ser una curva real de burn-down."""
    inicio, fin = project.fecha_inicio, project.fecha_fin_estimada
    if not inicio or not fin or fin <= inicio:
        return None
    total_dias = (fin - inicio).days
    transcurridos = (today - inicio).days
    if transcurridos <= 0:
        return 0
    return min(100, round(transcurridos * 100 / total_dias))


def _calcular_salud(project, avance: int, vencidas: int, total: int, today: date) -> str:
    if project.estado in project.CLOSED_ESTADOS:
        return Salud.CERRADO
    if total == 0:
        return Salud.SIN_DATOS
    if project.fecha_fin_estimada is None:
        # Sin compromiso de entrega no hay nada contra qué comparar. Las
        # vencidas igual son una señal real y se reportan aparte.
        return Salud.EN_RIESGO if vencidas else Salud.SIN_FECHA
    if today > project.fecha_fin_estimada and avance < 100:
        return Salud.ATRASADO
    if vencidas:
        return Salud.EN_RIESGO
    esperado = _avance_esperado(project, today)
    if esperado is not None and avance + RIESGO_TOLERANCIA_PP < esperado:
        return Salud.EN_RIESGO
    return Salud.EN_TIEMPO


def metrics_for(project, today: date | None = None) -> ProjectMetrics:
    """Métricas de un Project ya pasado por `annotate_metrics()`.

    Cae a consultar la base si el proyecto no viene anotado, para que un
    `Project` suelto (recién creado, o traído por otro camino) no reviente —
    pero el camino caliente es siempre el anotado.
    """
    today = today or date.today()
    total = getattr(project, "total_actividades", None)
    if total is None:
        anotado = annotate_metrics(
            type(project).objects.filter(pk=project.pk), today=today
        ).get()
        total = anotado.total_actividades
        finalizadas = anotado.actividades_finalizadas
        canceladas = anotado.actividades_canceladas
        vencidas = anotado.actividades_vencidas
    else:
        finalizadas = project.actividades_finalizadas
        canceladas = project.actividades_canceladas
        vencidas = project.actividades_vencidas

    avance = calcular_avance(finalizadas, canceladas, total)
    dias_restantes = (
        (project.fecha_fin_estimada - today).days if project.fecha_fin_estimada else None
    )
    return ProjectMetrics(
        total=total,
        finalizadas=finalizadas,
        canceladas=canceladas,
        abiertas=total - finalizadas - canceladas,
        vencidas=vencidas,
        avance=avance,
        salud=_calcular_salud(project, avance, vencidas, total, today),
        dias_restantes=dias_restantes,
    )
