"""Generación automática de slug para el signup — el usuario nunca debe
pensar en esto (ver Fase 1, punto 4 del roadmap). Nombres de organización
duplicados son legítimos (dos tenants distintos pueden llamarse "Acme"), así
que la colisión se resuelve con un sufijo numérico, nunca con un error."""
from django.utils.text import slugify

from .models import Organization


def unique_slug_for(nombre: str) -> str:
    base = slugify(nombre)[:40] or "org"
    slug = base
    n = 1
    while Organization.objects.filter(slug=slug).exists():
        n += 1
        slug = f"{base}-{n}"
    return slug
