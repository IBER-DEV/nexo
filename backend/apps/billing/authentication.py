"""Enforcement del estado de suscripción, en la capa de autenticación.

Por qué acá y no en un permission class: varios ViewSets del proyecto
declaran su propio `permission_classes`, lo que en DRF *reemplaza* —no
combina— `DEFAULT_PERMISSION_CLASSES`; una regla que debe valer en toda la
API se cae en silencio si se cuelga de ahí (ya pasó una vez, ver CLAUDE.md).
Ningún ViewSet sobreescribe `authentication_classes`, así que este es el
único punto realmente global.

Hereda de `DemoAwareJWTAuthentication` en vez de duplicarla: son dos reglas
del mismo tipo (cortar antes de llegar a la vista) y encadenarlas por
herencia mantiene una sola clase en `DEFAULT_AUTHENTICATION_CLASSES`. La
demo pública se evalúa primero — un usuario de demo es de solo lectura sin
importar qué diga su facturación."""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS

from apps.users.authentication import DemoAwareJWTAuthentication

from .access import level_for_organization
from .models import AccessLevel

READ_ONLY_MESSAGE = (
    "Tu suscripción no está al día: la organización quedó en solo lectura. "
    "Actualiza el método de pago en Configuración → Facturación para volver a escribir."
)
BLOCKED_MESSAGE = (
    "La suscripción de tu organización expiró. Reactívala en "
    "Configuración → Facturación para recuperar el acceso."
)


class BillingAwareJWTAuthentication(DemoAwareJWTAuthentication):
    # Facturación e identidad quedan siempre accesibles: bloquear el
    # endpoint por el que se paga a quien tiene que pagar es un callejón sin
    # salida del que solo se sale por soporte manual.
    EXEMPT_PATH_FRAGMENTS = ("/billing/", "/auth/")

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result

        if any(fragment in request.path for fragment in self.EXEMPT_PATH_FRAGMENTS):
            return user, token

        level = level_for_organization(getattr(user, "organization", None))
        if level == AccessLevel.BLOCKED:
            raise PermissionDenied(BLOCKED_MESSAGE)
        if level == AccessLevel.READ_ONLY and request.method not in SAFE_METHODS:
            raise PermissionDenied(READ_ONLY_MESSAGE)
        return user, token
