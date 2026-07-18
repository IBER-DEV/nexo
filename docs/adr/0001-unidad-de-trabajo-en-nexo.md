# ADR 0001 — ¿Qué es una unidad de trabajo en Nexo?

**Estado:** Aceptado (decisión: diferir el cambio, adoptar el principio de diseño de abajo).
**Fecha:** 2026-07-18.
**Revisar antes de:** publicar cualquier API pública para terceros (webhooks/SDK — ver
`docs/roadmap/product.md`, capacidades "roadmap" de NEXO ENGINE).

## Contexto

Hoy el corazón del dominio de Nexo es un único modelo: `Activity`
(`backend/apps/activities/models.py`). Es un objeto concreto y bien definido: tiene
organización, número secuencial por org (`{prefijo}-0001`), estado (`WorkflowState`),
prioridad, tipo, responsable, catálogos opcionales (cliente/proceso/aplicación/stakeholder),
fechas de planeación, y un contrato externo estable con Google Sheets/AppSheet (columna
`FlowDeskID`).

La landing page (`src/components/landing/NexoEngine.tsx`, sección "NEXO ENGINE") ya lista
capacidades futuras marcadas `status: "roadmap"`: **Automatizaciones** ("reglas y disparadores
sobre actividades y cambios de estado"), **IA** ("asistencia para triage, resúmenes y
priorización del backlog"), **Webhooks** ("notifica a otros sistemas cuando algo cambia"),
**MCP** ("conecta Nexo a agentes de IA como fuente de datos y de acciones"), **CLI** y **SDK**.
Ninguna de estas existe todavía en el código — son dirección de producto, no features
construidas — pero la palabra que las agrupa en el marketing es **"Engine"**, no "actividad".

La pregunta que dispara este ADR: cuando esas capacidades se construyan de verdad, ¿qué van a
ser? Si una automatización dispara sobre "cambios de estado", ¿de qué tiene estado? Si un
webhook notifica "cuando algo cambia en Nexo", ¿ese "algo" es siempre una `Activity`, o hace
falta un concepto más amplio que la incluya como un caso particular?

## Superficie de impacto de `Activity` hoy (para calibrar el costo de tocarla)

Investigado antes de decidir, no asumido:

- **Backend**: 15 archivos referencian `Activity` como clase/modelo directamente (modelo,
  vistas, serializers, `seed_data`, `sync_appsheet`, 5 migraciones, 4 archivos de test).
- **Frontend**: 27 archivos referencian `Activity`/"actividad" — rutas completas
  (`activities.tsx`, `kanban.tsx`, `planeacion.tsx`), componentes de dashboard (`PulseBand`),
  servicios, tipos, tres componentes de landing (`BoardSimulator`, `RoleSelector`, `Footer`).
- **Contrato externo estable**: la columna `FlowDeskID` en la Google Sheet real de un cliente,
  y el formato de código `{PREFIX}-0001` — ambos ya "publicados" en el sentido de que existen
  datos reales fuera del control de Nexo que dependen de ellos.
- **API**: `/api/v1/activities/` es la ruta principal del backend, consumida hoy únicamente por
  el frontend propio de Nexo — **no es todavía una API pública para terceros** (no hay SDK,
  no hay documentación de API pública, no hay ningún integrador externo).
- **Precedente de que un rename así es viable**: el Bloque 1 de multi-tenancy ya renombró el
  catálogo `Empresa` → `Cliente` (colisionaba con el concepto de `Organization`) sin drama,
  incluyendo su contrato con Sheets. Un rename de `Activity` sería más grande, pero no es un
  territorio inexplorado para este proyecto.

## Opciones consideradas

**A. No hacer nada — `Activity` sigue siendo el único tipo de unidad de trabajo.**
Cuando lleguen Automatizaciones/Webhooks/IA, cada una se modela como una entidad nueva sin
relación con `Activity` (`Automation`, `WebhookSubscription`, `AIJob`, cada una con su propio
scoping de organización, su propia numeración si aplica, su propia lógica de permisos).
- *Riesgo*: cada modelo nuevo reimplementa desde cero patrones que `Activity` ya resolvió bien
  (scoping por org, ownership, timeline/historial). Sin una vista o timeline unificada, un
  usuario no puede ver "todo lo que pasó" en un solo lugar — automatizaciones y actividades
  viven en universos separados aunque se relacionen entre sí en la práctica.

**B. Introducir ya un concepto paraguas (`WorkItem`) y migrar `Activity` a ser un caso de él.**
Vía herencia multi-tabla de Django, o una tabla núcleo mínima (`WorkItem`: id, organización,
tipo, timestamps) con tablas de extensión por tipo (`Activity` pasa a tener FK 1:1 a
`WorkItem` en vez de ser la tabla raíz).
- *Costo*: migración de datos real sobre las 15 + 27 ubicaciones de arriba, más el contrato
  externo (`FlowDeskID`, `{PREFIX}-0001`) tendría que sobrevivir el cambio de tabla raíz.
  Es exactamente el tipo de "dos cambios estructurales grandes a la vez" que este proyecto ya
  decidió evitar antes (ver `docs/roadmap/architecture.md`, bitácora 2026-07-17, sobre RBAC).
- *Riesgo de hacerlo ahora*: Automatizaciones/IA/Webhooks son hoy bullet points de marketing,
  no requisitos reales con casos de uso concretos — diseñar el `WorkItem` paraguas sin un
  segundo tipo real que lo necesite es adivinar la forma correcta a ciegas (el mismo motivo por
  el que el proyecto ya evitó un modelo EAV genérico de catálogos sin un caso de cliente real).

**C. Diferir el rename, pero fijar un principio de diseño para lo que viene después.**
No tocar `Activity` ahora. Cuando se construya la PRIMERA capacidad nueva de verdad
(automatización, webhook o IA — lo que llegue primero), diseñarla como su propio modelo de
primera clase, sin forzarla dentro del esquema de `Activity`. Recién en ese momento, con dos
tipos concretos de unidad de trabajo compitiendo por un concepto común, decidir si hace falta
un `WorkItem` paraguas — y si hace falta, ya se sabrá su forma real por los dos casos concretos
en vez de por especulación.

## Decisión

**Opción C.** No se renombra ni se restructura `Activity` en este momento. Se adopta como regla
de diseño para el resto de Fase 1/2:

1. La próxima capacidad nueva del tipo "Engine" (automatización, webhook, IA) que se construya
   de verdad —no como bullet de marketing— **se modela como un objeto de dominio propio**, no
   como una extensión ad-hoc de `Activity` ni de sus tablas.
2. Ese nuevo modelo **debe reutilizar los patrones ya probados** de `Activity` donde aplique
   (scoping org vía `for_org()`/`OrganizationScopedViewSetMixin`, no inventar una convención
   nueva) — pero como patrón compartido, no como herencia forzada de una tabla que no le
   pertenece.
3. Cuando exista un **segundo** tipo real de unidad de trabajo (no antes), reabrir este ADR y
   decidir si un `WorkItem` paraguas se justifica — con evidencia real de qué necesitan
   compartir ambos tipos, no con la forma imaginada hoy.
4. **Punto de no retorno**: si Nexo publica una API pública versionada para integradores
   externos (el SDK/CLI que hoy son "roadmap" en NEXO ENGINE) antes de resolver este punto, la
   ruta `/api/v1/activities/` y el nombre `Activity` quedan congelados como contrato público —
   en ese momento el costo de este ADR sube de "afecta 42 archivos internos" a "rompe
   integraciones de terceros". Revisar este ADR **antes** de ese lanzamiento, no después.

## Consecuencias

- Cero trabajo de migración ahora — el foco sigue en billing/hosting (Fase 1, puntos 5-6) y en
  Bloque C de signup (invitaciones), que sí tienen usuarios reales esperando.
- El riesgo de "adivinar mal la forma del paraguas" se elimina, a costa de que si dos
  capacidades Engine llegan casi al mismo tiempo, el primer PR de la segunda tendrá que hacer
  el trabajo de introducir `WorkItem` bajo presión de entrega en vez de con calma. Aceptable:
  es el mismo trade-off que este proyecto ya tomó conscientemente con RBAC y con catálogos EAV.
- Este documento es el lugar donde vive esa decisión — no hace falta repetir el razonamiento en
  cada retro de producto; solo enlazarlo.
