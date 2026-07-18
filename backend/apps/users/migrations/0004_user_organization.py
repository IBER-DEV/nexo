import django.db.models.deletion
from django.db import migrations, models


def backfill_org(apps, schema_editor):
    User = apps.get_model("users", "User")
    if not User.objects.filter(organization__isnull=True).exists():
        return
    Organization = apps.get_model("organizations", "Organization")
    default = Organization.objects.filter(slug="default").first()
    if default is not None:
        User.objects.filter(organization__isnull=True).update(organization=default)


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0002_default_org"),
        ("users", "0003_user_coordinador_alter_user_rol"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="users",
                to="organizations.organization",
            ),
        ),
        migrations.RunPython(backfill_org, migrations.RunPython.noop),
    ]
