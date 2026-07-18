from datetime import date
from rest_framework import serializers
from apps.users.models import User
from .models import Activity, ActivityType, Cliente, Priority, Proceso, Aplicacion, Stakeholder, WorkflowState


class DateFromISOField(serializers.DateField):
    """Accepts both 'YYYY-MM-DD' and full ISO-8601 datetimes from the frontend."""

    def to_internal_value(self, value):
        if isinstance(value, str) and "T" in value:
            value = value.split("T")[0]
        return super().to_internal_value(value)


class ActivitySerializer(serializers.ModelSerializer):
    # Read-only display fields
    id = serializers.SerializerMethodField()
    pk = serializers.IntegerField(read_only=True)
    responsable = serializers.SerializerMethodField()

    # Writable FK — returned on reads so the edit form can pre-select the user
    responsable_id = serializers.PrimaryKeyRelatedField(
        source="responsable",
        queryset=User.objects.all(),
    )

    # Catálogos: en el wire viajan como strings (nombre); internamente son FKs
    # org-scoped con get-or-create. write_only porque la lectura se arma en
    # to_representation (el FK puede ser NULL).
    empresa = serializers.CharField(max_length=100, write_only=True)
    proceso = serializers.CharField(max_length=100, write_only=True)
    aplicacion = serializers.CharField(max_length=100, write_only=True)
    stakeholder = serializers.CharField(
        max_length=100, write_only=True, allow_blank=True, required=False
    )

    # Maestros configurables por org: viajan por id. required=False porque
    # el estado se puede auto-calcular desde las fechas y la prioridad tiene
    # un default por organización (ver validate()).
    estado_id = serializers.PrimaryKeyRelatedField(
        source="estado", queryset=WorkflowState.objects.all(), required=False
    )
    prioridad_id = serializers.PrimaryKeyRelatedField(
        source="prioridad", queryset=Priority.objects.all(), required=False
    )
    tipo_id = serializers.PrimaryKeyRelatedField(
        source="tipo",
        queryset=ActivityType.objects.all(),
        required=False,
        allow_null=True,
    )

    # camelCase ↔ snake_case date mapping
    fechaInicio = DateFromISOField(source="fecha_inicio")
    fechaLimite = DateFromISOField(source="fecha_limite")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Segunda línea de defensa multi-tenant: los pk escribibles solo
        # aceptan objetos de la organización del request (o la pasada
        # explícitamente por flujos internos como el sync de AppSheet).
        org = self._request_org()
        if org is not None:
            self.fields["responsable_id"].queryset = User.objects.for_org(org).filter(
                is_active=True
            )
            self.fields["estado_id"].queryset = WorkflowState.objects.for_org(org).filter(
                is_active=True
            )
            self.fields["prioridad_id"].queryset = Priority.objects.for_org(org).filter(
                is_active=True
            )
            self.fields["tipo_id"].queryset = ActivityType.objects.for_org(org).filter(
                is_active=True
            )

    def _request_org(self):
        if "organization" in self.context:
            return self.context["organization"]
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        return getattr(user, "organization", None)

    class Meta:
        model = Activity
        fields = [
            "pk",
            "id",
            "empresa",
            "proceso",
            "aplicacion",
            "proyecto",
            "nombre",
            "descripcion",
            "responsable",
            "responsable_id",
            "stakeholder",
            "mes_planeacion",
            "semana_planeacion",
            "prioridad_id",
            "estado_id",
            "tipo_id",
            "fechaInicio",
            "fechaLimite",
        ]

    def _get_or_create_catalog(self, model, value: str):
        value = value.strip()
        if not value:
            return None
        org = self._request_org()
        if org is None:
            raise serializers.ValidationError("Usuario sin organización")
        existing = model.objects.for_org(org).filter(nombre__iexact=value).first()
        if existing is not None:
            return existing
        return model.objects.create(organization=org, nombre=value)

    def validate_mes_planeacion(self, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if len(value) != 7 or value[4] != "-":
            raise serializers.ValidationError("Formato invalido. Use YYYY-MM")
        year, month = value.split("-", 1)
        if not (year.isdigit() and month.isdigit()):
            raise serializers.ValidationError("Formato invalido. Use YYYY-MM")
        month_int = int(month)
        if month_int < 1 or month_int > 12:
            raise serializers.ValidationError("Mes invalido")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None

        # Strings del wire → FKs de catálogo dentro de la org.
        if "empresa" in attrs:
            attrs["cliente"] = self._get_or_create_catalog(Cliente, attrs.pop("empresa"))
            if attrs["cliente"] is None:
                raise serializers.ValidationError({"empresa": "Empresa requerida"})
        if "proceso" in attrs:
            attrs["proceso"] = self._get_or_create_catalog(Proceso, attrs.pop("proceso"))
            if attrs["proceso"] is None:
                raise serializers.ValidationError({"proceso": "Proceso requerido"})
        if "aplicacion" in attrs:
            attrs["aplicacion"] = self._get_or_create_catalog(Aplicacion, attrs.pop("aplicacion"))
            if attrs["aplicacion"] is None:
                raise serializers.ValidationError({"aplicacion": "Aplicacion requerida"})
        if "stakeholder" in attrs:
            attrs["stakeholder"] = self._get_or_create_catalog(
                Stakeholder, attrs.pop("stakeholder")
            )

        responsable = attrs.get("responsable")
        if responsable is None and instance is not None:
            responsable = instance.responsable

        if (
            user is not None
            and getattr(user, "is_authenticated", False)
            and getattr(user, "is_coordinator", False)
            and responsable is not None
        ):
            team_ids = user.team_user_ids() if hasattr(user, "team_user_ids") else [user.pk]
            if responsable.pk not in team_ids:
                raise serializers.ValidationError(
                    {"responsable_id": "Solo puedes asignar actividades a miembros de tu equipo."}
                )

        mes = attrs.get("mes_planeacion")
        semana = attrs.get("semana_planeacion")

        if mes is None and instance is not None:
            mes = instance.mes_planeacion
        if semana is None and instance is not None:
            semana = instance.semana_planeacion

        if mes is None or semana is None:
            fecha = (
                attrs.get("fecha_inicio")
                or (instance.fecha_inicio if instance is not None else None)
                or attrs.get("fecha_limite")
                or (instance.fecha_limite if instance is not None else None)
            )
            if isinstance(fecha, date):
                mes_auto = fecha.strftime("%Y-%m")
                dia = fecha.day
                if dia <= 7:
                    semana_auto = 1
                elif dia <= 14:
                    semana_auto = 2
                elif dia <= 21:
                    semana_auto = 3
                elif dia <= 28:
                    semana_auto = 4
                else:
                    semana_auto = 5
                mes = mes or mes_auto
                semana = semana or semana_auto

        if mes is not None:
            attrs["mes_planeacion"] = mes
        if semana is not None:
            attrs["semana_planeacion"] = semana

        org = self._request_org()

        if "estado" not in attrs and ("fecha_inicio" in attrs or "fecha_limite" in attrs) and org is not None:
            fecha_inicio = attrs.get("fecha_inicio") or (instance.fecha_inicio if instance is not None else None)
            fecha_limite = attrs.get("fecha_limite") or (instance.fecha_limite if instance is not None else None)
            today = date.today()
            states = WorkflowState.objects.for_org(org).filter(is_active=True)
            if not fecha_limite:
                estado = states.filter(is_initial=True).first()
            elif fecha_inicio and fecha_inicio <= today <= fecha_limite:
                estado = states.filter(categoria=WorkflowState.Categoria.ACTIVE).order_by("orden").first()
            elif today > fecha_limite:
                estado = states.filter(categoria=WorkflowState.Categoria.DONE).order_by("orden").first()
            else:
                estado = states.filter(is_initial=True).first()
            if estado is not None:
                attrs["estado"] = estado

        # Prioridad: sin default a nivel de modelo (es un maestro), así que
        # una creación sin prioridad_id explícita toma la de la organización.
        if instance is None and "prioridad" not in attrs and org is not None:
            default_priority = Priority.objects.for_org(org).filter(is_default=True, is_active=True).first()
            if default_priority is not None:
                attrs["prioridad"] = default_priority

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["empresa"] = instance.cliente.nombre if instance.cliente_id else ""
        data["proceso"] = instance.proceso.nombre if instance.proceso_id else ""
        data["aplicacion"] = instance.aplicacion.nombre if instance.aplicacion_id else ""
        data["stakeholder"] = instance.stakeholder.nombre if instance.stakeholder_id else ""
        return data

    def get_id(self, obj) -> str:
        return obj.codigo

    def get_responsable(self, obj) -> str:
        return obj.responsable.nombre
