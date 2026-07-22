from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication


class DemoAwareJWTAuthentication(JWTAuthentication):
    """Wrapper de JWTAuthentication: si el token es del usuario compartido de
    la demo pública (`is_demo_readonly`) y el método no es de lectura, corta
    acá con 403 — antes de llegar a ningún ViewSet.

    Por qué en la capa de autenticación y no en un permission class: varios
    ViewSets (ActivityViewSet, etc.) declaran su propio `permission_classes`,
    lo que en DRF *reemplaza* — no combina — `DEFAULT_PERMISSION_CLASSES`.
    Ningún ViewSet del proyecto sobreescribe `authentication_classes`, así
    que este es el único punto realmente global para bloquear escrituras sin
    tocar cada vista una por una."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        if getattr(user, "is_demo_readonly", False) and request.method not in SAFE_METHODS:
            raise PermissionDenied("La demo pública es de solo lectura.")
        return user, token
