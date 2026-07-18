"""Signup self-service (Fase 1, punto 4): un visitante se convierte en Owner
de una organización nueva sin intervención humana. Todo en una transacción —
si cualquier paso falla, no debe quedar ni una Organization sin usuarios ni
un User sin organización."""
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.org_templates import TemplateError, apply_template

from .funnel import track
from .models import Organization
from .signals import user_registered
from .slugs import unique_slug_for

User = get_user_model()


class SignupError(Exception):
    """Error de negocio del signup, traducible 1:1 a un 400 de API."""


@transaction.atomic
def register(*, email: str, password: str, nombre: str, nombre_org: str, template_key: str):
    track("signup_started", email=email)

    if User.objects.filter(email__iexact=email).exists():
        raise SignupError("Ya existe una cuenta con este correo.")

    org = Organization.objects.create(nombre=nombre_org, slug=unique_slug_for(nombre_org))

    try:
        apply_template(org, template_key, WorkflowState, Priority, ActivityType)
    except TemplateError as exc:
        raise SignupError(str(exc)) from exc

    try:
        user = User.objects.create_user(
            email, nombre, password, organization=org, rol=User.Role.OWNER
        )
    except IntegrityError:
        # Carrera: dos requests con el mismo email llegaron casi a la vez.
        raise SignupError("Ya existe una cuenta con este correo.")

    track("signup_completed", organization=org, user=user)
    transaction.on_commit(
        lambda: user_registered.send(sender=None, user=user, organization=org)
    )
    return org, user
