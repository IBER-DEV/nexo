"""Logging de embudo del signup self-service (Fase 1, punto 4): no es para
auditoría, es para entender dónde se cae la gente entre "vio el formulario"
y "creó su primera actividad". Por eso es logger.info estructurado y no un
modelo en base de datos — si más adelante hace falta un dashboard de
conversión, se agrega un modelo que consuma este mismo logger (un handler
más), sin tocar ninguno de los call sites."""
import logging

logger = logging.getLogger("nexo.funnel")


def track(event: str, *, organization=None, user=None, **extra) -> None:
    logger.info(
        event,
        extra={
            "funnel_event": event,
            "organization_id": getattr(organization, "pk", None),
            "user_id": getattr(user, "pk", None),
            **extra,
        },
    )
