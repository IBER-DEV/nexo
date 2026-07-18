"""ViewSets de los maestros por organización: lectura para cualquier usuario
autenticado de la org (los selects los necesitan todos), escritura solo admin."""
from django.db.models import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from apps.organizations.scoping import OrganizationScopedViewSetMixin

from .models import Aplicacion, ActivityType, Cliente, Priority, Proceso, Stakeholder, WorkflowState
from .serializers_masters import (
    AplicacionSerializer,
    ActivityTypeSerializer,
    ClienteSerializer,
    PrioritySerializer,
    ProcesoSerializer,
    StakeholderSerializer,
    WorkflowStateSerializer,
)


class ReadOrgWriteAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(user, "is_admin", False)


class OrgMasterViewSet(OrganizationScopedViewSetMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, ReadOrgWriteAdmin]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            en_uso = instance.activities.count()
            return Response(
                {
                    "detail": (
                        f"En uso por {en_uso} actividad{'es' if en_uso != 1 else ''}; "
                        "archívalo en su lugar."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClienteViewSet(OrgMasterViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer


class ProcesoViewSet(OrgMasterViewSet):
    queryset = Proceso.objects.all()
    serializer_class = ProcesoSerializer


class AplicacionViewSet(OrgMasterViewSet):
    queryset = Aplicacion.objects.all()
    serializer_class = AplicacionSerializer


class StakeholderViewSet(OrgMasterViewSet):
    queryset = Stakeholder.objects.all()
    serializer_class = StakeholderSerializer


class ReorderableMasterViewSet(OrgMasterViewSet):
    """Añade POST .../reorder/ {"ids": [...]} — reordena por la posición en
    la lista recibida. Usado por estados y prioridades en la UI de admin."""

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        ids = request.data.get("ids") or []
        org = request.user.organization
        qs = self.get_queryset().filter(pk__in=ids)
        if qs.count() != len(ids) or len(set(ids)) != len(ids):
            return Response({"detail": "ids inválidos"}, status=status.HTTP_400_BAD_REQUEST)
        for orden, pk in enumerate(ids):
            self.queryset.model.objects.filter(pk=pk, organization=org).update(orden=orden)
        ordered = self.get_queryset().order_by("orden", "pk")
        return Response(self.get_serializer(ordered, many=True).data)


class WorkflowStateViewSet(ReorderableMasterViewSet):
    queryset = WorkflowState.objects.all()
    serializer_class = WorkflowStateSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_initial:
            return Response(
                {"detail": "No puedes eliminar el estado inicial."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.categoria == WorkflowState.Categoria.DONE:
            others = (
                WorkflowState.objects.for_org(instance.organization)
                .filter(categoria=WorkflowState.Categoria.DONE, is_active=True)
                .exclude(pk=instance.pk)
            )
            if not others.exists():
                return Response(
                    {"detail": "Debe existir al menos un estado 'Finalizado' activo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().destroy(request, *args, **kwargs)


class PriorityViewSet(ReorderableMasterViewSet):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer


class ActivityTypeViewSet(OrgMasterViewSet):
    queryset = ActivityType.objects.all()
    serializer_class = ActivityTypeSerializer
