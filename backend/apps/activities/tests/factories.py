"""Shared object factories for the activities test suite."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model

from apps.activities.models import Activity

User = get_user_model()


def make_user(email, nombre, rol="member", password="x", **extra):
    return User.objects.create_user(email, nombre, password, rol=rol, **extra)


def make_activity(responsable, **overrides):
    defaults = {
        "empresa": "ACME",
        "proceso": "Soporte",
        "aplicacion": "ERP",
        "nombre": "Actividad de prueba",
        "descripcion": "",
        "stakeholder": "TI",
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
