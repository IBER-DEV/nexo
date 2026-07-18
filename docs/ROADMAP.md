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

**Estado: 🚧 En progreso.** Bloque 1 (multi-tenancy + maestros configurables) completado —
ver detalle abajo. Bloques 2-4 (signup, billing, hosting) sin diseñar todavía.

Es el ~60% del esfuerzo total de toda la estrategia. Orden:

1. **Multi-tenancy + maestros configurables** — ✅ **Completado (2026-07-17).** El cambio
   estructural más profundo, y el que había que resolver primero porque todo lo demás
   depende de él.
   - Modelo `Organization` (tenant) con FK en `User`/`Activity`/catálogos; scoping en tres
     capas (manager `for_org`, mixin de ViewSet, querysets de serializer) — decisión
     explícita: row-level tenancy con filtrado a nivel de vista/serializer, NO middleware
     (con JWT, `request.user` solo existe dentro de DRF) ni schema-per-tenant
     (sobreingeniería a esta escala).
   - **Diferenciador nuevo detectado durante el diseño**: el flujo de gestión (estados,
     prioridades, catálogos) estaba hardcodeado en 4 capas paralelas (enums Python, filtros,
     `types.ts`, mapeo AppSheet de 4 fases fijas) — invisible para el negocio pero bloqueaba
     vender a equipos que no operan como TI clásico (mesa de ayuda, agile puro, etc.).
     Resuelto con maestros configurables por organización: `WorkflowState` (categoría
     todo/active/done/cancelled + flags, no enum fijo), `Priority`, `ActivityType`, catálogos
     con dueño. Bootstrap en una sola llamada (`GET /workspace/`, versionado para invalidar
     caché del frontend).
   - El sync AppSheet (mapeo Fase↔estado) pasó de 4 fases hardcodeadas a
     `external_mappings` (JSON por estado) — deja la puerta abierta a Jira/Azure DevOps
     mañana sin migrar el modelo, y ya soporta múltiples organizaciones (`--org <slug>` o
     iteración automática sobre las que tengan spreadsheet propio).
   - Código de actividad (`ACT-0001`) pasó a ser por organización (`{prefijo}-0001`) en vez
     de una secuencia global — con 100+ orgs nadie debía ver `ACT-98342` como su primera
     actividad. Encapsulado en `SequenceService` para poder cambiar de estrategia sin tocar
     el dominio si la concurrencia lo exige.
   - Ver plan completo y decisiones de diseño en
     `~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`.
2. **Plantillas de flujo al onboarding** — ✅ **Completado (2026-07-17).** Tres presets como
   **archivos de datos** (JSON, no Python) en `backend/apps/activities/workflow_templates/`:
   **TI clásico** (los 6 estados de siempre), **Kanban simple** (4: pendiente/en curso/hecho/
   descartado — usado por la org "Acme Ltd" del seed) y **Mesa de ayuda** (6, estilo service
   desk, con tipos de ticket incidente/solicitud/consulta/problema).
   - Decisión explícita (feedback de revisión): las plantillas NO son tuplas hardcodeadas en
     un módulo Python — son archivos `.json` versionados en git, con metadata
     (`version`, `display_name`, `description`, `recommended_for`, `is_system`). Agregar una
     plantilla nueva = agregar un archivo; `org_templates.py` (el loader) las descubre por
     `glob` al arrancar y valida sus invariantes (1 estado inicial, ≥1 estado `done`, 1
     prioridad default, slugs únicos) fallando ruidosamente si una plantilla está mal
     formada. Ver `workflow_templates/README.md` para el esquema completo — es también la
     base de un futuro marketplace de plantillas de la comunidad (`is_system: false`).
   - Aplicar una plantilla **copia** sus filas como estados/prioridades/tipos propios de la
     organización — nunca hay una referencia compartida entre orgs ni con el archivo de la
     plantilla; una org es 100% dueña de sus maestros apenas se crea
     (`apps.activities.org_templates.apply_template`, usado por `seed_data` y por el admin).
   - El "onboarding" real hoy es el admin de Django (el punto 4 — signup self-service — sigue
     sin construirse): un campo "Plantilla de flujo" en el alta de `Organization` aplica el
     preset elegido justo después de crear la org (`OrganizationAdmin.save_model`), y solo en
     el alta — editar una org existente no reaplica ni pisa nada. Sigue siendo "nombre → elegir
     plantilla → crear", sin pasos adicionales.
   - Cuando exista signup self-service (punto 4), el mismo `apply_template` se reutiliza ahí
     — el mecanismo no depende de dónde se crea la organización.
