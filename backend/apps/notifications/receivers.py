from django.dispatch import receiver

from apps.organizations.signals import user_registered

from .emails import send_verification_email


@receiver(user_registered)
def on_user_registered(sender, user, organization, **kwargs):
    send_verification_email(user)
