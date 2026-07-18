import django.db.models.deletion
from django.db import migrations, models


def backfill_org(apps, schema_editor):
    Activity = apps.get_model("activities", "Activity")
    if not Activity.objects.filter(organization__isnull=True).exists():
        return
    Organization = apps.get_model("organizations", "Organization")
    default = Organization.objects.filter(slug="default").first()
    if default is not None:
        Activity.objects.filter(organization__isnull=True).update(organization=default)


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_default_org"),
        ("activities", "0006_activity_proyecto"),
    ]

    operations = [
        # Se agrega nullable, se backfillea a la org 'default' (creada en
        # organizations/0002 solo si había datos) y se endurece a NOT NULL.
        migrations.AddField(
            model_name="activity",
            name="organization",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="activities",
                to="organizations.organization",
            ),
        ),
        migrations.RunPython(backfill_org, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="activity",
            name="organization",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="activities",
                to="organizations.organization",
            ),
        ),
    ]
