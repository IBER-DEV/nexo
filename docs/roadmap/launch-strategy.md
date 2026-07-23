# Estrategia de lanzamiento de Nexo Cloud

**Definida:** 2026-07-18. Fuente de verdad para la Fase 1 punto 5 (Billing,
[release-plan.md](release-plan.md)) y para el lanzamiento comercial de Nexo Cloud. Este archivo
es sobre **por qué el negocio toma estas decisiones**, no sobre qué se construye (→
[product.md](product.md)) ni cómo está hecho por dentro (→ [architecture.md](architecture.md)).
Precios y licencia siguen viviendo en [monetization.md](monetization.md); este archivo es el
razonamiento detrás de esos números y de la elección de proveedor de pagos.

## La pregunta que gobierna todo

> ¿Esto hace más probable que un equipo pueda registrarse, trabajar y pagar sin que Iber
> intervenga?

Si la respuesta es no, la feature entra al backlog aunque Plane o Jira la tengan. Es el criterio
de corte para todo lo demás en este documento.

## Por qué competir verticalmente, no contra Plane horizontalmente

Plane (competidor open source más cercano) cobra Free/$6/$13/Enterprise y su foso real es
amplitud: open source serio, self-host robusto, mecánica de sprints (Cycles/Modules),
despliegues enterprise gestionados. Kanban, backlog, dashboards, time tracking, wiki,
formularios y vistas personalizadas ya son commodity — no vale la pena pelear ahí.

Nexo no intenta igualar esa amplitud. El nicho es específico: **equipos de TI hispanohablantes
que hoy coordinan trabajo en Google Sheets, AppSheet y herramientas dispersas, y necesitan orden
sin la complejidad de Jira.** Los diferenciadores reales (sync bidireccional con Sheets/AppSheet,
español nativo, flujos configurables en minutos, onboarding por código de acceso) ya están
detallados en [product.md](product.md) — no se repiten acá.

### ICP (Ideal Customer Profile)

**Cliente objetivo:** equipo de TI de 5-50 personas en LATAM, con estas señales de dolor: tiene
una hoja de cálculo para backlog, usa WhatsApp para asignar trabajo, reporta avances
manualmente, le parece que Jira es demasiado complejo, necesita trazabilidad y reportes.

**No es el ICP inicial:** equipos de producto de Silicon Valley, startups que ya viven en
sprints avanzados, empresas que piden SAML desde la demo, organizaciones con procurement pesado.
Esto importa para triage de features: una solicitud que solo el segundo grupo pediría no es
prioridad, sin importar cuánto ruido haga.

### Posicionamiento

> El motor open-core para equipos de TI.

| Competidor | Mensaje |
|---|---|
| Jira | Demasiado complejo |
| Linear | Excelente para producto, no para operaciones TI |
| Plane | Excelente para ingeniería, menos enfocado en operación TI LATAM |
| Nexo | El punto medio: simple, configurable y conectado a Google Sheets |

## Qué NO construir en los próximos 12 meses

Trampas de tiempo — no reabrir sin un caso de cliente real que lo justifique:

| Feature | Motivo |
|---|---|
| SSO/SAML | Solo la piden Enterprise |
| LDAP | Alto costo de mantenimiento |
| SCIM | No genera ventas ahora |
| Marketplace de apps | Requiere ecosistema que no existe |
| Wiki colaborativa completa | Problema distinto al que resuelve Nexo |
| AI generativa compleja | Costosa y difícil de monetizar a este tamaño |
| Motor de automatización estilo Zapier | Es un producto aparte |

(Coincide y refuerza la lista de Fase 2 — Enterprise en [product.md](product.md), que ya
establece que esas features "llegan solas si Community/Cloud funcionan".)

## Billing: por qué Lemon Squeezy y no Stripe

**Hecho confirmado:** Stripe no opera nativamente para cuentas colombianas — descartado como
solución inicial, no por preferencia sino por imposibilidad práctica para un founder solo en
Colombia.

Opciones evaluadas:

- **Merchant of Record (Lemon Squeezy / Paddle):** cobro global en USD, manejan impuestos
  internacionales, checkout hospedado, integración simple, permite vender el día 1. Contra:
  fee más alto, la factura la emite una entidad extranjera (no DIAN).
