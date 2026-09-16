# ADR 0003 — Nexo es gratis en todas sus versiones

**Estado:** Aceptado.
**Fecha:** 2026-09-15.
**Revisar antes de:** reintroducir cualquier cobro, plan, tier, límite comercial o edición
Enterprise de pago. También antes de aceptar un límite nuevo cuya justificación sea "el plan
gratis".

## Contexto

Nexo se venía construyendo como **open core**: núcleo AGPL gratis, Cloud de pago ($5–10
USD/usuario/mes) y una edición Enterprise futura en una carpeta `ee/` con licencia comercial.
Sobre esa premisa se diseñó y construyó el punto 5 de la Fase 1 (Fase 1 punto 5, terminado el
2026-07-25): la app `backend/apps/billing/` con Lemon Squeezy como Merchant of Record —
`BillingCustomer`, `Subscription`, `CheckoutSession`, `WebhookEvent`, checkout hospedado,
webhooks firmados, trial de 14 días, portal de cliente, límite de 5 puestos en el tier gratuito
de Cloud, sincronización de la cantidad facturada y dos comandos cron para mantener todo al día.

Nada de eso llegó a cobrarle a nadie: en producción las variables `LEMONSQUEEZY_*` nunca se
configuraron, así que la facturación estuvo inerte desde el primer día.

## Decisión

**Nexo es gratis en todas sus formas, incluida la que alojamos nosotros.** No hay planes, no hay
pasarela de pagos y no hay features detrás de un muro. Se elimina el módulo de facturación
entero en lugar de dejarlo apagado.

## Por qué eliminarlo y no dejarlo desactivado

Dejarlo con las credenciales vacías era la opción barata. Se descartó por tres razones:

1. **Era un multiplicador de complejidad en el camino caliente.** El estado de la suscripción se
   consultaba en `enforce_global_policy`, es decir en *cada petición autenticada* de la API y de
   MCP. Cuatro entidades, tres estados de acceso, un plan efectivo que se resolvía en caliente
   distinto del guardado, dos puertas que ocupaban puesto y que había que recordar tapar. Todo
   eso para un producto que ya decidió no cobrar.
2. **Código muerto pero armado.** Un webhook firmado que puede cambiar el plan de una
   organización, apagado por la ausencia de una variable de entorno, es exactamente el tipo de
   cosa que alguien reactiva por accidente con un `.env` mal copiado.
3. **La promesa tiene que ser verificable.** "Gratis para siempre" con un checkout funcional
   dormido en el repo se lee distinto a "gratis" sin módulo de cobro. La landing ahora dice que
   no hay plan de pago; el código debe poder respaldarlo.

## Alcance de la eliminación

- Backend: `backend/apps/billing/` completa (modelos, provider, servicio, endpoints, admin,
  tests y los comandos `expire_trials` / `sync_seats`).
- El campo `Organization.plan` y `Organization.Plan`; `PLAN_DEFAULT_FLAGS` pasa a
  `DEFAULT_FEATURE_FLAGS`, sin dimensión de plan. Migración `organizations.0005`, que además
  tumba las tablas `billing_*` — al borrar la app desaparecen sus migraciones y Django no
  generaría el `DeleteModel` por su cuenta.
- Los límites de puestos y sus dos puertas (`membership.add_member`, reactivar por
  `PATCH /users/{pk}/`), la sincronización de puestos facturados y el medidor `SeatUsage`.
- `enforce_global_policy` deja de consultar facturación; conserva las reglas que sí siguen
  vigentes (demo de solo lectura, alcance del token, tokens que no gestionan tokens).
- Frontend: `BillingSettings`, `BillingStatusBanner`, `billingService`, la pestaña Facturación,
  `plan`/`limits` del payload de `/workspace/` (`SCHEMA_VERSION` 2 → 3).
- Landing: la tarjeta de precios de Cloud pasa de "$5–10 / usuario / mes" a "$0".

## Lo que NO cambia

- **La licencia sigue siendo AGPL-3.0.** El motivo original (proteger el negocio Cloud de
  reventa) ya no aplica, pero la reciprocidad sí: quien ofrezca Nexo modificado como servicio
  publica sus modificaciones. Ver [sustainability.md](../roadmap/sustainability.md).
- ~~**La lista de espera de Cloud se queda**~~ — **revertido al día siguiente (2026-09-16).**
  Al quitar el precio quedó a la vista que la lista no protegía ningún cupo: el botón "Crea tu
  espacio gratis" del Hero ya entregaba una organización Cloud completa, a centímetros del
  formulario que prometía "te avisaremos cuando abramos". Se quitó el formulario y el endpoint
  `POST /auth/waitlist/`; la tabla queda como archivo de solo lectura hasta avisarle a quien se
  anotó que Cloud está abierto.
- **La cuota de MCP se queda, con otro sentido.** Ya no es un tope por plan sino
  `MCP_DAILY_LIMIT`, una protección de infraestructura que configura quien opera la instancia,
  con default "sin tope".

## Consecuencias

- Se pierde el dato del tier comercial de cada organización. No significaba nada: ninguna
  organización pagaba.
- Un self-hosted que venía de una versión anterior aplica `organizations.0005` en el arranque
  (`entrypoint.sh` corre `migrate`) y pierde sus tablas `billing_*`, vacías en la práctica.
- Reintroducir cobro no es volver atrás un commit: implica rediseñar el enforcement desde cero.
  Es intencional — el costo de reabrir esta decisión debe ser visible.
