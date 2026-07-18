from django.contrib import admin
from .models import (
    Activity,
    ActivityType,
    Aplicacion,
    Cliente,
    Priority,
    Proceso,
    Stakeholder,
    WorkflowState,
)


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


class OrgMasterAdmin(admin.ModelAdmin):
    list_display = ["nombre", "organization", "color", "orden", "is_active"]
    list_filter = ["organization", "is_active"]
    search_fields = ["nombre"]
    list_per_page = 50


@admin.register(WorkflowState)
class WorkflowStateAdmin(OrgMasterAdmin):
    list_display = OrgMasterAdmin.list_display + ["categoria", "is_initial", "mostrar_en_kanban"]
    list_filter = OrgMasterAdmin.list_filter + ["categoria", "is_initial"]


@admin.register(Priority)
class PriorityAdmin(OrgMasterAdmin):
    list_display = OrgMasterAdmin.list_display + ["is_default"]


@admin.register(ActivityType)
class ActivityTypeAdmin(OrgMasterAdmin):
    pass
