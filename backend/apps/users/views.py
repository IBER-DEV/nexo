import logging

from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.encoding import DjangoUnicodeDecodeError, force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, response, status
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.activities.org_templates import TEMPLATES
from apps.notifications.emails import send_password_reset_email, send_verification_email
from apps.notifications.tokens import read_verification_token
from apps.organizations.funnel import track
from apps.organizations.membership import (
    MembershipError,
    register_with_code,
    resolve_access_code,
)
from apps.organizations.serializers import OrganizationSerializer
from apps.organizations.signup import SignupError
from apps.organizations.signup import register as signup_register

from .models import User
from .serializers import (
    UserSerializer,
    UserTeamUpdateSerializer,
    CustomTokenObtainPairSerializer,
    SignupSerializer,
    PasswordForgotSerializer,
    PasswordResetConfirmSerializer,
)
from .permissions import IsAdminOrCoordinator, IsAdminRole

logger = logging.getLogger(__name__)

RESEND_THROTTLE_SECONDS = 60


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class SignupTemplatesView(APIView):
    """Plantillas disponibles para el selector del signup — público, se
    muestra antes de que exista ninguna sesión."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return response.Response(
            [
                {
                    "key": key,
                    "display_name": tpl["display_name"],
                    "description": tpl["description"],
                    "recommended_for": tpl.get("recommended_for", []),
                }
                for key, tpl in TEMPLATES.items()
            ]
        )


class SignupView(APIView):
    """Registro público self-service (Fase 1, punto 4): crea la
    organización, aplica la plantilla elegida y el primer usuario (Owner),
    todo en una sola transacción, y responde con tokens listos para
    auto-login — el frontend nunca vuelve a llamar /auth/token/ tras esto."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            if data.get("access_code"):
                org, user = register_with_code(
                    email=data["email"],
                    password=data["password"],
                    nombre=data["nombre"],
                    codigo=data["access_code"],
                )
            else:
                org, user = signup_register(
                    email=data["email"],
                    password=data["password"],
                    nombre=data["nombre"],
                    nombre_org=data["nombre_org"],
                    template_key=data["template"],
                )
        except (SignupError, MembershipError) as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        return response.Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
                "organization": OrganizationSerializer(org).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AccessCodeResolveView(APIView):
    """Preview público del modo 'Tengo un código': a quién te unirías y con
    qué rol, sin consumir usos. La entropía del código (~59 bits) hace
    inviable la enumeración."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        codigo = request.query_params.get("codigo", "")
        try:
            code = resolve_access_code(codigo)
        except MembershipError as exc:
            return response.Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(
            {
                "organization_nombre": code.organization.nombre,
                "rol": code.rol,
            }
        )


class EmailVerifyView(APIView):
    """Idempotente a propósito: confirmar dos veces (doble clic, o el link
    abierto en dos pestañas) nunca falla."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get("token", "")
        user_pk = read_verification_token(token)
        if user_pk is None:
            return response.Response(
                {"detail": "El enlace de verificación es inválido o ya expiró."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            return response.Response(
                {"detail": "El enlace de verificación es inválido o ya expiró."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.email_verified_at is None:
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
            track("email_confirmed", organization=user.organization, user=user)
        return response.Response({"detail": "Correo verificado."})


class ResendVerificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.email_verified_at is not None:
            return response.Response({"detail": "Tu correo ya está verificado."})
        last_sent = user.email_verification_sent_at
        if last_sent is not None:
            elapsed = (timezone.now() - last_sent).total_seconds()
            if elapsed < RESEND_THROTTLE_SECONDS:
                wait = int(RESEND_THROTTLE_SECONDS - elapsed)
                return response.Response(
                    {"detail": f"Espera {wait}s antes de reenviar."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
        try:
            send_verification_email(user)
        except Exception:
            logger.exception("Fallo el reenvío de verificación a %s", user.email)
            return response.Response(
                {"detail": "No pudimos enviar el correo ahora mismo. Intenta más tarde."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return response.Response({"detail": "Correo de verificación reenviado."})


class PasswordForgotView(APIView):
    """Nunca revela si el email existe o no — mismo 200 siempre, para no
    filtrar qué correos están registrados."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordForgotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=serializer.validated_data["email"]).first()
        if user is not None:
            send_password_reset_email(user)
        return response.Response({"detail": "Si el correo existe, enviamos instrucciones."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            pk = force_str(urlsafe_base64_decode(data["uid"]))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError, DjangoUnicodeDecodeError, OverflowError):
            user = None

        if user is None or not default_token_generator.check_token(user, data["token"]):
            return response.Response(
                {"detail": "El enlace de restablecimiento es inválido o ya expiró."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        return response.Response({"detail": "Contraseña actualizada."})


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrCoordinator]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        org_users = User.objects.for_org(user.organization)
        if getattr(user, "is_admin", False):
            # Incluye desactivados: el admin necesita verlos para reactivarlos.
            return org_users.select_related("coordinador").order_by("nombre")
        if getattr(user, "is_coordinator", False):
            team_ids = user.team_user_ids() if hasattr(user, "team_user_ids") else [user.pk]
            return org_users.filter(pk__in=team_ids, is_active=True).order_by("nombre")
        return User.objects.none()


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserTeamUpdateView(generics.UpdateAPIView):
    """Admin: asignar o quitar coordinador de un miembro."""

    permission_classes = [IsAdminRole]
    http_method_names = ["patch"]

    def get_queryset(self):
        # Sin filtrar is_active: reactivar a un desactivado es un PATCH más.
        return User.objects.for_org(self.request.user.organization)

    def get_serializer_class(self):
        return UserTeamUpdateSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        instance = User.objects.select_related("coordinador").get(pk=self.kwargs["pk"])
        return response.Response(UserSerializer(instance).data)
