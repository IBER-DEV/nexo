from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.activities.org_templates import DEFAULT_TEMPLATE, TEMPLATE_CHOICES

from .models import User


class UserSerializer(serializers.ModelSerializer):
    iniciales = serializers.ReadOnlyField()
    coordinador_id = serializers.IntegerField(read_only=True, allow_null=True)
    coordinador_nombre = serializers.SerializerMethodField()
    email_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "nombre",
            "email",
            "rol",
            "iniciales",
            "coordinador_id",
            "coordinador_nombre",
            "email_verified",
            "is_active",
        ]
        read_only_fields = ["id", "iniciales", "is_active"]

    def get_coordinador_nombre(self, obj: User) -> str | None:
        if obj.coordinador_id:
            return obj.coordinador.nombre
        return None

    def get_email_verified(self, obj: User) -> bool:
        return obj.email_verified_at is not None


class UserTeamUpdateSerializer(serializers.ModelSerializer):
    """PATCH parcial de un miembro por un admin: coordinador, rol o acceso.
    El Owner es intocable desde aquí (la org siempre necesita su Owner
    activo — ver Organization.owner) y nadie se edita a sí mismo."""

    coordinador_id = serializers.PrimaryKeyRelatedField(
        source="coordinador",
        queryset=User.objects.filter(rol=User.Role.COORDINATOR, is_active=True),
        allow_null=True,
        required=False,
    )
    rol = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = ["coordinador_id", "rol", "is_active"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Solo coordinadores de la misma organización que el usuario editado.
        request = self.context.get("request")
        org = getattr(getattr(request, "user", None), "organization", None) if request else None
        if org is not None:
            self.fields["coordinador_id"].queryset = User.objects.for_org(org).filter(
                rol=User.Role.COORDINATOR, is_active=True
            )

    def validate(self, attrs):
        user = self.instance
        request = self.context.get("request")
        editor = getattr(request, "user", None) if request else None

        touching_rol_or_access = "rol" in attrs or "is_active" in attrs
        if touching_rol_or_access:
            if user.rol == User.Role.OWNER:
                raise serializers.ValidationError(
                    {"detail": "El Owner de la organización no se modifica desde aquí."}
                )
            if editor is not None and editor.pk == user.pk:
                raise serializers.ValidationError(
                    {"detail": "No puedes cambiar tu propio rol o acceso."}
                )
        if attrs.get("rol") == User.Role.OWNER:
            raise serializers.ValidationError(
                {"rol": "Una organización solo tiene un Owner: el que la fundó."}
            )

        if "coordinador" in attrs:
            # El rol contra el que se valida es el resultante del PATCH.
            rol_final = attrs.get("rol", user.rol)
            if rol_final != User.Role.MEMBER:
                raise serializers.ValidationError(
                    {"coordinador_id": "Solo los miembros pueden tener coordinador asignado."}
                )
            coordinador = attrs.get("coordinador")
            if coordinador is not None and coordinador.pk == user.pk:
                raise serializers.ValidationError(
                    {"coordinador_id": "Un usuario no puede ser su propio coordinador."}
                )
        return attrs

    def update(self, instance, validated_data):
        if "coordinador" in validated_data:
            instance.coordinador = validated_data["coordinador"]
        if "rol" in validated_data:
            new_rol = validated_data["rol"]
            if instance.rol == User.Role.COORDINATOR and new_rol != User.Role.COORDINATOR:
                # Su equipo queda sin coordinador — mismo criterio que el
                # SET_NULL del FK si el usuario se borrara.
                User.objects.filter(coordinador=instance).update(coordinador=None)
            if new_rol != User.Role.MEMBER:
                instance.coordinador = None
            instance.rol = new_rol
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        instance.full_clean()
        instance.save()
        return instance


class SignupSerializer(serializers.Serializer):
    """Signup self-service con dos modos mutuamente excluyentes:
    - Fundar: `nombre_org` (+ `template`) → crea la organización y el Owner.
    - Unirse: `access_code` → la cuenta entra a una organización existente
      con el rol del código (ver apps/organizations/membership.py, ADR 0002).
    La cuenta se crea igual en ambos; solo cambia cómo se resuelve la org."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    nombre = serializers.CharField(max_length=200)
    nombre_org = serializers.CharField(max_length=200, required=False)
    template = serializers.ChoiceField(choices=TEMPLATE_CHOICES, required=False)
    access_code = serializers.CharField(max_length=20, required=False)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate(self, attrs):
        has_org = bool(attrs.get("nombre_org"))
        has_code = bool(attrs.get("access_code"))
        if has_org == has_code:  # ninguno, o los dos a la vez
            raise serializers.ValidationError(
                "Indica el nombre de tu organización nueva O un código de acceso, no ambos."
            )
        if has_org and not attrs.get("template"):
            attrs["template"] = DEFAULT_TEMPLATE
        return attrs


class PasswordForgotSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Returns access/refresh tokens plus the authenticated user's profile."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
