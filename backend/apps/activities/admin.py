from django.contrib import admin
from .models import Activity, Empresa, Proceso, Aplicacion


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = [
        "codigo",
        "nombre",
        "empresa",
        "mes_planeacion",
        "semana_planeacion",
        "responsable",
        "prioridad",
        "estado",
        "fecha_limite",
    ]
    list_filter = ["estado", "prioridad", "empresa", "mes_planeacion", "semana_planeacion"]
    search_fields = ["nombre", "empresa", "aplicacion", "responsable__nombre", "mes_planeacion"]
    autocomplete_fields = ["responsable"]
    readonly_fields = ["created_at", "updated_at"]
    list_per_page = 50


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ["nombre"]
    search_fields = ["nombre"]
    list_per_page = 50


@admin.register(Proceso)
class ProcesoAdmin(admin.ModelAdmin):
    list_display = ["nombre"]
    search_fields = ["nombre"]
    list_per_page = 50


@admin.register(Aplicacion)
class AplicacionAdmin(admin.ModelAdmin):
    list_display = ["nombre"]
    search_fields = ["nombre"]
    list_per_page = 50
