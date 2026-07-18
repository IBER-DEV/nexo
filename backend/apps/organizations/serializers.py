from rest_framework import serializers

from .models import Organization


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
