from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "nombre", "organization", "rol", "coordinador", "is_staff", "is_active"]
    list_filter = ["organization", "rol", "coordinador", "is_staff", "is_active"]
    search_fields = ["email", "nombre"]
    ordering = ["nombre"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Datos personales", {"fields": ("nombre", "organization", "rol", "coordinador")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "nombre", "organization", "rol", "coordinador", "password1", "password2"),
        }),
    )
