"""Resolución de mapeo Fase (Google Sheet) <-> WorkflowState. El mapeo es
configurable por organización (WorkflowState.external_mappings); estos tests
cubren el fallback por categoría y el fix del bug latente donde un pull
degradaba estados específicos que comparten fase con uno genérico."""
from django.test import TestCase

from apps.activities.models import WorkflowState
from apps.activities.sheets_client import estado_to_sheet, resolve_state_from_sheet

from .factories import ensure_masters, make_org


class SyncMappingTests(TestCase):
    def setUp(self):
        self.org = make_org("sync", "Sync Org")
        masters = ensure_masters(self.org)
        self.states = masters["states"]

    def test_push_uses_explicit_mapping(self):
        self.assertEqual(estado_to_sheet(self.states["testing"]), "En Proceso")

    def test_push_falls_back_to_categoria_default_without_mapping(self):
        state = self.states["backlog"]
        state.external_mappings = {}
        state.save()
        self.assertEqual(estado_to_sheet(state), "No iniciada")

    def test_pull_resolves_by_explicit_mapping(self):
        resolved = resolve_state_from_sheet("Finalizada", self.org)
        self.assertEqual(resolved, self.states["done"])

    def test_pull_keeps_current_state_when_it_shares_the_fase(self):
        # testing y in_progress y pending_client mapean todos a "En Proceso";
        # si la actividad ya está en 'testing', un pull con esa fase no debe
        # degradarla a 'in_progress' (el de menor orden).
        resolved = resolve_state_from_sheet(
            "En Proceso", self.org, current_estado=self.states["testing"]
        )
        self.assertEqual(resolved, self.states["testing"])

    def test_pull_picks_lowest_orden_when_no_current_state(self):
        resolved = resolve_state_from_sheet("En Proceso", self.org)
        self.assertEqual(resolved, self.states["in_progress"])

    def test_pull_falls_back_to_initial_for_unknown_fase(self):
        resolved = resolve_state_from_sheet("Fase Rara Inventada", self.org)
        self.assertEqual(resolved, self.states["backlog"])

    def test_pull_falls_back_to_categoria_default_phase(self):
        resolved = resolve_state_from_sheet("Cancelado", self.org)
        self.assertEqual(resolved, self.states["cancelled"])

    def test_pull_defaults_to_initial_when_fase_blank(self):
        resolved = resolve_state_from_sheet("", self.org)
        self.assertEqual(resolved, self.states["backlog"])
