"""
Scoping multi-tenant. Regla dura del proyecto: en views/serializers ningún
queryset de un modelo org-scoped se usa sin pasar por la organización —
siempre `Model.objects.for_org(org)` o este mixin (test de guardia en
apps/activities/tests/test_scoping_guard.py).
"""
from django.db import models


class OrgQuerySet(models.QuerySet):
    def for_org(self, organization):
        # None = superusuario de plataforma sin org: el API no le muestra nada;
        # opera solo vía el admin de Django.
        if organization is None:
            return self.none()
        return self.filter(organization=organization)


OrgManager = models.Manager.from_queryset(OrgQuerySet)


class OrganizationScopedViewSetMixin:
    """Filtra el queryset por la organización del usuario autenticado e
    inyecta la organización al crear. Las subclases que sobreescriban
    get_queryset deben partir de super().get_queryset()."""

    def get_queryset(self):
        return super().get_queryset().for_org(self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)
