from django import forms
from django.contrib import admin

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.org_templates import DEFAULT_TEMPLATE, TEMPLATE_CHOICES, apply_template

from .models import Organization, WaitlistSignup


class OrganizationAddForm(forms.ModelForm):
    """Solo para el alta: además de los campos del modelo, deja elegir la
    plantilla de flujo con la que arranca la organización. Vía de alta
    alterna al signup self-service (`POST /api/v1/auth/signup/`) — útil para
    orgs internas/soporte; ver docs/roadmap/release-plan.md, Fase 1 punto 4."""

    template = forms.ChoiceField(
        choices=TEMPLATE_CHOICES,
        initial=DEFAULT_TEMPLATE,
        label="Plantilla de flujo",
        help_text="Crea los estados, prioridades y tipos iniciales. Se puede seguir "
        "editando después en Configuración → Maestros.",
    )

    class Meta:
        model = Organization
        # Los contadores de secuencia quedan fuera del alta: una
        # organización nueva siempre arranca en 1 (ver readonly_fields en
        # OrganizationAdmin para por qué tampoco se editan después).
        exclude = ["next_activity_numero", "next_project_numero"]


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug", "codigo_prefix", "is_active", "created_at"]
    search_fields = ["nombre", "slug"]
    list_filter = ["is_active"]
    prepopulated_fields = {"slug": ["nombre"]}
    # Visibles para diagnóstico, no editables: el modelo pide consumir estas
    # secuencias solo vía SequenceService, y un contador retrocedido a mano
    # genera códigos duplicados (la UniqueConstraint por org lo convierte en
    # un 500 al crear la siguiente actividad o proyecto). Corregirlos es
    # trabajo de shell, con intención explícita, no un input de formulario.
    readonly_fields = ["next_activity_numero", "next_project_numero"]

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = OrganizationAddForm
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change:
            template_key = form.cleaned_data.get("template", DEFAULT_TEMPLATE)
            apply_template(obj, template_key, WorkflowState, Priority, ActivityType)


@admin.register(WaitlistSignup)
class WaitlistSignupAdmin(admin.ModelAdmin):
    """Solo lectura: nadie se anota ya (ver el modelo). Esta pantalla existe
    para exportar los correos pendientes de avisar que Cloud abrió."""

    list_display = ["email", "source", "created_at"]
    search_fields = ["email"]
    list_filter = ["source"]

    def has_add_permission(self, request):
        return False
