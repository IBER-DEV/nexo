"""Herramientas que Nexo expone por MCP.

Diseño en tres reglas:

1. **Toda herramienta pasa por el mismo dominio que el API REST.** Las
   escrituras usan `ActivitySerializer` y las lecturas
   `activities.visibility.visible_activities()` — no hay una segunda
   implementación de las validaciones ni de quién ve qué. Un servidor MCP
   que reimplementa las reglas es un servidor MCP que las viola.
2. **Una herramienta que escribe lo declara** (`writes=True`), y el
   despachador le exige permiso de escritura antes de ejecutarla. Hace
   falta explícitamente porque MCP habla JSON-RPC sobre POST: el verbo HTTP
   ya no distingue lectura de escritura (ver
   `users/authentication.py::METHOD_AGNOSTIC_PATH_FRAGMENT`).
3. **La IA necesita los maestros antes de escribir.** Estados, prioridades
   y tipos son configurables por organización y sus ids no coinciden entre
   dos espacios, así que `obtener_workspace` es la herramienta de entrada y
   el `instructions` del handshake lo dice.
"""
from dataclasses import dataclass
from datetime import date, timedelta

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.serializers import ActivitySerializer
from apps.activities.visibility import visible_activities
from apps.users.authentication import assert_write_allowed
from rest_framework.exceptions import PermissionDenied, ValidationError

from .protocol import INVALID_PARAMS, JsonRpcError

MAX_RESULTADOS = 50


@dataclass
class ToolContext:
    """Lo que una herramienta sabe de quien la llama."""

    user: object
    token: object = None

    @property
    def organization(self):
        return getattr(self.user, "organization", None)


class Tool:
    def __init__(self, *, name, description, schema, handler, writes=False):
        self.name = name
        self.description = description
        self.schema = schema
        self.handler = handler
        self.writes = writes

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.schema,
        }


# ─── Serialización a texto para el modelo ─────────────────────────────────


def _activity_line(a) -> str:
    """Una actividad en una línea legible. Texto y no JSON crudo porque el
    consumidor es un modelo de lenguaje: menos tokens y menos ruido."""
    partes = [
        f"{a.organization.codigo_prefix}-{a.numero:04d}",
        a.nombre,
        f"estado={a.estado.nombre}",
        f"prioridad={a.prioridad.nombre}",
        f"responsable={a.responsable.nombre if a.responsable else '—'}",
        f"limite={a.fecha_limite:%Y-%m-%d}",
    ]
    return " | ".join(partes)


# ─── Implementaciones ─────────────────────────────────────────────────────


def _obtener_workspace(args, ctx) -> str:
    org = ctx.organization
    if org is None:
        return "Este usuario no pertenece a ninguna organización."

    estados = WorkflowState.objects.for_org(org).order_by("orden", "pk")
    prioridades = Priority.objects.for_org(org).order_by("orden", "pk")
    tipos = ActivityType.objects.for_org(org).filter(is_active=True).order_by("orden", "nombre")

    lineas = [
        f"Organización: {org.nombre} (prefijo de código {org.codigo_prefix})",
        "",
        "Estados (usa el id en estado_id):",
    ]
    lineas += [
        f"  id={e.pk} · {e.nombre} · categoría={e.categoria}"
        + (" · inicial" if e.is_initial else "")
        for e in estados
    ]
    lineas += ["", "Prioridades (usa el id en prioridad_id):"]
    lineas += [
        f"  id={p.pk} · {p.nombre}" + (" · por defecto" if p.is_default else "")
        for p in prioridades
    ]
    lineas += ["", "Tipos de actividad (usa el id en tipo_id, opcional):"]
    lineas += [f"  id={t.pk} · {t.nombre}" for t in tipos] or ["  (ninguno)"]
    return "\n".join(lineas)


def _listar_actividades(args, ctx) -> str:
    qs = visible_activities(ctx.user)

    if args.get("buscar"):
        qs = qs.filter(nombre__icontains=args["buscar"])
    if args.get("estado_id"):
        qs = qs.filter(estado_id=args["estado_id"])
    if args.get("solo_abiertas"):
        qs = qs.exclude(estado__categoria__in=["done", "cancelled"])
    if args.get("responsable_id"):
        qs = qs.filter(responsable_id=args["responsable_id"])

    limite = min(int(args.get("limite") or 20), MAX_RESULTADOS)
    total = qs.count()
    filas = [_activity_line(a) for a in qs[:limite]]
    if not filas:
        return "No hay actividades que coincidan."
    encabezado = f"{total} actividad(es); mostrando {len(filas)}."
    return encabezado + "\n" + "\n".join(filas)


