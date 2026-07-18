from django import forms
from django.contrib import admin

from apps.activities.models import ActivityType, Priority, WorkflowState
from apps.activities.org_templates import DEFAULT_TEMPLATE, TEMPLATE_CHOICES, apply_template

from .models import Organization


class OrganizationAddForm(forms.ModelForm):
    """Solo para el alta: además de los campos del modelo, deja elegir la
    plantilla de flujo con la que arranca la organización — la
    "onboarding" real hoy es este formulario (no hay signup self-service
    todavía; ver docs/ROADMAP.md, Fase 1 punto 4)."""

    template = forms.ChoiceField(
        choices=TEMPLATE_CHOICES,
        initial=DEFAULT_TEMPLATE,
        label="Plantilla de flujo",
        help_text="Crea los estados, prioridades y tipos iniciales. Se puede seguir "
        "editando después en Configuración → Maestros.",
    )

    class Meta:
        model = Organization
        fields = "__all__"


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["nombre", "slug", "codigo_prefix", "plan", "is_active", "created_at"]
    search_fields = ["nombre", "slug"]
    list_filter = ["plan", "is_active"]
    prepopulated_fields = {"slug": ["nombre"]}

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            kwargs["form"] = OrganizationAddForm
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change:
            template_key = form.cleaned_data.get("template", DEFAULT_TEMPLATE)
            apply_template(obj, template_key, WorkflowState, Priority, ActivityType)
