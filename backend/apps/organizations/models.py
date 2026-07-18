import re

from django.db import models

# Feature flags que cada plan trae activados por defecto. Un flag presente en
# Organization.feature_flags siempre gana sobre estos defaults — así soporte
# puede activar/desactivar features puntuales sin cambiar el plan.
PLAN_DEFAULT_FLAGS = {
    "community": {"sheets_sync": True},
    "cloud": {"sheets_sync": True},
    "enterprise": {"sheets_sync": True},
}


class Organization(models.Model):
    """Tenant: toda la data de negocio (usuarios, actividades, maestros)
    cuelga de una organización. No confundir con el catálogo Cliente, que es
    la empresa-cliente de una actividad."""

    class Plan(models.TextChoices):
        COMMUNITY = "community", "Community"
        CLOUD = "cloud", "Cloud"
        ENTERPRISE = "enterprise", "Enterprise"

    nombre = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    # Prefijo del código de actividad ("ACT-0001"). Si queda vacío al crear,
    # save() lo deriva del slug.
    codigo_prefix = models.CharField(max_length=10, blank=True, default="")
    timezone = models.CharField(max_length=50, default="America/Bogota")
    locale = models.CharField(max_length=10, default="es")
    currency = models.CharField(max_length=3, default="USD")
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.COMMUNITY)
    feature_flags = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    appsheet_spreadsheet_id = models.CharField(max_length=100, blank=True, default="")
    appsheet_worksheet_name = models.CharField(max_length=100, blank=True, default="")
    # Secuencia de Activity.numero — consumir solo vía SequenceService.
    next_activity_numero = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "organización"
        verbose_name_plural = "organizaciones"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        if not self.codigo_prefix:
            derived = re.sub(r"[^A-Z0-9]", "", self.slug.upper())[:3]
            self.codigo_prefix = derived or "ACT"
        super().save(*args, **kwargs)

    def has_feature(self, name: str) -> bool:
        if name in self.feature_flags:
            return bool(self.feature_flags[name])
        return bool(PLAN_DEFAULT_FLAGS.get(self.plan, {}).get(name, False))

    @property
    def owner(self):
        """El usuario con rol=owner de esta organización (o None). Derivado,
        no un FK propio: evita el bootstrap circular de una Organization que
        necesitaría existir antes que el User que apunta a ella."""
        return self.users.filter(rol="owner", is_active=True).first()
