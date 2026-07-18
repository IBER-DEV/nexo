"""
Registro de plantillas de flujo para organizaciones nuevas. Las plantillas
son datos versionables (JSON en `workflow_templates/`), no código Python —
agregar una plantilla nueva es agregar un archivo, nada más. Ver
`workflow_templates/README.md` para el esquema completo y las reglas que
toda plantilla debe cumplir.

Las migraciones de datos NO importan este módulo (duplican las tablas
inline) porque una migración histórica debe seguir funcionando exactamente
igual aunque estos archivos cambien después.
"""
import json
from pathlib import Path

TEMPLATES_DIR = Path(__file__).resolve().parent / "workflow_templates"
VALID_CATEGORIES = {"todo", "active", "done", "cancelled"}


class TemplateError(ValueError):
    """Una plantilla en workflow_templates/ no cumple sus invariantes."""


def _validate(key: str, data: dict) -> None:
    if data.get("slug") != key:
        raise TemplateError(f"{key}.json: el campo 'slug' ({data.get('slug')!r}) debe coincidir con el nombre del archivo")

    states = data.get("states") or []
    if not states:
        raise TemplateError(f"{key}: sin estados")
    initials = [s for s in states if s.get("is_initial")]
    if len(initials) != 1:
        raise TemplateError(f"{key}: debe tener exactamente 1 estado inicial (tiene {len(initials)})")
    if not any(s.get("categoria") == "done" for s in states):
        raise TemplateError(f"{key}: falta un estado de categoría 'done'")
    bad_categories = {s.get("categoria") for s in states} - VALID_CATEGORIES
    if bad_categories:
        raise TemplateError(f"{key}: categorías inválidas {bad_categories}")
    state_slugs = [s["slug"] for s in states]
    if len(state_slugs) != len(set(state_slugs)):
        raise TemplateError(f"{key}: slugs de estado duplicados")

    priorities = data.get("priorities") or []
    if not priorities:
        raise TemplateError(f"{key}: sin prioridades")
    defaults = [p for p in priorities if p.get("is_default")]
    if len(defaults) != 1:
        raise TemplateError(f"{key}: debe tener exactamente 1 prioridad default (tiene {len(defaults)})")
    priority_slugs = [p["slug"] for p in priorities]
    if len(priority_slugs) != len(set(priority_slugs)):
        raise TemplateError(f"{key}: slugs de prioridad duplicados")

    type_slugs = [t["slug"] for t in data.get("types") or []]
    if len(type_slugs) != len(set(type_slugs)):
        raise TemplateError(f"{key}: slugs de tipo duplicados")


def _load_all() -> dict:
    templates = {}
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        _validate(path.stem, data)
        templates[path.stem] = data
    if not templates:
        raise TemplateError(f"No se encontraron plantillas en {TEMPLATES_DIR}")
    return templates


TEMPLATES = _load_all()
TEMPLATE_CHOICES = [(key, tpl["display_name"]) for key, tpl in TEMPLATES.items()]
DEFAULT_TEMPLATE = "ti_clasico"


def apply_template(org, template_key, WorkflowState, Priority, ActivityType=None):
    """Copia los maestros de `template_key` a `org` (idempotente por slug).

    Esto es una COPIA, no una referencia: los registros creados quedan
    100% en propiedad de `org` y no vuelven a sincronizarse con la
    plantilla — llamar esto en cualquier momento después de la creación de
    la organización sería un error de uso, no algo que este módulo deba
    prevenir en tiempo de ejecución (ver README de la carpeta)."""
    if template_key not in TEMPLATES:
        raise TemplateError(f"Plantilla desconocida: {template_key!r}")
    template = TEMPLATES[template_key]

    for s in template["states"]:
        WorkflowState.objects.get_or_create(
            organization=org,
            slug=s["slug"],
            defaults={
                "nombre": s["nombre"],
                "categoria": s["categoria"],
                "color": s["color"],
                "orden": s["orden"],
                "is_initial": s["is_initial"],
                "mostrar_en_kanban": s["mostrar_en_kanban"],
                "external_mappings": {"google_sheets": s["sheet_phase"]} if s.get("sheet_phase") else {},
            },
        )
    for p in template["priorities"]:
        Priority.objects.get_or_create(
            organization=org,
            slug=p["slug"],
            defaults={
                "nombre": p["nombre"],
                "color": p["color"],
                "orden": p["orden"],
                "is_default": p["is_default"],
            },
        )
    if ActivityType is not None:
        for t in template.get("types") or []:
            ActivityType.objects.get_or_create(
                organization=org,
                slug=t["slug"],
                defaults={"nombre": t["nombre"], "color": t["color"], "orden": t["orden"]},
            )
