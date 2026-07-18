"""Token de verificación de email: stateless (sin tabla ni sesiones), firmado
con la SECRET_KEY del proyecto. Confirmar dos veces es inofensivo — el
endpoint que lo consume es idempotente."""
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

_signer = TimestampSigner(salt="nexo.email-verification")
MAX_AGE_SECONDS = 60 * 60 * 24 * 3  # 3 días: verificar no es urgente, es no-bloqueante


def make_verification_token(user) -> str:
    return _signer.sign(f"{user.pk}:{user.email}")


def read_verification_token(token: str) -> int | None:
    """Devuelve el pk del usuario si el token es válido y no expiró, o None."""
    try:
        value = _signer.unsign(token, max_age=MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    pk_str, _, _email = value.partition(":")
    try:
        return int(pk_str)
    except ValueError:
        return None
