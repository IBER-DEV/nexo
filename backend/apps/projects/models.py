"""Proyecto: el contenedor bajo el que se agrupan actividades.

Por qué es un modelo propio y no un campo más de `Activity`: ver ADR 0001,
regla 1 — una capacidad nueva se modela como objeto de dominio propio
reutilizando los patrones probados (`OrgManager.for_org()`), sin forzarla
dentro de la tabla de actividades. Antes de esto `Activity.proyecto` era un
`CharField` de texto libre que solo llenaba el sync de Google Sheets: no
tenía dueño, ni fechas, ni forma de saber cómo iba.

Un `Project` NO es una segunda unidad de trabajo (no reabre el punto 3 del
ADR 0001): es un agrupador. El trabajo sigue siendo la `Activity`; el avance
del proyecto se deriva de ellas, nunca se teclea a mano — ver `progress.py`.
"""
from django.conf import settings
from django.db import models

from apps.organizations.scoping import OrgManager
from apps.organizations.sequences import SequenceService


class Project(models.Model):
    class Estado(models.TextChoices):
        # Enum fijo a propósito, en vez de reutilizar `WorkflowState`. El
        # ciclo de vida de un proyecto es universal (se planea, arranca, se
        # pausa, termina o se cancela), a diferencia del flujo de trabajo de
        # una actividad, que cada organización define a su medida. Además
        # `WorkflowState` tiene una constraint `one_initial_state_per_org` y
        # un flag `mostrar_en_kanban` pensados para el tablero de
        # actividades: meter estados de proyecto ahí ensuciaría ambos.
        PLANNED = "planned", "Planificado"
        ACTIVE = "active", "En curso"
        ON_HOLD = "on_hold", "En pausa"
        DONE = "done", "Finalizado"
        CANCELLED = "cancelled", "Cancelado"

    #: Estados en los que el proyecto ya no consume trabajo del equipo.
    CLOSED_ESTADOS = (Estado.DONE, Estado.CANCELLED)

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="projects"
    )
    # Secuencia propia por organización (ver SequenceService); el código
    # visible es {org.codigo_prefix}-P{numero:03d} — la "P" lo separa del
    # código de actividad ({prefijo}-0001) para que nunca se confundan.
    numero = models.PositiveIntegerField(editable=False)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True, default="")
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PLANNED)
    color = models.CharField(max_length=7, blank=True, default="")

    lider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_projects",
    )
    cliente = models.ForeignKey(
        "activities.Cliente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )

    fecha_inicio = models.DateField(null=True, blank=True)
    # Compromiso de entrega. Es el dato contra el que se mide la salud del
    # proyecto en progress.py — sin él, un proyecto no puede estar "atrasado".
    fecha_fin_estimada = models.DateField(null=True, blank=True)
    fecha_fin_real = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_projects",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "proyecto"
        verbose_name_plural = "proyectos"
        ordering = ["-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "numero"], name="uniq_project_numero_per_org"
            ),
            # El nombre es único por org porque el sync de Sheets y el import
            # de Excel resuelven proyectos por nombre (get-or-create, igual
            # que los catálogos): sin esta constraint, dos filas con el mismo
            # texto podrían terminar en proyectos distintos.
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_project_nombre_per_org"
            ),
        ]

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"

    def save(self, *args, **kwargs):
        if self.numero is None:
            self.numero = SequenceService.next(self.organization, name="project")
        super().save(*args, **kwargs)

    @property
    def codigo(self) -> str:
        return f"{self.organization.codigo_prefix}-P{self.numero:03d}"

    @property
    def is_closed(self) -> bool:
        return self.estado in self.CLOSED_ESTADOS
