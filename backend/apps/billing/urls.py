from django.urls import path

from .views import BillingStateView, CheckoutView, PortalView, TrialView, WebhookView

urlpatterns = [
    path("", BillingStateView.as_view(), name="billing_state"),
    path("checkout/", CheckoutView.as_view(), name="billing_checkout"),
    path("trial/", TrialView.as_view(), name="billing_trial"),
    path("portal/", PortalView.as_view(), name="billing_portal"),
    path("webhook/", WebhookView.as_view(), name="billing_webhook"),
]