def _listar_usuarios(args, ctx) -> str:
    from apps.users.models import User

    usuarios = User.objects.for_org(ctx.organization).filter(is_active=True).order_by("nombre")
    if not usuarios:
        return "No hay usuarios activos."
    return "\n".join(
        f"id={u.pk} · {u.nombre} · {u.email} · rol={u.rol}" for u in usuarios
    )


def _serializer_context(ctx) -> dict:
    # El serializer acepta `organization` por contexto, así que no hace
    # falta fabricar un request falso.
    return {"organization": ctx.organization}


def _crear_actividad(args, ctx) -> str:
    org = ctx.organization
    hoy = date.today()
    payload = {
        "nombre": args["nombre"],
        "descripcion": args.get("descripcion", ""),
        "responsable_id": args.get("responsable_id") or ctx.user.pk,
        "fechaInicio": args.get("fecha_inicio") or hoy.isoformat(),
        "fechaLimite": args.get("fecha_limite") or (hoy + timedelta(days=7)).isoformat(),
    }
    for opcional in ("estado_id", "prioridad_id", "tipo_id"):
        if args.get(opcional):
            payload[opcional] = args[opcional]
    for catalogo in ("empresa", "proceso", "aplicacion", "stakeholder"):
        if args.get(catalogo):
            payload[catalogo] = args[catalogo]

    serializer = ActivitySerializer(data=payload, context=_serializer_context(ctx))
    serializer.is_valid(raise_exception=True)
    actividad = serializer.save(created_by=ctx.user, organization=org)
    return f"Actividad creada: {_activity_line(actividad)}"


def _actualizar_actividad(args, ctx) -> str:
    # Se busca dentro de lo visible: si no la ve, para él no existe — y no
    # se filtra su existencia con un mensaje distinto.
    actividad = visible_activities(ctx.user).filter(pk=args["actividad_id"]).first()
    if actividad is None:
        raise JsonRpcError(
            INVALID_PARAMS, f"No existe una actividad {args['actividad_id']} que puedas editar."
        )

    payload = {}
    for campo in ("estado_id", "prioridad_id", "tipo_id", "responsable_id"):
        if args.get(campo):
            payload[campo] = args[campo]
    for campo in ("nombre", "descripcion"):
        if args.get(campo) is not None:
            payload[campo] = args[campo]
    if args.get("fecha_limite"):
        payload["fechaLimite"] = args["fecha_limite"]
    if not payload:
        raise JsonRpcError(INVALID_PARAMS, "No indicaste ningún campo para actualizar.")

    serializer = ActivitySerializer(
        actividad, data=payload, partial=True, context=_serializer_context(ctx)
    )
    serializer.is_valid(raise_exception=True)
    actualizada = serializer.save()
    return f"Actividad actualizada: {_activity_line(actualizada)}"


# ─── Registro ─────────────────────────────────────────────────────────────

