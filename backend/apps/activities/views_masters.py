"""ViewSets de los maestros por organización: lectura para cualquier usuario
autenticado de la org (los selects los necesitan todos), escritura solo admin."""
from django.db.models import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from apps.organizations.scoping import OrganizationScopedViewSetMixin

from .models import Aplicacion, Cliente, Proceso, Stakeholder
from .serializers_masters import (
    AplicacionSerializer,
    ClienteSerializer,
    ProcesoSerializer,
    StakeholderSerializer,
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
