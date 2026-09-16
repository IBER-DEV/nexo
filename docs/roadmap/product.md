# Producto: qué es Nexo y para quién

Este archivo es sobre **qué construimos y por qué**, no sobre licencia y costos (→
[sustainability.md](sustainability.md)) ni sobre cómo está hecho por dentro (→
[architecture.md](architecture.md)). Para saber qué está hecho y qué falta ahora mismo, ver
[release-plan.md](release-plan.md).

## Contexto

Nexo nació como herramienta interna (antes "FlowDesk") para un equipo de TI. Se decidió
convertirla en producto open source. Arrancó con un modelo open core de tres niveles; desde el
2026-09-15 **es gratis en todas sus versiones** y ese modelo desapareció (→
[ADR 0003](../adr/0003-nexo-es-gratis.md)).

## Modelo: un solo producto, gratis

No hay ediciones. Lo que existe son dos formas de correr **el mismo producto completo**:
self-hosted (AGPL-3.0, en tu servidor) o Nexo Cloud (alojado por nosotros). Ninguna feature vive
detrás de un plan, y no hay límite de usuarios en ninguna de las dos.

**Regla para decidir qué se construye** (ya no "en qué plan va"):
- ¿Un equipo pequeño lo necesita para trabajar? → **se construye**, va para todos.
- ¿Es operación de la instancia alojada (backups, updates, dominio)? → **es trabajo de Cloud**,
  no una feature del producto.
- ¿Lo exige un departamento de compras o de seguridad (SSO, auditoría)? → **Fase 2**, contra un
  caso real — y también gratis cuando exista.

(Licencia, costos reales y por qué esto es sostenible → [sustainability.md](sustainability.md).)

## Diferenciadores de producto

Confirmados con investigación de mercado (2026-07-17): ningún competidor (Jira, Asana, Monday,
Plane, OpenProject) resuelve estos puntos de la misma forma.

- **Sync bidireccional nativo con Google Sheets/AppSheet** — Jira/Asana/Monday solo lo logran
  con middleware de pago (Unito, ~$10+/usuario extra) o exports unidireccionales enterprise.
  Permite migrar equipos que hoy viven en hojas de cálculo sin big-bang.
- **Producto en español nativo** — nicho hispanohablante de TI mal servido hoy.
- **Flujos configurables sin la complejidad de administración de Jira** — "configurable en 5
  minutos": maestros (`WorkflowState`/`Priority`/`ActivityType`) por organización, no enums
  fijos de código.
- **Plantillas de flujo por tipo de equipo** (TI clásico / Kanban simple / Mesa de ayuda) —
  onboarding sin fricción, sienta base para un futuro marketplace de plantillas de comunidad.
- **Mapeo a sistemas externos genérico** (`external_mappings` por estado) — la puerta a
  integrar Jira/Azure DevOps ya está en el modelo de datos, no es una promesa de roadmap sin
  base.

## ICP y qué no construir

**Cliente objetivo:** equipo de TI de 5-50 personas en LATAM que hoy coordina trabajo en una
hoja de cálculo, asigna por WhatsApp, reporta avances a mano y encuentra a Jira demasiado
complejo. **No es el ICP inicial:** equipos de producto tipo Silicon Valley, empresas que piden
SAML desde la demo, organizaciones con procurement pesado — una feature que solo ese segundo
grupo pediría no es prioridad. Detalle de la tesis competitiva (por qué vertical y no horizontal
contra Plane/Jira/Linear) en [launch-strategy.md](launch-strategy.md).

Trampas de tiempo explícitas para los próximos 12 meses — no reabrir sin un caso de cliente
real: SSO/SAML, LDAP, SCIM, marketplace de apps, wiki colaborativa completa, AI generativa
compleja, motor de automatización estilo Zapier. Todas caben en la Fase 2 de abajo cuando (y si)
hay un contrato real detrás.

## Fase 2 — features de organización grande

**Estado: 💤 No empezar todavía.** Se construye contra el primer caso real, no por adelantado.
Ya no se llaman "Enterprise" ni se cobran: son simplemente lo último de la lista. (Fechas y
orden de ejecución →
[release-plan.md](release-plan.md).)

- SSO/SAML (`python3-saml` o Keycloak como broker), SCIM para provisioning
- Audit log: tabla append-only de quién-hizo-qué (el patrón de los `signals` de
  `apps/activities` para el sync de AppSheet es el mismo mecanismo, ya probado)
- RBAC avanzado, multi-organización a nivel de cuenta

La carpeta `ee/` con licencia comercial que contemplaba el plan original **no se va a crear** —
ver [sustainability.md](sustainability.md).

## Decisión de producto pendiente — el concepto núcleo

Hoy el corazón del producto es `Activity`. Si el producto va a incorporar automatizaciones, IA
o integraciones, vale la pena decidir **antes de estabilizar una API pública** si debe girar
alrededor de un concepto más amplio que "actividad". Ver el ADR dedicado:
[docs/adr/0001-unidad-de-trabajo-en-nexo.md](../adr/0001-unidad-de-trabajo-en-nexo.md).
