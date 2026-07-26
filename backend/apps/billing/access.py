"""Resolución de "qué puede hacer esta organización" según su suscripción.

Punto único de verdad: tanto el enforcement (`authentication.py`) como la
UI (`GET /billing/subscription/`) preguntan acá, para que el banner que ve
el usuario no pueda contradecir lo que el API le permite."""
from apps.billing.models import AccessLevel, Subscription
from apps.billing.provider import is_configured


def current_subscription(organization) -> Subscription | None:
    """La suscripción vigente de la organización, o None.

    "Vigente" = la última creada, priorizando las que siguen vivas: al
    convertir un trial en pago real conviven dos filas por un instante (el
    webhook puede llegar antes de que cerremos la del trial), y la del pago
    real es la que manda."""
    if organization is None:
        return None
    subs = list(Subscription.objects.for_org(organization).order_by("-created_at"))
    if not subs:
        return None
    return next((s for s in subs if s.is_live), subs[0])


def level_for_organization(organization) -> str:
    """Nivel de acceso de la organización. Devuelve FULL en los dos casos
    que no son "cliente de pago con problemas": instancia sin proveedor
    configurado (self-hosted) y organización que nunca tuvo suscripción
    (Community, o Cloud dentro del tier gratuito)."""
    if not is_configured():
        return AccessLevel.FULL
    sub = current_subscription(organization)
    if sub is None:
        return AccessLevel.FULL
    return sub.access_level
