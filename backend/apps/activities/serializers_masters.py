"""Serializers de los maestros/catálogos administrables por organización."""
from rest_framework import serializers

from .models import Aplicacion, Cliente, Proceso, Stakeholder


class OrgCatalogSerializer(serializers.ModelSerializer):
    """Base de catálogos simples (nombre + is_active) con unicidad por org."""

    class Meta:
        fields = ["id", "nombre", "is_active"]

    def _request_org(self):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        return getattr(user, "organization", None)

    def validate_nombre(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Nombre requerido")
        org = self._request_org()
        qs = self.Meta.model.objects.for_org(org).filter(nombre__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un registro con ese nombre")
        return value


class ClienteSerializer(OrgCatalogSerializer):
    class Meta(OrgCatalogSerializer.Meta):
        model = Cliente


class ProcesoSerializer(OrgCatalogSerializer):
    class Meta(OrgCatalogSerializer.Meta):
        model = Proceso


class AplicacionSerializer(OrgCatalogSerializer):
    class Meta(OrgCatalogSerializer.Meta):
        model = Aplicacion


class StakeholderSerializer(OrgCatalogSerializer):
    class Meta(OrgCatalogSerializer.Meta):
        model = Stakeholder
