from django.contrib import admin

from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug", "codigo_prefix", "plan", "is_active", "created_at"]
    search_fields = ["nombre", "slug"]
    list_filter = ["plan", "is_active"]
    prepopulated_fields = {"slug": ["nombre"]}
