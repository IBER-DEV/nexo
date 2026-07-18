"""Serializers de los maestros/catálogos administrables por organización."""
from django.utils.text import slugify
from rest_framework import serializers

from .models import Aplicacion, ActivityType, Cliente, Priority, Proceso, Stakeholder, WorkflowState


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


class OrgMasterSerializerMixin:
    """Mixin común a los maestros con nombre + slug + color + orden + is_active
    por organización. El slug es opcional en el wire: si no se envía, se
    deriva del nombre (con sufijo numérico si colisiona)."""

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

    def _unique_slug(self, org, base: str) -> str:
        slug = base
        suffix = 1
        while True:
            qs = self.Meta.model.objects.for_org(org).filter(slug=slug)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if not qs.exists():
                return slug
            suffix += 1
            slug = f"{base}-{suffix}"

    def validate(self, attrs):
        org = self._request_org()
        slug = (attrs.get("slug") or "").strip()
        if not slug:
            base = slugify(attrs.get("nombre") or (self.instance.nombre if self.instance else "")) or "item"
            attrs["slug"] = self._unique_slug(org, base)
        else:
            qs = self.Meta.model.objects.for_org(org).filter(slug=slug)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"slug": "Ya existe un registro con ese slug"})
            attrs["slug"] = slug
        return attrs


class WorkflowStateSerializer(OrgMasterSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False)
    sheet_phase = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = WorkflowState
        fields = [
            "id",
            "nombre",
            "slug",
            "color",
            "orden",
            "categoria",
            "is_initial",
            "mostrar_en_kanban",
            "sheet_phase",
            "is_active",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["sheet_phase"] = instance.sheet_phase
        return data

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        if attrs.get("is_active") is False and instance is not None:
            if instance.is_initial:
                raise serializers.ValidationError(
                    {"is_active": "No puedes archivar el estado inicial."}
                )
            if instance.categoria == WorkflowState.Categoria.DONE:
                others = (
                    WorkflowState.objects.for_org(instance.organization)
                    .filter(categoria=WorkflowState.Categoria.DONE, is_active=True)
                    .exclude(pk=instance.pk)
                )
                if not others.exists():
                    raise serializers.ValidationError(
                        {"is_active": "Debe existir al menos un estado 'Finalizado' activo."}
                    )
        return attrs

    def _extract_sheet_phase(self, validated_data, instance=None):
        if "sheet_phase" not in validated_data:
            return validated_data
        sheet_phase = validated_data.pop("sheet_phase")
        mappings = dict(instance.external_mappings) if instance is not None else {}
        if sheet_phase:
            mappings["google_sheets"] = sheet_phase
        else:
            mappings.pop("google_sheets", None)
        validated_data["external_mappings"] = mappings
        return validated_data

    def create(self, validated_data):
        validated_data = self._extract_sheet_phase(validated_data)
        org = validated_data.get("organization")
        if validated_data.get("is_initial"):
            WorkflowState.objects.for_org(org).filter(is_initial=True).update(is_initial=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._extract_sheet_phase(validated_data, instance)
        if validated_data.get("is_initial"):
            WorkflowState.objects.for_org(instance.organization).filter(is_initial=True).exclude(
                pk=instance.pk
            ).update(is_initial=False)
        return super().update(instance, validated_data)


class PrioritySerializer(OrgMasterSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False)

    class Meta:
        model = Priority
        fields = ["id", "nombre", "slug", "color", "orden", "is_default", "is_active"]

    def create(self, validated_data):
        org = validated_data.get("organization")
        if validated_data.get("is_default"):
            Priority.objects.for_org(org).filter(is_default=True).update(is_default=False)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Priority.objects.for_org(instance.organization).filter(is_default=True).exclude(
                pk=instance.pk
            ).update(is_default=False)
        return super().update(instance, validated_data)


class ActivityTypeSerializer(OrgMasterSerializerMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(required=False)

    class Meta:
        model = ActivityType
        fields = ["id", "nombre", "slug", "color", "orden", "is_active"]
