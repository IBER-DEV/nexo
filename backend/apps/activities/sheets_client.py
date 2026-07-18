"""
Thin wrapper around the Google Sheets API (via gspread) for the AppSheet
sync. Field/state mapping lives here so both the pull command
(management/commands/sync_appsheet.py) and the push signals
(signals.py) share one source of truth.
"""
import json

import gspread
from django.conf import settings
from google.oauth2.service_account import Credentials

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

FLOWDESK_ID_COLUMN = "FlowDeskID"

# Sheet column name -> Activity/serializer field name.
SHEET_TO_FIELD = {
    "Empresa": "empresa",
    "Proceso": "proceso",
    "Aplicacion": "aplicacion",
    "Proyecto": "proyecto",
    "NombreAct": "nombre",
    "DescripcionAct": "descripcion",
    "Responsable": "responsable",
    "Stakeholder": "stakeholder",
    "FechaInicio": "fechaInicio",
    "FechaFin": "fechaLimite",
    "Fase": "estado",
}
SHEET_COLUMNS = list(SHEET_TO_FIELD.keys()) + [FLOWDESK_ID_COLUMN]

# Fallback cuando un WorkflowState no tiene external_mappings.google_sheets
# configurado explícitamente — nunca rompe el push.
DEFAULT_PHASE_BY_CATEGORIA = {
    "todo": "No iniciada",
    "active": "En Proceso",
    "done": "Finalizada",
    "cancelled": "Cancelado",
}


def estado_to_sheet(estado) -> str:
    """WorkflowState -> valor de la columna 'Fase'."""
    return estado.sheet_phase or DEFAULT_PHASE_BY_CATEGORIA.get(estado.categoria, "No iniciada")


def resolve_state_from_sheet(fase: object, organization, current_estado=None):
    """Valor de 'Fase' -> WorkflowState de la organización.

    Orden de resolución: (1) match exacto por external_mappings.google_sheets
    (el de menor `orden` si varios estados comparten fase); (2) si el estado
    actual de la actividad ya mapea a esa misma fase, conservarlo — evita que
    un pull degrade estados más específicos (p.ej. 'En pruebas') a uno
    genérico solo porque comparten la misma fase de la Sheet; (3) fallback
    por categoría; (4) estado inicial de la organización."""
    from .models import WorkflowState  # import diferido: evita ciclos con models.py

    fase = str(fase or "").strip()
    states = WorkflowState.objects.for_org(organization).filter(is_active=True)

    matches = [s for s in states if s.sheet_phase and s.sheet_phase == fase] if fase else []
    if matches:
        if current_estado is not None and current_estado in matches:
            return current_estado
        return min(matches, key=lambda s: s.orden)

    categoria = next(
        (cat for cat, phase in DEFAULT_PHASE_BY_CATEGORIA.items() if phase == fase), None
    )
    if categoria:
        by_categoria = states.filter(categoria=categoria).order_by("orden").first()
        if by_categoria is not None:
            return by_categoria

    return states.filter(is_initial=True).first()


def _client() -> gspread.Client:
    creds_json = settings.GOOGLE_SHEETS_CREDENTIALS_JSON
    if not creds_json:
        raise RuntimeError("GOOGLE_SHEETS_CREDENTIALS_JSON no esta configurado")
    info = json.loads(creds_json)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def get_worksheet(organization=None) -> gspread.Worksheet:
    """Resuelve el spreadsheet/worksheet de `organization` si los tiene
    configurados; si no, cae a los settings globales (la org 'default' que
    ya usaba Nexo antes de ser multi-tenant)."""
    spreadsheet_id = (getattr(organization, "appsheet_spreadsheet_id", "") or settings.APPSHEET_SPREADSHEET_ID)
    worksheet_name = (getattr(organization, "appsheet_worksheet_name", "") or settings.APPSHEET_WORKSHEET_NAME)
    if not spreadsheet_id or not worksheet_name:
        raise RuntimeError("APPSHEET_SPREADSHEET_ID / APPSHEET_WORKSHEET_NAME no configurados")
    sh = _client().open_by_key(spreadsheet_id)
    return sh.worksheet(worksheet_name)


def validate_headers(worksheet: gspread.Worksheet) -> None:
    header = worksheet.row_values(1)
    missing = [col for col in SHEET_COLUMNS if col not in header]
    if missing:
        raise RuntimeError(
            "Faltan columnas en la Google Sheet: "
            + ", ".join(missing)
            + f". Agrega la columna '{FLOWDESK_ID_COLUMN}' si es la que falta."
        )


def read_rows(worksheet: gspread.Worksheet) -> list[dict]:
    """One dict per data row (sheet row 2 onward), tagged with its
    1-indexed sheet row number under '_row'."""
    records = worksheet.get_all_records()
    return [dict(record, _row=idx + 2) for idx, record in enumerate(records)]


def activity_to_row(activity) -> dict:
    return {
        "Empresa": activity.cliente.nombre if activity.cliente_id else "",
        "Proceso": activity.proceso.nombre if activity.proceso_id else "",
        "Aplicacion": activity.aplicacion.nombre if activity.aplicacion_id else "",
        "Proyecto": activity.proyecto,
        "NombreAct": activity.nombre,
        "DescripcionAct": activity.descripcion,
        "Responsable": activity.responsable.nombre,
        "Stakeholder": activity.stakeholder.nombre if activity.stakeholder_id else "",
        "FechaInicio": activity.fecha_inicio.isoformat(),
        "FechaFin": activity.fecha_limite.isoformat(),
        "Fase": estado_to_sheet(activity.estado),  # activity.estado: WorkflowState
        FLOWDESK_ID_COLUMN: activity.codigo,
    }


def find_row_number(worksheet: gspread.Worksheet, flowdesk_id: str) -> int | None:
    header = worksheet.row_values(1)
    if FLOWDESK_ID_COLUMN not in header:
        return None
    column_index = header.index(FLOWDESK_ID_COLUMN) + 1
    cell = worksheet.find(flowdesk_id, in_column=column_index)
    return cell.row if cell else None


def upsert_row(worksheet: gspread.Worksheet, activity) -> None:
    header = worksheet.row_values(1)
    row_data = activity_to_row(activity)
    values = [row_data.get(col, "") for col in header]
    row_number = find_row_number(worksheet, activity.codigo)
    if row_number:
        worksheet.update(f"A{row_number}", [values])
    else:
        worksheet.append_row(values)


def delete_row(worksheet: gspread.Worksheet, flowdesk_id: str) -> None:
    row_number = find_row_number(worksheet, flowdesk_id)
    if row_number:
        worksheet.delete_rows(row_number)


def write_flowdesk_id(worksheet: gspread.Worksheet, row_number: int, codigo: str) -> None:
    """Stamps the generated codigo back onto a row that was just created
    from a Sheet-side entry, so the next pull recognizes it and skips it."""
    header = worksheet.row_values(1)
    col_index = header.index(FLOWDESK_ID_COLUMN) + 1
    worksheet.update_cell(row_number, col_index, codigo)
