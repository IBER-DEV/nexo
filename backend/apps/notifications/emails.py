"""Única capa que sabe de django.core.mail / Resend. El dominio
(SignupService, las vistas de auth) nunca importa esto directamente — llega
aquí solo a través del signal user_registered o de una vista de "reenviar",
para mantener el dominio desacoplado del proveedor de correo."""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.organizations.funnel import track

from .tokens import make_verification_token


def _send(*, subject: str, template: str, to: str, context: dict) -> None:
    text_body = render_to_string(f"notifications/{template}.txt", context)
    html_body = render_to_string(f"notifications/{template}.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to],
    )
    message.attach_alternative(html_body, "text/html")
    message.send()


def send_verification_email(user) -> None:
    token = make_verification_token(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    _send(
        subject="Confirma tu correo en Nexo",
        template="verification_email",
        to=user.email,
        context={"nombre": user.nombre, "link": link},
    )
    user.email_verification_sent_at = timezone.now()
    user.save(update_fields=["email_verification_sent_at"])
    track("email_sent", organization=user.organization, user=user)


def send_password_reset_email(user) -> None:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    _send(
        subject="Restablece tu contraseña de Nexo",
        template="password_reset_email",
        to=user.email,
        context={"nombre": user.nombre, "link": link},
    )
