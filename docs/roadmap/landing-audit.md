# Auditoría de landing, README y primer minuto (2026-07-20)

Auditoría hecha en panel con roles (CTO evaluando open source) sobre la landing nueva
(`src/components/landing/`, sin commitear al momento de la auditoría), el `README.md` y el
flujo de signup. No es una checklist de estilo — es sobre qué le pasa a un visitante real en
sus primeros 20-30 segundos, en tres puntos de entrada distintos.

**Decisión de secuencia (usuario, 2026-07-20):** la primera ronda separó lo que no dependía de
producción (contenido, quickstart, README, navegación — implementado el mismo día) de lo que
sí dependía del punto 6 (hosting): la paradoja del CTA primario, el CTA contextual bajo la
demo, y las mejoras del primer minuto post-signup. **El mismo 2026-07-20, más tarde, el punto 6
se completó** (backend en Railway + frontend en Cloudflare Workers, dominio real
`nexoengine.tech` de punta a punta) y se retomó esta segunda ronda para implementar todo lo que
había quedado diferido. Quedan pendientes solo los ítems que requieren producir contenido real
(capturas, GIF, video) o diseñar un mecanismo nuevo (demo pública de solo lectura) — ver el
detalle en cada sección.

## Landing (`/landing`) — 7/10

**Fortalezas a conservar:** `BoardSimulator` con plantillas reales (la mejor sección — muestra
el diferenciador "tu flujo, no el nuestro" con datos verdaderos, no un mock genérico);
honestidad de Roadmap/Pricing ("en el roadmap — todavía no son un producto activo"); badge AGPL;
`RoleSelector` con previews reales por rol.

**§1 — CTA primario bloqueante — ✅ resuelto (2026-07-20):** el punto 6 (hosting) se completó
— backend en Railway (`api.nexoengine.tech`) y frontend en un Worker de Cloudflare sirviendo
`nexoengine.tech`, probado de punta a punta con un preflight CORS real. El CTA principal
("Crea tu espacio gratis" → `/signup`) ya funciona en producción; no hace falta el CTA
honesto-provisional (a/b) que se había dejado como plan B.

**Implementado en esta ronda:**
- Footer: formulario de suscripción fake (regex + "✓ te avisaremos" sin enviar nada) →
  reemplazado por enlace real a GitHub Watch/releases.
- Hero: quitado "FlowDesk" del subtítulo (la historia de origen ya vive completa en Roadmap;
  el Hero no debe pedirle a un visitante nuevo procesar un nombre propio irrelevante).
- Navbar: ancla "Funciones" apuntaba al selector de roles (`#features` = `RoleSelector`) →
  renombrada a "Roles".
- NEXO ENGINE: 6 de 9 tarjetas eran "Roadmap", transmitiendo "la mayoría es promesa" →
  reagrupadas: las 3 disponibles con más peso visual arriba, roadmap como fila secundaria
  compacta.
- Pricing: el botón de quickstart solo copiaba `docker compose up --build` — sin `git clone`
  previo ese comando no hace nada. Ahora copia el bloque completo.
- Sync con Google Sheets: diferenciador confirmado (`docs/roadmap/product.md`) que hoy es un
  bullet perdido en Pricing. Se le da un bloque propio cerca de la demo.
- Demo: el picker de plantilla no disparaba la simulación automáticamente (había que
  descubrir el botón "Simular sprint"). Ahora autoplay al cambiar de plantilla.
- Micro-FAQ: "¿AGPL me obliga a publicar mi código?" (duda #1 de todo CTO con AGPL), "¿puedo
  exportar mis datos?", "¿qué pasa si dejan de mantenerlo?".
- Señales de actividad del repo (tests en CI, imagen en GHCR) como prueba social verificable
  — no hay usuarios aún para testimonios, pero sí actividad real.
- CTA contextual bajo la demo (2026-07-20): botón "Empieza con '{plantilla}'" debajo del
  tablero, a `/signup?template=<key>` — captura el momento de máxima intención tras elegir
  plantilla y ver el sprint correr. La ruta `/signup` acepta `?template=` y preselecciona el
  Select del formulario.

**Sigue pendiente (necesita producto real corriendo/grabándose, no depende de hosting):**
- Carrusel/capturas del producto real (dashboard, Kanban, reportes, Configuración → Maestros)
  — hoy la única demo es el mock del `BoardSimulator`.
- Instancia demo pública (login de solo lectura sobre `seed_data`) — el mayor generador de
  confianza para open source. Ya hay hosting para soportarla; falta diseñar el mecanismo de
  login de solo lectura (usuario compartido vs. token de un solo uso) antes de exponerlo.
- Open Graph image para compartir en Slack/X/LinkedIn.

## README — 6/10

Correcto y honesto, pero invisible para quien decide en los primeros 20 segundos: cero
elementos visuales, ningún link a la landing, y describe el Nexo de hace un mes (no menciona
plantillas de flujo, multi-tenancy ni códigos de acceso).

**Implementado:** features actualizadas (multi-tenancy, plantillas, códigos de acceso), párrafo
inicial en inglés (GitHub es global; español-first es una decisión de producto, no un
accidente — vale la pena decirlo explícitamente en vez de asumirlo), mención de la org `acme`
del seed para ver multi-tenant en acción, sección "Estado del proyecto" con el checklist de
Fase 1. Link "¿solo quieres verlo? → nexoengine.tech" agregado el 2026-07-20 una vez que el
dominio quedó realmente sirviendo la app (antes habría sido un link muerto).

**Sigue pendiente:** GIF en loop del Kanban real arrastrando una tarjeta — es el elemento de
mayor retorno de todo el README (primer scroll, antes del `git clone`) pero requiere grabarlo
contra el producto corriendo; se deja como pendiente explícito, no como placeholder falso.

## Signup y primer minuto — 8/10

Dual-mode limpio (organización nueva vs. código de acceso), preview "Te unirás a X como Y"
antes de registrar.

**Implementado (2026-07-20):**
- Empty state activador en el dashboard vacío (`src/routes/_app/index.tsx`): en vez de mostrar
  gráficas y métricas todas en cero, "Tu espacio está listo — falta la primera actividad",
  muestra el código real que tendrá (`{PREFIJO}-0001`, del `codigo_prefix` de la organización)
  y un botón directo a `/activities?new=1`, que abre el formulario de creación solo — mayor
  palanca sobre `first_activity_created`, la métrica de activación ya instrumentada en
  `apps/organizations/funnel.py`.
- `/signup` acepta `?template=<key>` desde el CTA contextual de la landing y preselecciona la
  plantilla en el formulario.
- Nudge del Owner: en el mismo empty state, si `user.rol === "owner"`, una línea secundaria
  "¿Ya tienes equipo? Genera un código de acceso para invitarlos" → `/users`.

**Sigue pendiente:** selector de plantilla con preview visual (miniatura de columnas coloreadas
en vez de un `<Select>` de texto plano) — el deep-link `?template=` ya funciona, falta la parte
visual del selector en sí.

## Videos y GIFs recomendados (sin producir en esta ronda)

- Video "De cero a tablero en 2 minutos" — instalación, sin voz, 60-75s, para README/Pricing.
- Video "Tu flujo en 5 minutos" — configurabilidad, para junto a la demo.
- GIF README: Kanban real, arrastrar tarjeta, 8-10s en loop.
- GIF código de acceso: Owner genera código → signup con preview del rol.

Todos requieren grabar contra el producto real corriendo — no se simulan con capturas de la
demo mock.
