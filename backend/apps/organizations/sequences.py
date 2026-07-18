"""
Secuencias por organización. Encapsulado en un servicio para poder cambiar
la estrategia (select_for_update hoy; secuencias nativas de Postgres o Redis
cuando la concurrencia lo exija) sin tocar el dominio.
"""
from django.db import transaction
from django.db.models import F

from .models import Organization


class SequenceService:
    @staticmethod
    def next(organization: Organization, name: str = "activity") -> int:
        if name != "activity":
            raise ValueError(f"Secuencia desconocida: {name}")
        with transaction.atomic():
            org = Organization.objects.select_for_update().get(pk=organization.pk)
            numero = org.next_activity_numero
            Organization.objects.filter(pk=org.pk).update(
                next_activity_numero=F("next_activity_numero") + 1
            )
            return numero
