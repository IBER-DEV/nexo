"""Resolución de "qué puede hacer esta organización" según su suscripción.

Punto único de verdad: tanto el enforcement
(`apps.users.authentication.enforce_global_policy`) como la UI
(`GET /billing/`) preguntan acá, para que el banner que ve el usuario no
pueda contradecir lo que el API le permite."""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS

from apps.billing.models import AccessLevel, Subscription
from apps.billing.provider import is_configured

READ_ONLY_MESSAGE = (
    "Tu suscripción no está al día: la organización quedó en solo lectura. "
    "Actualiza el método de pago en Configuración → Facturación para volver a escribir."
)
BLOCKED_MESSAGE = (
    "La suscripción de tu organización expiró. Reactívala en "
    "Configuración → Facturación para recuperar el acceso."
)

# Facturación e identidad quedan siempre accesibles: bloquear el endpoint
# por el que se paga a quien tiene que pagar es un callejón sin salida del
# que solo se sale por soporte manual.
EXEMPT_PATH_FRAGMENTS = ("/billing/", "/auth/")


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


def enforce_billing_access(request, user) -> None:
    """Corta la petición si la suscripción de la organización no da para
    tanto. La llama `enforce_global_policy` — no se engancha a un mecanismo
    de autenticación concreto, para que agregar uno nuevo (tokens de larga
    vida, y mañana OAuth) no la deje afuera por olvido."""
    if any(fragment in request.path for fragment in EXEMPT_PATH_FRAGMENTS):
        return
    level = level_for_organization(getattr(user, "organization", None))
    if level == AccessLevel.BLOCKED:
        raise PermissionDenied(BLOCKED_MESSAGE)
    if level == AccessLevel.READ_ONLY and request.method not in SAFE_METHODS:
        raise PermissionDenied(READ_ONLY_MESSAGE)
