from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserSerializer(serializers.ModelSerializer):
    iniciales = serializers.ReadOnlyField()
    coordinador_id = serializers.IntegerField(read_only=True, allow_null=True)
    coordinador_nombre = serializers.SerializerMethodField()

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
        ]
        read_only_fields = ["id", "iniciales"]

    def get_coordinador_nombre(self, obj: User) -> str | None:
        if obj.coordinador_id:
            return obj.coordinador.nombre
        return None


class UserTeamUpdateSerializer(serializers.ModelSerializer):
    coordinador_id = serializers.PrimaryKeyRelatedField(
        source="coordinador",
        queryset=User.objects.filter(rol=User.Role.COORDINATOR, is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = User
        fields = ["coordinador_id"]

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
        if user.rol != User.Role.MEMBER:
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
        instance.full_clean()
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Returns access/refresh tokens plus the authenticated user's profile."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
