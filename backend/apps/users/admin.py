from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import PersonalAccessToken, User


@admin.register(PersonalAccessToken)
class PersonalAccessTokenAdmin(admin.ModelAdmin):
    """Solo lectura salvo la revocación: el valor del token no existe en la
    base (solo su sha256), así que no hay nada que editar acá — el uso real
    de esta pantalla es cortarle el acceso a una integración desde soporte."""

    list_display = ["nombre", "prefix", "user", "scope", "last_used_at", "revoked_at", "created_at"]
    list_filter = ["scope", "revoked_at"]
    search_fields = ["nombre", "prefix", "user__email"]
    readonly_fields = [
        "user",
        "nombre",
        "token_hash",
        "prefix",
        "scope",
        "expires_at",
        "last_used_at",
        "created_at",
    ]


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
