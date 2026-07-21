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
| 4c | Gestión de miembros y acceso a organizaciones | ✅ Completado (2026-07-18) |
| 5 | Billing (Stripe) | ⏸️ Sin diseñar |
| 6 | Hosting del backend | 🚧 En progreso (2026-07-20) — backend en Railway + frontend en Cloudflare Workers |
| 7 | Landing, README y primer minuto (pre-lanzamiento) | ✅ Completado (2026-07-20), falta contenido real (capturas/GIF/demo pública) |

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
   - **Bloque C — Gestión de miembros y acceso a organizaciones** — ✅ 2026-07-18. El
     diseño original (invitaciones por correo) se descartó antes de construirse: tokens,
     expiración, reenvíos y correos fallidos resolvían un problema de UX, no de dominio, y
     metían la entrega de un email en el camino crítico de incorporar a alguien. El
     reemplazo separa "crear una cuenta" de "pertenecer a una organización": el Owner genera
     **códigos de acceso** (rol inicial, expiración opcional, máximo de usos, activo/inactivo)
     y los comparte por el canal que quiera; quien se registra elige "Tengo un código" y queda
     asociado a la organización al instante, sin depender del correo. El dominio se diseña
     alrededor de **Membership** — `add_member()` como única puerta de entrada, con el
     mecanismo (código hoy; email/SSO/SCIM/API mañana) intercambiable — sin introducir todavía
     una tabla física `Membership` (ver ADR
     [0002](../adr/0002-membership-como-servicio-no-como-tabla.md) para el porqué y el punto
     de reapertura). Incluye además cambio de rol y desactivación de miembros desde la UI.
5. **Billing** — Stripe (Checkout + Customer Portal), webhook que activa/suspende la
   organización según estado de pago.
6. **Hosting del backend** — 🚧 backend desplegado en Railway (proyecto `nexo-backend`):
   servicio `backend` (build por `backend/Dockerfile`) + Postgres administrado, wireado por
   variables de referencia (`${{Postgres.PGHOST}}` etc., no una `DATABASE_URL` — `prod.py` usa
   `DB_NAME`/`DB_USER`/... por separado). Dominio propio `api.nexoengine.tech` conectado (CNAME
   + TXT de verificación creados vía la API de Hostinger, certificado válido); el dominio
   generado por Railway (`backend-production-c5b3.up.railway.app`) queda como fallback — ambos
   viven en `ALLOWED_HOSTS`. Bug encontrado y corregido en el primer deploy: `prod.py`
   necesitaba `SECURE_PROXY_SSL_HEADER` — Railway termina TLS en su borde y reenvía HTTP plano
   al contenedor, así que `SECURE_SSL_REDIRECT` sin ese header nunca ve la request como https y
   redirige en loop. Falta: monitoreo (Sentry), backups automáticos de Postgres. (Email
   transaccional ya resuelto en el punto 4 — Postmark ya está configurado en las variables del
   servicio.)

   **Frontend desplegado** (2026-07-20): Worker de Cloudflare `nexo` en
   `https://nexo.iber-mascodev.workers.dev` (`wrangler.jsonc` renombrado de la plantilla
   genérica `tanstack-start-app` a `nexo`). Build con
   `VITE_API_URL=https://api.nexoengine.tech/api/v1` horneado en tiempo de build (Vite inlinea
   `import.meta.env.VITE_API_URL`, no es una var de runtime del Worker — cambiarla exige
   rebuild + redeploy, no solo tocar una variable en el dashboard).

   **Dominio raíz migrado a Cloudflare** (2026-07-20): `nexoengine.tech` pasó de nameservers de
   Hostinger (`dns-parking.com`) a Cloudflare (`giancarlo.ns.cloudflare.com` /
   `journey.ns.cloudflare.com`) para poder servir el Worker en el dominio raíz — un Worker no
   puede colgar de un CNAME externo apuntando a `*.workers.dev`, necesita ser dueño de la zona.
   Todos los registros de correo (MX, DKIM×3, SPF, DMARC, autodiscover/autoconfig de Hostinger,
   bounce de Postmark) y los de Railway (`api` + verificación) se recrearon 1:1 en la zona
   nueva antes de tocar los nameservers — sin downtime de correo verificado post-migración.
   Rutas del Worker: `nexoengine.tech/*` y `www.nexoengine.tech/*` (agregadas a mano desde el
   dashboard de Cloudflare — el token de API usado para crear la zona/DNS no traía el permiso
   `Zone → Workers Routes`, y el patrón `*.nexoengine.tech/*` que sugiere la UI por defecto solo
   matchea subdominios, no el ápex; hay que usar `nexoengine.tech/*` sin el `*.` inicial).
   `CORS_ALLOWED_ORIGINS` del backend incluye `nexoengine.tech`, `www.nexoengine.tech` y el
   dominio de Workers — los tres probados con preflight `OPTIONS` real. Con frontend y backend
   ya conectados de punta a punta en el dominio real, el CTA primario de la landing (`/signup`)
   funciona — retomar la paradoja del CTA documentada en [landing-audit.md](landing-audit.md)
   ahora que el punto 6
   dejó de ser el bloqueante.
7. **Landing, README y primer minuto** — ✅ dos rondas completadas el 2026-07-20, detalle en
   [landing-audit.md](landing-audit.md). Primera ronda: contenido no dependiente de producción
   (footer con formulario fake, quickstart incompleto, README desactualizado, anclas de
   navegación, agrupación de features). Segunda ronda, una vez resuelto el punto 6: CTA
   contextual bajo la demo (`/signup?template=`), empty state de activación en el dashboard
   vacío (`{PREFIJO}-0001` + botón directo a crear la primera actividad), nudge del Owner hacia
   códigos de acceso, link real del README a la landing. **Sigue pendiente** — no es código,
   es contenido real que hay que producir: capturas del producto, GIF del Kanban, video de
   instalación, Open Graph image, y el diseño de una instancia demo pública de solo lectura.

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
- **2026-07-18** — Bloque C completado como "Gestión de miembros y acceso a organizaciones":
  códigos de acceso en vez de invitaciones por correo (replanteamiento del usuario, validado
  en análisis: la maquinaria de invitaciones resolvía UX, no dominio, y un código con
  `max_usos=1` es un superset de la invitación individual). Dominio diseñado alrededor de
  Membership con `add_member()` como seam único (ADR 0002 — tabla física `Membership`
  diferida hasta multi-org Enterprise). Incluye cambio de rol y desactivación/reactivación de
  miembros desde la UI.
- **2026-07-20** — Auditoría de landing/README/primer minuto en panel con roles
  ([landing-audit.md](landing-audit.md)). Confirmó que la landing nueva (sin commitear al
  momento de la auditoría) está lista en contenido, pero identificó una paradoja de CTA: el
  botón primario lleva a `/signup`, que no puede completarse porque el punto 6 (hosting) no
  existe aún. Decisión: implementar ya todo lo que no depende de producción (contenido,
  quickstart, README, navegación) y diferir explícitamente lo que sí depende del punto 6.
- **2026-07-20** — Punto 6 arranca: backend desplegado en Railway (Postgres administrado,
  dominio propio `api.nexoengine.tech`) y frontend en un Worker de Cloudflare
  (`nexo.iber-mascodev.workers.dev`), CORS wireado entre ambos y probado con un preflight
  real. La paradoja del CTA de la auditoría anterior deja de ser un bloqueante técnico —
  queda pendiente el dominio raíz (`nexoengine.tech` → Worker) y la segunda tanda de
  contenido real (capturas, GIF, demo pública) antes de anunciar la landing como publicada.
