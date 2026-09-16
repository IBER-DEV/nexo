"""Nexo pasa a ser gratis en todas sus versiones: no hay planes que guardar.

Se borra el campo junto con la app `billing` entera (suscripciones, checkout,
webhooks, límites de puestos). El dato que se pierde es el tier comercial de
cada organización, que ya no significa nada: ninguna feature vive detrás de
un plan y no hay topes por plan que resolver.

**Por qué las tablas de billing se tumban acá y no en su propia app:** al
borrar `apps.billing` del proyecto desaparecen también sus migraciones, y
Django no genera un `DeleteModel` para una app que ya no existe — sus tablas
se quedarían huérfanas para siempre. Va como RunSQL en la app que sí
sobrevive, y en el orden inverso a las FKs (todas apuntan a
`organizations_organization`).
"""
from django.db import migrations

BILLING_TABLES = [
    "billing_checkoutsession",
    "billing_webhookevent",
    "billing_subscription",
    "billing_billingcustomer",
]


def drop_billing_tables(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for tabla in BILLING_TABLES:
            cursor.execute(
                f"DROP TABLE IF EXISTS {schema_editor.quote_name(tabla)}"
                # Postgres se queja si algo más apunta a la tabla; nada lo
                # hace, pero CASCADE lo vuelve independiente del orden.
                + (" CASCADE" if schema_editor.connection.vendor == "postgresql" else "")
            )
        # Sin esto, `showmigrations` sigue listando una app inexistente y un
        # `migrate` futuro la reporta como huérfana.
        cursor.execute("DELETE FROM django_migrations WHERE app = %s", ["billing"])


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_waitlistsignup"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="organization",
            name="plan",
        ),
        # Irreversible a propósito: recrear tablas vacías de un módulo que ya
        # no existe en el código no devuelve nada útil.
        migrations.RunPython(drop_billing_tables, migrations.RunPython.noop),
    ]
