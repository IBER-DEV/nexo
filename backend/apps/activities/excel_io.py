"""Plantilla, exportación e importación de proyectos vía Excel.

Vive separado de `views.py` por el mismo motivo que `sheets_client.py`:
construir un libro de openpyxl es lógica de formato, no de HTTP, y mezclarla
con el ViewSet la hace imposible de leer de un vistazo.

Tres piezas:
  - `build_template_workbook()`: la plantilla en blanco para cargar
    proyectos y actividades desde cero.
  - `build_export_workbook()`: exportación real en .xlsx — reemplaza el CSV
    que rompía en Excel con configuración regional en español (coma decimal
    ⇒ `;` como separador de listas; un CSV con comas cae todo en una sola
    columna). Un .xlsx real no depende de ningún separador.
  - `import_projects_sheet()`: la hoja "Proyectos" del import, hermana de
    la lógica de actividades que ya vive en `views.py::import_excel`.

Ninguna de las tres reimplementa reglas de negocio que no le tocan: el
get-or-create de catálogos sigue el mismo criterio (`nombre__iexact`) que
`ActivitySerializer`/`ProjectSerializer`, y el líder de un proyecto se
resuelve con `get_or_create_responsable` — la misma función que ya usa
Responsable en actividades, para que "Ana García" en una columna y en otra
no genere dos usuarios por una diferencia de mayúsculas.
"""
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from apps.activities.models import Cliente
from apps.projects.models import Project

from .sync_utils import normalize_header, parse_date, get_or_create_responsable

HEADER_FILL = PatternFill("solid", fgColor="1F2937")
HEADER_FONT = Font(color="FFFFFF", bold=True)
TITLE_FONT = Font(bold=True, size=13)