TOOLS = [
    Tool(
        name="obtener_workspace",
        description=(
            "Devuelve la configuración de la organización: estados, prioridades y tipos "
            "de actividad con sus ids. Llama a esta herramienta ANTES de crear o "
            "actualizar actividades — cada organización define su propio flujo y los "
            "ids no son los mismos en dos organizaciones."
        ),
        schema={"type": "object", "properties": {}},
        handler=_obtener_workspace,
    ),
    Tool(
        name="listar_actividades",
        description=(
            "Lista las actividades que este usuario puede ver, con filtros opcionales. "
            "Un miembro ve las suyas, un coordinador las de su equipo y un admin las de "
            "toda la organización."
        ),
        schema={
            "type": "object",
            "properties": {
                "buscar": {"type": "string", "description": "Texto a buscar en el nombre."},
                "estado_id": {"type": "integer", "description": "Filtra por estado."},
                "responsable_id": {"type": "integer", "description": "Filtra por responsable."},
                "solo_abiertas": {
                    "type": "boolean",
                    "description": "Excluye las terminadas y canceladas.",
                },
                "limite": {
                    "type": "integer",
                    "description": f"Máximo de resultados (tope {MAX_RESULTADOS}).",
                },
            },
        },
        handler=_listar_actividades,
    ),
    Tool(
        name="listar_usuarios",
        description="Usuarios activos de la organización, para asignar responsables.",
        schema={"type": "object", "properties": {}},
        handler=_listar_usuarios,
    ),
    Tool(
        name="crear_actividad",
        description=(
            "Crea una actividad. Si no indicas estado o prioridad se usan los que la "
            "organización tenga por defecto; si no indicas responsable, queda a nombre "
            "del dueño del token. Las fechas van en formato AAAA-MM-DD."
        ),
        schema={
            "type": "object",
            "properties": {
                "nombre": {"type": "string", "description": "Qué hay que hacer."},
                "descripcion": {"type": "string"},
                "responsable_id": {"type": "integer"},
                "estado_id": {"type": "integer"},
                "prioridad_id": {"type": "integer"},
                "tipo_id": {"type": "integer"},
                "fecha_inicio": {"type": "string", "description": "AAAA-MM-DD."},
                "fecha_limite": {"type": "string", "description": "AAAA-MM-DD."},
                "empresa": {"type": "string", "description": "Cliente; se crea si no existe."},
                "proceso": {"type": "string"},
                "aplicacion": {"type": "string"},
                "stakeholder": {"type": "string"},
            },
            "required": ["nombre"],
        },
        handler=_crear_actividad,
        writes=True,
    ),
    Tool(
        name="actualizar_actividad",
        description=(
            "Cambia campos de una actividad existente: estado, prioridad, responsable, "
            "nombre, descripción o fecha límite. Solo funciona sobre actividades que el "
            "usuario puede ver."
        ),
        schema={
            "type": "object",
            "properties": {
                "actividad_id": {"type": "integer", "description": "Id interno (no el código)."},
                "estado_id": {"type": "integer"},
                "prioridad_id": {"type": "integer"},
                "tipo_id": {"type": "integer"},
                "responsable_id": {"type": "integer"},
                "nombre": {"type": "string"},
                "descripcion": {"type": "string"},
                "fecha_limite": {"type": "string", "description": "AAAA-MM-DD."},
            },
            "required": ["actividad_id"],
        },
        handler=_actualizar_actividad,
        writes=True,
    ),
]

BY_NAME = {t.name: t for t in TOOLS}


def list_tools(context: ToolContext) -> list[dict]:
    """Un token de solo lectura no ve siquiera las herramientas que
    escriben: mostrárselas para después rechazarlas haría que el modelo
    gaste turnos intentando algo que nunca va a poder hacer."""
    solo_lectura = context.token is not None and context.token.scope == "read"
    return [t.as_dict() for t in TOOLS if not (solo_lectura and t.writes)]


def call_tool(name: str, arguments: dict, context: ToolContext) -> dict:
    tool = BY_NAME.get(name)
    if tool is None:
        raise JsonRpcError(INVALID_PARAMS, f"Herramienta desconocida: {name}")

    faltantes = [c for c in tool.schema.get("required", []) if c not in arguments]
    if faltantes:
        raise JsonRpcError(INVALID_PARAMS, f"Faltan argumentos: {', '.join(faltantes)}")

    try:
        if tool.writes:
            # El verbo HTTP no sirve para decidir esto en MCP: acá es donde
            # se aplica la misma regla que en el resto del API.
            assert_write_allowed(context.user, token=context.token)
        texto = tool.handler(arguments, context)
        es_error = False
    except (ValidationError, PermissionDenied) as exc:
        # Errores de dominio y de permisos: van como `isError` dentro del
        # resultado, no como error de JSON-RPC. Así el modelo los lee, los
        # entiende y puede explicárselos a quien le pidió la acción ("tu
        # token es de solo lectura") o corregir el intento. Un error de
        # protocolo solo le diría que algo falló, sin qué ni por qué.
        texto = f"No se pudo completar: {exc.detail if hasattr(exc, 'detail') else exc}"
        es_error = True

    return {"content": [{"type": "text", "text": texto}], "isError": es_error}
