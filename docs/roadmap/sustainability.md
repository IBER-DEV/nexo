# Licencia y sostenibilidad

Este archivo era `monetization.md` y respondía "cómo se cobra Nexo". Desde el **2026-09-15 la
respuesta es: no se cobra** — ni el self-hosted, ni Cloud, ni una edición Enterprise. No hay
planes, no hay pasarela de pagos, no hay features detrás de un muro. Lo que queda por documentar
es la licencia, qué reemplaza al muro comercial como criterio de diseño, y qué cuesta dinero de
verdad.

Qué se construye → [product.md](product.md). Cómo está hecho por dentro →
[architecture.md](architecture.md).

## Nexo es gratis en todas sus versiones

Una sola edición del producto, disponible de dos maneras:

| | Self-hosted | Nexo Cloud |
|---|---|---|
| Precio | $0 | $0 |
| Funcionalidad | completa | **la misma, sin recortes** |
| Usuarios | sin límite | sin límite |
| Quién paga la infraestructura | tú | nosotros |

No hay un "tier gratuito" con techo: no existe un plan superior al que empujar. Que Cloud tenga
lista de espera no es un embudo de conversión — es cupo real de servidores, y es la única
diferencia operativa entre las dos columnas.

### Consecuencias para el diseño del código

Sin planes, tres reglas que antes hacían falta dejan de existir y **no deben volver a
introducirse sin una decisión explícita**:

- **Ningún límite es "del plan".** Si algún día hace falta acotar algo (p. ej. `MCP_DAILY_LIMIT`),
  es una protección de infraestructura configurada por quien opera la instancia, con default
  "sin tope" — no un número que se levante pagando.
- **Ninguna feature se esconde.** Flujos configurables, reportes, sync con Google Sheets y el
  servidor MCP van completos para todos. Esto ya era el principio anterior ("el muro es de
  puestos, no de features"); ahora simplemente no hay muro.
- **Nada consulta un plan para decidir.** El campo `Organization.plan` se borró
  (`organizations.0005`). Los feature flags que quedan (`DEFAULT_FEATURE_FLAGS` en
  `apps/organizations/models.py`) existen para *apagar* algo ante un problema, no para venderlo.

## Licencia: AGPL-3.0

**Se mantiene**, aunque el argumento original cambió. Se eligió para impedir que un tercero
tomara Nexo, lo alojara y vendiera un Cloud compitiendo contra el nuestro. Sin negocio Cloud que
proteger ese motivo ya no aplica, pero quedan dos que sí:

- **Reciprocidad.** Quien ofrezca Nexo modificado como servicio publica sus modificaciones. Lo
  que se protege ya no es un ingreso, es que las mejoras vuelvan al proyecto.
- **Coherencia con lo prometido.** Cambiar a MIT/Apache permitiría que alguien construya encima
  un producto cerrado y de pago — exactamente lo que esta página dice que Nexo no es.

La carpeta `ee/` con licencia comercial que contemplaba el modelo GitLab **no se va a crear**:
no hay edición Enterprise que licenciar aparte.

## Qué cuesta dinero, entonces

Ser gratis no es ser gratuito de producir. Los costos reales, y por qué hoy son asumibles:

- **Infraestructura de Cloud** (Railway + Postgres + correo transaccional). Es el único costo que
  crece con los usuarios, y por eso Cloud abre por tandas con lista de espera en vez de registro
  abierto: el límite es la factura del servidor, no una decisión comercial.
- **IA: cero.** Nexo no paga inferencia. El usuario conecta su propio cliente MCP con su propia
  cuenta. Este es el motivo por el que el diferenciador más caro de la categoría acá no cuesta
  nada — y por el que regalarlo es sostenible.
- **Tiempo de desarrollo**, que hoy no se cobra a nadie.

Si algún día el costo de Cloud deja de ser asumible, las salidas honestas son cerrar el registro
o pedir apoyo voluntario — **no** recortar la versión gratuita de lo que ya se entregó. Esa
promesa está escrita en la landing (sección de precios y FAQ) y se rompe en público si cambia.

## Bitácora

- **2026-07-16** — Elegido AGPL-3.0 sobre MIT para proteger el plan Cloud de reventa por
  terceros.
- **2026-07-18** — Billing diseñado: Lemon Squeezy sobre Stripe (bloqueado para Colombia) y
  sobre pasarelas locales. Razonamiento en [launch-strategy.md](launch-strategy.md).
- **2026-07-25** — Límites por plan definidos e implementados (5 puestos en el tier gratuito de
  Cloud); MCP declarado gratis en todos los planes.
- **2026-09-15** — **Nexo pasa a ser gratis en todas sus versiones, Cloud incluido.** Se eliminó
  la app `billing` completa (Lemon Squeezy, suscripciones, checkout, webhooks, trials), el campo
  `Organization.plan`, los límites de puestos y los dos crons asociados. Decisión y alcance en
  [ADR 0003](../adr/0003-nexo-es-gratis.md).
