# Plan de ejecución: qué está hecho, qué falta, en qué orden

Este archivo es sobre **estado y orden de entrega** — no sobre qué es cada feature (→
[product.md](product.md)), por qué está hecha así por dentro (→ [architecture.md](architecture.md))
o cómo se cobra (→ [monetization.md](monetization.md)).

## Fase 0 — Preparación Open Source

**Estado: ✅ Completada** (commit `af3d650`, tag `v0.1.0`)

Licencia AGPL-3.0, CI (frontend + backend), primera suite de tests (12), imagen Docker en GHCR,
Dependabot, repo renombrado y protegido. Detalle: `git show af3d650 --stat`.

## Fase 1 — Fundaciones SaaS (habilita el plan Cloud)

**Estado: 🚧 En progreso.** Es el ~60% del esfuerzo total de toda la estrategia.

| # | Punto | Estado |
|---|---|---|
| 1 | Multi-tenancy + maestros configurables | ✅ Completado (2026-07-17) |
| 2 | Plantillas de flujo al onboarding | ✅ Completado (2026-07-17) |
| 3 | Catálogos genéricos / campos personalizados | ⏸️ Pendiente, deuda consciente |
| 4 | Signup self-service + onboarding | ✅ Completado (2026-07-18), alcance Bloque A+B+D |
| 4c | Bloque C: invitaciones / gestión de equipo | 🚧 En diseño |
| 5 | Billing (Stripe) | ⏸️ Sin diseñar |
| 6 | Hosting del backend | ⏸️ Sin diseñar |

Detalle técnico de cada punto completado → [architecture.md](architecture.md). Detalle de
producto/diferenciadores → [product.md](product.md). Planes de implementación caso por caso en
`~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`.

1. **Multi-tenancy + maestros configurables** — ✅ 2026-07-17. El cambio estructural más
   profundo; todo lo demás depende de él.
2. **Plantillas de flujo al onboarding** — ✅ 2026-07-17. Tres presets (`ti_clasico`/
   `kanban_simple`/`mesa_ayuda`) como archivos JSON.
3. **Catálogos genéricos / campos personalizados** — pendiente. Hoy Cliente/Proceso/
   Aplicación/Stakeholder son tablas tipadas fijas; un catálogo nuevo requiere migración. No
   revisar sin un caso de cliente real que lo pida.
4. **Signup self-service + onboarding** — ✅ 2026-07-18. `POST /api/v1/auth/signup/` público:
   organización + plantilla + primer usuario (Owner) en una transacción, auto-login,
   verificación de email no bloqueante, reset de contraseña, envío real vía Resend.
   - **Bloque C (invitaciones al equipo)** quedó fuera a propósito — no bloqueaba el criterio
     de aceptación del signup. En diseño ahora.
5. **Billing** — Stripe (Checkout + Customer Portal), webhook que activa/suspende la
   organización según estado de pago.
6. **Hosting del backend** — backend dockerizado a Railway/Render/Fly.io. Falta: monitoreo
   (Sentry), backups automáticos de Postgres. (Email transaccional ya resuelto en el punto 4.)

La base de Fase 0 (imagen Docker, `gunicorn`, `whitenoise`, settings por entorno) es
exactamente el punto de partida de este hosting.

## Fase 2 — Enterprise

**Estado: 💤 No empezar todavía.** Se construye contra el primer contrato real, no por
adelantado. Lista de features → [product.md](product.md).

## Bitácora de hitos

- **2026-07-16** — Fase 0 completada; Fase 1 arranca por multi-tenancy antes que billing o
  signup, porque todo lo demás depende de ese modelo de datos.
- **2026-07-17** — Fase 1, Bloque 1 completado: multi-tenancy + maestros configurables.
- **2026-07-17** — Identidad visual del dashboard y sección "NEXO ENGINE" en la landing,
  basados en el brand kit de Claude Design del usuario.
- **2026-07-17** — Fase 1 punto 2 (plantillas de flujo) completado.
- **2026-07-18** — Fase 1 punto 4 (signup self-service) completado, alcance Bloque A+B+D
  mínimo. Bloque C (invitaciones) explícitamente para después.
- **2026-07-18** — Restructuración de `docs/ROADMAP.md` en `docs/roadmap/{product,
  architecture, monetization, release-plan}.md` + `docs/adr/` para decisiones arquitectónicas
  grandes — el documento único ya mezclaba roadmap técnico y comercial y crecía sin límite.
