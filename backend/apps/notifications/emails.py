"""Única capa que sabe de django.core.mail / Resend. El dominio
(SignupService, las vistas de auth) nunca importa esto directamente — llega
aquí solo a través del signal user_registered o de una vista de "reenviar",
para mantener el dominio desacoplado del proveedor de correo."""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.organizations.funnel import track

from .tokens import make_verification_token


def send_verification_email(user) -> None:
    token = make_verification_token(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    send_mail(
        subject="Confirma tu correo en Nexo",
        message=(
            f"Hola {user.nombre},\n\n"
            "Confirma tu correo para terminar de asegurar tu cuenta de Nexo:\n"
            f"{link}\n\n"
            "Si no creaste esta cuenta, ignora este mensaje."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
    user.email_verification_sent_at = timezone.now()
    user.save(update_fields=["email_verification_sent_at"])
    track("email_sent", organization=user.organization, user=user)


def send_password_reset_email(user) -> None:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    send_mail(
        subject="Restablece tu contraseña de Nexo",
        message=(
            f"Hola {user.nombre},\n\n"
            "Pediste restablecer tu contraseña. Este enlace expira pronto:\n"
            f"{link}\n\n"
            "Si no fuiste tú, ignora este mensaje — tu contraseña no cambiará."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
