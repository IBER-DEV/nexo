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

## Billing (Fase 1, punto 5 — sin diseñar todavía)

Stripe (Checkout + Customer Portal ahorran la mayor parte del trabajo), webhook que
activa/suspende la organización según estado de pago. `Organization.plan` y
`Organization.feature_flags` ya existen desde el Bloque 1 de multi-tenancy — la lógica de
límites por plan se diseña aquí, cuando llegue el turno (ver [release-plan.md](release-plan.md)).

## Bitácora

- **2026-07-16** — Elegido AGPL-3.0 sobre MIT para proteger el plan Cloud de reventa por
  terceros.
