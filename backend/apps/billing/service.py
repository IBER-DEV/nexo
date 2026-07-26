"""Dominio de facturación. No importa `requests` ni conoce la forma de la
API de Lemon Squeezy — eso vive en `provider.py`; acá solo hay reglas de
negocio sobre dicts ya normalizados.

Todo lo que cambia el plan de una organización pasa por este módulo: ni las
vistas ni el admin escriben `Organization.plan` directo, igual que ningún
sitio escribe `user.organization` sin pasar por `membership.add_member()`
(ADR 0002).
"""
import hashlib
import json
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.organizations.funnel import track

from . import provider
from .access import current_subscription
from .models import BillingCustomer, CheckoutSession, Subscription, WebhookEvent

logger = logging.getLogger("nexo.billing")

# Eventos cuyo `data` ES una suscripción (se aplican tal cual).
SUBSCRIPTION_EVENTS = {
    "subscription_created",
    "subscription_updated",
    "subscription_cancelled",
    "subscription_resumed",
    "subscription_expired",
    "subscription_paused",
    "subscription_unpaused",
}
# Evento cuyo `data` es una factura: solo trae el id de la suscripción.
PAYMENT_FAILED_EVENT = "subscription_payment_failed"


class BillingError(RuntimeError):
    pass


class AlreadySubscribed(BillingError):
    pass


class InvalidSignature(BillingError):
    pass


def _dt(value):
    """Fechas del proveedor: ISO-8601 o None."""
    return parse_datetime(value) if value else None


# ─── Plan de la organización ──────────────────────────────────────────────


def sync_organization_plan(subscription: Subscription) -> None:
    org = subscription.organization
    nuevo = subscription.effective_plan
    if org.plan != nuevo:
        org.plan = nuevo
        org.save(update_fields=["plan"])
        track("plan_changed", organization=org, plan=nuevo, subscription_status=subscription.status)


# ─── Puestos facturados ───────────────────────────────────────────────────


def sync_seats(organization) -> bool:
    """Empuja el número de usuarios activos como cantidad facturada.

    Sin esto, "puestos ilimitados en el plan de pago" sería literal: alguien
    paga un puesto y suma treinta gratis. Con precio por usuario/mes es un
    agujero de ingreso, no un detalle.

    **Best-effort a propósito.** Va después del commit y se traga cualquier
    error del proveedor: nadie debería quedarse sin poder sumar a un
    compañero porque Lemon Squeezy tuvo un mal minuto. La reconciliación
    real es `manage.py sync_seats`, que puede correr como cron.
    """
    from .limits import seats_in_use

    sub = current_subscription(organization)
    if sub is None or not sub.provider_item_id:
        return False
    # Solo se ajusta lo que se está cobrando: un trial o una suscripción
    # expirada no tienen puestos que facturar.
    if sub.status not in (Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE):
        return False

    cantidad = seats_in_use(organization)
    if cantidad == sub.quantity:
        return False

    try:
        provider.update_quantity(sub.provider_item_id, cantidad)
    except (provider.BillingNotConfigured, provider.ProviderError):
        logger.warning(
            "no se pudo sincronizar puestos de %s (%s → %s); "
            "queda para manage.py sync_seats",
            organization.slug,
            sub.quantity,
            cantidad,
        )
        return False

    Subscription.objects.filter(pk=sub.pk).update(quantity=cantidad)
    track("seats_synced", organization=organization, quantity=cantidad)
    return True


def schedule_seat_sync(organization) -> None:
    """Encola `sync_seats` para después del commit. Único punto que deberían
    llamar los sitios que cambian la cantidad de usuarios activos."""
    transaction.on_commit(lambda: sync_seats(organization))


# ─── Trial (sprint 3): 14 días, sin tarjeta ───────────────────────────────


def start_trial(organization, user) -> Subscription:
    """Trial local, sin pasar por el proveedor: la promesa comercial es "sin
    tarjeta", y pedirle a Lemon Squeezy que cree una suscripción en trial
    exige justamente el método de pago que prometimos no pedir."""
    if Subscription.objects.for_org(organization).exists():
        raise AlreadySubscribed("Esta organización ya usó su periodo de prueba.")

    sub = Subscription.objects.create(
        organization=organization,
        status=Subscription.Status.TRIALING,
        plan="cloud",
        trial_ends_at=timezone.now() + timedelta(days=settings.BILLING_TRIAL_DAYS),
    )
    sync_organization_plan(sub)
    track("trial_started", organization=organization, user=user, dias=settings.BILLING_TRIAL_DAYS)
    return sub


# ─── Checkout (sprint 1) ──────────────────────────────────────────────────


def start_checkout(organization, user) -> CheckoutSession:
    from .limits import seats_in_use

    BillingCustomer.objects.get_or_create(
        organization=organization, defaults={"email": user.email}
    )
    redirect_url = f"{settings.FRONTEND_URL}/settings?billing=ok"
    data = provider.create_checkout(
        email=user.email,
        name=user.nombre,
        organization_id=organization.pk,
        redirect_url=redirect_url,
        # Los puestos que la organización ya ocupa, para que la primera
        # factura no salga en 1 asiento teniendo un equipo entero.
        quantity=max(1, seats_in_use(organization)),
    )
    session = CheckoutSession.objects.create(
        organization=organization,
        created_by=user,
        provider_checkout_id=data["id"],
        url=data["url"],
        variant_id=str(settings.LEMONSQUEEZY_VARIANT_ID_CLOUD),
    )
    track("checkout_started", organization=organization, user=user, checkout_id=data["id"])
    return session


# ─── Aplicación de eventos del proveedor (sprint 2) ───────────────────────


