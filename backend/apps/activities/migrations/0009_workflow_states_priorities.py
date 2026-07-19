"""
E3a del bloque multi-tenancy: WorkflowState y Priority reemplazan los enums
fijos Activity.Status / Activity.Priority; nace ActivityType (opcional).

La migración duplica inline la tabla de estados/prioridades por defecto (no
importa apps.activities.org_templates) porque una migración histórica debe
seguir funcionando exactamente igual aunque ese módulo cambie después.
"""
import django.db.models.deletion
from django.db import migrations, models


# slug, nombre, categoria, color, orden, is_initial, mostrar_en_kanban, sheet_phase
DEFAULT_STATES = [
    ("backlog", "Backlog", "todo", "#7C8A93", 0, True, True, "No iniciada"),
    ("in_progress", "En progreso", "active", "#29AFF5", 1, False, True, "En Proceso"),
    ("testing", "En pruebas", "active", "#F0A93B", 2, False, True, "En Proceso"),
    ("pending_client", "Pendiente cliente", "active", "#5B6EF5", 3, False, False, "En Proceso"),
    ("done", "Finalizado", "done", "#22B573", 4, False, True, "Finalizada"),
    ("cancelled", "Cancelado", "cancelled", "#7C8A93", 5, False, False, "Cancelado"),
]
# slug, nombre, color, orden, is_default
DEFAULT_PRIORITIES = [
    ("low", "Baja", "#7C8A93", 0, False),
    ("medium", "Media", "#29AFF5", 1, True),
    ("high", "Alta", "#F0A93B", 2, False),
    ("critical", "Crítica", "#E5484D", 3, False),
]


def convert_data(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Activity = apps.get_model("activities", "Activity")
    WorkflowState = apps.get_model("activities", "WorkflowState")
    Priority = apps.get_model("activities", "Priority")

    orgs_with_data = set(
        Activity.objects.values_list("organization_id", flat=True).distinct()
    )
    for org in Organization.objects.all():
        # Solo materializar maestros para orgs con actividades a convertir;
        # una org nueva sin datos legacy los recibe del seed/onboarding, no
        # de esta migración.
        if org.pk not in orgs_with_data:
            continue
        for slug, nombre, categoria, color, orden, is_initial, mostrar, sheet_phase in DEFAULT_STATES:
            WorkflowState.objects.get_or_create(
                organization=org,
                slug=slug,
                defaults={
                    "nombre": nombre,
                    "categoria": categoria,
                    "color": color,
                    "orden": orden,
                    "is_initial": is_initial,
                    "mostrar_en_kanban": mostrar,
                    "external_mappings": {"google_sheets": sheet_phase} if sheet_phase else {},
                },
            )
        for slug, nombre, color, orden, is_default in DEFAULT_PRIORITIES:
            Priority.objects.get_or_create(
                organization=org,
                slug=slug,
                defaults={"nombre": nombre, "color": color, "orden": orden, "is_default": is_default},
            )

    for activity in Activity.objects.select_related("organization").iterator():
        org = activity.organization
        activity.estado_fk = WorkflowState.objects.get(organization=org, slug=activity.estado)
        activity.prioridad_fk = Priority.objects.get(organization=org, slug=activity.prioridad)
        activity.save(update_fields=["estado_fk", "prioridad_fk"])


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_default_org"),
        ("activities", "0008_catalogos_org_y_numero"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkflowState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("slug", models.SlugField(max_length=100)),
                ("color", models.CharField(max_length=7)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                (
                    "categoria",
                    models.CharField(
                        choices=[
                            ("todo", "Por hacer"),
                            ("active", "En curso"),
                            ("done", "Finalizado"),
                            ("cancelled", "Cancelado"),
                        ],
                        max_length=20,
                    ),
                ),
                ("is_initial", models.BooleanField(default=False)),
                ("mostrar_en_kanban", models.BooleanField(default=True)),
                ("external_mappings", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="workflow_states",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "estado de flujo",
                "verbose_name_plural": "estados de flujo",
                "ordering": ["orden", "pk"],
            },
        ),
        migrations.CreateModel(
            name="Priority",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("slug", models.SlugField(max_length=100)),
                ("color", models.CharField(max_length=7)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("is_default", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="priorities",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "prioridad",
                "verbose_name_plural": "prioridades",
                "ordering": ["orden", "pk"],
            },
        ),
        migrations.CreateModel(
            name="ActivityType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("slug", models.SlugField(max_length=100)),
                ("color", models.CharField(max_length=7)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_types",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "tipo de actividad",
                "verbose_name_plural": "tipos de actividad",
                "ordering": ["orden", "nombre"],
            },
        ),
        migrations.AddConstraint(
            model_name="workflowstate",
            constraint=models.UniqueConstraint(fields=("organization", "slug"), name="uniq_state_slug_per_org"),
        ),
        migrations.AddConstraint(
            model_name="workflowstate",
            constraint=models.UniqueConstraint(fields=("organization", "nombre"), name="uniq_state_nombre_per_org"),
        ),
        migrations.AddConstraint(
            model_name="workflowstate",
            constraint=models.UniqueConstraint(
                fields=("organization",),
                condition=models.Q(("is_initial", True)),
                name="one_initial_state_per_org",
            ),
        ),
        migrations.AddConstraint(
            model_name="priority",
            constraint=models.UniqueConstraint(fields=("organization", "slug"), name="uniq_priority_slug_per_org"),
        ),
        migrations.AddConstraint(
            model_name="priority",
            constraint=models.UniqueConstraint(fields=("organization", "nombre"), name="uniq_priority_nombre_per_org"),
        ),
        migrations.AddConstraint(
            model_name="priority",
            constraint=models.UniqueConstraint(
                fields=("organization",),
                condition=models.Q(("is_default", True)),
                name="one_default_priority_per_org",
            ),
        ),
        migrations.AddConstraint(
            model_name="activitytype",
            constraint=models.UniqueConstraint(fields=("organization", "slug"), name="uniq_type_slug_per_org"),
        ),
        migrations.AddConstraint(
            model_name="activitytype",
            constraint=models.UniqueConstraint(fields=("organization", "nombre"), name="uniq_type_nombre_per_org"),
        ),
        migrations.AddField(
            model_name="activity",
            name="tipo",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="activities",
                to="activities.activitytype",
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="estado_fk",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.workflowstate",
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="prioridad_fk",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.priority",
            ),
        ),
        migrations.RunPython(convert_data, migrations.RunPython.noop),
        migrations.RemoveField(model_name="activity", name="estado"),
        migrations.RemoveField(model_name="activity", name="prioridad"),
        migrations.RenameField(model_name="activity", old_name="estado_fk", new_name="estado"),
        migrations.RenameField(model_name="activity", old_name="prioridad_fk", new_name="prioridad"),
        migrations.AlterField(
            model_name="activity",
            name="estado",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.workflowstate",
            ),
        ),
        migrations.AlterField(
            model_name="activity",
            name="prioridad",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.priority",
            ),
        ),
    ]
