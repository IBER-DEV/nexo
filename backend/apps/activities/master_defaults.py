"""
Maestros por defecto para una organización nueva ("flujo TI clásico" — el
que ya usaba Nexo antes de volverse configurable). Usado por seed_data y por
el flujo de creación de organizaciones; las migraciones de datos NO importan
este módulo (duplican estas tablas inline) porque una migración histórica
debe seguir funcionando aunque este archivo cambie después.
"""

# slug, nombre, categoria, color, orden, is_initial, mostrar_en_kanban, sheet_phase
DEFAULT_STATES = [
    ("backlog", "Backlog", "todo", "#7C8A93", 0, True, True, "No iniciada"),
    ("in_progress", "En progreso", "active", "#29AFF5", 1, False, True, "En Proceso"),
    ("testing", "En pruebas", "active", "#F0A93B", 2, False, True, "En Proceso"),
    ("pending_client", "Pendiente cliente", "active", "#5B6EF5", 3, False, False, "En Proceso"),
    ("done", "Finalizado", "done", "#22B573", 4, False, True, "Finalizada"),
    ("cancelled", "Cancelado", "cancelled", "#7C8A93", 5, False, False, "Cancelado"),
]

# slug, nombre, color, orden, is_default
DEFAULT_PRIORITIES = [
    ("low", "Baja", "#7C8A93", 0, False),
    ("medium", "Media", "#29AFF5", 1, True),
    ("high", "Alta", "#F0A93B", 2, False),
    ("critical", "Crítica", "#E5484D", 3, False),
]

# slug, nombre, color, orden
DEFAULT_ACTIVITY_TYPES = [
    ("desarrollo", "Desarrollo", "#29AFF5", 0),
    ("soporte", "Soporte", "#F0A93B", 1),
    ("mejora", "Mejora", "#22B573", 2),
    ("incidente", "Incidente", "#E5484D", 3),
]


def create_default_masters(org, WorkflowState, Priority, ActivityType=None):
    """Crea los maestros por defecto para `org` si no existen (idempotente).
    Los modelos se reciben como parámetro para poder usarse tanto en runtime
    (import directo) como, si hiciera falta, con modelos históricos."""
    for slug, nombre, categoria, color, orden, is_initial, mostrar, sheet_phase in DEFAULT_STATES:
        WorkflowState.objects.get_or_create(
            organization=org,
            slug=slug,
            defaults={
                "nombre": nombre,
                "categoria": categoria,
                "color": color,
                "orden": orden,
                "is_initial": is_initial,
                "mostrar_en_kanban": mostrar,
                "external_mappings": {"google_sheets": sheet_phase} if sheet_phase else {},
            },
        )
    for slug, nombre, color, orden, is_default in DEFAULT_PRIORITIES:
        Priority.objects.get_or_create(
            organization=org,
            slug=slug,
            defaults={
                "nombre": nombre,
                "color": color,
                "orden": orden,
                "is_default": is_default,
            },
        )
    if ActivityType is not None:
        for slug, nombre, color, orden in DEFAULT_ACTIVITY_TYPES:
            ActivityType.objects.get_or_create(
                organization=org,
                slug=slug,
                defaults={"nombre": nombre, "color": color, "orden": orden},
            )