- **Pasarelas colombianas (Wompi, Mercado Pago, PayU):** cobro en COP, PSE, factura local.
  Contra: Iber maneja DIAN, IVA y contabilidad directamente — más tiempo operativo que
  producto, en la etapa donde el tiempo es el recurso más escaso.

**Decisión: Merchant of Record, proveedor Lemon Squeezy.** No optimiza márgenes, optimiza
velocidad: el tiempo desde "quiero probar Nexo" hasta "Nexo ya me cobró". Wompi (u otra pasarela
local) se agrega **solo cuando exista demanda real** de factura DIAN de un cliente empresarial —
no antes (ver Riesgo 3 abajo).

### Arquitectura mínima de billing

Ya existe (Bloque 1 de multi-tenancy + signup): `Organization`, `plan`, `feature_flags`,
membership, owner, signup self-service.

Falta diseñar/construir:

- **Entidades:** `BillingCustomer`, `Subscription`, `CheckoutSession`, `WebhookEvent`.
- **Webhooks mínimos:** `subscription_created`, `subscription_updated`,
  `subscription_cancelled`, `payment_failed`.
- **Reglas de acceso por estado de suscripción:**

  | Estado | Acceso |
  |---|---|
  | Trial | Completo |
  | Active | Completo |
  | Past Due | Solo lectura |
  | Cancelled | Solo lectura |
  | Expired | Bloqueado |

### Plan de implementación (4 sprints)

1. **Checkout** — integrar SDK/API de Lemon Squeezy, botón "Actualizar a Cloud", checkout
   hospedado, guardar `checkout_id`.
2. **Webhooks** — endpoint firmado, idempotente (clave: `WebhookEvent`), actualiza
   `Organization.plan` según el evento.
3. **Trial** — 14 días, sin tarjeta, conversión iniciada desde la app.
4. **Customer Portal** — cambiar método de pago, cancelar suscripción, ver facturas.

## Métricas

**North Star:** organizaciones activas semanalmente (WAO).

| Métrica de lanzamiento | Objetivo |
|---|---|
| Registro → primera actividad | < 5 min |
| Registro → equipo completo | < 15 min |
| Trial → pago | > 5% |
| Activación | 1 actividad + 1 miembro + 1 cambio de estado |

## Riesgos

1. **"Otro Kanban más"** — mitigación: demostrar el sync con Google Sheets en los primeros 30
   segundos (la demo pública por rol, ya construida en la landing, es el vehículo para esto).
2. **Soporte manual no escala** — mitigación: onboarding guiado + documentación + videos cortos,
   antes de que el volumen de usuarios lo exija.
3. **Clientes empresariales piden factura DIAN** — mitigación diferida: agregar Wompi como
   método secundario solo cuando exista demanda real, no por adelantado.

## Dominio: nexoengine.tech

Ya implementado (detalle operativo completo en [release-plan.md](release-plan.md), punto 6).
Razón de la elección: los dominios `nexo.*` principales estaban ocupados, `nexoengine.tech`
evita crear una marca corporativa separada de la marca de producto, y es suficientemente técnico
para el ICP. Convención: `app.`/`api.`/`docs.` como subdominios, `hola@` para correo.

## La definición de éxito

Nexo no necesita ser el próximo Plane. La primera señal de que el producto encontró su espacio:
un equipo de TI se registra, crea una organización, invita a sus compañeros con un código, mueve
actividades durante una semana y paga USD 5-10 por usuario sin que Iber tenga que ayudarles por
WhatsApp. Cuando eso ocurra repetidamente, Nexo cruzó la frontera entre proyecto personal y
startup real.

## Bitácora

- **2026-07-18** — Estrategia de lanzamiento definida: auditoría competitiva de Plane, tesis
  vertical (no horizontal), ICP explícito, lista de "qué no construir en 12 meses", y decisión
  de billing (Lemon Squeezy sobre Stripe, bloqueado por cuentas colombianas, y sobre pasarelas
  locales, por velocidad de lanzamiento vs. carga operativa de DIAN/IVA). Reemplaza la mención
  de Stripe en [monetization.md](monetization.md) y en el punto 5 de
  [release-plan.md](release-plan.md).
