"""
Shared parsing/lookup helpers for external data ingestion (Excel import,
Google Sheets sync). Kept in one place so both flows behave identically.
"""
import unicodedata
from datetime import date, datetime

from apps.users.models import User


def normalize_header(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.split())


def parse_date(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        pass
    if "/" in text:
        parts = text.split("/")
        if len(parts) == 3:
            day, month, year = parts
            try:
                return date(int(year), int(month), int(day))
            except ValueError:
                return None
    return None


def parse_pk(value: object) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    text_up = text.upper()
    if text_up.startswith("ACT-"):
        num = text_up.replace("ACT-", "", 1)
        if num.isdigit():
            return int(num)
    return None


def get_or_create_responsable(
    name: object, organization=None, requesting_user: User | None = None
) -> User | None:
    """Looks up a User by display name within the organization, auto-creating
    a passwordless account if none exists yet — matches the behavior already
    used by the Excel import."""
    if organization is None:
        raise ValueError("get_or_create_responsable requiere una organización")
    if not name:
        return None
    responsable_name = str(name).strip()
    if not responsable_name:
        return None

    responsable = (
        User.objects.for_org(organization).filter(nombre__iexact=responsable_name).first()
    )
    if responsable:
        return responsable

    seed = unicodedata.normalize("NFKD", responsable_name)
    seed = "".join(ch for ch in seed if not unicodedata.combining(ch))
    seed = "".join(ch for ch in seed if ch.isalnum() or ch in (" ", ".", "_", "-"))
    seed = seed.strip().lower().replace(" ", ".") or "user"
    email = f"{seed}@empresa.com"
    suffix = 1
    while User.objects.filter(email=email).exists():
        suffix += 1
        email = f"{seed}{suffix}@empresa.com"

    responsable = User(email=email, nombre=responsable_name, organization=organization)
    if requesting_user is not None and getattr(requesting_user, "is_coordinator", False):
        responsable.coordinador = requesting_user
    responsable.set_unusable_password()
    responsable.save()
    return responsable
