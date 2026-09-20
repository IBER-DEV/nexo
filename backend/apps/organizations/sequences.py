"""
Secuencias por organización. Encapsulado en un servicio para poder cambiar
la estrategia (select_for_update hoy; secuencias nativas de Postgres o Redis
cuando la concurrencia lo exija) sin tocar el dominio.
"""
from django.db import transaction
from django.db.models import F

from .models import Organization


class SequenceService:
    #: nombre lógico de la secuencia → campo contador en Organization.
    COUNTERS = {
        "activity": "next_activity_numero",
        "project": "next_project_numero",
    }

    @staticmethod
    def next(organization: Organization, name: str = "activity") -> int:
        field = SequenceService.COUNTERS.get(name)
        if field is None:
            raise ValueError(f"Secuencia desconocida: {name}")
        with transaction.atomic():
            org = Organization.objects.select_for_update().get(pk=organization.pk)
            numero = getattr(org, field)
            Organization.objects.filter(pk=org.pk).update(**{field: F(field) + 1})
            return numero
