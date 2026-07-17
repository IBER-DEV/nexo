"""
python manage.py seed_data

Creates 8 team users + 42 activities matching the frontend mock data.
Safe to run multiple times (idempotent).
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from apps.organizations.models import Organization
from apps.users.models import User
from apps.activities.models import Activity, Aplicacion, Cliente, Proceso, Stakeholder


SEED_USERS = [
    {"email": "ana.garcia@empresa.com",    "nombre": "Ana García",     "rol": "coordinator"},
    {"email": "carlos.perez@empresa.com",  "nombre": "Carlos Pérez",   "rol": "coordinator"},
    {"email": "maria.lopez@empresa.com",   "nombre": "María López",    "rol": "member"},
    {"email": "jorge.ramirez@empresa.com", "nombre": "Jorge Ramírez",  "rol": "member"},
    {"email": "lucia.torres@empresa.com",  "nombre": "Lucía Torres",   "rol": "member"},
    {"email": "diego.vargas@empresa.com",  "nombre": "Diego Vargas",   "rol": "member"},
    {"email": "sofia.mendoza@empresa.com", "nombre": "Sofía Mendoza",  "rol": "member"},
    {"email": "pablo.castro@empresa.com",  "nombre": "Pablo Castro",   "rol": "member"},
]

EMPRESAS = ["Acme Corp", "Globex", "Initech", "Umbrella", "Soylent"]
APLICACIONES = ["SAP ERP", "Salesforce CRM", "Oracle DB", "Jira Cloud", "Power BI", "Active Directory"]
PROCESOS = ["Facturación", "Compras", "RRHH", "Soporte N2", "Infraestructura", "Seguridad"]
STAKEHOLDERS = ["Gerencia Comercial", "Operaciones", "Finanzas", "Recursos Humanos", "Dirección TI"]
NOMBRES = [
    "Migración de base de datos",
    "Integración API de pagos",
    "Actualización de servidores",
    "Refactor módulo facturación",
    "Implementar SSO corporativo",
    "Auditoría de seguridad",
    "Reporte ejecutivo mensual",
    "Sincronización con SAP",
    "Configuración de backups",
    "Despliegue ambiente staging",
    "Optimización de consultas SQL",
    "Migración a la nube",
    "Onboarding usuarios CRM",
    "Tablero KPI gerencial",
    "Parche crítico de seguridad",
]
STATUSES = [s[0] for s in Activity.Status.choices]
PRIORITIES = [p[0] for p in Activity.Priority.choices]


def mulberry32(seed):
    """Deterministic PRNG — same as the frontend mock to produce identical data."""
    state = [seed]

    def rand():
        t = state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = (t ^ (t >> 15)) & 0xFFFFFFFF
        t = (t * ((t | 1) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t = (t ^ (t + (t ^ (t >> 7)) * ((t | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rand


class Command(BaseCommand):
    help = "Seeds the database with demo users and activities"

    def handle(self, *args, **options):
        self.stdout.write("Seeding organization...")
        org, org_created = Organization.objects.get_or_create(
            slug="demo",
            defaults={"nombre": "Nexo Demo", "codigo_prefix": "ACT"},
        )
        self.stdout.write(f"  {'Created' if org_created else 'Exists '} {org.nombre}")

        self.stdout.write("Seeding users...")
        users = []
        coordinators_by_email = {}
        for data in SEED_USERS:
            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={"nombre": data["nombre"], "rol": data["rol"], "organization": org},
            )
            if created:
                user.set_password("demo1234")
                user.save()
                self.stdout.write(f"  Created {user.nombre}")
            else:
                # Keep seed deterministic if roles changed between versions.
                if user.rol not in {"admin", "coordinator", "member"}:
                    user.rol = data["rol"]
                    user.save(update_fields=["rol"])
                if user.organization_id is None:
                    user.organization = org
                    user.save(update_fields=["organization"])
                self.stdout.write(f"  Exists  {user.nombre}")
            users.append(user)
            if user.rol == "coordinator":
                coordinators_by_email[user.email] = user

        # Create admin superuser if missing
        admin, created = User.objects.get_or_create(
            email="admin@empresa.com",
            defaults={"nombre": "Administrador", "rol": "admin", "organization": org},
        )
        if created:
            admin.set_password("demo1234")
            admin.is_staff = True
            admin.is_superuser = True
            admin.save()
            self.stdout.write("  Created admin@empresa.com (superuser)")
        else:
            changed = False
            if admin.rol != "admin":
                admin.rol = "admin"
                changed = True
            if not admin.is_staff:
                admin.is_staff = True
                changed = True
            if not admin.is_superuser:
                admin.is_superuser = True
                changed = True
            if admin.organization_id is None:
                admin.organization = org
                changed = True
            if changed:
                admin.save()

        # Assign members to coordinators (idempotent)
        # Ana coordina: María, Jorge, Lucía, Diego
        # Carlos coordina: Sofía, Pablo
        ana = coordinators_by_email.get("ana.garcia@empresa.com")
        carlos = coordinators_by_email.get("carlos.perez@empresa.com")
        if ana:
            User.objects.filter(email__in=[
                "maria.lopez@empresa.com",
                "jorge.ramirez@empresa.com",
                "lucia.torres@empresa.com",
                "diego.vargas@empresa.com",
            ]).update(coordinador=ana, rol="member")
        if carlos:
            User.objects.filter(email__in=[
                "sofia.mendoza@empresa.com",
                "pablo.castro@empresa.com",
            ]).update(coordinador=carlos, rol="member")

        self.stdout.write("Seeding catalogs...")
        clientes = {
            n: Cliente.objects.get_or_create(organization=org, nombre=n)[0] for n in EMPRESAS
        }
        procesos = {
            n: Proceso.objects.get_or_create(organization=org, nombre=n)[0] for n in PROCESOS
        }
        aplicaciones = {
            n: Aplicacion.objects.get_or_create(organization=org, nombre=n)[0]
            for n in APLICACIONES
        }
        stakeholders = {
            n: Stakeholder.objects.get_or_create(organization=org, nombre=n)[0]
            for n in STAKEHOLDERS
        }

        self.stdout.write("Seeding activities...")
        rand = mulberry32(42)

        def pick(lst):
            return lst[int(rand() * len(lst))]

        today = date.today()
        created_count = 0

        for i in range(1, 43):
            days_back = int(rand() * 60)
            inicio = today - timedelta(days=days_back)
            limite = inicio + timedelta(days=5 + int(rand() * 40))

            if inicio.day <= 7:
                semana = 1
            elif inicio.day <= 14:
                semana = 2
            elif inicio.day <= 21:
                semana = 3
            elif inicio.day <= 28:
                semana = 4
            else:
                semana = 5
            mes_planeacion = inicio.strftime("%Y-%m")

            user = pick(users)
            defaults = {
                "organization": org,
                "cliente": clientes[pick(EMPRESAS)],
                "proceso": procesos[pick(PROCESOS)],
                "aplicacion": aplicaciones[pick(APLICACIONES)],
                "nombre": pick(NOMBRES),
                "descripcion": "Tarea técnica asignada al equipo de sistemas con seguimiento semanal.",
                "responsable": user,
                "stakeholder": stakeholders[pick(STAKEHOLDERS)],
                "mes_planeacion": mes_planeacion,
                "semana_planeacion": semana,
                "prioridad": pick(PRIORITIES),
                "estado": pick(STATUSES),
                "fecha_inicio": inicio,
                "fecha_limite": limite,
            }
            # Use pk to keep IDs stable across re-runs
            activity, created = Activity.objects.get_or_create(pk=i, defaults=defaults)
            if created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {created_count} activities created (existing ones untouched)."
        ))
        self.stdout.write("\nLogin credentials:")
        self.stdout.write("  admin@empresa.com / demo1234  (superuser)")
        self.stdout.write("  ana.garcia@empresa.com / demo1234")
        self.stdout.write("  (all team users use password: demo1234)")
