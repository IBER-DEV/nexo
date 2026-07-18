from rest_framework import serializers

from apps.users.models import User

from .membership import MembershipError, generate_access_code
from .models import OrganizationAccessCode


class AccessCodeSerializer(serializers.ModelSerializer):
    created_by_nombre = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationAccessCode
        fields = [
            "id",
            "codigo",
            "rol",
            "expires_at",
            "max_usos",
            "usos",
            "is_active",
            "created_at",
            "created_by_nombre",
        ]
        # El código lo genera el servicio; usos solo lo mueve el canje.
        read_only_fields = ["id", "codigo", "usos", "created_at"]

    def get_created_by_nombre(self, obj) -> str | None:
        return obj.created_by.nombre if obj.created_by_id else None

    def validate_rol(self, value: str) -> str:
        if value == User.Role.OWNER:
            raise serializers.ValidationError("No se pueden generar códigos con rol Owner.")
        if value not in User.Role.values:
            raise serializers.ValidationError("Rol desconocido.")
        return value

    def create(self, validated_data):
        # perform_create del mixin inyecta organization; la creación real
        # pasa por el servicio de dominio (única fuente del formato del código).
        try:
            return generate_access_code(
                organization=validated_data["organization"],
                rol=validated_data["rol"],
                created_by=self.context["request"].user,
                expires_at=validated_data.get("expires_at"),
                max_usos=validated_data.get("max_usos"),
            )
        except MembershipError as exc:
            raise serializers.ValidationError(str(exc))

    def update(self, instance, validated_data):
        # Solo el estado activo/inactivo es editable; rol/expiración/usos de
        # un código ya compartido no se cambian — se genera uno nuevo.
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
            instance.save(update_fields=["is_active"])
        return instance
