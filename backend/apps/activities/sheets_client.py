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

ESTADO_SHEET_TO_FLOWDESK = {
    "No iniciada": "backlog",
    "En Proceso": "in_progress",
    "Finalizada": "done",
    "Cancelado": "cancelled",
}
ESTADO_FLOWDESK_TO_SHEET = {
    "backlog": "No iniciada",
    "in_progress": "En Proceso",
    "testing": "En Proceso",
    "pending_client": "En Proceso",
    "done": "Finalizada",
    "cancelled": "Cancelado",
}


def estado_to_sheet(estado: str) -> str:
    return ESTADO_FLOWDESK_TO_SHEET.get(estado, "No iniciada")


def estado_to_flowdesk(fase: object) -> str:
    return ESTADO_SHEET_TO_FLOWDESK.get(str(fase).strip(), "backlog")


def _client() -> gspread.Client:
    creds_json = settings.GOOGLE_SHEETS_CREDENTIALS_JSON
    if not creds_json:
        raise RuntimeError("GOOGLE_SHEETS_CREDENTIALS_JSON no esta configurado")
    info = json.loads(creds_json)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def get_worksheet() -> gspread.Worksheet:
    spreadsheet_id = settings.APPSHEET_SPREADSHEET_ID
    worksheet_name = settings.APPSHEET_WORKSHEET_NAME
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
        "Fase": estado_to_sheet(activity.estado),
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
