"""
python manage.py seed_data

Creates 8 team users + 42 activities matching the frontend mock data.
Safe to run multiple times (idempotent).
"""
from datetime import date, timedelta
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from apps.organizations.models import Organization
from apps.users.models import User
from apps.activities.org_templates import apply_template
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

        # Un usuario demo compartido por rol (/auth/demo-login/, sin
        # password) — deja ver la interacción *real* por rol (qué ve un
        # coordinador vs. un member), no una preview mockeada. Owner/admin/
        # coordinator no necesitan datos extra para ser útiles; member sí
        # (ActivityViewSet lo filtra a solo lo suyo — se reasignan algunas
        # actividades más abajo, después de sembrarlas). is_demo_readonly
        # bloquea cualquier escritura suya en toda la API sin importar el
        # rol, así que cada uno es seguro con el alcance real de su rol.
        demo_users: dict[str, User] = {}
        for role in settings.DEMO_ROLES:
            email = settings.DEMO_EMAIL_TEMPLATE.format(role=role)
            u, u_created = User.objects.get_or_create(
                email=email,
                defaults={"nombre": f"Demo {role}", "rol": role, "organization": org},
            )
            if u_created:
                u.set_unusable_password()
                u.is_demo_readonly = True
                u.save()
                self.stdout.write(f"  Created {u.email} (demo pública, {role})")
            else:
                changed = False
                if u.rol != role:
                    u.rol = role
                    changed = True
                if not u.is_demo_readonly:
                    u.is_demo_readonly = True
                    changed = True
                if changed:
                    u.save()
            demo_users[role] = u

        # Assign members to coordinators (idempotent)
        # Ana coordina: María, Lucía — Jorge y Diego pasan al demo-coordinator
        # (necesita equipo propio para que el rol demuestre algo real).
        # Carlos coordina: Sofía, Pablo
        ana = coordinators_by_email.get("ana.garcia@empresa.com")
        carlos = coordinators_by_email.get("carlos.perez@empresa.com")
        demo_coordinator = demo_users["coordinator"]
        if ana:
            User.objects.filter(email__in=[
                "maria.lopez@empresa.com",
                "lucia.torres@empresa.com",
            ]).update(coordinador=ana, rol="member")
        User.objects.filter(email__in=[
            "jorge.ramirez@empresa.com",
            "diego.vargas@empresa.com",
        ]).update(coordinador=demo_coordinator, rol="member")
        if carlos:
            User.objects.filter(email__in=[
                "sofia.mendoza@empresa.com",
                "pablo.castro@empresa.com",
            ]).update(coordinador=carlos, rol="member")

        self.stdout.write("Seeding workflow masters...")
        apply_template(org, "ti_clasico", WorkflowState, Priority, ActivityType)
        states = {s.slug: s for s in WorkflowState.objects.for_org(org)}
        priorities = {p.slug: p for p in Priority.objects.for_org(org)}

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
                "prioridad": priorities[pick(list(priorities))],
                "estado": states[pick(list(states))],
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

        # demo-member necesita ser responsable de algo — ActivityViewSet
        # filtra a member a solo lo suyo (responsable/created_by). Sin esto
        # vería el dashboard vacío, igual que pasaba con el demo-admin
        # cuando todavía era un único usuario con rol=member.
        Activity.objects.filter(organization=org, pk__in=[1, 2, 3, 4, 5]).update(
            responsable=demo_users["member"]
        )

        acme_created_count = self._seed_acme(today)

        self.stdout.write(self.style.SUCCESS(
            f"Done. {acme_created_count} Acme Ltd activities created (existing ones untouched)."
        ))
        self.stdout.write("\nLogin credentials:")
        self.stdout.write("  admin@empresa.com / demo1234  (superuser, org 'demo')")
        self.stdout.write("  ana.garcia@empresa.com / demo1234")
        self.stdout.write("  admin@acme.com / demo1234  (superuser, org 'acme' — flujo propio)")
        self.stdout.write("  (all team users use password: demo1234)")
        for role in settings.DEMO_ROLES:
            email = settings.DEMO_EMAIL_TEMPLATE.format(role=role)
            self.stdout.write(
                f"  {email}  (demo pública, {role} — via POST /auth/demo-login/ {{\"role\":\"{role}\"}}, sin password)"
            )

        self._fix_activity_id_sequence()

    def _fix_activity_id_sequence(self) -> None:
        """Los `pk=i` explícitos de arriba (y los `pk=9000+i` de Acme) dejan
        la secuencia de Postgres del id de Activity atrasada — el próximo
        INSERT sin pk explícito (cualquier actividad creada normalmente
        desde la API) intentaría reusar un id ya ocupado y volaría con
        IntegrityError. SQLite no tiene este problema (calcula MAX(rowid)+1
        en cada insert), así que esto solo aplica a Postgres."""
        if connection.vendor != "postgresql":
            return
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence('activities_activity', 'id'), "
                "COALESCE((SELECT MAX(id) FROM activities_activity), 1), "
                "(SELECT MAX(id) FROM activities_activity) IS NOT NULL)"
            )

    def _seed_acme(self, today: date) -> int:
        """Segunda organización de demo: plantilla "kanban_simple" (4
        estados, no 6) para probar aislamiento, Kanban dinámico y las
        plantillas de flujo a mano."""
        self.stdout.write("\nSeeding second organization (Acme Ltd)...")
        acme, acme_created = Organization.objects.get_or_create(
            slug="acme",
            defaults={"nombre": "Acme Ltd", "codigo_prefix": "ACM"},
        )
        self.stdout.write(f"  {'Created' if acme_created else 'Exists '} {acme.nombre}")

        acme_admin, created = User.objects.get_or_create(
            email="admin@acme.com",
            defaults={"nombre": "Admin Acme", "rol": "admin", "organization": acme},
        )
        if created:
            acme_admin.set_password("demo1234")
            acme_admin.is_staff = True
            acme_admin.is_superuser = True
            acme_admin.save()
            self.stdout.write("  Created admin@acme.com (superuser)")

        apply_template(acme, "kanban_simple", WorkflowState, Priority, ActivityType)

        acme_states = {s.slug: s for s in WorkflowState.objects.for_org(acme)}
        acme_priorities = {p.slug: p for p in Priority.objects.for_org(acme)}
        acme_cliente = Cliente.objects.get_or_create(organization=acme, nombre="Acme Corp")[0]
        acme_proceso = Proceso.objects.get_or_create(organization=acme, nombre="Operaciones")[0]
        acme_app = Aplicacion.objects.get_or_create(organization=acme, nombre="Sistema Interno")[0]

        ACME_ACTIVITIES = [
            ("Configurar VPN para equipo remoto", "pendiente"),
            ("Renovar certificado SSL", "en-curso"),
            ("Migrar correo a Google Workspace", "hecho"),
            ("Documentar proceso de onboarding", "pendiente"),
            ("Revisar accesos de exempleados", "descartado"),
        ]
        created_count = 0
        for i, (nombre, estado_slug) in enumerate(ACME_ACTIVITIES, start=1):
            pk = 9000 + i
            inicio = today - timedelta(days=i * 3)
            defaults = {
                "organization": acme,
                "cliente": acme_cliente,
                "proceso": acme_proceso,
                "aplicacion": acme_app,
                "nombre": nombre,
                "descripcion": "",
                "responsable": acme_admin,
                "mes_planeacion": inicio.strftime("%Y-%m"),
                "semana_planeacion": 1,
                "prioridad": acme_priorities["normal"],
                "estado": acme_states[estado_slug],
                "fecha_inicio": inicio,
                "fecha_limite": inicio + timedelta(days=14),
            }
            activity, created = Activity.objects.get_or_create(pk=pk, defaults=defaults)
            if created:
                created_count += 1
        return created_count
