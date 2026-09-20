"""`Activity.proyecto` deja de ser texto libre y pasa a ser una relación.

Esta migración NO es la que genera `makemigrations` sola. El autogenerado
es un `AlterField` de CharField a ForeignKey, que en Postgres intenta
castear el texto a un id y, en el mejor caso, deja la columna en NULL: se
perderían los nombres de proyecto que el sync de AppSheet lleva escribiendo
desde la migración 0006. Acá se hace en cuatro pasos para conservarlos:

  1. renombrar la columna de texto a `proyecto_legacy`,
  2. crear la FK `proyecto` vacía,
  3. convertir cada texto distinto (por organización) en un `Project` real
     y apuntar las actividades hacia él,
  4. borrar la columna vieja.

El paso 3 es reversible en el sentido de que `backwards` devuelve el texto
a su columna, así que un rollback no pierde información.
"""
import django.db.models.deletion
from django.db import migrations, models


def texto_a_proyectos(apps, schema_editor):
    Activity = apps.get_model("activities", "Activity")
    Project = apps.get_model("projects", "Project")
    Organization = apps.get_model("organizations", "Organization")

    # (organization_id, nombre_normalizado) → Project. Se agrupa por
    # organización porque el mismo nombre de proyecto en dos tenants son dos
    # proyectos distintos, no uno compartido.
    cache: dict[tuple[int, str], object] = {}
    pendientes = (
        Activity.objects.exclude(proyecto_legacy="")
        .exclude(proyecto_legacy=None)
        .values_list("pk", "organization_id", "proyecto_legacy")
    )

    for activity_pk, org_id, texto in pendientes:
        nombre = (texto or "").strip()
        if not nombre:
            continue
        key = (org_id, nombre.casefold())
        project = cache.get(key)
        if project is None:
            project = (
                Project.objects.filter(organization_id=org_id, nombre__iexact=nombre).first()
            )
        if project is None:
            org = Organization.objects.get(pk=org_id)
            # El numero se asigna a mano: en una migración no se puede usar
            # SequenceService, que trabaja sobre el modelo real y no sobre
            # el histórico de `apps.get_model`.
            project = Project.objects.create(
                organization_id=org_id,
                numero=org.next_project_numero,
                nombre=nombre,
                # Estos proyectos vienen de datos existentes: nadie eligió su
                # estado. "En curso" es el supuesto honesto —tienen
                # actividades vivas— y el usuario lo corrige desde la UI.
                estado="active",
            )
            org.next_project_numero += 1
            org.save(update_fields=["next_project_numero"])
        cache[key] = project
        Activity.objects.filter(pk=activity_pk).update(proyecto=project)


def proyectos_a_texto(apps, schema_editor):
    Activity = apps.get_model("activities", "Activity")
    for pk, nombre in Activity.objects.exclude(proyecto=None).values_list(
        "pk", "proyecto__nombre"
    ):
        Activity.objects.filter(pk=pk).update(proyecto_legacy=nombre or "")


class Migration(migrations.Migration):
    dependencies = [
        ("activities", "0009_workflow_states_priorities"),
        ("projects", "0001_initial"),
        ("organizations", "0006_organization_next_project_numero"),
    ]

    operations = [
        migrations.RenameField(
            model_name="activity",
            old_name="proyecto",
            new_name="proyecto_legacy",
        ),
        migrations.AddField(
            model_name="activity",
            name="proyecto",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="activities",
                to="projects.project",
            ),
        ),
        migrations.RunPython(texto_a_proyectos, proyectos_a_texto),
        migrations.RemoveField(model_name="activity", name="proyecto_legacy"),
    ]
