"""Reconcilia los puestos facturados con los usuarios activos reales.

`service.schedule_seat_sync()` ya empuja el número en caliente cuando entra
o sale alguien, pero es best-effort: si el proveedor estaba caído, ese
empujón se perdió. Este comando es la red: idempotente, seguro de correr a
diario, y lo único que garantiza que nadie termine pagando por puestos que
no usa —o usando puestos que no paga— por un timeout de hace tres semanas.
"""
from django.core.management.base import BaseCommand

from apps.billing.limits import seats_in_use
from apps.billing.models import Subscription
from apps.billing.service import sync_seats


class Command(BaseCommand):
    help = "Sincroniza la cantidad de puestos facturados con los usuarios activos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué suscripciones cambiarían, sin llamar al proveedor.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        pendientes = 0
        sincronizadas = 0

        for sub in Subscription.objects.filter(
            status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE]
        ).exclude(provider_item_id="").select_related("organization"):
            reales = seats_in_use(sub.organization)
            if reales == sub.quantity:
                continue
            pendientes += 1
            self.stdout.write(f"{sub.organization.slug}: {sub.quantity} → {reales} puestos")
            if not dry_run and sync_seats(sub.organization):
                sincronizadas += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"[dry-run] {pendientes} por sincronizar."))
            return
        fallidas = pendientes - sincronizadas
        estilo = self.style.WARNING if fallidas else self.style.SUCCESS
        self.stdout.write(
            estilo(f"{sincronizadas} sincronizada(s), {fallidas} sin poder contactar al proveedor.")
        )
