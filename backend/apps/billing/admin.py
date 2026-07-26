from django.contrib import admin

from .models import BillingCustomer, CheckoutSession, Subscription, WebhookEvent


@admin.register(BillingCustomer)
class BillingCustomerAdmin(admin.ModelAdmin):
    list_display = ["organization", "provider", "provider_customer_id", "email", "created_at"]
    search_fields = ["organization__nombre", "organization__slug", "email", "provider_customer_id"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        "organization",
        "plan",
        "status",
        "provider_status",
        "quantity",
        "renews_at",
        "ends_at",
    ]
    list_filter = ["status", "plan", "provider"]
    search_fields = ["organization__nombre", "organization__slug", "provider_subscription_id"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(CheckoutSession)
class CheckoutSessionAdmin(admin.ModelAdmin):
    list_display = ["organization", "status", "created_by", "created_at", "completed_at"]
    list_filter = ["status"]
    search_fields = ["organization__slug", "provider_checkout_id"]


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    """Los eventos `failed` de acá son la cola de trabajo manual cuando un
    pago no se refleja: el payload crudo queda guardado para reprocesarlo."""

    list_display = ["event_name", "status", "organization", "received_at"]
    list_filter = ["status", "event_name"]
    search_fields = ["event_key", "event_name", "organization__slug"]
    readonly_fields = ["event_key", "event_name", "payload", "organization", "received_at"]
