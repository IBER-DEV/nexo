"""Autenticación y reglas globales de petición.

**Por qué las reglas viven acá y no en un permission class:** varios
ViewSets del proyecto declaran su propio `permission_classes`, lo que en DRF
*reemplaza* —no combina— `DEFAULT_PERMISSION_CLASSES`; una regla que debe
valer en toda la API se cae en silencio si se cuelga de ahí (ya pasó una
vez, ver CLAUDE.md). Ningún ViewSet sobreescribe `authentication_classes`,
así que esta es la única capa realmente global.

**Por qué una función y no una jerarquía de clases:** antes el enforcement
estaba dentro de `authenticate()` y se encadenaba por herencia
(`BillingAware` heredaba de `DemoAware`). Eso funcionaba mientras hubo un
solo mecanismo de autenticación, pero al agregar tokens de larga vida quedó
claro el problema: un mecanismo nuevo entra por otra clase y se salta todas
las reglas sin que nada avise. `enforce_global_policy` es el punto único que
*todo* mecanismo llama — si mañana se agrega OAuth, la única obligación es
llamarla.
"""
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import SAFE_METHODS
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import PersonalAccessToken

# `/auth/demo-login/` es un POST que no escribe nada (solo emite un token,
# sin tocar al usuario del token entrante). Sin esta excepción, un visitante
# con sesión demo activa —p. ej. "owner"— no podía tocar "Probar como
# coordinador" en el RoleSelector: su propio token viejo disparaba el
# bloqueo contra el endpoint que intenta cambiar de rol.
DEMO_EXEMPT_PATH_SUFFIX = "/auth/demo-login/"

# Gestionar tokens exige una sesión real. Si un token pudiera crear otros,
# uno de solo lectura emitiría uno de escritura y el scope no valdría nada.
TOKEN_MANAGEMENT_PATH_FRAGMENT = "/auth/tokens/"


# MCP habla JSON-RPC sobre POST: *todas* sus llamadas son escrituras a ojos
# de HTTP, incluidas las que solo consultan. Aplicarle la regla por verbo
# dejaría a un token de solo lectura sin poder ni listar actividades. El
# control equivalente vive por herramienta en `apps/mcp/tools.py`, que llama
# a `assert_write_allowed` para las que sí escriben.
METHOD_AGNOSTIC_PATH_FRAGMENT = "/mcp/"

DEMO_READONLY_MESSAGE = "La demo pública es de solo lectura."
READ_ONLY_TOKEN_MESSAGE = "Este token es de solo lectura."


def assert_write_allowed(user, *, token=None) -> None:
    """¿Puede este usuario escribir, sin mirar el verbo HTTP?

    Es la forma canónica de la regla. `enforce_global_policy` la usa cuando
    el método no es seguro, y el despachador de MCP la llama directo para
    las herramientas que escriben — así las dos rutas no pueden divergir.
    """
    if getattr(user, "is_demo_readonly", False):
        raise PermissionDenied(DEMO_READONLY_MESSAGE)
    if token is not None and token.scope == PersonalAccessToken.Scope.READ:
        raise PermissionDenied(READ_ONLY_TOKEN_MESSAGE)
    # Import local: apps.billing importa de apps.users, a nivel de módulo
    # sería un ciclo.
    from apps.billing.access import assert_can_write

    assert_can_write(user)


def enforce_global_policy(request, user, *, token=None) -> None:
    """Reglas que valen para toda la API, sin importar cómo se autenticó
    quien pide. Corta con 403 o deja pasar.

    `token` es el `PersonalAccessToken` cuando la petición se autenticó con
    uno; None cuando viene de una sesión normal.
    """
    # Un token nunca gestiona tokens: si pudiera, uno de solo lectura
    # emitiría uno de escritura y el scope no valdría nada. Va antes que
    # todo lo demás y sin excepciones de ruta.
    if token is not None and TOKEN_MANAGEMENT_PATH_FRAGMENT in request.path:
        raise PermissionDenied(
            "Los tokens de acceso no pueden gestionar otros tokens: entra a Nexo "
            "con tu cuenta para crearlos o revocarlos."
        )

    if METHOD_AGNOSTIC_PATH_FRAGMENT in request.path:
        # Solo se valida que pueda *entrar*; el permiso de escritura lo
        # resuelve cada herramienta.
        from apps.billing.access import assert_can_read

        assert_can_read(user)
        return

    if request.method not in SAFE_METHODS and not request.path.endswith(
        DEMO_EXEMPT_PATH_SUFFIX
    ):
        assert_write_allowed(user, token=token)

    # El nivel `blocked` corta también las lecturas, y las exenciones de
    # ruta de facturación solo aplican acá.
    from apps.billing.access import enforce_billing_access

    enforce_billing_access(request, user)


class NexoJWTAuthentication(JWTAuthentication):
    """Sesión normal del navegador (login, refresh). Idéntica a la de
    simplejwt salvo que aplica las reglas globales antes de dejar pasar."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result
        enforce_global_policy(request, user)
        return user, validated_token


class PersonalAccessTokenAuthentication(BaseAuthentication):
    """`Authorization: Bearer nxo_...`

    Convive con el JWT en el mismo header: si el valor no arranca con el
    prefijo de un token de Nexo, devuelve None y DRF pasa al siguiente
    autenticador. Así un cliente MCP y el navegador usan la misma forma de
    header sin pisarse.
    """

    keyword = b"bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if len(header) != 2 or header[0].lower() != self.keyword:
            return None

        try:
            raw = header[1].decode()
        except UnicodeError:
            return None

        if not raw.startswith(PersonalAccessToken.PREFIX):
            # Es un JWT: no es nuestro turno.
            return None

        try:
            token = PersonalAccessToken.objects.select_related(
                "user", "user__organization"
            ).get(token_hash=PersonalAccessToken.hash_token(raw))
        except PersonalAccessToken.DoesNotExist:
            raise AuthenticationFailed("Token inválido.")

        if token.is_revoked:
            raise AuthenticationFailed("Este token fue revocado.")
        if token.is_expired:
            raise AuthenticationFailed("Este token expiró.")
        if not token.user.is_active:
            # Desactivar a alguien tiene que cortarle también sus
            # integraciones, no solo el login.
            raise AuthenticationFailed("La cuenta dueña de este token está desactivada.")

        enforce_global_policy(request, token.user, token=token)
        token.touch()
        return token.user, token

    def authenticate_header(self, request):
        return "Bearer"
