"""Numeración de actividades por organización y compatibilidad del parser
de códigos con los FlowDeskID legacy (ACT-####)."""
from django.test import TestCase

from apps.activities.models import Activity
from apps.activities.sync_utils import parse_codigo

from .factories import make_activity, make_org, make_user


class CodigoPerOrgTests(TestCase):
    def test_each_org_starts_at_one(self):
        org_a = make_org("alfa", "Alfa")
        org_b = make_org("beta", "Beta")
        user_a = make_user("a@a.com", "A", organization=org_a)
        user_b = make_user("b@b.com", "B", organization=org_b)

        a1 = make_activity(user_a)
        b1 = make_activity(user_b)
        a2 = make_activity(user_a)

        self.assertEqual(a1.numero, 1)
        self.assertEqual(b1.numero, 1)
        self.assertEqual(a2.numero, 2)

    def test_codigo_uses_org_prefix(self):
        org = make_org("acme-ltd", "Acme Ltd")
        self.assertEqual(org.codigo_prefix, "ACM")
        user = make_user("x@acme.com", "X", organization=org)
        activity = make_activity(user)
        self.assertEqual(activity.codigo, "ACM-0001")

    def test_sequence_survives_deletes(self):
        org = make_org("gamma", "Gamma")
        user = make_user("g@g.com", "G", organization=org)
        a1 = make_activity(user)
        a1.delete()
        a2 = make_activity(user)
        self.assertEqual(a2.numero, 2, "los números no se reutilizan tras borrar")

    def test_explicit_numero_is_respected(self):
        # La migración de datos backfillea numero=pk; el save() no debe pisarlo.
        org = make_org("delta", "Delta")
        user = make_user("d@d.com", "D", organization=org)
        activity = make_activity(user, numero=42)
        self.assertEqual(activity.numero, 42)


class ParseCodigoTests(TestCase):
    def test_legacy_act_codes(self):
        self.assertEqual(parse_codigo("ACT-0042"), 42)
        self.assertEqual(parse_codigo("act-0042"), 42)

    def test_new_org_prefixes(self):
        self.assertEqual(parse_codigo("ACM-0007"), 7)
        self.assertEqual(parse_codigo("NEX-1234"), 1234)

    def test_plain_digits(self):
        self.assertEqual(parse_codigo("42"), 42)
        self.assertEqual(parse_codigo(42), 42)

    def test_garbage_returns_none(self):
        self.assertIsNone(parse_codigo(None))
        self.assertIsNone(parse_codigo(""))
        self.assertIsNone(parse_codigo("sin-numero-x"))
