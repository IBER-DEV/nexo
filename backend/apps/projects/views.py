from collections import Counter

import django_filters
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.activities.serializers import ActivitySerializer
from apps.activities.visibility import RELATED as ACTIVITY_RELATED
from apps.activities.visibility import scope_to_user as scope_activities_to_user
from apps.organizations.scoping import OrganizationScopedViewSetMixin
from apps.users.permissions import IsAdminOrCoordinator

from .models import Project
from .progress import annotate_metrics, metrics_for
from .serializers import ProjectSerializer
from .visibility import scope_to_user


class ProjectFilter(django_filters.FilterSet):
    estado = django_filters.MultipleChoiceFilter(choices=Project.Estado.choices)
    lider_id = django_filters.NumberFilter(field_name="lider__id")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Project
        fields = ["estado", "lider_id", "is_active"]


class WriteRequiresPlanningRole(permissions.BasePermission):
    """Leer un proyecto lo puede cualquier miembro autenticado; crearlo o
    editarlo, solo quien planea (admin/coordinador) — mismo criterio que la
    ruta /planeacion del frontend.

    Esta clase reemplaza el DEFAULT_PERMISSION_CLASSES de DRF para este
    ViewSet (en DRF `permission_classes` *sustituye*, no combina). Las reglas
    verdaderamente globales —demo de solo lectura, alcance del token— no
    viven acá sino en `users/authentication.py::enforce_global_policy`, que
    ningún ViewSet puede saltarse.
    """

    def has_permission(self, request, view) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return IsAdminOrCoordinator().has_permission(request, view)


class ProjectViewSet(OrganizationScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [WriteRequiresPlanningRole]
    filterset_class = ProjectFilter
    search_fields = ["nombre", "descripcion", "cliente__nombre", "lider__nombre"]
    ordering_fields = ["pk", "nombre", "estado", "fecha_fin_estimada", "fecha_inicio"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        # Primero el aislamiento por organización (mixin), después el
        # scoping por rol, y solo al final las métricas: el orden importa,
        # porque annotate_metrics() cuenta sobre la relación completa.
        base = super().get_queryset().select_related("lider", "cliente", "organization")
        return annotate_metrics(scope_to_user(base, self.request.user)).order_by("-pk")

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )

    @action(detail=True, methods=["get"], url_path="activities")
    def activities(self, request, pk=None):
        """Las actividades del proyecto que este usuario puede ver.

        A diferencia de las métricas —que son del proyecto entero, ver
        progress.annotate_metrics()— la *lista* sí respeta el scoping por
        rol: mostrar el número agregado no filtra datos, listar actividades
        ajenas sí.
        """
        project = self.get_object()
        qs = scope_activities_to_user(
            project.activities.select_related(*ACTIVITY_RELATED).order_by("-pk"),
            request.user,
        )
        return Response(
            ActivitySerializer(qs, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["get"], url_path="activity-defaults")
    def activity_defaults(self, request, pk=None):
        """Contexto de la última actividad del proyecto, para prellenar la
        siguiente.

        Las actividades de un mismo proyecto comparten casi siempre cliente,
        proceso, aplicación y stakeholder: reescribirlos en cada alta es
        trabajo puro. Acá solo viaja ese contexto repetible — nunca fechas,
        estado, prioridad ni responsable, que son propios de cada actividad
        y copiarlos silenciosamente sería peor que dejarlos en su default
        (una fecha vieja o un responsable ajeno se cuelan sin que nadie los
        mire).

        Respeta el scoping por rol, igual que `activities`: se prellena
        desde algo que este usuario ya podía ver. Si no ve ninguna, devuelve
        vacío y el formulario se comporta como antes.

        Es un endpoint aparte y no un campo del serializer de Project para
        no pagar una subconsulta por fila al listar proyectos, donde este
        dato no se usa.
        """
        project = self.get_object()
        ultima = (
            scope_activities_to_user(
                project.activities.select_related(
                    "cliente", "proceso", "aplicacion", "stakeholder"
                ),
                request.user,
            )
            .order_by("-pk")
            .first()
        )
        if ultima is None:
            return Response({})

        def nombre(obj):
            return obj.nombre if obj is not None else ""

        return Response(
            {
                "empresa": nombre(ultima.cliente),
                "proceso": nombre(ultima.proceso),
                "aplicacion": nombre(ultima.aplicacion),
                "stakeholder": nombre(ultima.stakeholder),
                "tipo_id": ultima.tipo_id,
            }
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Una línea por semáforo para el dashboard, sin bajarse la lista
        completa de proyectos al navegador."""
        proyectos = list(self.filter_queryset(self.get_queryset()))
        por_salud = Counter()
        avances = []
        for p in proyectos:
            m = metrics_for(p)
            por_salud[m.salud] += 1
            if not p.is_closed:
                avances.append(m.avance)
        return Response(
            {
                "total": len(proyectos),
                "por_salud": dict(por_salud),
                "activos": sum(1 for p in proyectos if p.estado == Project.Estado.ACTIVE),
                "avance_promedio": round(sum(avances) / len(avances)) if avances else 0,
            }
        )
