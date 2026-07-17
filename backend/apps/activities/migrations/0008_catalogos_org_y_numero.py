"""
E2 del bloque multi-tenancy:
- Empresa se renombra a Cliente (para no confundir con Organization).
- Cliente/Proceso/Aplicacion ganan dueño (organization) e is_active; nace
  el catálogo Stakeholder.
- Activity pasa de strings sueltos a FKs de catálogo y gana `numero`
  (secuencia por organización). El backfill usa numero = pk para que los
  códigos ACT-#### ya escritos en la Google Sheet (FlowDeskID) sigan
  resolviendo en la org existente.
"""
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def convert_data(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Activity = apps.get_model("activities", "Activity")
    Cliente = apps.get_model("activities", "Cliente")
    Proceso = apps.get_model("activities", "Proceso")
    Aplicacion = apps.get_model("activities", "Aplicacion")
    Stakeholder = apps.get_model("activities", "Stakeholder")

    first_org = Organization.objects.order_by("pk").first()

    # Catálogos pre-existentes (globales): pasan a la primera org; si no hay
    # ninguna org no puede haber actividades — son restos de autocompletado
    # y se descartan.
    for model in (Cliente, Proceso, Aplicacion):
        if first_org is not None:
            model.objects.filter(organization__isnull=True).update(organization=first_org)
        else:
            model.objects.filter(organization__isnull=True).delete()

    def get_or_create(model, org, nombre):
        nombre = (nombre or "").strip()
        if not nombre:
            return None
        existing = model.objects.filter(organization=org, nombre__iexact=nombre).first()
        if existing is not None:
            return existing
        return model.objects.create(organization=org, nombre=nombre)

    max_numero_by_org = {}
    for activity in Activity.objects.select_related("organization").iterator():
        org = activity.organization
        activity.cliente = get_or_create(Cliente, org, activity.empresa)
        activity.proceso_fk = get_or_create(Proceso, org, activity.proceso)
        activity.aplicacion_fk = get_or_create(Aplicacion, org, activity.aplicacion)
        activity.stakeholder_fk = get_or_create(Stakeholder, org, activity.stakeholder)
        activity.numero = activity.pk
        activity.save(
            update_fields=["cliente", "proceso_fk", "aplicacion_fk", "stakeholder_fk", "numero"]
        )
        max_numero_by_org[org.pk] = max(max_numero_by_org.get(org.pk, 0), activity.numero)

    for org_pk, max_numero in max_numero_by_org.items():
        Organization.objects.filter(pk=org_pk).update(next_activity_numero=max_numero + 1)


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_default_org"),
        ("activities", "0007_activity_organization"),
    ]

    operations = [
        migrations.RenameModel(old_name="Empresa", new_name="Cliente"),
        migrations.AlterModelOptions(
            name="cliente",
            options={"ordering": ["nombre"], "verbose_name": "cliente", "verbose_name_plural": "clientes"},
        ),
        # Catálogos: dueño + is_active; la unicidad global de nombre pasa a ser por org.
        migrations.AddField(
            model_name="cliente",
            name="organization",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clientes",
                to="organizations.organization",
            ),
        ),
        migrations.AddField(
            model_name="cliente", name="is_active", field=models.BooleanField(default=True)
        ),
        migrations.AlterField(
            model_name="cliente", name="nombre", field=models.CharField(max_length=100)
        ),
        migrations.AddField(
            model_name="proceso",
            name="organization",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="procesos",
                to="organizations.organization",
            ),
        ),
        migrations.AddField(
            model_name="proceso", name="is_active", field=models.BooleanField(default=True)
        ),
        migrations.AlterField(
            model_name="proceso", name="nombre", field=models.CharField(max_length=100)
        ),
        migrations.AddField(
            model_name="aplicacion",
            name="organization",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="aplicaciones",
                to="organizations.organization",
            ),
        ),
        migrations.AddField(
            model_name="aplicacion", name="is_active", field=models.BooleanField(default=True)
        ),
        migrations.AlterField(
            model_name="aplicacion", name="nombre", field=models.CharField(max_length=100)
        ),
        migrations.CreateModel(
            name="Stakeholder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stakeholders",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "verbose_name": "stakeholder",
                "verbose_name_plural": "stakeholders",
                "ordering": ["nombre"],
            },
        ),
        # Activity: numero + FKs temporales (los CharField viejos siguen vivos
        # hasta después de la conversión de datos).
        migrations.AddField(
            model_name="activity",
            name="numero",
            field=models.PositiveIntegerField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="activity",
            name="cliente",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.cliente",
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="proceso_fk",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.proceso",
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="aplicacion_fk",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.aplicacion",
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="stakeholder_fk",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="activities.stakeholder",
            ),
        ),
        migrations.RunPython(convert_data, migrations.RunPython.noop),
        # Retirar los CharField viejos y consolidar nombres finales.
        migrations.RemoveField(model_name="activity", name="empresa"),
        migrations.RemoveField(model_name="activity", name="proceso"),
        migrations.RemoveField(model_name="activity", name="aplicacion"),
        migrations.RemoveField(model_name="activity", name="stakeholder"),
        migrations.RenameField(model_name="activity", old_name="proceso_fk", new_name="proceso"),
        migrations.RenameField(model_name="activity", old_name="aplicacion_fk", new_name="aplicacion"),
        migrations.RenameField(model_name="activity", old_name="stakeholder_fk", new_name="stakeholder"),
        # Endurecer: catálogos con dueño obligatorio, numero obligatorio.
        migrations.AlterField(
            model_name="cliente",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clientes",
                to="organizations.organization",
            ),
        ),
        migrations.AlterField(
            model_name="proceso",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="procesos",
                to="organizations.organization",
            ),
        ),
        migrations.AlterField(
            model_name="aplicacion",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="aplicaciones",
                to="organizations.organization",
            ),
        ),
        migrations.AlterField(
            model_name="activity",
            name="numero",
            field=models.PositiveIntegerField(editable=False),
        ),
        # Unicidad por organización.
        migrations.AddConstraint(
            model_name="cliente",
            constraint=models.UniqueConstraint(
                fields=("organization", "nombre"), name="uniq_cliente_nombre_per_org"
            ),
        ),
        migrations.AddConstraint(
            model_name="proceso",
            constraint=models.UniqueConstraint(
                fields=("organization", "nombre"), name="uniq_proceso_nombre_per_org"
            ),
        ),
        migrations.AddConstraint(
            model_name="aplicacion",
            constraint=models.UniqueConstraint(
                fields=("organization", "nombre"), name="uniq_aplicacion_nombre_per_org"
            ),
        ),
        migrations.AddConstraint(
            model_name="stakeholder",
            constraint=models.UniqueConstraint(
                fields=("organization", "nombre"), name="uniq_stakeholder_nombre_per_org"
            ),
        ),
        migrations.AddConstraint(
            model_name="activity",
            constraint=models.UniqueConstraint(
                fields=("organization", "numero"), name="uniq_activity_numero_per_org"
            ),
        ),
    ]
