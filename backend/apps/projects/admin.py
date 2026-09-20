from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "organization", "estado", "lider", "fecha_fin_estimada")
    list_filter = ("organization", "estado", "is_active")
    search_fields = ("nombre", "descripcion")
    autocomplete_fields = ("lider", "cliente")
    readonly_fields = ("numero", "created_at", "updated_at")

    @admin.display(description="código")
    def codigo(self, obj):
        return obj.codigo
