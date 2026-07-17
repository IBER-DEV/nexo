from datetime import date
from rest_framework import serializers
from apps.users.models import User
from .models import Activity, Empresa, Proceso, Aplicacion


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
            "prioridad",
            "estado",
            "fechaInicio",
            "fechaLimite",
        ]

    def validate_empresa(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Empresa requerida")
        existing = Empresa.objects.filter(nombre__iexact=value).first()
        if existing:
            return existing.nombre
        Empresa.objects.create(nombre=value)
        return value

    def validate_proceso(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Proceso requerido")
        existing = Proceso.objects.filter(nombre__iexact=value).first()
        if existing:
            return existing.nombre
        Proceso.objects.create(nombre=value)
        return value

    def validate_aplicacion(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Aplicacion requerida")
        existing = Aplicacion.objects.filter(nombre__iexact=value).first()
        if existing:
            return existing.nombre
        Aplicacion.objects.create(nombre=value)
        return value

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

        if "estado" not in attrs and ("fecha_inicio" in attrs or "fecha_limite" in attrs):
            fecha_inicio = attrs.get("fecha_inicio") or (instance.fecha_inicio if instance is not None else None)
            fecha_limite = attrs.get("fecha_limite") or (instance.fecha_limite if instance is not None else None)
            today = date.today()
            if not fecha_limite:
                attrs["estado"] = Activity.Status.BACKLOG
            elif fecha_inicio and fecha_inicio <= today <= fecha_limite:
                attrs["estado"] = Activity.Status.IN_PROGRESS
            elif today > fecha_limite:
                attrs["estado"] = Activity.Status.DONE
            else:
                attrs["estado"] = Activity.Status.BACKLOG

        return attrs

    def get_id(self, obj) -> str:
        return obj.codigo

    def get_responsable(self, obj) -> str:
        return obj.responsable.nombre
