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

## Billing (Fase 1, punto 5 — diseñado, sin implementar)

**Proveedor: Lemon Squeezy (Merchant of Record), no Stripe.** Stripe no opera nativamente para
cuentas colombianas — queda descartado como solución inicial. Un Merchant of Record cobra
globalmente en USD y maneja los impuestos internacionales por nosotros, a cambio de un fee más
alto y de que la factura la emite una entidad extranjera (no DIAN). Pasarelas colombianas
(Wompi, Mercado Pago, PayU) quedan como opción futura, solo cuando exista demanda real de
factura DIAN de un cliente empresarial — hoy implicarían que Iber maneje DIAN/IVA/contabilidad
directamente, tiempo operativo que no hay como founder solo. Razonamiento completo →
[launch-strategy.md](launch-strategy.md).

Entidades nuevas: `BillingCustomer`, `Subscription`, `CheckoutSession`, `WebhookEvent`. Webhooks
mínimos: `subscription_created`/`subscription_updated`/`subscription_cancelled`/
`payment_failed`, procesados de forma idempotente contra `WebhookEvent`. Acceso por estado:
Trial/Active → completo, Past Due/Cancelled → solo lectura, Expired → bloqueado.
`Organization.plan` y `Organization.feature_flags` ya existen desde el Bloque 1 de
multi-tenancy — la lógica de límites por plan se termina de diseñar cuando llegue el turno (ver
[release-plan.md](release-plan.md) para el plan de sprints).

## Bitácora

- **2026-07-16** — Elegido AGPL-3.0 sobre MIT para proteger el plan Cloud de reventa por
  terceros.
- **2026-07-18** — Billing diseñado: Lemon Squeezy sobre Stripe (bloqueado para Colombia) y
  sobre pasarelas locales (velocidad de lanzamiento vs. carga operativa de DIAN/IVA). Detalle
  completo en [launch-strategy.md](launch-strategy.md).
