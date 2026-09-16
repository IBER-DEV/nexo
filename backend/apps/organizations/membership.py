"""Membership: pertenecer a una organización con un rol (ADR 0002).

`add_member` es LA única puerta de entrada para unirse a una organización
existente — todo mecanismo de incorporación (código de acceso hoy; email,
SSO, SCIM, API mañana) termina aquí, y ninguno escribe `user.organization`
o `user.rol` por su cuenta. El storage actual (FK + rol en User) es un
detalle encapsulado en este módulo: cuando Enterprise necesite multi-org,
cambia el interior, no los llamadores.

Fundar una organización (signup.register) NO pasa por aquí a propósito:
crear el Owner de una org nueva es otro caso de dominio, y add_member
rechaza rol=owner por diseño.
"""
import secrets

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from .funnel import track
from .models import Organization, OrganizationAccessCode
from .signals import user_registered

User = get_user_model()

# Sin caracteres ambiguos (0/O, 1/I/L) — el código se comparte por chat o
# verbalmente. 12 chars sobre alfabeto de 31 ≈ 59 bits de entropía.
_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


class MembershipError(Exception):
    """Error de negocio de membership, traducible 1:1 a un 400 de API."""


def add_member(*, user, organization: Organization, rol: str):
    if rol == User.Role.OWNER:
        raise MembershipError("Una organización solo tiene un Owner: el que la fundó.")
    if rol not in User.Role.values:
        raise MembershipError(f"Rol desconocido: {rol!r}")
    if user.organization_id is not None:
        raise MembershipError("Este usuario ya pertenece a una organización.")
    user.organization = organization
    user.rol = rol
    user.save(update_fields=["organization", "rol"])
    track("member_joined", organization=organization, user=user)
    return user


def _generate_codigo() -> str:
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(12))
    return f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"


def generate_access_code(
    *, organization: Organization, rol: str, created_by, expires_at=None, max_usos=None
) -> OrganizationAccessCode:
    if rol == User.Role.OWNER:
        raise MembershipError("No se pueden generar códigos con rol Owner.")
    if rol not in User.Role.values:
        raise MembershipError(f"Rol desconocido: {rol!r}")
    return OrganizationAccessCode.objects.create(
        organization=organization,
        codigo=_generate_codigo(),
        rol=rol,
        created_by=created_by,
        expires_at=expires_at,
        max_usos=max_usos,
    )


def resolve_access_code(codigo: str) -> OrganizationAccessCode:
    """Devuelve el código si es canjeable ahora mismo; MembershipError si no.
    No consume usos — sirve para el preview público de 'Te unirás a...'."""
    try:
        code = OrganizationAccessCode.objects.select_related("organization").get(
            codigo=codigo.strip().upper()
        )
    except OrganizationAccessCode.DoesNotExist:
        raise MembershipError("El código no existe o ya no es válido.")
    _validate_redeemable(code)
    return code


def _validate_redeemable(code: OrganizationAccessCode) -> None:
    if not code.is_active:
        raise MembershipError("El código no existe o ya no es válido.")
    if code.expires_at is not None and code.expires_at <= timezone.now():
        raise MembershipError("El código ya expiró.")
    if code.max_usos is not None and code.usos >= code.max_usos:
        raise MembershipError("El código ya alcanzó su número máximo de usos.")


@transaction.atomic
def redeem_access_code(*, user, codigo: str) -> Organization:
    """Canjea un código: valida bajo lock (evita que dos canjes simultáneos
    superen max_usos), une al usuario vía add_member e incrementa el
    contador — todo o nada."""
    try:
        code = (
            OrganizationAccessCode.objects.select_for_update()
            .select_related("organization")
            .get(codigo=codigo.strip().upper())
        )
    except OrganizationAccessCode.DoesNotExist:
        raise MembershipError("El código no existe o ya no es válido.")
    _validate_redeemable(code)
    add_member(user=user, organization=code.organization, rol=code.rol)
    code.usos += 1
    code.save(update_fields=["usos"])
    return code.organization


@transaction.atomic
def register_with_code(*, email: str, password: str, nombre: str, codigo: str):
    """Espejo de signup.register() para el modo 'Tengo un código': crea la
    cuenta y la une a una organización existente, todo en una transacción —
    si el código es inválido no queda ningún usuario huérfano."""
    if User.objects.filter(email__iexact=email).exists():
        raise MembershipError("Ya existe una cuenta con este correo.")

    try:
        user = User.objects.create_user(email, nombre, password)
    except IntegrityError:
        # Carrera: dos requests con el mismo email llegaron casi a la vez.
        raise MembershipError("Ya existe una cuenta con este correo.")

    org = redeem_access_code(user=user, codigo=codigo)

    transaction.on_commit(
        lambda: user_registered.send(sender=None, user=user, organization=org)
    )
    return org, user
