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
    proyecto_id = django_filters.NumberFilter(field_name="proyecto__id")
    # "Sin proyecto" es una vista que el gestor necesita de verdad: es la
    # bandeja de trabajo huérfano que nadie está midiendo.
    sin_proyecto = django_filters.BooleanFilter(field_name="proyecto", lookup_expr="isnull")
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
            "proyecto_id",
            "sin_proyecto",
            "empresa",
            "aplicacion",
            "mes_planeacion",
            "semana_planeacion",
        ]
