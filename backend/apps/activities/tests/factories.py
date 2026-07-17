"""Shared object factories for the activities test suite."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model

from apps.activities.models import Activity, Aplicacion, Cliente, Proceso, Stakeholder
from apps.organizations.models import Organization

User = get_user_model()


def _catalog(model, org, nombre):
    if not nombre:
        return None
    return model.objects.get_or_create(organization=org, nombre=nombre)[0]


def make_org(slug="test", nombre=None, **extra):
    org, _ = Organization.objects.get_or_create(
        slug=slug, defaults={"nombre": nombre or slug.title(), **extra}
    )
    return org


def make_user(email, nombre, rol="member", password="x", organization=None, **extra):
    if organization is None:
        organization = make_org()
    return User.objects.create_user(
        email, nombre, password, rol=rol, organization=organization, **extra
    )


def make_activity(
    responsable, empresa="ACME", proceso="Soporte", aplicacion="ERP", stakeholder="TI", **overrides
):
    org = overrides.get("organization", responsable.organization)
    defaults = {
        "organization": org,
        "cliente": _catalog(Cliente, org, empresa),
        "proceso": _catalog(Proceso, org, proceso),
        "aplicacion": _catalog(Aplicacion, org, aplicacion),
        "stakeholder": _catalog(Stakeholder, org, stakeholder),
        "nombre": "Actividad de prueba",
        "descripcion": "",
        "fecha_inicio": date.today(),
        "fecha_limite": date.today() + timedelta(days=7),
    }
    defaults.update(overrides)
    return Activity.objects.create(responsable=responsable, **defaults)


def activity_payload(responsable, **overrides):
    """Valid POST body for /api/v1/activities/."""
    data = {
        "empresa": "ACME",
        "proceso": "Soporte",
        "aplicacion": "ERP",
        "nombre": "Migrar base de datos",
        "descripcion": "detalle",
        "responsable_id": responsable.pk,
        "stakeholder": "Operaciones",
        "prioridad": "high",
        "estado": "backlog",
        "fechaInicio": "2026-07-01",
        "fechaLimite": "2026-07-15",
    }
    data.update(overrides)
    return data
