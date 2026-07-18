"""
Crea la organización 'default' SOLO si la base ya tiene datos (usuarios o
actividades pre-multi-tenancy que necesitan un dueño). Las instalaciones
nuevas no reciben ninguna organización fantasma: la crea el seed o el signup.
"""
from django.db import migrations


def create_default_org(apps, schema_editor):
    User = apps.get_model("users", "User")
    Activity = apps.get_model("activities", "Activity")
    if not User.objects.exists() and not Activity.objects.exists():
        return
    Organization = apps.get_model("organizations", "Organization")
    Organization.objects.get_or_create(
        slug="default",
        defaults={"nombre": "Mi Organización", "codigo_prefix": "ACT"},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0001_initial"),
        ("users", "0003_user_coordinador_alter_user_rol"),
        ("activities", "0006_activity_proyecto"),
    ]

    operations = [
        migrations.RunPython(create_default_org, migrations.RunPython.noop),
    ]
