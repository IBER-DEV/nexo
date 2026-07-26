from django.utils import timezone
from rest_framework import serializers

from .models import PersonalAccessToken


class PersonalAccessTokenSerializer(serializers.ModelSerializer):
    """Lectura. Nunca expone el token: solo el prefijo visible, que sirve
    para reconocer cuál es cuál en la lista."""

    is_usable = serializers.BooleanField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = PersonalAccessToken
        fields = [
            "id",
            "nombre",
            "prefix",
            "scope",
            "expires_at",
            "revoked_at",
            "last_used_at",
            "created_at",
            "is_usable",
            "is_expired",
        ]
        read_only_fields = fields


class PersonalAccessTokenCreateSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    scope = serializers.ChoiceField(
        choices=PersonalAccessToken.Scope.choices,
        default=PersonalAccessToken.Scope.READ_WRITE,
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError("La fecha de expiración ya pasó.")
        return value
