"""Sanidad de las plantillas de flujo (workflow_templates/*.json): cada
preset debe ser un flujo válido por sí mismo — un estado inicial, al menos
un estado 'finalizado', y una prioridad por defecto. El loader ya valida
esto al importar (test_loader_validation_runs_on_import cubre eso); estos
tests además documentan la forma esperada para quien agregue una plantilla
nueva."""
from django.test import TestCase

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.org_templates import TEMPLATES, VALID_CATEGORIES, TemplateError, apply_template

from .factories import make_org


class TemplateDefinitionsTests(TestCase):
    def test_at_least_the_three_system_templates_are_registered(self):
        self.assertGreaterEqual(len(TEMPLATES), 3)
        for key in ("ti_clasico", "kanban_simple", "mesa_ayuda"):
            self.assertIn(key, TEMPLATES)

    def test_every_template_has_exactly_one_initial_state(self):
        for key, template in TEMPLATES.items():
            initials = [s for s in template["states"] if s["is_initial"]]
            self.assertEqual(len(initials), 1, f"{key}: debe tener exactamente 1 estado inicial")

    def test_every_template_has_at_least_one_done_state(self):
        for key, template in TEMPLATES.items():
            done_states = [s for s in template["states"] if s["categoria"] == "done"]
            self.assertGreaterEqual(len(done_states), 1, f"{key}: falta un estado 'done'")

    def test_every_state_uses_a_valid_categoria(self):
        for key, template in TEMPLATES.items():
            for s in template["states"]:
                self.assertIn(s["categoria"], VALID_CATEGORIES, f"{key}: categoría inválida en {s['slug']!r}")

    def test_every_template_has_exactly_one_default_priority(self):
        for key, template in TEMPLATES.items():
            defaults = [p for p in template["priorities"] if p["is_default"]]
            self.assertEqual(len(defaults), 1, f"{key}: debe tener exactamente 1 prioridad default")

    def test_slugs_are_unique_within_each_template(self):
        for key, template in TEMPLATES.items():
            state_slugs = [s["slug"] for s in template["states"]]
            priority_slugs = [p["slug"] for p in template["priorities"]]
            type_slugs = [t["slug"] for t in template["types"]]
            self.assertEqual(len(state_slugs), len(set(state_slugs)), f"{key}: slugs de estado duplicados")
            self.assertEqual(
                len(priority_slugs), len(set(priority_slugs)), f"{key}: slugs de prioridad duplicados"
            )
            self.assertEqual(len(type_slugs), len(set(type_slugs)), f"{key}: slugs de tipo duplicados")

    def test_slug_field_matches_registry_key(self):
        for key, template in TEMPLATES.items():
            self.assertEqual(template["slug"], key)

    def test_every_template_has_required_metadata(self):
        for key, template in TEMPLATES.items():
            for field in ("version", "display_name", "description", "recommended_for", "is_system"):
                self.assertIn(field, template, f"{key}: falta el campo {field!r}")


class ApplyTemplateTests(TestCase):
    def test_unknown_template_raises(self):
        org = make_org("plantilla-mala", "Plantilla Mala")
        with self.assertRaises(TemplateError):
            apply_template(org, "no-existe", WorkflowState, Priority, ActivityType)

    def test_kanban_simple_creates_expected_counts(self):
        org = make_org("kanban-org", "Kanban Org")
        apply_template(org, "kanban_simple", WorkflowState, Priority, ActivityType)
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 4)
        self.assertEqual(Priority.objects.for_org(org).count(), 3)
        self.assertEqual(ActivityType.objects.for_org(org).count(), 0)

    def test_mesa_ayuda_creates_expected_counts(self):
        org = make_org("mesa-org", "Mesa Org")
        apply_template(org, "mesa_ayuda", WorkflowState, Priority, ActivityType)
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 6)
        self.assertEqual(Priority.objects.for_org(org).count(), 4)
        self.assertEqual(ActivityType.objects.for_org(org).count(), 4)

    def test_applying_twice_is_idempotent(self):
        org = make_org("idempotente", "Idempotente")
        apply_template(org, "ti_clasico", WorkflowState, Priority, ActivityType)
        apply_template(org, "ti_clasico", WorkflowState, Priority, ActivityType)
        self.assertEqual(WorkflowState.objects.for_org(org).count(), 6)
        self.assertEqual(Priority.objects.for_org(org).count(), 4)

    def test_applied_states_are_owned_by_the_org_not_shared(self):
        """La plantilla se copia — dos orgs con la misma plantilla tienen
        filas de WorkflowState completamente independientes (distinto pk),
        no una referencia compartida a un registro de plantilla."""
        org_a = make_org("copia-a", "Copia A")
        org_b = make_org("copia-b", "Copia B")
        apply_template(org_a, "kanban_simple", WorkflowState, Priority, ActivityType)
        apply_template(org_b, "kanban_simple", WorkflowState, Priority, ActivityType)

        state_a = WorkflowState.objects.for_org(org_a).get(slug="pendiente")
        state_b = WorkflowState.objects.for_org(org_b).get(slug="pendiente")
        self.assertNotEqual(state_a.pk, state_b.pk)

        # Editar el estado de una org no afecta a la otra ni a la plantilla.
        state_a.nombre = "Por aprobar"
        state_a.save()
        state_b.refresh_from_db()
        self.assertEqual(state_b.nombre, "Pendiente")
        self.assertEqual(TEMPLATES["kanban_simple"]["states"][0]["nombre"], "Pendiente")
