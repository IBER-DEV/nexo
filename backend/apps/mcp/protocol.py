"""Capa de protocolo MCP: JSON-RPC 2.0 sobre HTTP.

Se implementa a mano en vez de traer el SDK de MCP porque el SDK está
construido sobre ASGI/Starlette y este backend corre WSGI bajo gunicorn —
meterlo obligaría a cambiar el servidor de toda la aplicación para una sola
feature. Lo que hace falta para un servidor de *solo herramientas* es un
subconjunto chico y estable de JSON-RPC: `initialize`, `tools/list`,
`tools/call` y `ping`.

**No se implementa streaming (SSE).** El transporte "Streamable HTTP" lo
permite pero no lo exige: un servidor que solo expone herramientas puede
responder JSON plano a cada POST, y es lo que hacemos. Si algún día hay
herramientas de larga duración o notificaciones del servidor al cliente,
ese es el momento de agregarlo — no antes.
"""
import logging

logger = logging.getLogger("nexo.mcp")

# Versión del protocolo que hablamos. Si el cliente pide otra, se le
# responde con esta: el handshake de MCP permite que el servidor proponga
# la suya y el cliente decida si sigue.
PROTOCOL_VERSION = "2025-06-18"

SERVER_INFO = {"name": "nexo", "title": "Nexo", "version": "1.0.0"}

# Códigos de error estándar de JSON-RPC 2.0.
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


class JsonRpcError(Exception):
    def __init__(self, code: int, message: str, data=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


def success(request_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def error(request_id, code: int, message: str, data=None) -> dict:
    payload = {"code": code, "message": message}
    if data is not None:
        payload["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": payload}


def is_notification(message: dict) -> bool:
    """En JSON-RPC, un mensaje sin `id` es una notificación: el cliente no
    espera respuesta. MCP usa esto para `notifications/initialized`."""
    return "id" not in message


def handle_message(message: dict, context) -> dict | None:
    """Despacha un mensaje JSON-RPC. Devuelve la respuesta, o None si era
    una notificación (que no lleva respuesta por definición).

    `context` es el `ToolContext` con el usuario y el token de la petición.
    """
    from .tools import call_tool, list_tools

    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return error(message.get("id") if isinstance(message, dict) else None,
                     INVALID_REQUEST, "El mensaje no es JSON-RPC 2.0.")

    method = message.get("method")
    params = message.get("params") or {}
    request_id = message.get("id")
    notificacion = is_notification(message)

    try:
        if method == "initialize":
            result = {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
                "instructions": (
                    "Nexo gestiona actividades de equipos de TI. Antes de crear o "
                    "actualizar algo, llama a `obtener_workspace` para conocer los "
                    "estados, prioridades y tipos que esta organización tiene "
                    "definidos: son configurables por organización y sus ids no son "
                    "los mismos en dos espacios distintos."
                ),
            }
        elif method in ("notifications/initialized", "notifications/cancelled"):
            return None
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": list_tools(context)}
        elif method == "tools/call":
            result = call_tool(params.get("name"), params.get("arguments") or {}, context)
        else:
            if notificacion:
                return None
            return error(request_id, METHOD_NOT_FOUND, f"Método desconocido: {method}")
    except JsonRpcError as exc:
        if notificacion:
            return None
        return error(request_id, exc.code, exc.message, exc.data)

    if notificacion:
        return None
    return success(request_id, result)
