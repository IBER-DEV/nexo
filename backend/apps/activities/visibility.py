"""Quién ve qué actividades dentro de una organización.

Vive suelto y no dentro del ViewSet porque hay más de un consumidor: el API
REST y el servidor MCP. Una regla de visibilidad duplicada es una fuga de
datos esperando a que alguien toque una de las dos copias — acá hay una
sola implementación y ambos la llaman.

El aislamiento entre organizaciones NO se resuelve acá: eso es
`OrgManager.for_org()` / `OrganizationScopedViewSetMixin`. Esto es el
scoping por rol *dentro* de una organización ya filtrada.
"""
from django.db.models import Q

RELATED = (
    "responsable",
    "created_by",
    "organization",
    "cliente",
    "proceso",
    "aplicacion",
    "stakeholder",
    "estado",
    "prioridad",
    "tipo",
)


def scope_to_user(queryset, user):
    """Reduce un queryset de Activity —ya acotado a la organización— a lo
    que este usuario tiene permitido ver."""
    if getattr(user, "is_admin", False):
        return queryset
    if getattr(user, "is_coordinator", False):
        team_ids = user.team_user_ids() if hasattr(user, "team_user_ids") else [user.pk]
        return queryset.filter(
            Q(responsable_id__in=team_ids) | Q(created_by_id__in=team_ids)
        ).distinct()
    return queryset.filter(Q(responsable=user) | Q(created_by=user)).distinct()


def visible_activities(user):
    """Actividades que `user` puede ver: su organización, acotada por su rol."""
    from .models import Activity

    base = (
        Activity.objects.for_org(getattr(user, "organization", None))
        .select_related(*RELATED)
        .order_by("-pk")
    )
    return scope_to_user(base, user)
