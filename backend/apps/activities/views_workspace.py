"""GET /api/v1/workspace/ — bootstrap del frontend: organización + maestros
en una sola llamada. `version` cambia cuando cualquier maestro se crea o
edita, para que el frontend invalide su caché (staleTime: Infinity)."""
from django.db.models import Max
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.limits import effective_plan, limits_for

from .models import ActivityType, Priority, WorkflowState

# 2: la organización pasa a incluir `plan` y `limits` — el frontend necesita
# saber qué otorga el plan para avisar antes de que alguien choque contra un
# tope, no después de un 400.
SCHEMA_VERSION = 2


class WorkspaceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.user.organization
        if org is None:
            return Response(
                {
                    "organization": None,
                    "workflow_states": [],
                    "priorities": [],
                    "activity_types": [],
                    "version": "0",
                    "schema_version": SCHEMA_VERSION,
                }
            )

        states = WorkflowState.objects.for_org(org).order_by("orden", "pk")
        priorities = Priority.objects.for_org(org).order_by("orden", "pk")
        types_ = ActivityType.objects.for_org(org).filter(is_active=True).order_by("orden", "nombre")

        latest = max(
            (
                v
                for v in (
                    states.aggregate(m=Max("updated_at"))["m"],
                    priorities.aggregate(m=Max("updated_at"))["m"],
                    types_.aggregate(m=Max("updated_at"))["m"],
                )
                if v is not None
            ),
            default=org.created_at,
        )

        payload = {
            "organization": {
                "id": org.pk,
                "nombre": org.nombre,
                "slug": org.slug,
                "codigo_prefix": org.codigo_prefix,
                "timezone": org.timezone,
                "locale": org.locale,
                "currency": org.currency,
                # `plan` es el efectivo (un trial vencido ya revirtió a
                # Community), no el guardado: la UI no puede ofrecer algo
                # que el API va a rechazar.
                "plan": effective_plan(org),
                "limits": limits_for(org),
            },
            "workflow_states": [
                {
                    "id": s.pk,
                    "nombre": s.nombre,
                    "slug": s.slug,
                    "color": s.color,
                    "orden": s.orden,
                    "categoria": s.categoria,
                    "is_initial": s.is_initial,
                    "mostrar_en_kanban": s.mostrar_en_kanban,
                    "sheet_phase": s.sheet_phase,
                    "is_active": s.is_active,
                }
                for s in states
            ],
            "priorities": [
                {
                    "id": p.pk,
                    "nombre": p.nombre,
                    "slug": p.slug,
                    "color": p.color,
                    "orden": p.orden,
                    "is_default": p.is_default,
                    "is_active": p.is_active,
                }
                for p in priorities
            ],
            "activity_types": [
                {
                    "id": t.pk,
                    "nombre": t.nombre,
                    "slug": t.slug,
                    "color": t.color,
                    "orden": t.orden,
                }
                for t in types_
            ],
            "version": latest.isoformat(),
            "schema_version": SCHEMA_VERSION,
        }
        return Response(payload)
