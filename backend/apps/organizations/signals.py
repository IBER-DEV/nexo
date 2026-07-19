"""Eventos de dominio de organizations. El emisor no sabe quién escucha —
separa el dominio del proveedor (ver Fase 1, punto 4 del roadmap). El
receiver que de verdad envía el correo de verificación vive en
apps.notifications, conectado en su AppConfig.ready(), siguiendo el mismo
patrón que apps/activities/signals.py usa para el push a Google Sheets."""
from django.dispatch import Signal

# kwargs: user (apps.users.models.User), organization (Organization)
user_registered = Signal()
