"""Regresión: seed_data inserta Activity con pk explícito (para ser
idempotente entre corridas) — en Postgres eso deja la secuencia del id
atrasada, y el próximo INSERT sin pk explícito (cualquier actividad creada
normalmente desde la API) colisiona con un id ya ocupado. seed_data debe
corregir la secuencia al final."""
from unittest import skipUnless

from django.core.management import call_command
from django.db import connection
from django.test import TestCase

from apps.activities.models import Activity


@skipUnless(connection.vendor == "postgresql", "la secuencia solo aplica a Postgres")
class SeedDataSequenceTests(TestCase):
    def test_id_sequence_is_ahead_of_max_id_after_seeding(self):
        call_command("seed_data")
        max_id = Activity.objects.order_by("-pk").first().pk
        with connection.cursor() as cursor:
            cursor.execute("SELECT last_value FROM activities_activity_id_seq")
            last_value = cursor.fetchone()[0]
        self.assertGreaterEqual(last_value, max_id)

    def test_creating_activity_without_explicit_pk_does_not_collide(self):
        call_command("seed_data")
        existing = Activity.objects.filter(organization__slug="demo").first()
        # Sin pk explícito -- exactamente lo que hace la API al crear una
        # actividad real, y lo que reventaba antes de corregir la secuencia.
        activity = Activity.objects.create(
            organization=existing.organization,
            responsable=existing.responsable,
            nombre="Actividad creada por un usuario real",
            descripcion="",
            estado=existing.estado,
            prioridad=existing.prioridad,
            fecha_inicio="2026-07-01",
            fecha_limite="2026-07-15",
        )
        self.assertIsNotNone(activity.pk)
