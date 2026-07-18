# Producto: qué es Nexo y para quién

Este archivo es sobre **qué construimos y por qué**, no sobre precios (→
[monetization.md](monetization.md)) ni sobre cómo está hecho por dentro (→
[architecture.md](architecture.md)). Para saber qué está hecho y qué falta ahora mismo, ver
[release-plan.md](release-plan.md).

## Contexto

Nexo nació como herramienta interna (antes "FlowDesk") para un equipo de TI. Se decidió
convertirla en producto open source con un modelo de monetización de tres niveles (ver
[monetization.md](monetization.md)).

## Modelo: Open Core

Un solo producto — el núcleo es libre, las capas de conveniencia (Cloud) y cumplimiento
corporativo (Enterprise) se cobran. Mismo modelo que GitLab, Cal.com o Mattermost.

**Regla para decidir en qué plan va cada feature nueva:**
- ¿Un equipo pequeño lo necesita para trabajar? → **Community**
- ¿Es conveniencia/operación (hosting, backups, updates)? → **Cloud**
- ¿Lo exige un departamento de compras o de seguridad? → **Enterprise**

| | Community | Cloud | Enterprise |
|---|---|---|---|
| Qué es | Self-hosted, código libre | Alojado por nosotros, multi-tenant | Nube dedicada o self-hosted |
| Incluye | Kanban, backlog, planeación, reportes, sync AppSheet | Community + updates automáticos, backups, dominio propio | Cloud + SSO/SAML, auditoría, multi-organización |
| Soporte | Comunidad (Discussions) | Email < 24h | 24/7 con SLA |

(Precios y lógica de facturación → [monetization.md](monetization.md).)

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

## Fase 2 — Enterprise (features)

**Estado: 💤 No empezar todavía.** Se construye contra el primer contrato real, no por
adelantado — llegan solos si Community/Cloud funcionan. (Fechas y orden de ejecución →
[release-plan.md](release-plan.md).)

- SSO/SAML (`python3-saml` o Keycloak como broker), SCIM para provisioning
- Audit log: tabla append-only de quién-hizo-qué (el patrón de los `signals` de
  `apps/activities` para el sync de AppSheet es el mismo mecanismo, ya probado)
- RBAC avanzado, multi-organización a nivel de cuenta
- Licenciamiento del código `ee/` (ver [monetization.md](monetization.md) para el porqué)

## Decisión de producto pendiente — el concepto núcleo

Hoy el corazón del producto es `Activity`. Si el producto va a incorporar automatizaciones, IA
o integraciones, vale la pena decidir **antes de estabilizar una API pública** si debe girar
alrededor de un concepto más amplio que "actividad". Ver el ADR dedicado:
[docs/adr/0001-unidad-de-trabajo-en-nexo.md](../adr/0001-unidad-de-trabajo-en-nexo.md).
