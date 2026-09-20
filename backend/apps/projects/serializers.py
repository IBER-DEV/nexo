from rest_framework import serializers

from apps.activities.models import Cliente
from apps.users.models import User

from .models import Project
from .progress import metrics_for


class ProjectSerializer(serializers.ModelSerializer):
    # Mismo contrato de lectura que ActivitySerializer: `pk` es la clave
    # real y `id` el código visible ({PREFIX}-P001).
    pk = serializers.IntegerField(read_only=True)
    id = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    lider_id = serializers.PrimaryKeyRelatedField(
        source="lider", queryset=User.objects.all(), required=False, allow_null=True
    )
    lider_nombre = serializers.SerializerMethodField()

    # Igual que en ActivitySerializer, el catálogo viaja como string por el
    # wire y adentro es un FK org-scoped con get-or-create.
    cliente = serializers.CharField(
        max_length=100, write_only=True, allow_blank=True, required=False
    )

    # Métricas derivadas — nunca escribibles: el avance sale de las
    # actividades, no de lo que alguien teclee (ver progress.py).
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "pk",
            "id",
            "nombre",
            "descripcion",
            "estado",
            "estado_display",
            "color",
            "lider_id",
            "lider_nombre",
            "cliente",
            "fecha_inicio",
            "fecha_fin_estimada",
            "fecha_fin_real",
            "is_active",
            "created_at",
            "metrics",
        ]
        read_only_fields = ["created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Segunda línea de defensa multi-tenant, igual que en
        # ActivitySerializer: los pk escribibles solo aceptan objetos de la
        # organización del request.
        org = self._request_org()
        if org is not None:
            self.fields["lider_id"].queryset = User.objects.for_org(org).filter(is_active=True)

    def _request_org(self):
        if "organization" in self.context:
            return self.context["organization"]
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        return getattr(user, "organization", None)

    def get_id(self, obj) -> str:
        return obj.codigo

    def get_lider_nombre(self, obj) -> str:
        return obj.lider.nombre if obj.lider_id else ""

    def get_metrics(self, obj) -> dict:
        return metrics_for(obj).as_dict()

    def validate(self, attrs):
        if "cliente" in attrs:
            nombre = attrs.pop("cliente").strip()
            attrs["cliente"] = self._resolve_cliente(nombre) if nombre else None

        inicio = attrs.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        fin = attrs.get(
            "fecha_fin_estimada", getattr(self.instance, "fecha_fin_estimada", None)
        )
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError(
                {"fecha_fin_estimada": "La fecha de entrega no puede ser anterior al inicio."}
            )
        return attrs

    def validate_nombre(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Requerido")
        org = self._request_org()
        if org is None:
            raise serializers.ValidationError("Usuario sin organización")
        # El nombre es único por org (lo exige el get-or-create del sync de
        # Sheets); sin este chequeo el usuario recibiría un 500 de la
        # constraint en vez de un error de formulario.
        clash = Project.objects.for_org(org).filter(nombre__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Ya existe un proyecto con ese nombre.")
        return value

    def _resolve_cliente(self, nombre: str):
        org = self._request_org()
        if org is None:
            raise serializers.ValidationError("Usuario sin organización")
        existing = Cliente.objects.for_org(org).filter(nombre__iexact=nombre).first()
        return existing or Cliente.objects.create(organization=org, nombre=nombre)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["cliente"] = instance.cliente.nombre if instance.cliente_id else ""
        return data
