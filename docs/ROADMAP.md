# Roadmap: de herramienta interna a producto open source

Este documento es la fuente de verdad de la estrategia de producto y monetización de Nexo.
Si estás retomando el proyecto en otra máquina o sesión, empieza por acá — el contexto
técnico está en [CLAUDE.md](../CLAUDE.md).

## Contexto

Nexo nació como herramienta interna (antes "FlowDesk") para un equipo de TI. Se decidió
convertirla en producto open source con un modelo de monetización de tres niveles.

## Modelo: Open Core

Un solo producto — el núcleo es libre, las capas de conveniencia (Cloud) y cumplimiento
corporativo (Enterprise) se cobran. Mismo modelo que GitLab, Cal.com o Mattermost.

**Regla para decidir en qué plan va cada feature nueva:**
- ¿Un equipo pequeño lo necesita para trabajar? → **Community**
- ¿Es conveniencia/operación (hosting, backups, updates)? → **Cloud**
- ¿Lo exige un departamento de compras o de seguridad? → **Enterprise**

| | Community | Cloud | Enterprise |
|---|---|---|---|
| Precio | $0 | $5–10 USD / usuario / mes | Contrato anual |
| Qué es | Self-hosted, código libre | Alojado por nosotros, multi-tenant | Nube dedicada o self-hosted |
| Incluye | Kanban, backlog, planeación, reportes, sync AppSheet | Community + updates automáticos, backups, dominio propio | Cloud + SSO/SAML, auditoría, multi-organización |
| Soporte | Comunidad (Discussions) | Email < 24h | 24/7 con SLA |

**Diferenciador real** (para marketing, no para ingeniería): sync bidireccional con Google
Sheets/AppSheet — permite migrar equipos que hoy viven en hojas de cálculo sin big-bang — y
producto nativo en español para TI hispanohablante, nicho mal servido hoy.

**Precio de referencia:** Linear cobra $8/usuario, Jira/Asana más — $5–10 nos posiciona para
entrar. Sugerido: Cloud gratis hasta 5 usuarios como embudo de conversión self-service.

## Licencia: AGPL-3.0 (decisión ya tomada, no reabrir sin razón de peso)

MIT/Apache permitiría que cualquier proveedor tome Nexo, lo aloje y venda su propio plan
Cloud compitiendo contra nosotros. AGPL obliga a quien lo ofrezca como servicio a publicar
sus modificaciones — protege el negocio Cloud. Las features Enterprise, cuando existan, van
en una carpeta `ee/` con licencia comercial propia (modelo GitLab), en el mismo repo.

---

## Fase 0 — Preparación Open Source

**Estado: ✅ Completada** (commit `af3d650`, tag `v0.1.0`)

Dejar el repositorio listo como proyecto público antes de construir el SaaS encima:

- Licencia AGPL-3.0, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, plantillas de issues
- CI en GitHub Actions: frontend (lint/typecheck/build) + backend (check/migraciones/tests)
- Primera suite de tests del backend (12 tests: auth, CRUD, visibilidad por rol)
- Publicación de imagen Docker del backend en GHCR al taggear versiones
- Dependabot (npm, pip, actions, docker)
- Saneamiento: 0 errores de lint/typecheck, `eslint.config.js` con ignores correctos
- Repo renombrado `nexo-` → `nexo`, Discussions habilitado, `main` protegida con ruleset

Detalle completo con verificación: ver el artifact publicado en esa sesión, o simplemente
`git show af3d650 --stat`.

## Fase 1 — Fundaciones SaaS (habilita el plan Cloud)

**Estado: 🔜 Siguiente — sin diseñar todavía.** Esto es lo que hay que planear en detalle
antes de escribir código (usar Plan mode).

Es el ~60% del esfuerzo total de toda la estrategia. Orden sugerido:

1. **Multi-tenancy** — el cambio estructural más profundo, y el que hay que resolver
   primero porque todo lo demás depende de él. Hoy el modelo asume una sola empresa:
   `Activity`, `User`, catálogos (`Empresa`, `Proceso`, `Aplicacion`), todo es global. Hace
   falta un modelo `Organization` y FK en prácticamente todos los modelos. Row-level tenancy
   con un middleware que filtre por org es lo pragmático a esta escala — schema-per-tenant
   sería sobreingeniería.
2. **Signup self-service + onboarding** — hoy los usuarios los crea un admin (`seed_data`,
   admin de Django). Cloud necesita registro público, verificación de email, invitaciones al
   equipo.
3. **Billing** — Stripe (Checkout + Customer Portal ahorran la mayor parte del trabajo),
   webhook que activa/suspende la organización según estado de pago.
4. **Hosting del backend** — el frontend ya despliega a Cloudflare (no tocar, ver
   CLAUDE.md); el backend dockerizado puede ir a Railway/Render/Fly.io para empezar. Falta:
   email transaccional (Resend/Postmark), monitoreo (Sentry), backups automáticos de
   Postgres.

La base de Fase 0 (imagen Docker, `gunicorn`, `whitenoise`, settings por entorno) es
exactamente el punto de partida de este hosting.

## Fase 2 — Enterprise

**Estado: 💤 No empezar todavía.** Se construye contra el primer contrato real, no por
adelantado — llegan solos si Community/Cloud funcionan.

- SSO/SAML (`python3-saml` o Keycloak como broker), SCIM para provisioning
- Audit log: tabla append-only de quién-hizo-qué (el patrón de los `signals` de
  `apps/activities` para el sync de AppSheet es el mismo mecanismo, ya probado)
- RBAC avanzado, multi-organización a nivel de cuenta
- Tooling de despliegue dedicado (Terraform/Helm), licenciamiento del código `ee/`

---

## Bitácora de decisiones

Registrar acá cualquier decisión de producto/estrategia que no sea obvia leyendo el código,
para no tener que re-explicarla en la próxima sesión.

- **2026-07-16** — Elegido AGPL-3.0 sobre MIT para proteger el plan Cloud de reventa por
  terceros.
- **2026-07-16** — Docker cubre solo el backend; el frontend sigue nativo + Cloudflare
  Workers (ver CLAUDE.md para el porqué técnico).
- **2026-07-16** — Fase 0 completada; Fase 1 arranca por multi-tenancy antes que billing o
  signup, porque todo lo demás depende de ese modelo de datos.
