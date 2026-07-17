import django_filters
from .models import Activity


class ActivityFilter(django_filters.FilterSet):
    estado = django_filters.MultipleChoiceFilter(choices=Activity.Status.choices)
    prioridad = django_filters.MultipleChoiceFilter(choices=Activity.Priority.choices)
    responsable_id = django_filters.NumberFilter(field_name="responsable__id")
    empresa = django_filters.CharFilter(field_name="cliente__nombre", lookup_expr="icontains")
    aplicacion = django_filters.CharFilter(field_name="aplicacion__nombre", lookup_expr="icontains")
    mes_planeacion = django_filters.CharFilter(lookup_expr="iexact")
    semana_planeacion = django_filters.NumberFilter()

    class Meta:
        model = Activity
        fields = [
            "estado",
            "prioridad",
            "responsable_id",
            "empresa",
            "aplicacion",
            "mes_planeacion",
            "semana_planeacion",
        ]
