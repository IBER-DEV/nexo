import django_filters
from .models import Activity, Priority, WorkflowState


def _workflow_states_qs(request):
    if request is None or not getattr(request.user, "is_authenticated", False):
        return WorkflowState.objects.none()
    return WorkflowState.objects.for_org(request.user.organization)


def _priorities_qs(request):
    if request is None or not getattr(request.user, "is_authenticated", False):
        return Priority.objects.none()
    return Priority.objects.for_org(request.user.organization)


class ActivityFilter(django_filters.FilterSet):
    estado = django_filters.ModelMultipleChoiceFilter(queryset=_workflow_states_qs)
    prioridad = django_filters.ModelMultipleChoiceFilter(queryset=_priorities_qs)
    categoria = django_filters.CharFilter(field_name="estado__categoria")
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
            "categoria",
            "responsable_id",
            "empresa",
            "aplicacion",
            "mes_planeacion",
            "semana_planeacion",
        ]
