from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.organizations.scoping import OrgManager


class Empresa(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "empresa"
        verbose_name_plural = "empresas"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Proceso(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "proceso"
        verbose_name_plural = "procesos"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Aplicacion(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "aplicacion"
        verbose_name_plural = "aplicaciones"
        ordering = ["nombre"]

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
    empresa = models.CharField(max_length=100)
    proceso = models.CharField(max_length=100)
    aplicacion = models.CharField(max_length=100)
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
    stakeholder = models.CharField(max_length=100)
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

    def __str__(self):
        return f"{self.codigo} · {self.nombre}"

    @property
    def codigo(self) -> str:
        return f"ACT-{self.pk:04d}"
