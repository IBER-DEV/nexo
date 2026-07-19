# ADR 0002 — Membership: dominio como servicio, no (todavía) como tabla

**Estado:** Aceptado.
**Fecha:** 2026-07-18.
**Revisar antes de:** construir multi-organización por cuenta (Enterprise, Fase 2) o cualquier
segundo mecanismo de incorporación (email, SSO/SAML, SCIM, API de provisioning).

## Contexto

El Bloque C del signup (incorporar miembros a una organización) se diseñó primero alrededor de
invitaciones por correo: modelo `Invitation` con token, expiración, reenvío, aceptación,
estados pendientes. Ese diseño se descartó **antes de implementarse** por dos razones:

1. Toda esa maquinaria resuelve un problema de UX (cómo le llega el enlace a la persona), no
   un problema de dominio (que una persona pertenezca a una organización con un rol). Y mete
   la entrega de un correo — un sistema externo que puede fallar, demorar o caer en spam —
   en el camino crítico de incorporar a alguien.
2. Mezclaba dos conceptos que deben estar separados: **crear una cuenta** y **pertenecer a una
   organización**. La invitación acoplaba ambos a un token dirigido a un email concreto.

La dirección nueva: el dominio se diseña alrededor de **Membership** (pertenecer a una
organización con un rol), y el mecanismo de incorporación es un detalle intercambiable. Hoy es
un código de acceso; mañana puede ser email, enlace mágico, SSO, SCIM o una API — todos deben
terminar en el mismo lugar.

## La pregunta estructural: ¿tabla `Membership` ya?

Se evaluó introducir la entidad física `User → Membership → Organization` (join table con
organización, rol, is_active por membresía) desde ahora, aunque solo se permita una
organización por usuario. Se decidió que **no**, por lo siguiente:

- Todo el aislamiento multi-tenant del proyecto (`OrgQuerySet.for_org()`,
  `OrganizationScopedViewSetMixin`, la segunda línea de defensa en serializers, el test de
  guardia `test_scoping_guard.py`) lee `request.user.organization` — un FK directo. Mover eso
  a una join table significa reabrir la capa de seguridad más delicada del sistema para
  soportar algo (multi-org) que ningún usuario necesita hoy y que el roadmap ya ubica en
  Enterprise.
- Es el mismo patrón de decisión que este proyecto ya tomó conscientemente tres veces: RBAC
  configurable (diferido a Fase 2), catálogos EAV (diferidos sin caso real de cliente),
  `WorkItem` paraguas (ADR 0001: diferido hasta el segundo caso concreto). Diseñar la tabla
  `Membership` hoy sería adivinar su forma sin el caso que la define — ¿la membresía tiene su
  propio `is_active` o hereda el del usuario? ¿el rol vive por membresía o por usuario? Esas
  preguntas solo se responden bien con el requisito Enterprise real enfrente.

## Decisión

1. **El seam es un servicio, no una tabla**: `apps/organizations/membership.py` con una única
   puerta de entrada — `add_member(*, user, organization, rol)` — para unirse a una
   organización existente. Todo mecanismo de incorporación presente o futuro (código de acceso
   hoy; email, SSO, SCIM, API mañana) DEBE llamar esta función; ninguno escribe
   `user.organization`/`user.rol` por su cuenta. El storage actual (FK + rol en `User`) queda
   encapsulado detrás del servicio: cuando llegue multi-org, cambia el interior de
   `membership.py` y su storage, no sus llamadores.
2. **Fundar ≠ unirse**: `signup.register()` (crear organización + Owner) NO pasa por
   `add_member` — fundar es otro caso de dominio, y `add_member` rechaza `rol="owner"` por
   diseño (el constraint `unique_owner_per_organization` respalda esto en DB).
3. **El primer mecanismo es el código de acceso** (`OrganizationAccessCode`: rol inicial,
   expiración opcional, máximo de usos, contador, activo/inactivo, generado con `secrets`).
   No depende del correo. Un código con `max_usos=1` y expiración corta **es** una invitación
   individual — el modelo es un superset del diseño descartado, no una pérdida de capacidad.
4. **Punto de reapertura**: este ADR se revisa cuando (a) Enterprise necesite multi-org por
   cuenta, o (b) se construya un segundo mecanismo de incorporación. En ese momento, la
   migración a tabla `Membership` es un cambio interno de `membership.py` + una migración de
   datos (una fila por usuario con org), sin tocar a los llamadores.

## Consecuencias

- El MVP de "gestión de miembros" no tiene tokens por email, estados pendientes, reenvíos ni
  correos fallidos — el ciclo de vida completo del acceso vive en nuestra base de datos y es
  verificable síncronamente.
- Incorporar a alguien no requiere que el correo funcione (crítico mientras Resend esté en
  sandbox, y sano incluso después).
- El costo aceptado: si multi-org llega antes de lo previsto, la migración FK→tabla se hará
  bajo presión de ese requisito — mitigado porque el seam ya concentra todos los puntos de
  escritura en un solo módulo.
