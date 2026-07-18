"""Gestión de códigos de acceso (solo Owner/Admin de la organización). El
canje/registro con código es público y vive en apps.users.views — aquí solo
el ciclo de vida: generar, listar, desactivar, borrar."""
from rest_framework import viewsets

from apps.users.permissions import IsAdminRole

from .models import OrganizationAccessCode
from .scoping import OrganizationScopedViewSetMixin
from .serializers_access_codes import AccessCodeSerializer


class AccessCodeViewSet(OrganizationScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = OrganizationAccessCode.objects.all()
    serializer_class = AccessCodeSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None
    # PATCH solo cambia is_active (ver serializer); editar rol/expiración de
    # un código ya compartido no existe — se genera uno nuevo.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
