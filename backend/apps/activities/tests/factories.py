"""Shared object factories for the activities test suite."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model

from apps.activities.org_templates import apply_template
from apps.activities.models import (
    Activity,
    ActivityType,
    Aplicacion,
    Cliente,
    Priority,
    Proceso,
    Stakeholder,
    WorkflowState,
)
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


def ensure_masters(org):
    """Crea (si faltan) los estados/prioridades/tipos por defecto de la org
    y devuelve los diccionarios slug -> instancia."""
    apply_template(org, "ti_clasico", WorkflowState, Priority, ActivityType)
    return {
        "states": {s.slug: s for s in WorkflowState.objects.for_org(org)},
        "priorities": {p.slug: p for p in Priority.objects.for_org(org)},
    }


def make_activity(
    responsable, empresa="ACME", proceso="Soporte", aplicacion="ERP", stakeholder="TI", **overrides
):
    org = overrides.get("organization", responsable.organization)
    masters = ensure_masters(org)
    defaults = {
        "organization": org,
        "cliente": _catalog(Cliente, org, empresa),
        "proceso": _catalog(Proceso, org, proceso),
        "aplicacion": _catalog(Aplicacion, org, aplicacion),
        "stakeholder": _catalog(Stakeholder, org, stakeholder),
        "estado": masters["states"]["backlog"],
        "prioridad": masters["priorities"]["medium"],
        "nombre": "Actividad de prueba",
        "descripcion": "",
        "fecha_inicio": date.today(),
        "fecha_limite": date.today() + timedelta(days=7),
    }
    defaults.update(overrides)
    return Activity.objects.create(responsable=responsable, **defaults)


def activity_payload(responsable, **overrides):
    """Valid POST body for /api/v1/activities/."""
    org = overrides.get("organization", responsable.organization)
    masters = ensure_masters(org)
    data = {
        "empresa": "ACME",
        "proceso": "Soporte",
        "aplicacion": "ERP",
        "nombre": "Migrar base de datos",
        "descripcion": "detalle",
        "responsable_id": responsable.pk,
        "stakeholder": "Operaciones",
        "prioridad_id": masters["priorities"]["high"].pk,
        "estado_id": masters["states"]["backlog"].pk,
        "fechaInicio": "2026-07-01",
        "fechaLimite": "2026-07-15",
    }
    data.update(overrides)
    return data


def signup_payload(**overrides):
    """Valid POST body for /api/v1/auth/signup/."""
    data = {
        "email": "nuevo@acme.com",
        "password": "contrasena-larga-123",
        "nombre": "Nueva Owner",
        "nombre_org": "Acme",
        "template": "ti_clasico",
    }
    data.update(overrides)
    return data
