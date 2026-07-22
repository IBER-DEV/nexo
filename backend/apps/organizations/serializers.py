from rest_framework import serializers

from .models import Organization, WaitlistSignup


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "nombre",
            "slug",
            "codigo_prefix",
            "timezone",
            "locale",
            "currency",
            "plan",
            "appsheet_spreadsheet_id",
            "appsheet_worksheet_name",
        ]
        read_only_fields = ["id", "slug", "plan"]


class WaitlistJoinSerializer(serializers.Serializer):
    email = serializers.EmailField()
    source = serializers.CharField(max_length=50, required=False, default="pricing_cloud")

    def save(self):
        obj, _created = WaitlistSignup.objects.get_or_create(
            email=self.validated_data["email"],
            defaults={"source": self.validated_data.get("source", "pricing_cloud")},
        )
        return obj
