from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=200)),
                ("slug", models.SlugField(unique=True)),
                ("codigo_prefix", models.CharField(blank=True, default="", max_length=10)),
                ("timezone", models.CharField(default="America/Bogota", max_length=50)),
                ("locale", models.CharField(default="es", max_length=10)),
                ("currency", models.CharField(default="USD", max_length=3)),
                (
                    "plan",
                    models.CharField(
                        choices=[
                            ("community", "Community"),
                            ("cloud", "Cloud"),
                            ("enterprise", "Enterprise"),
                        ],
                        default="community",
                        max_length=20,
                    ),
                ),
                ("feature_flags", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("appsheet_spreadsheet_id", models.CharField(blank=True, default="", max_length=100)),
                ("appsheet_worksheet_name", models.CharField(blank=True, default="", max_length=100)),
                ("next_activity_numero", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "organización",
                "verbose_name_plural": "organizaciones",
                "ordering": ["nombre"],
            },
        ),
    ]
