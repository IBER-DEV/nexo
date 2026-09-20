"""Qué proyectos ve cada rol dentro de una organización.

Espejo de `activities/visibility.py` y por el mismo motivo: vive suelto
porque el API REST no va a ser el único consumidor (el dashboard ya lo usa,
MCP lo usará), y una regla de visibilidad con dos implementaciones es una
fuga esperando a que alguien toque una sola.

El aislamiento entre organizaciones NO se resuelve acá — de eso se encarga
`OrgManager.for_org()` / `OrganizationScopedViewSetMixin`.
"""
from django.db.models import Q


def scope_to_user(queryset, user):
    """Reduce un queryset de Project —ya acotado a la organización— a lo que
    este usuario tiene permitido ver.

    Un miembro ve los proyectos que lidera y aquellos donde tiene alguna
    actividad suya: mismo criterio que usa `activities/visibility.py` para
    decidir qué actividades ve, para que no aparezca un proyecto vacío cuyo
    contenido no puede abrir.
    """
    if getattr(user, "is_admin", False):
        return queryset
    if getattr(user, "is_coordinator", False):
        ids = user.team_user_ids() if hasattr(user, "team_user_ids") else [user.pk]
    else:
        ids = [user.pk]

    # El filtro se aplica como subconsulta sobre `pk` y NO como un
    # `.filter(activities__...)` directo, aunque este último sea más corto.
    # Motivo: Django reutiliza el JOIN de un filtro sobre una relación
    # multi-valuada en los `Count()` que se anoten después, así que
    # `annotate_metrics()` terminaría contando solo las actividades del
    # usuario — un miembro vería "50% completado" en un proyecto que va en
    # 90%. Con la subconsulta el filtro decide *qué filas salen* sin tocar
    # cómo se cuentan sus actividades. Ver progress.annotate_metrics().
    model = queryset.model
    scoped_ids = (
        model.objects.filter(
            Q(lider_id__in=ids)
            | Q(created_by_id__in=ids)
            | Q(activities__responsable_id__in=ids)
            | Q(activities__created_by_id__in=ids)
        )
        .values("pk")
        .distinct()
    )
    return queryset.filter(pk__in=scoped_ids)


def visible_projects(user):
    """Proyectos que `user` puede ver: su organización, acotada por su rol."""
    from .models import Project

    base = (
        Project.objects.for_org(getattr(user, "organization", None))
        .select_related("lider", "cliente", "organization")
        .order_by("-pk")
    )
    return scope_to_user(base, user)
