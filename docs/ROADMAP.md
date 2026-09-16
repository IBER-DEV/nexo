# Roadmap de Nexo — índice

Este documento se dividió para no crecer sin límite mezclando estrategia de producto,
arquitectura técnica y sostenibilidad en un solo archivo de 600 líneas. Empieza por el que
responda tu pregunta:

- **[roadmap/product.md](roadmap/product.md)** — qué es Nexo, diferenciadores de producto y
  features pendientes de Fase 2.
- **[roadmap/architecture.md](roadmap/architecture.md)** — decisiones técnicas que no son
  obvias leyendo el código (multi-tenancy, maestros configurables, eventos de dominio...) y los
  [ADRs](adr/) para las decisiones grandes.
- **[roadmap/sustainability.md](roadmap/sustainability.md)** — por qué Nexo es gratis en todas
  sus versiones, la licencia AGPL-3.0 y qué cuesta dinero de verdad.
- **[roadmap/launch-strategy.md](roadmap/launch-strategy.md)** — por qué estas decisiones de
  negocio: auditoría competitiva (Plane), ICP y qué no construir en 12 meses. Su sección de
  pasarelas de pago quedó como registro histórico: ver [ADR 0003](adr/0003-nexo-es-gratis.md).
- **[roadmap/release-plan.md](roadmap/release-plan.md)** — estado actual: qué fase/punto está
  completado, en progreso o pendiente, y en qué orden.
- **[roadmap/landing-audit.md](roadmap/landing-audit.md)** — auditoría de landing, README y
  primer minuto: qué se implementó ya y qué queda diferido hasta que el hosting (Fase 1, punto
  6) esté resuelto.

Para **operar** lo que ya está desplegado —entornos, tareas programadas, respaldos, limpieza de
datos— el runbook es [operations.md](operations.md); no es roadmap, son cosas que se hacen.

El contexto técnico general del código (no del roadmap) vive en [CLAUDE.md](../CLAUDE.md).
