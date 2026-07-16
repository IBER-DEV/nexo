from rest_framework import generics, permissions, response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import User
from .serializers import (
    UserSerializer,
    UserTeamUpdateSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsAdminOrCoordinator, IsAdminRole


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrCoordinator]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_admin", False):
            return User.objects.filter(is_active=True).select_related("coordinador").order_by("nombre")
        if getattr(user, "is_coordinator", False):
            team_ids = user.team_user_ids() if hasattr(user, "team_user_ids") else [user.pk]
            return User.objects.filter(pk__in=team_ids, is_active=True).order_by("nombre")
        return User.objects.none()


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserTeamUpdateView(generics.UpdateAPIView):
    """Admin: asignar o quitar coordinador de un miembro."""

    permission_classes = [IsAdminRole]
    queryset = User.objects.filter(is_active=True)
    http_method_names = ["patch"]

    def get_serializer_class(self):
        return UserTeamUpdateSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        instance = User.objects.select_related("coordinador").get(pk=self.kwargs["pk"])
        return response.Response(UserSerializer(instance).data)
