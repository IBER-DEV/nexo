"""Cliente de Lemon Squeezy. Único archivo del proyecto que sabe cómo se
habla con el proveedor de pagos: el resto del dominio (`service.py`) trabaja
con dicts normalizados, para que cambiar de proveedor —o agregar Wompi como
método secundario cuando aparezca demanda de factura DIAN, ver
launch-strategy.md, Riesgo 3— sea escribir otro módulo con esta misma
interfaz y no tocar el dominio.

La API de Lemon Squeezy es JSON:API, de ahí los `Content-Type` raros y el
anidamiento `data.attributes`.
"""
import hashlib
import hmac
import logging

import requests
from django.conf import settings

logger = logging.getLogger("nexo.billing")

API_BASE = "https://api.lemonsqueezy.com/v1"
TIMEOUT = 15

# Estado del proveedor → estado de dominio (Subscription.Status). Lemon
# Squeezy tiene más granularidad de la que el producto necesita: lo que nos
# importa es qué acceso implica, y eso lo decide Subscription.access_level.
STATUS_MAP = {
    "on_trial": "trialing",
    "active": "active",
    "past_due": "past_due",
    "unpaid": "past_due",
    "paused": "paused",
    "cancelled": "cancelled",
    "expired": "expired",
}


class BillingNotConfigured(RuntimeError):
    """El self-hosted no tiene por qué configurar un proveedor de pagos."""


class ProviderError(RuntimeError):
    """El proveedor respondió algo que no podemos usar."""


def is_configured() -> bool:
    return bool(
        settings.LEMONSQUEEZY_API_KEY
        and settings.LEMONSQUEEZY_STORE_ID
        and settings.LEMONSQUEEZY_VARIANT_ID_CLOUD
    )


def _headers() -> dict:
    return {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": f"Bearer {settings.LEMONSQUEEZY_API_KEY}",
    }


def _request(method: str, path: str, json: dict | None = None) -> dict:
    if not is_configured():
        raise BillingNotConfigured("Lemon Squeezy no está configurado en esta instancia.")
    try:
        res = requests.request(
            method, f"{API_BASE}{path}", headers=_headers(), json=json, timeout=TIMEOUT
        )
    except requests.RequestException as exc:
        raise ProviderError(f"No se pudo contactar a Lemon Squeezy: {exc}") from exc
    if res.status_code >= 400:
        logger.warning("lemonsqueezy %s %s → %s: %s", method, path, res.status_code, res.text[:500])
        raise ProviderError(f"Lemon Squeezy respondió {res.status_code}.")
    return res.json()


def create_checkout(*, email: str, name: str, organization_id: int, redirect_url: str) -> dict:
    """Crea un checkout hospedado y devuelve `{id, url}`.

    `custom.organization_id` es el hilo que ata el pago a la organización:
    Lemon Squeezy lo devuelve en `meta.custom_data` de todos los webhooks de
    esa suscripción, y es como `service.py` resuelve a quién pertenece un
    evento sin depender de que el email del pagador coincida con el del
    usuario que inició el checkout (a menudo no coincide: paga finanzas, usa
    TI)."""
    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": email,
                    "name": name,
                    # Lemon Squeezy exige strings en custom; un int vuelve
                    # como string igual, mejor mandarlo explícito.
                    "custom": {"organization_id": str(organization_id)},
                },
                "product_options": {"redirect_url": redirect_url},
            },
            "relationships": {
                "store": {
                    "data": {"type": "stores", "id": str(settings.LEMONSQUEEZY_STORE_ID)}
                },
                "variant": {
                    "data": {
                        "type": "variants",
                        "id": str(settings.LEMONSQUEEZY_VARIANT_ID_CLOUD),
                    }
                },
            },
        }
    }
    data = _request("POST", "/checkouts", json=payload).get("data", {})
    url = data.get("attributes", {}).get("url")
    if not url:
        raise ProviderError("Lemon Squeezy no devolvió una URL de checkout.")
    return {"id": str(data.get("id", "")), "url": url}


def get_subscription(provider_subscription_id: str) -> dict:
    """Lee una suscripción del proveedor y la devuelve ya normalizada."""
    data = _request("GET", f"/subscriptions/{provider_subscription_id}").get("data", {})
    return normalize_subscription(data)


def normalize_subscription(data: dict) -> dict:
    """`data` de JSON:API (de un GET o del cuerpo de un webhook) → dict plano
    con los nombres del dominio. Todo lo que el resto del código sabe de
    Lemon Squeezy pasa por acá."""
    attrs = data.get("attributes", {}) or {}
    urls = attrs.get("urls", {}) or {}
    item = attrs.get("first_subscription_item") or {}
    provider_status = attrs.get("status", "") or ""
    return {
        "provider_subscription_id": str(data.get("id", "")),
        "provider_customer_id": str(attrs.get("customer_id", "") or ""),
        "provider_status": provider_status,
        "status": STATUS_MAP.get(provider_status, "expired"),
        "variant_id": str(attrs.get("variant_id", "") or ""),
        "quantity": item.get("quantity") or 1,
        "trial_ends_at": attrs.get("trial_ends_at"),
        "renews_at": attrs.get("renews_at"),
        "ends_at": attrs.get("ends_at"),
        "customer_portal_url": urls.get("customer_portal", "") or "",
        "update_payment_url": urls.get("update_payment_method", "") or "",
        "email": attrs.get("user_email", "") or "",
    }


def verify_signature(raw_body: bytes, signature: str) -> bool:
    """HMAC-SHA256 del cuerpo crudo contra `X-Signature`.

    Sin secreto configurado devuelve False (no True): un webhook sin firma
    verificable puede cambiar el plan de una organización, así que el modo
    "sin configurar" tiene que ser el que rechaza, no el que acepta."""
    secret = settings.LEMONSQUEEZY_WEBHOOK_SECRET
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
