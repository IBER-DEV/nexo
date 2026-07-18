"""
python manage.py sync_appsheet [--dry-run]

Pulls rows from the Google Sheet behind the AppSheet "Proyectos TI" app and
upserts them into Nexo's Activity table. Rows without a FlowDeskID are
treated as new (created straight in AppSheet); the generated codigo is
written back to that row so the next run recognizes it instead of creating
a duplicate.

Meant to be run on a schedule (cron / hosting scheduled job) — see
GOOGLE_SHEETS_CREDENTIALS_JSON / APPSHEET_SPREADSHEET_ID /
APPSHEET_WORKSHEET_NAME in settings.

Rows that disappear from the Sheet are NOT deleted from Nexo in this
version — deleting an activity is still a manual action on either side.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.organizations.models import Organization
from apps.activities.models import Activity
from apps.activities.serializers import ActivitySerializer
from apps.activities.sheets_client import (
    get_worksheet,
    read_rows,
    resolve_state_from_sheet,
    validate_headers,
    write_flowdesk_id,
)
from apps.activities.sync_context import pulling
from apps.activities.sync_utils import get_or_create_responsable, parse_date, parse_codigo

REQUIRED_ROW_FIELDS = ("NombreAct", "Empresa", "Proceso", "Aplicacion", "Responsable")


def _nombre(catalog_obj) -> str:
    return catalog_obj.nombre if catalog_obj is not None else ""


def _row_changed(instance: Activity, data: dict) -> bool:
    return (
        _nombre(instance.cliente) != data["empresa"]
        or _nombre(instance.proceso) != data["proceso"]
        or _nombre(instance.aplicacion) != data["aplicacion"]
        or instance.proyecto != data["proyecto"]
        or instance.nombre != data["nombre"]
        or instance.descripcion != data["descripcion"]
        or instance.responsable_id != data["responsable_id"]
        or _nombre(instance.stakeholder) != data["stakeholder"]
        or instance.estado_id != data["estado_id"]
        or instance.fecha_inicio != data["fechaInicio"]
        or instance.fecha_limite != data["fechaLimite"]
    )


class Command(BaseCommand):
    help = "Sincroniza actividades desde la Google Sheet de AppSheet (Proyectos TI) hacia Nexo"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="No escribe cambios en Nexo ni en la Sheet, solo reporta lo que haria",
        )
        parser.add_argument(
            "--org",
            help="Slug de la organización destino; opcional si solo existe una",
        )

    def _resolve_org(self, slug: str | None) -> Organization:
        if slug:
            org = Organization.objects.filter(slug=slug).first()
            if org is None:
                raise CommandError(f"No existe una organización con slug '{slug}'")
            return org
        orgs = list(Organization.objects.filter(is_active=True)[:2])
        if len(orgs) == 1:
            return orgs[0]
        raise CommandError("Hay varias organizaciones: especifica --org <slug>")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        org = self._resolve_org(options.get("org"))

        try:
            worksheet = get_worksheet()
            validate_headers(worksheet)
            rows = read_rows(worksheet)
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        created = updated = unchanged = skipped = 0

        with pulling(), transaction.atomic():
            for row in rows:
                if not any(str(row.get(f) or "").strip() for f in REQUIRED_ROW_FIELDS):
                    continue  # blank row

                nombre = str(row.get("NombreAct") or "").strip()
                empresa = str(row.get("Empresa") or "").strip()
                proceso = str(row.get("Proceso") or "").strip()
                aplicacion = str(row.get("Aplicacion") or "").strip()
                responsable_name = str(row.get("Responsable") or "").strip()
                fecha_inicio = parse_date(row.get("FechaInicio"))
                fecha_limite = parse_date(row.get("FechaFin"))

                if not (nombre and empresa and proceso and aplicacion and responsable_name and fecha_inicio and fecha_limite):
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"Fila {row['_row']}: campos requeridos incompletos, omitida"))
                    continue

                responsable = get_or_create_responsable(responsable_name, organization=org)

                flowdesk_id = str(row.get("FlowDeskID") or "").strip()
                numero = parse_codigo(flowdesk_id) if flowdesk_id else None
                instance = (
                    Activity.objects.for_org(org)
                    .select_related("cliente", "proceso", "aplicacion", "stakeholder", "estado")
                    .filter(numero=numero)
                    .first()
                    if numero
                    else None
                )

                estado = resolve_state_from_sheet(
                    row.get("Fase"), org, current_estado=instance.estado if instance else None
                )

                data = {
                    "empresa": empresa,
                    "proceso": proceso,
                    "aplicacion": aplicacion,
                    "proyecto": str(row.get("Proyecto") or "").strip(),
                    "nombre": nombre,
                    "descripcion": str(row.get("DescripcionAct") or "").strip(),
                    "responsable_id": responsable.pk,
                    "stakeholder": str(row.get("Stakeholder") or "").strip(),
                    "estado_id": estado.pk if estado else None,
                    "fechaInicio": fecha_inicio,
                    "fechaLimite": fecha_limite,
                }

                if instance and not _row_changed(instance, data):
                    unchanged += 1
                    continue

                serializer = ActivitySerializer(
                    instance,
                    data=data,
                    partial=bool(instance),
                    context={"organization": org},
                )
                if not serializer.is_valid():
                    skipped += 1
                    self.stdout.write(self.style.WARNING(f"Fila {row['_row']}: {serializer.errors}"))
                    continue

                save_kwargs = {} if instance else {"organization": org}
                activity = serializer.save(**save_kwargs)

                if instance:
                    updated += 1
                else:
                    created += 1
                    if not dry_run:
                        write_flowdesk_id(worksheet, row["_row"], activity.codigo)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(
            self.style.SUCCESS(
                f"Creadas: {created} · Actualizadas: {updated} · Sin cambios: {unchanged} · Omitidas: {skipped}"
                + (" (dry-run, sin escribir)" if dry_run else "")
            )
        )
