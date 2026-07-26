"""Billing (Fase 1, punto 5). Proveedor: Lemon Squeezy como Merchant of
Record — Stripe no opera para cuentas colombianas (ver
docs/roadmap/launch-strategy.md).

Dos reglas que gobiernan todo este módulo:

1. **Billing es opt-in.** Sin credenciales configuradas (el caso del
   self-hosted AGPL) nada de esto gatea nada: `access.py` devuelve acceso
   completo y los endpoints de checkout responden 503. Nexo Community no
   deja de funcionar porque no haya un Lemon Squeezy detrás.
2. **Una organización sin `Subscription` tiene acceso completo.** El plan
   Community es gratis de verdad, y Cloud tiene tier gratuito de entrada
   (ver monetization.md). Solo se degrada el acceso de quien *tuvo* una
   suscripción y su estado se deterioró — nunca de quien nunca entró al
   embudo de pago.

El estado del proveedor se guarda crudo (`provider_status`) además del
estado de dominio (`status`): el mapeo Lemon Squeezy → dominio vive en
`service.py` y puede cambiar sin perder el dato original.
"""
from django.db import models
from django.utils import timezone

from apps.organizations.scoping import OrgManager


class AccessLevel(models.TextChoices):
    """Qué puede hacer una organización según el estado de su suscripción.
    Tabla de decisión en docs/roadmap/launch-strategy.md."""

    FULL = "full", "Completo"
    READ_ONLY = "read_only", "Solo lectura"
    BLOCKED = "blocked", "Bloqueado"


class BillingCustomer(models.Model):
    """El cliente de la organización en el proveedor de pagos. Separado de
    `Subscription` porque sobrevive a la suscripción: quien cancela y vuelve
    seis meses después es el mismo cliente, con el mismo método de pago y el
    mismo historial de facturas."""

    organization = models.OneToOneField(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="billing_customer",
    )
    provider = models.CharField(max_length=30, default="lemonsqueezy")
    provider_customer_id = models.CharField(max_length=64, blank=True, default="")
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "cliente de facturación"
        verbose_name_plural = "clientes de facturación"

    def __str__(self):
        return f"{self.organization.slug} → {self.provider}:{self.provider_customer_id or '—'}"


