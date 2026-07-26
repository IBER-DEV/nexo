"""Elimina una organización entera y todo lo que cuelga de ella.

Nace de un problema concreto: `seed_data` se corrió sobre la base de
producción de Railway y dejó ahí la organización `acme`, que solo existía
para probar aislamiento multi-tenant a mano. Borrarla desde el admin de
Django no funciona de un tirón —`Activity.responsable` y `User.organization`
son `PROTECT`— y descubrirlo a mitad de camino, en producción, es la peor
forma de enterarse.

**Es dry-run por defecto.** Sin `--execute` solo imprime el inventario de lo
que borraría. Esa asimetría es deliberada: el modo peligroso se pide
explícitamente, el informativo es el que sale si te equivocas de comando.

**Se niega a tocar la demo pública.** Una organización con usuarios
`is_demo_readonly` es la que alimenta los botones "Probar como {rol}" de la
landing; borrarla rompe la landing en producción sin que nada avise. Hay
`--force` para el caso legítimo (limpiar un staging), pero tiene que
escribirse a mano.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.activities.models import (
    Activity,
    ActivityType,
    Aplicacion,
    Cliente,
    Priority,
    Proceso,
    Stakeholder,
    WorkflowState,
)
from apps.organizations.models import Organization, OrganizationAccessCode
from apps.users.models import PersonalAccessToken, User


class Command(BaseCommand):
    help = "Elimina una organización y todos sus datos. Dry-run salvo que pases --execute."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="Slug de la organización a eliminar.")
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Ejecuta el borrado de verdad. Sin esto solo se muestra el inventario.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Permite borrar una organización que alimenta la demo pública.",
        )

    def handle(self, *args, **options):
        slug = options["slug"]
        ejecutar = options["execute"]
        forzar = options["force"]

        try:
            org = Organization.objects.get(slug=slug)
        except Organization.DoesNotExist:
            raise CommandError(f"No existe una organización con slug {slug!r}.")

        usuarios = User.objects.filter(organization=org)
        demo = usuarios.filter(is_demo_readonly=True)
        if demo.exists() and not forzar:
            raise CommandError(
                f"La organización {slug!r} tiene {demo.count()} usuario(s) de la demo "
                "pública: es la que alimenta los botones 'Probar como {rol}' de la "
                "landing. Si de verdad quieres borrarla, repite el comando con --force."
            )

        inventario = {
            "actividades": Activity.objects.filter(organization=org).count(),
            "usuarios": usuarios.count(),
            "tokens de acceso": PersonalAccessToken.objects.filter(
                user__organization=org
            ).count(),
            "códigos de acceso": OrganizationAccessCode.objects.filter(organization=org).count(),
            "estados de flujo": WorkflowState.objects.filter(organization=org).count(),
            "prioridades": Priority.objects.filter(organization=org).count(),
            "tipos de actividad": ActivityType.objects.filter(organization=org).count(),
            "clientes": Cliente.objects.filter(organization=org).count(),
            "procesos": Proceso.objects.filter(organization=org).count(),
            "aplicaciones": Aplicacion.objects.filter(organization=org).count(),
            "stakeholders": Stakeholder.objects.filter(organization=org).count(),
        }

        self.stdout.write(f"Organización: {org.nombre} (slug={org.slug}, plan={org.plan})")
        for etiqueta, cantidad in inventario.items():
            self.stdout.write(f"  {cantidad:>5}  {etiqueta}")

        superusuarios = list(usuarios.filter(is_superuser=True).values_list("email", flat=True))
        if superusuarios:
            self.stdout.write(
                self.style.WARNING(f"  Incluye superusuarios: {', '.join(superusuarios)}")
            )

        if not ejecutar:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n[dry-run] No se borró nada. Repite con --execute para aplicarlo."
                )
            )
            return

        with transaction.atomic():
            # El orden importa: Activity.responsable y User.organization son
            # PROTECT, así que hay que ir de adentro hacia afuera. Lo que
            # cuelga de la organización con CASCADE (maestros, catálogos,
            # facturación) se va solo al final.
            Activity.objects.filter(organization=org).delete()
            PersonalAccessToken.objects.filter(user__organization=org).delete()
            usuarios.delete()
            org.delete()

        self.stdout.write(self.style.SUCCESS(f"\nOrganización {slug!r} eliminada."))
