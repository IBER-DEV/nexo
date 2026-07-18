from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.organizations.scoping import OrgManager
from apps.organizations.sequences import SequenceService


class Cliente(models.Model):
    """Empresa-cliente de una actividad (catálogo de negocio de la org).
    No confundir con Organization, que es el tenant dueño de los datos."""

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="clientes"
    )
    nombre = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_cliente_nombre_per_org"
            ),
        ]

    def __str__(self):
        return self.nombre


class Proceso(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="procesos"
    )
    nombre = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "proceso"
        verbose_name_plural = "procesos"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_proceso_nombre_per_org"
            ),
        ]

    def __str__(self):
        return self.nombre


class Aplicacion(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="aplicaciones"
    )
    nombre = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "aplicacion"
        verbose_name_plural = "aplicaciones"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_aplicacion_nombre_per_org"
            ),
        ]

    def __str__(self):
        return self.nombre


class Stakeholder(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="stakeholders"
    )
    nombre = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "stakeholder"
        verbose_name_plural = "stakeholders"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_stakeholder_nombre_per_org"
            ),
        ]

    def __str__(self):
        return self.nombre


class WorkflowState(models.Model):
    """Estado del flujo de trabajo, configurable por organización. Reemplaza
    el enum fijo Activity.Status."""

    class Categoria(models.TextChoices):
        TODO = "todo", "Por hacer"
        ACTIVE = "active", "En curso"
        DONE = "done", "Finalizado"
        CANCELLED = "cancelled", "Cancelado"
        # Futuras (WAITING, BLOCKED...) no rompen métricas: dependen solo de
        # esta categoría, no de flags booleanos sueltos.

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="workflow_states"
    )
    nombre = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    color = models.CharField(max_length=7)  # "#RRGGBB", de paleta curada en el frontend
    orden = models.PositiveSmallIntegerField(default=0)
    categoria = models.CharField(max_length=20, choices=Categoria.choices)
    is_initial = models.BooleanField(default=False)
    mostrar_en_kanban = models.BooleanField(default=True)
    # {"google_sheets": "En Proceso"} hoy; deja espacio para {"jira": "To Do",
    # "azure": "New"} mañana sin migrar el modelo.
    external_mappings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "estado de flujo"
        verbose_name_plural = "estados de flujo"
        ordering = ["orden", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="uniq_state_slug_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_state_nombre_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(is_initial=True),
                name="one_initial_state_per_org",
            ),
        ]

    def __str__(self):
        return self.nombre

    @property
    def is_done(self) -> bool:
        return self.categoria == self.Categoria.DONE

    @property
    def is_cancelled(self) -> bool:
        return self.categoria == self.Categoria.CANCELLED

    @property
    def is_open(self) -> bool:
        return self.categoria not in (self.Categoria.DONE, self.Categoria.CANCELLED)

    @property
    def sheet_phase(self) -> str:
        return self.external_mappings.get("google_sheets", "")


class Priority(models.Model):
    """Prioridad configurable por organización. Reemplaza Activity.Priority."""

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="priorities"
    )
    nombre = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    color = models.CharField(max_length=7)
    orden = models.PositiveSmallIntegerField(default=0)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "prioridad"
        verbose_name_plural = "prioridades"
        ordering = ["orden", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="uniq_priority_slug_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_priority_nombre_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization"],
                condition=Q(is_default=True),
                name="one_default_priority_per_org",
            ),
        ]

    def __str__(self):
        return self.nombre


class ActivityType(models.Model):
    """Tipo de actividad configurable (Desarrollo, Soporte, Incidente...)."""

    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="activity_types"
    )
    nombre = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)
    color = models.CharField(max_length=7)
    orden = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "tipo de actividad"
        verbose_name_plural = "tipos de actividad"
        ordering = ["orden", "nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="uniq_type_slug_per_org"
            ),
            models.UniqueConstraint(
                fields=["organization", "nombre"], name="uniq_type_nombre_per_org"
            ),
        ]

    def __str__(self):
        return self.nombre


class Activity(models.Model):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="activities",
    )
    # Secuencia por organización (ver SequenceService); el código visible es
    # {org.codigo_prefix}-{numero:04d}.
    numero = models.PositiveIntegerField(editable=False)
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT, null=True, blank=True, related_name="activities"
    )
    proceso = models.ForeignKey(
        Proceso, on_delete=models.PROTECT, null=True, blank=True, related_name="activities"
    )
    aplicacion = models.ForeignKey(
        Aplicacion, on_delete=models.PROTECT, null=True, blank=True, related_name="activities"
    )
    stakeholder = models.ForeignKey(
        Stakeholder, on_delete=models.PROTECT, null=True, blank=True, related_name="activities"
    )
    tipo = models.ForeignKey(
        ActivityType, on_delete=models.SET_NULL, null=True, blank=True, related_name="activities"
    )
    proyecto = models.CharField(max_length=200, blank=True, default="")
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="activities",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_activities",
        null=True,
        blank=True,
    )
    mes_planeacion = models.CharField(max_length=7, blank=True, null=True)
    semana_planeacion = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    prioridad = models.ForeignKey(Priority, on_delete=models.PROTECT, related_name="activities")
    estado = models.ForeignKey(WorkflowState, on_delete=models.PROTECT, related_name="activities")
    fecha_inicio = models.DateField()
    fecha_limite = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "actividad"
        verbose_name_plural = "actividades"
        ordering = ["-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "numero"], name="uniq_activity_numero_per_org"
            ),
        ]

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"

    def save(self, *args, **kwargs):
        if self.numero is None:
            self.numero = SequenceService.next(self.organization)
        super().save(*args, **kwargs)

    @property
    def codigo(self) -> str:
        return f"{self.organization.codigo_prefix}-{self.numero:04d}"