class Subscription(models.Model):
    """Suscripción de una organización a un plan de pago.

    A propósito **sin** una constraint de "una sola suscripción viva por
    organización": los webhooks llegan desordenados y una constraint así
    convierte un reintento del proveedor en un 500 permanente. La
    unicidad real que importa es la del id del proveedor; "cuál es la
    suscripción vigente" se resuelve por orden de creación
    (`access.current_subscription`), y al convertir un trial en pago real el
    servicio marca la fila del trial como `expired` — si no, una suscripción
    de pago que expira dejaría al trial viejo (todavía "vivo") mandando, y
    la organización recuperaría acceso completo sin pagar."""

    class Status(models.TextChoices):
        TRIALING = "trialing", "En prueba"
        ACTIVE = "active", "Activa"
        PAST_DUE = "past_due", "Pago vencido"
        PAUSED = "paused", "Pausada"
        CANCELLED = "cancelled", "Cancelada"
        EXPIRED = "expired", "Expirada"

    # Estados en los que la suscripción todavía es "la vigente" de la org.
    LIVE_STATUSES = [Status.TRIALING, Status.ACTIVE, Status.PAST_DUE, Status.PAUSED]

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    provider = models.CharField(max_length=30, default="lemonsqueezy")
    # Vacío en el trial local de 14 días: todavía no existe nada en el
    # proveedor porque el trial no pide tarjeta.
    provider_subscription_id = models.CharField(max_length=64, blank=True, default="")
    provider_customer_id = models.CharField(max_length=64, blank=True, default="")
    # Id del subscription-item en el proveedor: es contra él que se ajustan
    # los puestos facturados (ver service.sync_seats).
    provider_item_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices)
    # Estado tal cual lo mandó el proveedor (on_trial, unpaid, ...), para
    # diagnosticar sin depender de que el mapeo a dominio sea correcto.
    provider_status = models.CharField(max_length=40, blank=True, default="")
    plan = models.CharField(max_length=20, default="cloud")
    variant_id = models.CharField(max_length=64, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    renews_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    customer_portal_url = models.URLField(max_length=500, blank=True, default="")
    update_payment_url = models.URLField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "suscripción"
        verbose_name_plural = "suscripciones"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_subscription_id"],
                condition=~models.Q(provider_subscription_id=""),
                name="unique_provider_subscription",
            )
        ]

    def __str__(self):
        return f"{self.organization.slug} · {self.plan} ({self.status})"

    @property
    def is_live(self) -> bool:
        return self.status in self.LIVE_STATUSES

    @property
    def trial_expired(self) -> bool:
        return (
            self.status == self.Status.TRIALING
            and self.trial_ends_at is not None
            and self.trial_ends_at <= timezone.now()
        )

    @property
    def effective_plan(self) -> str:
        """Plan que la organización tiene derecho a usar *ahora*. Un trial
        vencido o una suscripción expirada revierten a Community — el plan
        gratuito es el piso, no el bloqueo."""
        if self.trial_expired or self.status == self.Status.EXPIRED:
            return "community"
        return self.plan

    @property
    def access_level(self) -> str:
        """Estado de suscripción → qué puede hacer la organización.

        Dos matices sobre la tabla de launch-strategy.md, ambos deliberados:

        - **Cancelada con `ends_at` futuro = acceso completo.** Lemon
          Squeezy marca `cancelled` en cuanto alguien apaga la renovación,
          pero el periodo ya está pagado. Cortar ahí sería cobrar un mes y
          no entregarlo.
        - **Trial vencido = acceso completo, plan revertido a Community.**
          La asimetría manda: si dejamos entrar de más, regalamos acceso a
          quien no iba a pagar igual; si cortamos de más, echamos de su
          propia data a alguien que nunca debió un peso. Lo que el trial
          otorga son *features de plan*, no el derecho a escribir — la
          degradación vive en `effective_plan`, no acá. `read_only` queda
          para quien sí pagó y dejó de hacerlo (`past_due`), que es una
          situación de cobranza real.
        """
        now = timezone.now()
        if self.status in (self.Status.TRIALING, self.Status.ACTIVE):
            return AccessLevel.FULL
        if self.status == self.Status.CANCELLED:
            pagado = self.ends_at is not None and self.ends_at > now
            return AccessLevel.FULL if pagado else AccessLevel.READ_ONLY
        if self.status in (self.Status.PAST_DUE, self.Status.PAUSED):
            return AccessLevel.READ_ONLY
        return AccessLevel.BLOCKED


class CheckoutSession(models.Model):
    """Un intento de pago: el checkout hospedado que se le abrió a alguien.
    Se guarda antes de redirigir para poder responder "¿este usuario llegó a
    intentar pagar?" sin depender de que el proveedor nos cuente algo."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        COMPLETED = "completed", "Completado"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="checkout_sessions",
    )
    created_by = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    provider = models.CharField(max_length=30, default="lemonsqueezy")
    provider_checkout_id = models.CharField(max_length=64, blank=True, default="")
    url = models.URLField(max_length=1000)
    variant_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    objects = OrgManager()

    class Meta:
        verbose_name = "sesión de checkout"
        verbose_name_plural = "sesiones de checkout"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization.slug} · {self.status} · {self.created_at:%Y-%m-%d}"


class WebhookEvent(models.Model):
    """Bitácora e idempotencia de los webhooks del proveedor.

    La clave de deduplicación (`event_key`) es el **sha256 del cuerpo
    crudo**, no un id que mande el proveedor: Lemon Squeezy no garantiza un
    identificador único de entrega, y el digest del cuerpo tiene justo la
    semántica que queremos — un reintento de la misma entrega trae el mismo
    cuerpo y se descarta, mientras que dos `subscription_updated` con
    contenido distinto son dos eventos y ambos se procesan."""

    class Status(models.TextChoices):
        PROCESSED = "processed", "Procesado"
        IGNORED = "ignored", "Ignorado"
        FAILED = "failed", "Fallido"

    provider = models.CharField(max_length=30, default="lemonsqueezy")
    event_key = models.CharField(max_length=64, unique=True)
    event_name = models.CharField(max_length=60)
    payload = models.JSONField(default=dict, blank=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="webhook_events",
    )
    status = models.CharField(max_length=20, choices=Status.choices)
    error = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "evento de webhook"
        verbose_name_plural = "eventos de webhook"
        ordering = ["-received_at"]

    def __str__(self):
        return f"{self.event_name} · {self.status} · {self.received_at:%Y-%m-%d %H:%M}"
