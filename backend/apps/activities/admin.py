from django.contrib import admin
from .models import Activity, Cliente, Proceso, Aplicacion, Stakeholder


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = [
        "codigo",
        "nombre",
        "organization",
        "cliente",
        "mes_planeacion",
        "semana_planeacion",
        "responsable",
        "prioridad",
        "estado",
        "fecha_limite",
    ]
    list_filter = ["organization", "estado", "prioridad", "mes_planeacion", "semana_planeacion"]
    search_fields = ["nombre", "cliente__nombre", "aplicacion__nombre", "responsable__nombre", "mes_planeacion"]
    autocomplete_fields = ["responsable", "cliente", "proceso", "aplicacion", "stakeholder"]
    readonly_fields = ["numero", "created_at", "updated_at"]
    list_per_page = 50


class OrgCatalogAdmin(admin.ModelAdmin):
    list_display = ["nombre", "organization", "is_active"]
    list_filter = ["organization", "is_active"]
    search_fields = ["nombre"]
    list_per_page = 50


@admin.register(Cliente)
class ClienteAdmin(OrgCatalogAdmin):
    pass


@admin.register(Proceso)
class ProcesoAdmin(OrgCatalogAdmin):
    pass


@admin.register(Aplicacion)
class AplicacionAdmin(OrgCatalogAdmin):
    pass


@admin.register(Stakeholder)
class StakeholderAdmin(OrgCatalogAdmin):
    pass
