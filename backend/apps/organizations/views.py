from rest_framework import generics

from apps.users.permissions import IsAdminRole

from .serializers import OrganizationSerializer


class OrganizationDetailView(generics.RetrieveUpdateAPIView):
    """GET/PATCH de la organización del usuario autenticado. Sin lookup por
    id en la URL a propósito: no hay forma de pedir la de otra org."""

    permission_classes = [IsAdminRole]
    serializer_class = OrganizationSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user.organization
