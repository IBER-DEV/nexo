from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsAdminRole

from . import provider, service
from .access import current_subscription, level_for_organization
from .limits import limits_for, usage
from .models import Subscription
from .serializers import SubscriptionSerializer


class BillingStateView(APIView):
    """GET /api/v1/billing/ — todo lo que la UI necesita para pintar la
    pestaña Facturación en una sola llamada. Legible por cualquier miembro
    (el banner de "solo lectura" tiene que verlo todo el equipo, no solo
    quien puede pagar); `can_manage` dice quién ve los botones."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        sub = current_subscription(org)
        return Response(
            {
                "billing_enabled": provider.is_configured(),
                "plan": org.plan if org else "community",
                "access_level": level_for_organization(org),
                "subscription": SubscriptionSerializer(sub).data if sub else None,
                # El trial es de una sola vez por organización: si ya existe
                # cualquier suscripción (incluso una expirada), se acabó.
                "trial_available": bool(
                    org and not Subscription.objects.for_org(org).exists()
                ),
                "trial_days": settings.BILLING_TRIAL_DAYS,
                "can_manage": bool(getattr(request.user, "is_admin", False)),
                "limits": limits_for(org),
                "usage": usage(org),
            }
        )


class CheckoutView(APIView):
    """POST /api/v1/billing/checkout/ — crea el checkout hospedado y
    devuelve la URL a la que redirigir. No cobramos nosotros: la tarjeta
    nunca toca este backend (ver launch-strategy.md, Merchant of Record)."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        try:
            session = service.start_checkout(request.user.organization, request.user)
        except provider.BillingNotConfigured:
            return Response(
                {"detail": "Esta instancia no tiene facturación configurada."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except provider.ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"url": session.url, "checkout_id": session.provider_checkout_id})


class TrialView(APIView):
    """POST /api/v1/billing/trial/ — 14 días sin tarjeta."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        try:
            sub = service.start_trial(request.user.organization, request.user)
        except service.AlreadySubscribed as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(SubscriptionSerializer(sub).data, status=status.HTTP_201_CREATED)


class PortalView(APIView):
    """GET /api/v1/billing/portal/ — URL del portal de cliente de Lemon
    Squeezy (método de pago, cancelación, facturas). Las URLs que manda el
    proveedor caducan, así que se refrescan contra la API en vez de servir
    la copia guardada."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        sub = current_subscription(request.user.organization)
        if sub is None or not sub.provider_subscription_id:
            return Response(
                {"detail": "No hay una suscripción de pago activa."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            fresh = provider.get_subscription(sub.provider_subscription_id)
        except (provider.BillingNotConfigured, provider.ProviderError):
            # Degradar a la URL guardada es mejor que dejar al usuario sin
            # forma de cancelar porque el proveedor tuvo un mal minuto.
            if sub.customer_portal_url:
                return Response({"url": sub.customer_portal_url, "stale": True})
            return Response(
                {"detail": "No se pudo contactar al proveedor de pagos."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        Subscription.objects.filter(pk=sub.pk).update(
            customer_portal_url=fresh["customer_portal_url"],
            update_payment_url=fresh["update_payment_url"],
        )
        return Response({"url": fresh["customer_portal_url"], "stale": False})


class WebhookView(APIView):
    """POST /api/v1/billing/webhook/ — público, autenticado por firma HMAC.

    Responde 200 incluso cuando el procesamiento falla (el evento queda
    registrado como `failed` y visible en el admin): Lemon Squeezy reintenta
    ante cualquier no-2xx, y los fallos reales de este handler —un evento
    sin `organization_id`, por ejemplo— no se arreglan reintentando; solo
    generarían una tormenta de reintentos que tapa el problema. La firma
    inválida sí devuelve 401, que es la única respuesta que el proveedor
    debe interpretar como "no te acepto esto"."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        # `request.body` antes de tocar `request.data`: la verificación de
        # firma es sobre los bytes crudos y el parser de DRF consume el
        # stream.
        raw = request.body
        signature = request.headers.get("X-Signature", "")
        try:
            event = service.handle_webhook(raw, signature)
        except service.InvalidSignature:
            return Response({"detail": "Firma inválida."}, status=status.HTTP_401_UNAUTHORIZED)
        except ValueError:
            return Response({"detail": "Cuerpo inválido."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": event.status, "event": event.event_name})
