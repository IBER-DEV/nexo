import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Activity
from .sheets_client import delete_row, get_worksheet, upsert_row
from .sync_context import is_pulling

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Activity)
def push_activity_to_sheet(sender, instance, **kwargs):
    if is_pulling():
        return
    try:
        worksheet = get_worksheet()
        upsert_row(worksheet, instance)
    except Exception:
        # Best-effort: a misconfigured or unreachable Google Sheet must never
        # break saving an activity in Nexo itself.
        logger.exception("No se pudo sincronizar %s hacia la Google Sheet", instance.codigo)


@receiver(post_delete, sender=Activity)
def push_activity_delete_to_sheet(sender, instance, **kwargs):
    if is_pulling():
        return
    try:
        worksheet = get_worksheet()
        delete_row(worksheet, instance.codigo)
    except Exception:
        logger.exception("No se pudo eliminar %s de la Google Sheet", instance.codigo)