3. **Catálogos genéricos / campos personalizados** (pendiente, deuda consciente) — hoy
   Cliente/Proceso/Aplicación/Stakeholder son tablas tipadas fijas; un catálogo nuevo
   (Proveedor, Sucursal, Equipo...) requiere migración. Un modelo EAV (Catalog/CatalogItem)
   lo evitaría, pero para el MVP los FKs tipados ganan en simplicidad e integridad — no
   revisar sin un caso de cliente real que lo pida.
4. **Signup self-service + onboarding** — hoy los usuarios los crea un admin (`seed_data`,
   admin de Django). Cloud necesita registro público, verificación de email, invitaciones al
   equipo, selección de plantilla de flujo (ver punto 2), términos/privacidad, rate limiting.
5. **Billing** — Stripe (Checkout + Customer Portal ahorran la mayor parte del trabajo),
   webhook que activa/suspende la organización según estado de pago. `Organization.plan` y
   `Organization.feature_flags` ya existen desde el Bloque 1 — la lógica de límites por plan
   se diseña aquí.
6. **Hosting del backend** — el frontend ya despliega a Cloudflare (no tocar, ver
   CLAUDE.md); el backend dockerizado puede ir a Railway/Render/Fly.io para empezar. Falta:
   email transaccional (Resend/Postmark), monitoreo (Sentry), backups automáticos de
   Postgres.

La base de Fase 0 (imagen Docker, `gunicorn`, `whitenoise`, settings por entorno) es
exactamente el punto de partida de este hosting.

**Decisión de producto pendiente — el concepto núcleo**: hoy el corazón del producto es
`Activity`. Vale la pena evaluar, antes de estabilizar una API pública, si el producto debe
girar alrededor de un concepto más amplio ("unidad de trabajo") que abarque automatizaciones,
IA e integraciones sin sentirse limitado por la palabra "actividad" — anotado para no
perderlo, no bloquea nada del Bloque 1.

**Diferenciadores confirmados con investigación de mercado (2026-07-17)**: (a) sync
bidireccional con Google Sheets — Jira/Asana/Monday solo lo logran con middleware de pago
(Unito, ~$10+/usuario extra) o exports unidireccionales enterprise, nadie lo tiene nativo;
(b) producto en español nativo; (c) flujos configurables sin la complejidad de administración
de Jira ("configurable en 5 minutos"); (d) plantillas de flujo por tipo de equipo TI (punto 2
arriba); (e) mapeo a sistemas externos genérico (`external_mappings`) — la puerta a integrar
Jira/Azure DevOps ya está en el modelo de datos, no es una promesa de roadmap sin base.

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
- **2026-07-17** — Fase 1, Bloque 1 completado: multi-tenancy + maestros configurables
  (estados/prioridades/tipos por organización, ya no enums fijos). Detectado durante el
  diseño que esto era, además, un diferenciador de producto no contemplado originalmente —
  ver detalle en la sección de Fase 1 arriba. Decisión tomada de no meter RBAC configurable
  en este bloque (queda para Fase 2) para no mezclar dos cambios estructurales grandes a la
  vez.
- **2026-07-17** — Identidad visual del dashboard (banda de pulso, conclusiones calculadas
  sobre datos reales, carga por persona) y sección "NEXO ENGINE" en la landing, basados en el
  brand kit de Claude Design del usuario. En NEXO ENGINE, de 9 capacidades listadas solo 3
  se marcan "Disponible" (Open Source, Google Sheets, API REST) — el resto queda como
  "Roadmap" explícito, siguiendo la misma disciplina de no prometer fechas que ya usan
  Roadmap.tsx y Pricing.tsx.
- **2026-07-17** — Fase 1 punto 2 (plantillas de flujo) completado: 3 presets
  (`ti_clasico`/`kanban_simple`/`mesa_ayuda`) aplicables al crear una organización desde el
  admin de Django — el "onboarding" real hasta que exista signup self-service (punto 4).
  Rediseñado tras revisión: plantillas como archivos JSON versionables (no Python), copiadas
  (nunca referenciadas) a cada organización, aplicadas solo al crear — sienta la base para un
  futuro marketplace de plantillas de la comunidad sin tocar el modelo de datos.
