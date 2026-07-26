from rest_framework import serializers

from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    access_level = serializers.CharField(read_only=True)
    effective_plan = serializers.CharField(read_only=True)
    trial_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "status",
            "provider_status",
            "plan",
            "effective_plan",
            "access_level",
            "quantity",
            "trial_ends_at",
            "trial_expired",
            "renews_at",
            "ends_at",
            "customer_portal_url",
            "update_payment_url",
            "created_at",
        ]
        read_only_fields = fields
