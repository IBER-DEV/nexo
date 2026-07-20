# Auditoría de landing, README y primer minuto (2026-07-20)

Auditoría hecha en panel con roles (CTO evaluando open source) sobre la landing nueva
(`src/components/landing/`, sin commitear al momento de la auditoría), el `README.md` y el
flujo de signup. No es una checklist de estilo — es sobre qué le pasa a un visitante real en
sus primeros 20-30 segundos, en tres puntos de entrada distintos.

**Decisión de secuencia (usuario, 2026-07-20):** la landing y el README no se publican hasta
que el punto 6 (hosting del backend) esté resuelto — hoy no hay worker de Cloudflare para el
frontend ni backend en producción, solo un hosting comprado en Hostinger para
`nexoengine.tech`. Por eso **todo lo que depende de "el signup funciona en producción" queda
fuera de esta ronda**: la paradoja del CTA primario (§1), el CTA contextual bajo la demo hacia
`/signup?template=`, la instancia demo pública, y las mejoras del primer minuto post-signup
(empty state activador, nudge de código de acceso). Esos puntos se retoman cuando el punto 6
esté hecho — están documentados aquí para no perderlos, no para implementarlos ahora. El resto
(honestidad de contenido, quickstart, README, estructura) no depende de tener backend en
producción y se implementa ya.

## Landing (`/landing`) — 7/10

**Fortalezas a conservar:** `BoardSimulator` con plantillas reales (la mejor sección — muestra
el diferenciador "tu flujo, no el nuestro" con datos verdaderos, no un mock genérico);
honestidad de Roadmap/Pricing ("en el roadmap — todavía no son un producto activo"); badge AGPL;
`RoleSelector` con previews reales por rol.

**§1 — CTA primario bloqueante (🔴, diferido junto con el punto 6):** el CTA principal
("Crea tu espacio gratis" → `/signup`) no puede completarse sin backend en producción. Un CTA
primario que falla es peor que no tenerlo. Opciones cuando llegue el momento de publicar: (a)
adelantar el hosting antes de publicar esta versión, o (b) mientras tanto, CTA primario = lo
que sí funciona hoy (autoalojar), con "Cloud próximamente + lista de espera" como secundario
honesto.

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

**Diferido junto con el punto 6 (hosting):**
- Resolver la paradoja del CTA primario (§1).
- CTA contextual bajo la demo ("Empieza con esta plantilla →" a `/signup?template=`) — capturar
  el momento de máxima intención tras elegir plantilla y ver el sprint correr.
- Carrusel/capturas del producto real (dashboard, Kanban, reportes, Configuración → Maestros)
  — hoy la única demo es el mock del `BoardSimulator`.
- Instancia demo pública (login de solo lectura sobre `seed_data`) — el mayor generador de
  confianza para open source, pero requiere hosting por definición.
- Open Graph image para compartir en Slack/X/LinkedIn.

## README — 6/10

Correcto y honesto, pero invisible para quien decide en los primeros 20 segundos: cero
elementos visuales, ningún link a la landing, y describe el Nexo de hace un mes (no menciona
plantillas de flujo, multi-tenancy ni códigos de acceso).

**Implementado en esta ronda:** features actualizadas (multi-tenancy, plantillas, códigos de
acceso), párrafo inicial en inglés (GitHub es global; español-first es una decisión de
producto, no un accidente — vale la pena decirlo explícitamente en vez de asumirlo), mención
de la org `acme` del seed para ver multi-tenant en acción, sección "Estado del proyecto" con
el checklist de Fase 1, link a la landing.

**Diferido (necesita producto grabándose o hosting):** GIF en loop del Kanban real arrastrando
una tarjeta — es el elemento de mayor retorno de todo el README (primer scroll, antes del
`git clone`) pero requiere grabarlo contra el producto corriendo; se deja como pendiente
explícito, no como placeholder falso. El link "¿solo quieres verlo? → nexoengine.tech" también
queda fuera de esta ronda por la misma razón que el CTA de la landing: hoy no hay worker de
Cloudflare desplegado ahí, así que el link estaría muerto — se agrega cuando el punto 6 esté
resuelto y la landing tenga dónde vivir.

## Signup y primer minuto — 8/10

Dual-mode limpio (organización nueva vs. código de acceso), preview "Te unirás a X como Y"
antes de registrar. **Todo lo de esta sección queda diferido junto con el punto 6** porque
signup no tiene backend en producción todavía:
- Empty state activador en el dashboard vacío ("Crea tu primera actividad — obtendrá el código
  `{PREFIJO}-0001`") — mayor palanca sobre `first_activity_created`, la métrica de activación
  ya instrumentada en `apps/organizations/funnel.py`.
- Selector de plantilla con preview visual (miniatura de columnas) + aceptar `?template=` desde
  la landing.
- Nudge post-signup del Owner hacia "genera un código de acceso para tu equipo".

## Videos y GIFs recomendados (sin producir en esta ronda)

- Video "De cero a tablero en 2 minutos" — instalación, sin voz, 60-75s, para README/Pricing.
- Video "Tu flujo en 5 minutos" — configurabilidad, para junto a la demo.
- GIF README: Kanban real, arrastrar tarjeta, 8-10s en loop.
- GIF código de acceso: Owner genera código → signup con preview del rol.

Todos requieren grabar contra el producto real corriendo — no se simulan con capturas de la
demo mock.