@transaction.atomic
def apply_subscription(organization, normalized: dict) -> Subscription:
    """Upsert de la suscripción por su id en el proveedor. Idempotente: el
    mismo payload aplicado dos veces deja el mismo estado."""
    sub, created = Subscription.objects.update_or_create(
        provider="lemonsqueezy",
        provider_subscription_id=normalized["provider_subscription_id"],
        defaults={
            "organization": organization,
            "provider_customer_id": normalized["provider_customer_id"],
            "provider_item_id": normalized.get("provider_item_id", ""),
            "status": normalized["status"],
            "provider_status": normalized["provider_status"],
            "plan": "cloud",
            "variant_id": normalized["variant_id"],
            "quantity": normalized["quantity"],
            "trial_ends_at": _dt(normalized["trial_ends_at"]),
            "renews_at": _dt(normalized["renews_at"]),
            "ends_at": _dt(normalized["ends_at"]),
            "customer_portal_url": normalized["customer_portal_url"],
            "update_payment_url": normalized["update_payment_url"],
        },
    )

    # Conversión de trial → pago: el trial local deja de ser una suscripción
    # viva. Ver el docstring de Subscription para por qué esto no es
    # cosmético.
    Subscription.objects.for_org(organization).filter(
        provider_subscription_id="", status=Subscription.Status.TRIALING
    ).exclude(pk=sub.pk).update(status=Subscription.Status.EXPIRED)

    if normalized["provider_customer_id"]:
        owner = organization.owner
        defaults = {"provider_customer_id": normalized["provider_customer_id"]}
        email = normalized.get("email") or (owner.email if owner else "")
        if email:
            defaults["email"] = email
        BillingCustomer.objects.update_or_create(organization=organization, defaults=defaults)

    CheckoutSession.objects.for_org(organization).filter(
        status=CheckoutSession.Status.PENDING
    ).update(status=CheckoutSession.Status.COMPLETED, completed_at=timezone.now())

    sync_organization_plan(sub)
    # Red de seguridad sobre la cantidad inicial del checkout: si el equipo
    # cambió entre "abrí el checkout" y "pagué", o si el proveedor ignoró la
    # cantidad que mandamos, acá se corrige. No-op cuando ya coincide, así
    # que no cuesta una llamada extra en el caso normal.
    schedule_seat_sync(organization)
    track(
        "subscription_created" if created else "subscription_updated",
        organization=organization,
        status=sub.status,
        plan=sub.plan,
    )
    return sub


# ─── Webhooks (sprint 2) ──────────────────────────────────────────────────


def _resolve_organization(payload: dict):
    from apps.organizations.models import Organization

    custom = (payload.get("meta") or {}).get("custom_data") or {}
    org_id = custom.get("organization_id")
    try:
        pk = int(org_id)
    except (TypeError, ValueError):
        # custom_data lo escribe quien crea el checkout; un valor basura no
        # puede tumbar el endpoint (el proveedor reintentaría en loop).
        return None
    return Organization.objects.filter(pk=pk).first()


def handle_webhook(raw_body: bytes, signature: str) -> WebhookEvent:
    """Verifica firma, deduplica y aplica. Devuelve el `WebhookEvent`
    resultante — el de la primera entrega si esta es un reintento."""
    if not provider.verify_signature(raw_body, signature):
        raise InvalidSignature("Firma inválida.")

    event_key = hashlib.sha256(raw_body).hexdigest()
    existing = WebhookEvent.objects.filter(event_key=event_key).first()
    if existing is not None:
        logger.info("webhook duplicado ignorado: %s", existing.event_name)
        return existing

    payload = json.loads(raw_body.decode("utf-8"))
    event_name = (payload.get("meta") or {}).get("event_name", "")
    organization = _resolve_organization(payload)

    event = WebhookEvent(
        event_key=event_key,
        event_name=event_name,
        payload=payload,
        organization=organization,
        status=WebhookEvent.Status.IGNORED,
    )

    try:
        if event_name in SUBSCRIPTION_EVENTS:
            if organization is None:
                # Sin `custom_data.organization_id` no hay a quién aplicarle
                # el evento. Queda registrado como fallido para poder
                # reprocesarlo a mano: perder un pago en silencio es peor
                # que un 200 con una fila en rojo en el admin.
                raise BillingError("El evento no trae organization_id en custom_data.")
            apply_subscription(organization, provider.normalize_subscription(payload.get("data", {})))
            event.status = WebhookEvent.Status.PROCESSED
        elif event_name == PAYMENT_FAILED_EVENT:
            event.status = (
                WebhookEvent.Status.PROCESSED
                if _apply_payment_failed(payload)
                else WebhookEvent.Status.IGNORED
            )
        else:
            logger.info("webhook sin handler: %s", event_name)
    except Exception as exc:  # noqa: BLE001 — se registra y se responde 200
        event.status = WebhookEvent.Status.FAILED
        event.error = str(exc)[:2000]
        logger.exception("webhook %s falló", event_name)

    event.save()
    return event


def _apply_payment_failed(payload: dict) -> bool:
    """`subscription_payment_failed` trae una factura, no una suscripción:
    marcamos la suscripción como vencida con el id que sí viene, sin salir a
    la API. Un `subscription_updated` posterior traerá el estado autoritativo
    del proveedor y corregirá esto si hace falta."""
    attrs = (payload.get("data") or {}).get("attributes") or {}
    sub_id = attrs.get("subscription_id")
    if not sub_id:
        return False
    sub = Subscription.objects.filter(provider_subscription_id=str(sub_id)).first()
    if sub is None:
        return False
    sub.status = Subscription.Status.PAST_DUE
    sub.provider_status = "past_due"
    sub.save(update_fields=["status", "provider_status", "updated_at"])
    track("payment_failed", organization=sub.organization, subscription_id=str(sub_id))
    return True
