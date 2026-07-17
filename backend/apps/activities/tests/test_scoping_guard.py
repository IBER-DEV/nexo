"""Test de guardia: todo ViewSet registrado cuyo modelo sea org-scoped
(tiene FK 'organization') DEBE heredar OrganizationScopedViewSetMixin.
Si agregas un endpoint nuevo y este test falla, no lo excluyas: hereda el
mixin — es la regla dura de aislamiento multi-tenant del proyecto."""
import importlib

from django.test import SimpleTestCase

from apps.organizations.scoping import OrganizationScopedViewSetMixin

# Módulos que exponen un DefaultRouter llamado `router`.
ROUTER_MODULES = [
    "apps.activities.urls",
    "apps.activities.urls_masters",
]


def iter_registered_viewsets():
    for module_path in ROUTER_MODULES:
        module = importlib.import_module(module_path)
        for _prefix, viewset, _basename in module.router.registry:
            yield module_path, viewset


class ScopingGuardTests(SimpleTestCase):
    def test_org_scoped_viewsets_inherit_the_mixin(self):
        checked = 0
        for module_path, viewset in iter_registered_viewsets():
            model = viewset.queryset.model
            field_names = {f.name for f in model._meta.get_fields()}
            if "organization" not in field_names:
                continue
            checked += 1
            self.assertTrue(
                issubclass(viewset, OrganizationScopedViewSetMixin),
                f"{module_path}: {viewset.__name__} maneja el modelo org-scoped "
                f"{model.__name__} pero no hereda OrganizationScopedViewSetMixin",
            )
        self.assertGreater(checked, 0, "El guardia no encontró ningún ViewSet org-scoped")
