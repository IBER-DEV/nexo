"""Revierte a Community las organizaciones cuyo trial venció.

Por qué un comando y no un cálculo al vuelo: el acceso sí se resuelve en
caliente (`access.level_for_organization`), pero `Organization.plan` es un
valor guardado que lee media aplicación —y el admin de Django— y no puede
depender de que alguien haga una petición para actualizarse.

La fila del trial conserva `status=trialing` a propósito: es historia ("esta
organización probó Cloud"), y `effective_plan` ya expresa que hoy no le
otorga nada. No se inventa un estado nuevo para algo que es solo el paso del
tiempo.

Idempotente. En Railway va como cron diario; sin cron configurado, el único
efecto es que el plan guardado se queda desactualizado hasta que se corra
—no que alguien conserve acceso indebido.
"""
from django.core.management.base import BaseCommand

from apps.billing.models import Subscription
from apps.billing.service import sync_organization_plan


class Command(BaseCommand):
    help = "Revierte a Community las organizaciones con el periodo de prueba vencido."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué organizaciones cambiarían, sin escribir.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        cambiadas = 0
        for sub in Subscription.objects.filter(
            status=Subscription.Status.TRIALING
        ).select_related("organization"):
            if not sub.trial_expired:
                continue
            org = sub.organization
            if org.plan == sub.effective_plan:
                continue
            cambiadas += 1
            self.stdout.write(f"{org.slug}: {org.plan} → {sub.effective_plan}")
            if not dry_run:
                sync_organization_plan(sub)

        prefijo = "[dry-run] " if dry_run else ""
        self.stdout.write(
            self.style.SUCCESS(f"{prefijo}{cambiadas} organización(es) revertidas a Community.")
        )
