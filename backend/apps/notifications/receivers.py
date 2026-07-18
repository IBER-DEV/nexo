import logging

from django.dispatch import receiver

from apps.organizations.signals import user_registered

from .emails import send_verification_email

logger = logging.getLogger(__name__)


@receiver(user_registered)
def on_user_registered(sender, user, organization, **kwargs):
    # Best-effort, igual que el push a Sheets (apps/activities/signals.py):
    # un proveedor de correo caído o mal configurado nunca debe romper un
    # signup ya confirmado — el usuario tiene el botón "Reenviar" del banner.
    try:
        send_verification_email(user)
    except Exception:
        logger.exception("No se pudo enviar el correo de verificación a %s", user.email)