def _style_header(ws: Worksheet, ncols: int, row: int = 1) -> None:
    for col in range(1, ncols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = ws.cell(row=row + 1, column=1).coordinate


def _autosize(ws: Worksheet, widths: list[int]) -> None:
    for idx, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = max(12, min(width, 48))


# ---------------------------------------------------------------------------
# Plantilla
# ---------------------------------------------------------------------------

PROJECT_ESTADO_LABELS = dict(Project.Estado.choices)

PROJECT_HEADERS = [
    "Nombre",
    "Descripcion",
    "Estado",
    "Cliente",
    "Lider",
    "Fecha inicio",
    "Fecha entrega estimada",
]

ACTIVITY_HEADERS = [
    "Empresa",
    "Proceso",
    "Aplicacion",
    "Proyecto",
    "Nombre Actividad",
    "Descripcion Actividad",
    "Responsable",
    "Stakeholder",
    "Fecha Inicio",
    "Fecha Finalizacion",
]


def build_template_workbook(org) -> Workbook:
    """Libro en blanco con instrucciones + una fila de ejemplo por hoja.

    Las hojas se llaman literalmente "Proyectos" y "Actividades" — el
    import las busca por nombre (ver `views.py::import_excel`); si el
    usuario las renombra, cae al comportamiento viejo (primera hoja =
    actividades), así que renombrarlas no rompe nada, solo pierde el
    prellenado de proyectos.
    """
    wb = Workbook()

    instrucciones = wb.active
    instrucciones.title = "Instrucciones"
    instrucciones.sheet_view.showGridLines = False
    instrucciones.column_dimensions["A"].width = 90
    lineas = [
        ("Cómo usar esta plantilla", TITLE_FONT),
        ("", None),
        ("1. Llena la hoja «Proyectos» (opcional) — uno por fila.", None),
        (
            "2. Llena la hoja «Actividades». La columna Proyecto se une por nombre: "
            "si coincide con uno de la hoja «Proyectos» (o con uno que ya existe en Nexo), "
            "la actividad queda amarrada a él. Si no coincide con ninguno, se crea uno nuevo "
            "con ese nombre.",
            None,
        ),
        (
            "3. Empresa, Proceso, Aplicación, Stakeholder y Cliente también son texto libre: "
            "si el valor no existe todavía en tu organización, Nexo lo crea solo al importar.",
            None,
        ),
        (
            f"4. Estado del proyecto acepta: {', '.join(PROJECT_ESTADO_LABELS.values())}. "
            "Si lo dejas vacío, un proyecto nuevo queda como «Planificado».",
            None,
        ),
        (
            "5. Responsable/Lider se busca por nombre dentro de tu organización; si no existe, "
            "Nexo crea un usuario sin contraseña con ese nombre (igual que hoy en Actividades).",
            None,
        ),
        (
            "6. Para ACTUALIZAR una actividad ya existente en vez de crear una nueva, agrega una "
            "columna «Codigo» con su código (ej. ACT-0001).",
            None,
        ),
        ("", None),
        (f"Generado para {org.nombre} · {date.today().isoformat()}", None),
    ]
    for i, (texto, font) in enumerate(lineas, start=1):
        cell = instrucciones.cell(row=i, column=1, value=texto)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
        if font:
            cell.font = font

    # --- Proyectos ---
    proyectos = wb.create_sheet("Proyectos")
    proyectos.append(PROJECT_HEADERS)
    _style_header(proyectos, len(PROJECT_HEADERS))
    proyectos.append(
        [
            "Migración a SAP S/4HANA",
            "Reemplazo del ERP actual por S/4HANA",
            "En curso",
            "Acme Corp",
            "",
            date.today().isoformat(),
            "",
        ]
    )
    _autosize(proyectos, [28, 40, 16, 22, 22, 16, 20])

    # --- Actividades ---
    actividades = wb.create_sheet("Actividades")
    actividades.append(ACTIVITY_HEADERS)
    _style_header(actividades, len(ACTIVITY_HEADERS))
    actividades.append(
        [
            "Acme Corp",
            "Infraestructura",
            "Oracle DB",
            "Migración a SAP S/4HANA",
            "Relevamiento de servidores",
            "Inventario de servidores actuales y su rol",
            "",
            "",
            date.today().isoformat(),
            "",
        ]
    )
    _autosize(actividades, [20, 20, 20, 28, 32, 40, 20, 20, 16, 18])

    wb.active = wb.sheetnames.index("Instrucciones")
    return wb


# ---------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------

EXPORT_HEADERS = [
    "Codigo",
    "Proyecto",
    "Empresa",
    "Proceso",
    "Aplicacion",
    "Nombre",
    "Descripcion",
    "Responsable",
    "Stakeholder",
    "Prioridad",
    "Estado",
    "Fecha inicio",
    "Fecha limite",
]


def build_export_workbook(activities) -> Workbook:
    """`activities`: iterable de `Activity` ya con `select_related` de
    catálogos/estado/prioridad/proyecto — evita N+1 al armar cada fila.

    Genera un .xlsx real (no texto delimitado) a propósito: es la única
    forma de que Excel muestre las columnas bien sin importar el separador
    de lista de la configuración regional del usuario (con coma decimal,
    como en la mayoría de configuraciones en español, Excel espera `;` en
    un CSV y no `,` — de ahí que el export viejo se viera como una sola
    columna con comillas literales)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Actividades"
    ws.append(EXPORT_HEADERS)
    _style_header(ws, len(EXPORT_HEADERS))

    for a in activities:
        ws.append(
            [
                a.codigo,
                a.proyecto.nombre if a.proyecto_id else "",
                a.cliente.nombre if a.cliente_id else "",
                a.proceso.nombre if a.proceso_id else "",
                a.aplicacion.nombre if a.aplicacion_id else "",
                a.nombre,
                a.descripcion,
                a.responsable.nombre,
                a.stakeholder.nombre if a.stakeholder_id else "",
                a.prioridad.nombre,
                a.estado.nombre,
                a.fecha_inicio,
                a.fecha_limite,
            ]
        )

    for row in ws.iter_rows(min_row=2, min_col=12, max_col=13):
        for cell in row:
            cell.number_format = "yyyy-mm-dd"

    _autosize(ws, [12, 26, 20, 20, 20, 32, 40, 20, 20, 14, 16, 14, 14])
    ws.auto_filter.ref = ws.dimensions
    return wb


# ---------------------------------------------------------------------------
# Import de la hoja "Proyectos"
# ---------------------------------------------------------------------------


def _resolve_estado(value: object) -> str | None:
    if not value:
        return None
    text = str(value).strip().lower()
    for enum_value, label in PROJECT_ESTADO_LABELS.items():
        if text == enum_value.lower() or text == label.lower():
            return enum_value
    return None


def _get_or_create_cliente(org, nombre: str) -> Cliente:
    existing = Cliente.objects.for_org(org).filter(nombre__iexact=nombre).first()
    return existing or Cliente.objects.create(organization=org, nombre=nombre)


def import_projects_sheet(ws: Worksheet, org, requesting_user) -> dict:
    """Upsert por nombre (case-insensitive): re-importar la misma plantilla
    actualiza los proyectos existentes en vez de duplicarlos — a propósito,
    para que cargar la plantilla dos veces sea seguro."""
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"created": 0, "updated": 0, "skipped": 0, "errors": []}

    header_map: dict[str, int] = {}
    for idx, header in enumerate(rows[0]):
        key = normalize_header(header)
        if key == "nombre":
            header_map["nombre"] = idx
        elif key == "descripcion":
            header_map["descripcion"] = idx
        elif key == "estado":
            header_map["estado"] = idx
        elif key == "cliente":
            header_map["cliente"] = idx
        elif key in ("lider", "líder"):
            header_map["lider"] = idx
        elif key == "fecha inicio":
            header_map["fecha_inicio"] = idx
        elif key in ("fecha entrega estimada", "fecha fin estimada", "fecha de entrega"):
            header_map["fecha_fin_estimada"] = idx

    if "nombre" not in header_map:
        return {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [{"sheet": "Proyectos", "row": 1, "error": "Falta la columna Nombre"}],
        }

    created = updated = skipped = 0
    errors: list[dict] = []

    for row_index, row in enumerate(rows[1:], start=2):
        if not any(cell not in (None, "") for cell in row):
            continue

        nombre = str(row[header_map["nombre"]] or "").strip()
        if not nombre:
            skipped += 1
            errors.append({"sheet": "Proyectos", "row": row_index, "error": "Falta el nombre"})
            continue

        project = Project.objects.for_org(org).filter(nombre__iexact=nombre).first()
        is_new = project is None
        if project is None:
            project = Project(organization=org, created_by=requesting_user, nombre=nombre)

        if "descripcion" in header_map:
            value = row[header_map["descripcion"]]
            if value not in (None, ""):
                project.descripcion = str(value).strip()

        if "estado" in header_map:
            resolved = _resolve_estado(row[header_map["estado"]])
            if resolved:
                project.estado = resolved

        if "cliente" in header_map:
            value = row[header_map["cliente"]]
            if value not in (None, ""):
                project.cliente = _get_or_create_cliente(org, str(value).strip())

        if "lider" in header_map:
            value = row[header_map["lider"]]
            if value not in (None, ""):
                project.lider = get_or_create_responsable(
                    value, organization=org, requesting_user=requesting_user
                )

        if "fecha_inicio" in header_map:
            parsed = parse_date(row[header_map["fecha_inicio"]])
            if parsed:
                project.fecha_inicio = parsed

        if "fecha_fin_estimada" in header_map:
            parsed = parse_date(row[header_map["fecha_fin_estimada"]])
            if parsed:
                project.fecha_fin_estimada = parsed

        try:
            project.full_clean(
                exclude=["numero", "created_by", "organization", "color", "fecha_fin_real"]
            )
            project.save()
        except Exception as exc:  # noqa: BLE001 — fila con datos inválidos, no debe tumbar el import
            skipped += 1
            errors.append({"sheet": "Proyectos", "row": row_index, "error": str(exc)})
            continue

        if is_new:
            created += 1
        else:
            updated += 1

    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors}
