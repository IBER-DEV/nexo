"""Endpoint MCP: `POST /api/v1/mcp/`.

Un único endpoint que recibe mensajes JSON-RPC 2.0. Se autentica con los
mecanismos normales del proyecto (`DEFAULT_AUTHENTICATION_CLASSES`), que
para este caso significa un token de acceso personal — es exactamente el
problema que esos tokens vinieron a resolver: un cliente MCP no puede
sostener una sesión de navegador.
"""
import json
import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import PersonalAccessToken

from .protocol import INTERNAL_ERROR, PARSE_ERROR, error, handle_message
from .throttling import McpPlanThrottle
from .tools import ToolContext

logger = logging.getLogger("nexo.mcp")


class McpView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [McpPlanThrottle]

    def get(self, request):
        """Descubrimiento: qué es esto y cómo se habla. No es parte del
        protocolo, pero un GET a mano —o desde un navegador— explicando qué
        pasa ahorra mucho tiempo de diagnóstico."""
        return Response(
            {
                "service": "Nexo MCP",
                "transport": "JSON-RPC 2.0 sobre HTTP POST",
                "authenticated_as": request.user.email,
                "organization": getattr(request.user.organization, "slug", None),
                "hint": "Envía mensajes JSON-RPC por POST a esta misma URL.",
            }
        )

    def post(self, request):
        try:
            cuerpo = json.loads(request.body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(error(None, PARSE_ERROR, "JSON inválido."))

        token = request.auth if isinstance(request.auth, PersonalAccessToken) else None
        context = ToolContext(user=request.user, token=token)

        # JSON-RPC permite mandar un lote de mensajes en un array.
        if isinstance(cuerpo, list):
            respuestas = [r for r in (self._despachar(m, context) for m in cuerpo) if r is not None]
            # Un lote de puras notificaciones no lleva respuesta.
            if not respuestas:
                return Response(status=status.HTTP_202_ACCEPTED)
            return Response(respuestas)

        respuesta = self._despachar(cuerpo, context)
        if respuesta is None:
            return Response(status=status.HTTP_202_ACCEPTED)
        return Response(respuesta)

    def _despachar(self, mensaje, context):
        try:
            return handle_message(mensaje, context)
        except Exception:
            # Un fallo inesperado de una herramienta no puede tumbar la
            # conexión del cliente: se responde un error de JSON-RPC y queda
            # el traceback en los logs.
            logger.exception("fallo procesando un mensaje MCP")
            mensaje_id = mensaje.get("id") if isinstance(mensaje, dict) else None
            return error(mensaje_id, INTERNAL_ERROR, "Error interno del servidor MCP.")
