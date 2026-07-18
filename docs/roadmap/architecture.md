# Arquitectura: decisiones técnicas que no son obvias leyendo el código

Este archivo registra **por qué** el sistema está hecho como está — no qué se construye (→
[product.md](product.md)) ni cómo se cobra (→ [monetization.md](monetization.md)). Decisiones
grandes con consecuencias a largo plazo (ej. el modelo de dominio central) tienen su propio ADR
en [`docs/adr/`](../adr/) en vez de vivir solo acá; este archivo indexa esas decisiones y
documenta las de tamaño medio directamente.

## ADRs (Architecture Decision Records)

- [0001 — ¿Qué es una unidad de trabajo en Nexo?](../adr/0001-unidad-de-trabajo-en-nexo.md) —
  `Activity` vs. un concepto más amplio que cubra automatizaciones/IA/integraciones futuras.
- [0002 — Membership: dominio como servicio, no (todavía) como tabla](../adr/0002-membership-como-servicio-no-como-tabla.md) —
  pertenecer a una organización se modela con un servicio de dominio (`add_member()` como
  único punto de entrada, mecanismo de incorporación intercambiable); la tabla física
  `Membership` se difiere hasta multi-org Enterprise.

## Multi-tenancy: row-level, no middleware ni schema-per-tenant

`Organization` es el tenant. Scoping en tres capas: manager `for_org()` (nunca
`Model.objects.all()` en código org-scoped), `OrganizationScopedViewSetMixin` en ViewSets, y
querysets de `PrimaryKeyRelatedField` restringidos a la org del request en los serializers
(segunda línea de defensa). Un test de guardia (`test_scoping_guard.py`) falla si un ViewSet
nuevo maneja un modelo con FK `organization` sin heredar el mixin.

**Por qué no middleware**: con JWT, `request.user` solo se resuelve dentro de la capa DRF — no
hay sesión de Django que un middleware pueda inspeccionar temprano.
**Por qué no schema-per-tenant**: sobreingeniería a esta escala; row-level tenancy es el patrón
correcto para el volumen de organizaciones esperado en Cloud.

## Maestros configurables, no enums fijos

`WorkflowState`/`Priority`/`ActivityType` reemplazan los `TextChoices` que antes vivían en
`Activity.Status`/`Activity.Priority`. `WorkflowState.categoria` (`todo`/`active`/`done`/
`cancelled`) es la única fuente de verdad para métricas — código nuevo nunca debe comparar
`estado.slug` contra strings tipo `"backlog"` (esos slugs son solo el seed de una org
específica, no están garantizados en otras). Plantillas de flujo (JSON versionado, no tuplas
Python) aplican un preset de maestros al crear una organización vía
`apps.activities.org_templates.apply_template()` — **copia**, nunca referencia compartida.

## Numeración de actividades por organización

`Activity.numero` + `Organization.codigo_prefix` → `codigo` (`{PREFIX}-0001}`), asignado vía
`apps.organizations.sequences.SequenceService` (hoy `select_for_update`, intercambiable por
secuencias nativas de Postgres/Redis sin tocar el dominio si la concurrencia lo exige). Cada
organización arranca en 1 — con cientos de orgs nadie debía ver `ACT-98342` como su primera
actividad.

## Eventos de dominio: signals de Django, no un event bus

No hay Celery/Redis en el proyecto todavía, así que el patrón de eventos es un `Signal()` de
Django conectado en `AppConfig.ready()` — usado primero para el push a Google Sheets
(`apps/activities/signals.py`) y reutilizado para el signal `user_registered`
(`apps/organizations/signals.py`, consumido por `apps/notifications/`). El emisor nunca importa
al consumidor — el dominio (`SignupService`) no sabe qué proveedor de correo hay detrás.

## `/workspace/` versionado

Bootstrap en una sola llamada (organización + maestros). El frontend cachea con
`staleTime: Infinity`; el campo `version` permite invalidar ese caché desde el servidor cuando
un admin cambia maestros, sin esperar un reload manual del usuario.

## Mapeos externos genéricos, no un dict fijo de 4 fases

`WorkflowState.external_mappings` (JSON, ej. `{"google_sheets": "En Proceso"}`) reemplazó un
mapeo hardcodeado de 4 fases — deja la puerta abierta a Jira/Azure DevOps mañana sin migrar el
modelo. El pull de Sheets conserva el estado actual si comparte fase con otro más genérico
(evita degradar `en pruebas` a `en progreso` en cada sync).

## Membership y códigos de acceso, no invitaciones por correo

Incorporar a alguien a una organización pasa por un único servicio de dominio
(`apps/organizations/membership.py::add_member`) — ningún mecanismo escribe
`user.organization`/`user.rol` directamente. El primer mecanismo es el código de acceso
(`OrganizationAccessCode`: rol, expiración opcional, máximo de usos, contador,
activo/inactivo) — sin depender de la entrega de un correo. El diseño de invitaciones por
email se descartó antes de implementarse; el razonamiento completo y el punto de reapertura
(multi-org / segundo mecanismo) están en el ADR 0002.

## Bitácora técnica

- **2026-07-17** — Multi-tenancy + maestros configurables completado. Decisión tomada de no
  meter RBAC configurable en este bloque (queda para Fase 2) para no mezclar dos cambios
  estructurales grandes a la vez.
- **2026-07-17** — Plantillas de flujo como archivos JSON versionables (no Python), copiadas
  (nunca referenciadas) a cada organización, aplicadas solo al crear.
- **2026-07-18** — Signup self-service: `Organization.owner` como propiedad derivada (busca el
  `User` con `rol=owner`) en vez de un FK nuevo — evita el bootstrap circular de una
  organización que necesitaría existir antes que el usuario que apunta a ella. Email
  transaccional (primera integración real del proyecto) vía Resend/`django-anymail`, desacoplado
  del dominio por el signal `user_registered`.
