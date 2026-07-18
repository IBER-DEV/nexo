"""Resolución de organizaciones del comando sync_appsheet: --org explícito,
iteración sobre orgs con spreadsheet propio, y fallback de una sola org
usando los settings globales (instalación single-org clásica)."""
from django.core.management import CommandError
from django.test import TestCase

from apps.activities.management.commands.sync_appsheet import Command

from .factories import make_org


class ResolveOrgsTests(TestCase):
    def test_explicit_org_slug(self):
        org = make_org("explicita", "Explicita")
        make_org("otra-cualquiera", "Otra")
        resolved = Command()._resolve_orgs("explicita")
        self.assertEqual(resolved, [org])

    def test_unknown_slug_raises(self):
        with self.assertRaises(CommandError):
            Command()._resolve_orgs("no-existe")

    def test_single_org_without_config_falls_back(self):
        org = make_org("unica", "Unica")
        resolved = Command()._resolve_orgs(None)
        self.assertEqual(resolved, [org])

    def test_multiple_orgs_without_config_requires_explicit_org(self):
        make_org("a", "A")
        make_org("b", "B")
        with self.assertRaises(CommandError):
            Command()._resolve_orgs(None)

    def test_iterates_only_orgs_with_own_spreadsheet(self):
        configured = make_org("configurada", "Configurada", appsheet_spreadsheet_id="sheet123")
        make_org("sin-configurar", "Sin Configurar")
        resolved = Command()._resolve_orgs(None)
        self.assertEqual(resolved, [configured])
