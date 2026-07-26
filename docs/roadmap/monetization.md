# Monetización: precios, licencia, billing

Este archivo es sobre **cómo se cobra Nexo**, no sobre qué se construye (→
[product.md](product.md)) ni sobre cómo está hecho por dentro (→ [architecture.md](architecture.md)).

## Precios de referencia

| | Community | Cloud | Enterprise |
|---|---|---|---|
| Precio | $0 | $5–10 USD / usuario / mes | Contrato anual |

Linear cobra $8/usuario, Jira/Asana más — $5–10 nos posiciona para entrar. Sugerido: Cloud
gratis hasta 5 usuarios como embudo de conversión self-service.

**Diferenciador real para marketing** (no para ingeniería): sync bidireccional con Google
Sheets/AppSheet, y producto nativo en español para TI hispanohablante. (Diferenciadores de
producto completos → [product.md](product.md).)

## Licencia: AGPL-3.0 (decisión ya tomada, no reabrir sin razón de peso)

MIT/Apache permitiría que cualquier proveedor tome Nexo, lo aloje y venda su propio plan Cloud
compitiendo contra nosotros. AGPL obliga a quien lo ofrezca como servicio a publicar sus
modificaciones — protege el negocio Cloud. Las features Enterprise, cuando existan, van en una
carpeta `ee/` con licencia comercial propia (modelo GitLab), en el mismo repo.

## Billing (Fase 1, punto 5 — implementado 2026-07-25)

**Proveedor: Lemon Squeezy (Merchant of Record), no Stripe.** Stripe no opera nativamente para
cuentas colombianas — queda descartado como solución inicial. Un Merchant of Record cobra
globalmente en USD y maneja los impuestos internacionales por nosotros, a cambio de un fee más
alto y de que la factura la emite una entidad extranjera (no DIAN). Pasarelas colombianas
(Wompi, Mercado Pago, PayU) quedan como opción futura, solo cuando exista demanda real de
factura DIAN de un cliente empresarial — hoy implicarían que Iber maneje DIAN/IVA/contabilidad
directamente, tiempo operativo que no hay como founder solo. Razonamiento completo →
[launch-strategy.md](launch-strategy.md).

Entidades: `BillingCustomer`, `Subscription`, `CheckoutSession`, `WebhookEvent` (en
`backend/apps/billing/models.py`). Webhooks procesados de forma idempotente contra
`WebhookEvent`, cuya clave de deduplicación es el **sha256 del cuerpo crudo**: Lemon Squeezy no
garantiza un id único de entrega, y el digest tiene justo la semántica que se necesita — un
reintento trae el mismo cuerpo y se descarta, mientras que dos `subscription_updated` distintos
son dos eventos reales.

### Acceso por estado de suscripción

| Estado | Acceso | Plan efectivo |
|---|---|---|
| Sin suscripción | Completo | Community |
| Trial vigente | Completo | Cloud |
| Trial vencido | Completo | **Community** |
| Active | Completo | Cloud |
| Past Due / Paused | Solo lectura | Cloud |
| Cancelled, periodo pagado sin vencer | **Completo** | Cloud |
| Cancelled, ya vencida | Solo lectura | Cloud |
| Expired | Bloqueado | Community |

Dos filas se apartan de la tabla original de [launch-strategy.md](launch-strategy.md), a
propósito:

- **Cancelada con periodo pagado vigente conserva acceso completo.** Lemon Squeezy marca
  `cancelled` en cuanto alguien apaga la renovación, no cuando termina el periodo. Cortar ahí
  sería cobrar un mes y no entregarlo.
- **Un trial vencido degrada el plan, no el acceso.** La asimetría manda: dejar entrar de más
  regala acceso a quien no iba a pagar igual; cortar de más echa de su propia data a alguien que
  nunca debió un peso. `read_only` queda para quien sí pagó y dejó de hacerlo, que es cobranza
  real. Coherente además con "Cloud gratis hasta 5 usuarios" como embudo.

Dos reglas más gobiernan el módulo: **billing es opt-in** (sin las variables de Lemon Squeezy
configuradas —el caso del self-hosted AGPL— nada gatea nada y los endpoints de cobro responden
503), y **una organización sin `Subscription` tiene acceso completo** (solo se degrada a quien
*tuvo* una suscripción y su estado se deterioró).

`Organization.plan` y `Organization.feature_flags` existen desde el Bloque 1 de multi-tenancy —
pero **la lógica de límites por plan sigue sin diseñarse**: hoy Cloud no restringe nada, así que
la diferencia que otorga un trial es todavía nominal. Es el siguiente paso natural de este
punto.

## Bitácora

- **2026-07-16** — Elegido AGPL-3.0 sobre MIT para proteger el plan Cloud de reventa por
  terceros.
- **2026-07-18** — Billing diseñado: Lemon Squeezy sobre Stripe (bloqueado para Colombia) y
  sobre pasarelas locales (velocidad de lanzamiento vs. carga operativa de DIAN/IVA). Detalle
  completo en [launch-strategy.md](launch-strategy.md).
- **2026-07-25** — Billing implementado (`backend/apps/billing/`). Al construirlo aparecieron
  las dos excepciones a la tabla de acceso documentadas arriba (cancelada con periodo pagado, y
  trial vencido), ninguna visible desde el diseño en papel: la primera sale de la semántica real
  de `cancelled` en Lemon Squeezy, la segunda de mirar qué cuesta más caro equivocarse en cada
  dirección.
