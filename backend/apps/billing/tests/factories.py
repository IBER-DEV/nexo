"""Payloads de webhook con la forma real de Lemon Squeezy (JSON:API), para
no testear contra una fantasía nuestra del formato."""
import hashlib
import hmac
import json


def subscription_webhook(
    *,
    organization_id,
    event_name="subscription_created",
    subscription_id="9001",
    status="active",
    customer_id="5501",
    variant_id="777",
    trial_ends_at=None,
    renews_at="2026-08-25T00:00:00.000000Z",
    ends_at=None,
    quantity=1,
) -> dict:
    return {
        "meta": {
            "event_name": event_name,
            "custom_data": {"organization_id": str(organization_id)},
            "test_mode": True,
        },
        "data": {
            "type": "subscriptions",
            "id": str(subscription_id),
            "attributes": {
                "store_id": 1,
                "customer_id": int(customer_id),
                "variant_id": int(variant_id),
                "user_email": "pagador@acme.com",
                "status": status,
                "status_formatted": status.replace("_", " ").title(),
                "trial_ends_at": trial_ends_at,
                "renews_at": renews_at,
                "ends_at": ends_at,
                "first_subscription_item": {"id": 1, "quantity": quantity},
                "urls": {
                    "update_payment_method": "https://acme.lemonsqueezy.com/pay/update",
                    "customer_portal": "https://acme.lemonsqueezy.com/billing/portal",
                },
            },
        },
    }


def payment_failed_webhook(*, organization_id, subscription_id="9001") -> dict:
    """`subscription_payment_failed` trae una factura, no una suscripción."""
    return {
        "meta": {
            "event_name": "subscription_payment_failed",
            "custom_data": {"organization_id": str(organization_id)},
        },
        "data": {
            "type": "subscription-invoices",
            "id": "42",
            "attributes": {"subscription_id": int(subscription_id), "status": "failed"},
        },
    }


def sign(payload: dict, secret: str) -> tuple[bytes, str]:
    """Devuelve (cuerpo crudo, firma) tal como llegarían en la petición. El
    cuerpo se serializa una sola vez porque la firma es sobre esos bytes
    exactos: re-serializar cambia el digest."""
    raw = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return raw, signature
