"""Límites por plan.

Tres principios que explican por qué esto está escrito así, y que conviene
no romper sin una razón fuerte:

1. **El self-hosted no se limita nunca.** Nexo es AGPL: limitar el binario
   que alguien corre en su propio servidor rompe la promesa open core y
   además es inaplicable (basta borrar el check). Por eso el gate es
   `provider.is_configured()`, el mismo que decide si la facturación existe
   — `plan="community"` significa "self-host libre" o "tier gratuito de
   Cloud" según ese flag, y solo el segundo tiene techo.
2. **El muro es de puestos, no de features.** Esconder el sync de Sheets o
   el core detrás del plan mata la razón por la que alguien elige Nexo
   sobre Plane. Se cobra por el eje que crece con el valor entregado.
3. **Un límite bloquea agregar, nunca quita lo que ya existe.** Bajar de
   plan no desactiva a nadie: solo impide al siguiente. Lo contrario
   convierte un downgrade en pérdida de acceso para gente que no hizo nada.

Vive en `apps.billing` y no en `apps.organizations` porque es una regla
comercial, no de dominio. `membership.add_member()` lo importa dentro de la
función para no crear un ciclo entre las dos apps.
"""
import logging

from django.contrib.auth import get_user_model

from .access import current_subscription
from .provider import is_configured

logger = logging.getLogger("nexo.billing")

# `None` = sin techo. El 5 de community es el tier gratuito de Cloud
# documentado en docs/roadmap/monetization.md, no un límite del software.
PLAN_LIMITS = {
    "community": {"max_active_users": 5},
    "cloud": {"max_active_users": None},
    "enterprise": {"max_active_users": None},
}

SIN_LIMITE = {"max_active_users": None}


class LimitExceeded(Exception):
    """Se alcanzó un tope del plan. El llamador la traduce a su propio error
    de dominio (400 con mensaje accionable), no se filtra cruda al API."""


def effective_plan(organization) -> str:
    """Plan que rige *ahora*. No es `organization.plan` a secas: un trial
    vencido revierte a Community en caliente, antes de que el cron de
    `expire_trials` toque el valor guardado. Resolverlo igual que el nivel
    de acceso evita que un usuario tenga los límites de un plan y los
    permisos de otro."""
    if organization is None:
        return "community"
    sub = current_subscription(organization)
    return sub.effective_plan if sub is not None else organization.plan


def limits_for(organization) -> dict:
    if organization is None or not is_configured():
        return dict(SIN_LIMITE)
    return dict(PLAN_LIMITS.get(effective_plan(organization), PLAN_LIMITS["community"]))


def seats_in_use(organization) -> int:
    """Puestos ocupados = usuarios activos. Los desactivados no cuentan: es
    la válvula de escape para quien baja de plan sin echar a nadie de la
    organización."""
    if organization is None:
        return 0
    User = get_user_model()
    return User.objects.for_org(organization).filter(is_active=True).count()


def check_can_add_member(organization) -> None:
    """Lanza LimitExceeded si sumar un puesto pasaría del techo del plan."""
    techo = limits_for(organization)["max_active_users"]
    if techo is None:
        return
    if seats_in_use(organization) >= techo:
        raise LimitExceeded(
            f"Tu plan incluye {techo} usuarios activos y ya los tienes ocupados. "
            "Actualiza a Cloud desde Configuración → Facturación, o desactiva "
            "a alguien del equipo para liberar un puesto."
        )


def usage(organization) -> dict:
    """Consumo actual contra los topes, para pintarlo en la UI *antes* de
    que alguien choque contra el muro."""
    techo = limits_for(organization)["max_active_users"]
    return {
        "active_users": seats_in_use(organization),
        "max_active_users": techo,
        "seats_available": None if techo is None else max(0, techo - seats_in_use(organization)),
    }
