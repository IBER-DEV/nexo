from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

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


class Activity(models.Model):
    class Status(models.TextChoices):
        BACKLOG = "backlog", "Backlog"
        IN_PROGRESS = "in_progress", "En progreso"
        TESTING = "testing", "En pruebas"
        PENDING_CLIENT = "pending_client", "Pendiente cliente"
        DONE = "done", "Finalizado"
        CANCELLED = "cancelled", "Cancelado"

    class Priority(models.TextChoices):
        LOW = "low", "Baja"
        MEDIUM = "medium", "Media"
        HIGH = "high", "Alta"
        CRITICAL = "critical", "Crítica"

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
    prioridad = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    estado = models.CharField(max_length=20, choices=Status.choices, default=Status.BACKLOG)
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
