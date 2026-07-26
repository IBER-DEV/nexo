# CLAUDE.md

Contexto de proyecto para Claude Code. Léelo al empezar cualquier sesión nueva — evita
re-descubrir decisiones ya tomadas. El roadmap (producto, arquitectura, monetización, plan de
entrega) vive en [docs/ROADMAP.md](docs/ROADMAP.md) — es un índice a `docs/roadmap/*.md` y
`docs/adr/`; este archivo es sobre el código en su estado actual.

## Qué es Nexo

Plataforma open source de gestión de actividades para equipos de TI: backlog, planeación
semanal/mensual, Kanban, reportes, roles (admin/coordinador/miembro). Nació como herramienta
interna (antes "FlowDesk"), ahora en transición a producto open core (ver ROADMAP).

## Estructura

```
src/              Frontend: TanStack Start + React 19 + Tailwind v4 + shadcn/ui
backend/          Django 5 + DRF, apps: activities, users
docs/             Roadmap y documentación de producto
docker-compose.yml, backend/Dockerfile   Solo el backend (ver por qué, abajo)
```

## Decisión arquitectónica que no hay que romper

**El frontend despliega a Cloudflare Workers, no a un servidor Node normal.**
`src/server.ts` exporta el handler `fetch(request, env, ctx)` propio de Workers.
`vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que ya trae el plugin de
Cloudflare cableado (el comentario del propio archivo dice no tocarlo manualmente).
Por esto Docker **solo cubre el backend** — dockerizar el frontend como servidor Node
implicaría pelear contra este target y fue una decisión explícita, no un olvido.

**Despliegue real (desde 2026-07-20):** `wrangler.jsonc` tiene `name: "nexo"`, con rutas a
`nexoengine.tech` y `www.nexoengine.tech` (zona migrada a Cloudflare) además del subdominio
`nexo.iber-mascodev.workers.dev` como fallback. `VITE_API_URL` se hornea en build time
(`import.meta.env`, no es una var de runtime del Worker) — **usar siempre `npm run deploy`**
(= `npm run build:prod && wrangler deploy`, con `VITE_API_URL=https://api.nexoengine.tech/api/v1`
vía `cross-env`), nunca `npm run build && npx wrangler deploy` a mano: un `npm run build` a
secas hornea el default de `.env.example` (`localhost:8000`) y el sitio en producción se
rompe en silencio (typecheck/build pasan igual — el error solo aparece en runtime, en la
consola del navegador, como CORS bloqueando `localhost:8000` desde `https://nexoengine.tech`;
ya pasó una vez). El backend vive en Railway (`api.nexoengine.tech`); su
`CORS_ALLOWED_ORIGINS` debe incluir el dominio del Worker que le pega. Detalle completo del
hosting en [docs/roadmap/release-plan.md](docs/roadmap/release-plan.md), punto 6.

## Comandos

```bash
# Frontend
npm install && npm run dev          # localhost:8080 (o el puerto que asigne Vite)
npm run lint                        # ESLint
npx tsc --noEmit                    # typecheck estricto
npm run build                       # build de producción (Cloudflare Worker)

# Backend — nativo
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py seed_data && python manage.py runserver

# Backend — Docker (Postgres real, hot-reload)
docker compose up --build           # localhost:8000

# Tests backend (215 tests: auth, CRUD, visibilidad, tenancy, maestros, sync, organización,
# plantillas, facturación)
docker compose exec -T backend python manage.py test

# Sync AppSheet (Google Sheets) — requiere GOOGLE_SHEETS_CREDENTIALS_JSON configurado
docker compose exec -T backend python manage.py sync_appsheet --org demo --dry-run
```

`seed_data` crea **dos organizaciones** para poder probar aislamiento multi-tenant a mano:
- `demo` (prefijo `ACT`, flujo de 6 estados "TI clásico"): `admin@empresa.com` / `demo1234`
  (admin), `ana.garcia@empresa.com` / `demo1234` (coordinador).
- `acme` (prefijo `ACM`, flujo propio de 4 estados — para ver que el Kanban y los selects
  son realmente dinámicos): `admin@acme.com` / `demo1234` (admin).

También crea un usuario demo por rol en la org `demo` (`demo-{role}@nexoengine.tech` —
`settings.DEMO_EMAIL_TEMPLATE`/`DEMO_ROLES`, owner/admin/coordinator/member), todos con
`is_demo_readonly=True` — sin password, se resuelven vía `POST /auth/demo-login/
{"role": "..."}` (botones "Probar como {rol}" del `RoleSelector` en la landing). `member` y
`coordinator` necesitan datos propios para no ver todo vacío (`ActivityViewSet` los filtra a
lo suyo/su equipo) — `seed_data` les asigna actividades/equipo a mano, no lo reasignes sin
revisar por qué. Ver [docs/roadmap/landing-audit.md](docs/roadmap/landing-audit.md) para el
diseño completo.

## Settings de Django — tres perfiles, no dos

- `config.settings.dev` — SQLite fijo, ignora las variables `DB_*`. Uso nativo local.
- `config.settings.docker` — Postgres real, sin forzar HTTPS. Uso exclusivo de
  `docker-compose.yml`.
- `config.settings.prod` — Postgres + `SECURE_SSL_REDIRECT`/`SESSION_COOKIE_SECURE`. Por
  eso **no sirve para dev local por HTTP** (rompe con redirects en loop). No colapsar
  `docker.py` en `prod.py` ni en `dev.py` — cada uno existe por una razón concreta.

## Gotchas ya resueltos (no los reintroduzcas)

- **Whitenoise**: usa `CompressedStaticFilesStorage`, NO `CompressedManifestStaticFilesStorage`.
  Jazzmin vendoriza un bundle de Bootstrap que referencia un `.js.map` inexistente; la variante
  "Manifest" hace fallar `collectstatic` al intentar reescribir esa referencia.
- **`backend/entrypoint.sh` debe ser ejecutable en el host**, no solo en la imagen — el volumen
  `./backend:/app` de `docker-compose.yml` tapa el `chmod +x` del build con el archivo real del
  host en cada arranque.
- **`VITE_API_URL` es del navegador, no del contenedor.** Aunque el backend corra en Docker,
  esta variable debe apuntar a `http://localhost:8000/...` (no a `http://backend:8000`) porque
  la ejecuta el navegador del usuario, no otro contenedor.
- **Columna `FlowDeskID`** en el sync de AppSheet/Google Sheets (`backend/apps/activities/sheets_client.py`):
  es un contrato externo ya comunicado — no renombrarla sin coordinarlo con la hoja real.
- **Los passwords de `seed_data` (`demo1234`) NO son válidos en producción** — se rotaron a
  mano en la base de datos de Railway (2026-07-21, no en `seed_data.py`) porque
  `nexoengine.tech` apunta a una org `demo` compartida y real: esas credenciales, documentadas
  en el README, daban escritura completa a cualquiera. `seed_data` sigue creando usuarios con
  `demo1234` para self-hosted (`get_or_create` no resetea el password de un usuario ya
  existente, así que re-correr el comando en Railway no deshace la rotación). Si necesitas
  entrar como admin/coordinador a la org `demo` de producción, no existe una password
  documentada — usa el admin de Django o genera una nueva a mano.
- **Puerto de Postgres en compose**: deliberadamente sin publicar al host (`db` no tiene
  `ports:`). Esta máquina ya tenía cosas en 5432 y 5433; el backend igual lo alcanza por la red
  interna de Docker como `db:5432`.
- **Paleta de marca**: todos los colores viven como custom properties en `src/styles.css`
  (`--primary`, `--chart-*`, `--status-*`, etc.). No hardcodear hex en componentes — los
  tokens ya están pensados para funcionar en claro y oscuro.
- **`eslint.config.js`** tiene `ignores` explícitos (`.venv`, `.agents`, `backend`, etc.) — sin
  eso, lint tarda minutos recorriendo directorios que no son del frontend.
- **Ningún queryset de un modelo org-scoped se usa sin pasar por la organización.** Siempre
  `Model.objects.for_org(org)` (manager en `apps/organizations/scoping.py`) o el mixin
  `OrganizationScopedViewSetMixin` en un ViewSet — nunca `Model.objects.all()` ni
  `.filter(...)` a secas en views/serializers. `apps/activities/tests/test_scoping_guard.py`
  falla si un ViewSet nuevo maneja un modelo con FK `organization` y no hereda el mixin; no
  lo excluyas del test, corrige el ViewSet.
- **`WorkflowState.categoria`** (todo/active/done/cancelled) es la única fuente de verdad
  para métricas y para el fallback del sync — nunca compares `estado.slug` contra strings
  tipo `"backlog"`/`"done"` en código nuevo (esos slugs son solo el seed de la org `demo`,
  no existen garantizados en otras organizaciones). Usa los helpers `isDone`/`isCancelled`/
  `isOpen` de `useWorkspace()` en el frontend, o `estado.categoria` en el backend.
- **Mapeo a Google Sheets es `WorkflowState.external_mappings` (JSON)**, no un dict fijo —
  `sheets_client.resolve_state_from_sheet()` ya conserva el estado actual si comparte fase
  con otro más genérico (evita que un pull degrade `en pruebas` a `en progreso`). No
  reintroducir un mapeo hardcodeado de 4 fases.
- **Código de actividad (`ACT-0001`) es por organización**, no una secuencia global —
  `Activity.numero` + `Organization.codigo_prefix`, asignado vía
  `apps/organizations/sequences.py::SequenceService` (no calcules `numero` a mano en
  ningún sitio nuevo).
- **Un permiso "global" agregado a `REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES` no aplica en
  toda la API si algún ViewSet declara su propio `permission_classes`** — en DRF eso
  *reemplaza*, no combina, el default (varios ViewSets del proyecto ya lo hacen: `ActivityViewSet`
  y otros). Para una regla que sí debe ser verdaderamente global, va en
  `apps/users/authentication.py::enforce_global_policy` — ahí sí ningún ViewSet sobreescribe
  nada. Verificalo con una petición real, no solo lectura del código: este bug pasó
  desapercibido hasta un `curl` manual.
- **Toda regla global vive en `enforce_global_policy`, no en una clase de autenticación.** Hay
  dos mecanismos (`NexoJWTAuthentication` para el navegador y
  `PersonalAccessTokenAuthentication` para tokens de larga vida) y **ambos** la llaman. Antes el
  enforcement estaba dentro de `authenticate()` y se encadenaba por herencia
  (`BillingAwareJWTAuthentication` heredaba de `DemoAwareJWTAuthentication`, ambas ya
  eliminadas); eso funcionaba con un solo mecanismo, pero el segundo habría entrado por otra
  clase salteándose demo y facturación sin que nada avisara. Si agregas un tercero (OAuth), su
  única obligación es llamar a esa función.
- **Un test no debe depender de la *ausencia* de configuración.** Los cuatro tests del caso
  self-hosted usan `@override_settings(**BILLING_OFF)` explícito: sin eso pasaban en CI (sin
  credenciales) y empezaban a fallar en la máquina de quien ya conectó su tienda de Lemon
  Squeezy — el peor modo de fallo posible. Ya pasó una vez.

## CI (`.github/workflows/ci.yml`)

En cada push/PR a `main`: frontend (`lint` → `tsc --noEmit` → `build`) y backend
(`manage.py check` → `makemigrations --check --dry-run` → `manage.py test`). La rama `main`
exige estos checks en verde antes de mergear (ruleset configurado en GitHub).
`docker-publish.yml` publica la imagen del backend en GHCR al taggear `v*`.

## Convenciones de UI (para no reinventarlas)

- Modales/diálogos: fade + zoom + slide sutil, no instantáneo (ver `dialog.tsx`,
  `alert-dialog.tsx`) — ya se corrigió una vez por sentirse "brusco".
- Transiciones entre rutas/tabs: usar `key={pathname}` o `key={view}` en el contenedor para
  forzar remount y disparar `animate-fade-in` — un `if/else` puro sin `key` no anima.
- Gráficas Recharts con `<ResponsiveContainer>`: siempre con `debounce={200}`, si no
  recalculan en cada frame de cualquier transición de layout (ej. colapsar el sidebar).
- Sonido de interfaz vía `useSound()` (`src/providers/SoundProvider.tsx`, sobre la librería
  `cuelume`) — solo en momentos que lo ameritan (éxito/error de acciones), nunca en hover o
  en algo que se repita muchas veces por sesión.

## Fase 1 — Bloque 1: Multi-tenancy + Maestros configurables (COMPLETADO — 2026-07-17)

Nexo dejó de asumir una sola empresa con un flujo fijo. `Organization` es el tenant;
`WorkflowState`/`Priority`/`ActivityType` reemplazan los enums fijos que antes vivían en
`Activity.Status`/`Activity.Priority` y en `src/lib/types.ts` — cada organización define su
propio flujo (nombre, color, orden, categoría, estado inicial) y el frontend lo consume
dinámicamente vía `useWorkspace()` (`GET /workspace/`, bootstrap en una sola llamada).
Catálogos (Cliente/Proceso/Aplicación/Stakeholder) tienen dueño; el código de actividad es
por organización (`{prefijo}-0001`). Admin de todo esto en Configuración → Maestros/
Organización. Detalle de decisiones y las 7 etapas (E0-E5) en
`~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`; diferenciadores de producto
detectados en el camino, en `docs/roadmap/product.md`.

**Plantillas de flujo** (`backend/apps/activities/workflow_templates/*.json`, cargadas por
`org_templates.py`): al crear una `Organization` (desde el admin de Django o desde el signup
self-service), un campo/paso "Plantilla de flujo" aplica un preset
(`ti_clasico`/`kanban_simple`/`mesa_ayuda`) vía `apply_template()` — la misma función que usa
`seed_data`. Las plantillas son datos (JSON versionado en git con metadata
`version`/`display_name`/`recommended_for`), no tuplas en Python — agregar una nueva es
agregar un archivo, el loader la descubre por `glob` y valida sus invariantes al arrancar (ver
`workflow_templates/README.md`). `apply_template` **copia** las filas a la org (nunca una
referencia compartida) y solo se llama al crear; editar una org existente no reaplica nada.

## Fase 1 — Punto 4: Signup self-service (COMPLETADO — 2026-07-18)

Registro público sin intervención humana: `POST /api/v1/auth/signup/` (email, password, tu
nombre, nombre de organización, plantilla) crea `Organization` + aplica la plantilla + crea el
primer `User` como `rol=owner`, todo en una transacción (`apps/organizations/signup.py`), y
responde con tokens JWT para auto-login inmediato. Alcance: Identidad completa
(signup/login/logout/forgot/reset) + Organización (nombre→slug→plantilla) + auto-login directo
al dashboard. **Invitaciones a un segundo usuario quedan fuera**, para cuando haya un caso real.

- **Rol `owner`**: nuevo valor en `User.Role`, con `UniqueConstraint` (máximo un owner activo
  por org). `Organization.owner` es una propiedad derivada (busca al `User` con ese rol), no
  un FK — RBAC completo (Owner/Admin/Manager/Member/Viewer) sigue siendo Fase 2.
- **Idempotencia**: el ancla es el email (`unique=True`), no el nombre de la organización —
  nombres duplicados se resuelven con sufijo de slug (`acme`, `acme-2`); un doble-submit con el
  mismo email nunca duplica una organización.
- **Verificación de email no bloqueante**: banner persistente tras el login, nunca gatea el
  flujo. Token stateless (`django.core.signing.TimestampSigner`); reset de contraseña reutiliza
  `default_token_generator` de Django en vez de un segundo esquema de firma.
- **Email transaccional** (primera integración del proyecto): Resend vía `django-anymail`,
  `EMAIL_BACKEND` de consola por defecto en dev/tests, Resend solo en `prod.py` — ver variables
  nuevas en `backend/.env.example`.
- **Dominio separado del proveedor**: `SignupService.register()` nunca importa nada de correo;
  al confirmar la transacción emite un signal Django (`user_registered`,
  `apps/organizations/signals.py`) que la app nueva `apps/notifications/` escucha para enviar
  el correo real — mismo patrón que `apps/activities/signals.py` usa para el push a Sheets.
- **Funnel de producto** (`apps/organizations/funnel.py`): `logger.info` estructurado, no un
  modelo en DB — eventos `signup_started`/`signup_completed`/`email_sent`/`email_confirmed`/
  `first_activity_created`.

Detalle completo y decisiones confirmadas con el usuario en
`~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`; estado del punto en
`docs/roadmap/release-plan.md`.

## Fase 1 — Punto 4, Bloque C: Gestión de miembros y acceso (COMPLETADO — 2026-07-18)

Incorporar miembros NO usa invitaciones por correo (diseño descartado antes de construirse —
ver ADR 0002): el Owner/Admin genera **códigos de acceso** (`OrganizationAccessCode`: rol,
expiración opcional, máx. usos, contador, activo) en Usuarios y equipos, y quien se registra
elige "Tengo un código" en `/signup` (el mismo `POST /auth/signup/` con dos modos excluyentes:
`nombre_org`+`template` XOR `access_code`).

- **Regla dura nueva**: unirse a una organización existente pasa SIEMPRE por
  `apps/organizations/membership.py::add_member()` — ningún mecanismo escribe
  `user.organization`/`user.rol` directo. `add_member` rechaza `rol=owner` (fundar es otro
  caso: solo `signup.register()` crea Owners). El canje (`redeem_access_code`) usa
  `select_for_update` para que `max_usos` no se supere en carrera.
- Gestión de equipo vía `PATCH /api/v1/users/{pk}/` (extendido): `rol` e `is_active` además de
  `coordinador_id`. El Owner es intocable desde ahí y nadie se edita a sí mismo; degradar a un
  coordinador limpia el `coordinador` de su equipo. La lista de usuarios del admin ahora
  **incluye desactivados** (para reactivarlos) — consumidores tipo selector de responsable
  deben filtrar `is_active` (ya hecho en `ActivityForm`).
- `GET /auth/access-codes/resolve/?codigo=` es público (preview "Te unirás a X como Y") — la
  entropía del código (~59 bits, alfabeto sin caracteres ambiguos) hace inviable enumerar.

## Fase 1 — Punto 5: Billing con Lemon Squeezy (COMPLETADO — 2026-07-25)

App nueva `backend/apps/billing/` con las cuatro entidades del diseño (`BillingCustomer`,
`Subscription`, `CheckoutSession`, `WebhookEvent`) y los cuatro sprints construidos: checkout
hospedado, webhooks firmados, trial de 14 días sin tarjeta y portal de cliente. Endpoints bajo
`/api/v1/billing/`; UI en Configuración → Facturación (`BillingSettings`) más un banner global
(`BillingStatusBanner`). Proveedor: Lemon Squeezy como Merchant of Record (Stripe no opera para
cuentas colombianas — ver `docs/roadmap/launch-strategy.md`).

- **Billing es opt-in y falla abierto para el acceso, cerrado para la firma.** Sin
  `LEMONSQUEEZY_API_KEY`/`STORE_ID`/`VARIANT_ID_CLOUD` configuradas (el self-hosted AGPL), nada
  gatea nada y los endpoints de cobro responden 503. Pero `verify_signature` sin
  `WEBHOOK_SECRET` **rechaza** — un webhook no verificable puede cambiarle el plan a una org.
- **El enforcement vive en `enforce_global_policy`, no en un permission class**
  (`apps.billing.access.enforce_billing_access`, llamada desde
  `apps/users/authentication.py`). Es el mismo gotcha ya documentado arriba: un ViewSet con
  `permission_classes` propio anula el default. `/billing/` y `/auth/` quedan exentos —
  bloquear el endpoint por el que se paga a quien tiene que pagar es un callejón sin salida que
  solo se sale por soporte manual.
- **Idempotencia de webhooks por sha256 del cuerpo crudo**, no por un id del proveedor (Lemon
  Squeezy no garantiza uno). Por eso `WebhookView` lee `request.body` **antes** de tocar
  `request.data`: el parser de DRF consume el stream y la firma es sobre esos bytes exactos.
- **El webhook responde 200 aunque el procesamiento falle** (el evento queda `failed` y visible
  en el admin, que es la cola de trabajo manual). Lemon Squeezy reintenta ante cualquier no-2xx,
  y los fallos reales de este handler no se arreglan reintentando. Solo la firma inválida da 401.
- **Ningún sitio escribe `Organization.plan` directo** — siempre `service.sync_organization_plan()`,
  mismo patrón que `membership.add_member()` para `user.organization` (ADR 0002).
- **Un trial vencido degrada el plan, no el acceso**; una suscripción `cancelled` con `ends_at`
  futuro conserva acceso completo. Ambas se apartan de la tabla original del roadmap a
  propósito — el porqué está en `docs/roadmap/monetization.md`, no lo "corrijas" a la tabla.
- `manage.py expire_trials` (idempotente, pensado como cron diario en Railway) revierte a
  Community el plan guardado de los trials vencidos. Sin cron, el único efecto es que ese valor
  se queda desactualizado — el acceso se resuelve en caliente y no depende de él.

### Límites por plan (`apps/billing/limits.py`)

Tres principios, cada uno con su razón — no los relajes sin entenderla:

1. **El self-hosted no se limita nunca.** El gate es `provider.is_configured()`, el mismo de la
   facturación: `plan="community"` significa "self-host libre" (sin techo) o "tier gratuito de
   Cloud" (5 puestos) según ese flag. Limitar un binario AGPL que corre en el servidor de otro
   rompe la promesa open core y además es inaplicable.
2. **El muro es de puestos, no de features.** El core, el sync de Sheets y —cuando exista— MCP
   van completos en todos los planes. Esconder el diferenciador detrás del plan mata la razón
   por la que alguien elige Nexo sobre Plane; se cobra por el eje que crece con el valor.
3. **Un límite bloquea agregar, nunca quita lo que ya existe.** Bajar de plan no desactiva a
   nadie. Los usuarios desactivados no ocupan puesto: esa es la válvula de escape.

- **Dos puertas ocupan un puesto y las dos están tapadas**: `membership.add_member()` (entrada
  nueva, incluido el signup con código) y reactivar a alguien vía `PATCH /users/{pk}/`
  (`UserTeamUpdateSerializer.validate`). Si agregas una tercera, tápala — con solo una abierta el
  techo es decorativo.
- **`limits.effective_plan()` resuelve el plan en caliente**, igual que el nivel de acceso: un
  trial vencido recupera el techo sin esperar al cron de `expire_trials`. Nunca uses
  `organization.plan` directo para decidir un límite — tendrías los límites de un plan y los
  permisos de otro.
- **`service.sync_seats()` empuja los usuarios activos como cantidad facturada** (`quantity` del
  subscription-item de Lemon Squeezy). Sin esto, "puestos ilimitados en el plan de pago" sería
  literal. Es **best-effort a propósito**: va en `transaction.on_commit` y se traga los errores
  del proveedor — nadie debería quedarse sin poder sumar a un compañero por un timeout. La red
  es `manage.py sync_seats` (idempotente, cron diario).
- **La cantidad de puestos se fija en tres momentos, y los tres hacen falta.** (1) Al abrir el
  checkout (`checkout_data.variant_quantities`), para que la *primera* factura ya salga con el
  equipo completo — sin esto una org de 8 pagaba 1 asiento el primer mes, porque ajustar después
  solo corrige de la segunda factura en adelante. (2) Al aplicar la suscripción del webhook, por
  si el equipo cambió entre abrir el checkout y pagar. (3) Cada vez que alguien entra o sale.
- **`provider.create_checkout()` valida `is_configured()` al entrar**, no solo dentro de
  `_request()`: armar el payload ya lee las settings (`int(VARIANT_ID_CLOUD)`), así que sin
  credenciales reventaba con un `ValueError` opaco antes de llegar a la petición.

## Tokens de acceso personal (COMPLETADO — 2026-07-26)

Prerequisito de MCP, resuelto: `PersonalAccessToken` (`apps/users/models.py`) es una credencial
de larga vida para clientes que no pueden mantener una sesión de navegador. Endpoints en
`/api/v1/auth/tokens/`; UI en Configuración → Cuenta (`AccessTokensSection`).

- **El token nunca se guarda en claro** — solo su sha256, y el valor real se muestra una única
  vez al crearlo. Es **sha256 y no PBKDF2/bcrypt a propósito**: esos son lentos por diseño
  porque protegen secretos de baja entropía elegidos por humanos; acá el secreto son 256 bits
  aleatorios y el hash corre en *cada* petición del API, donde esa lentitud sería latencia pura.
- **Un token nunca puede más que su dueño.** La autorización sigue saliendo del rol del `user`;
  `scope` (`read`/`read_write`) solo acota *hacia abajo* — el caso de uso es darle a una IA
  acceso de lectura al backlog sin que pueda modificarlo. Por eso cualquier rol puede emitir
  tokens para sí mismo, no hace falta ser admin.
- **Un token no puede gestionar tokens** (`/auth/tokens/` está bloqueado para ellos). Si
  pudiera, uno de solo lectura emitiría uno de escritura y el `scope` no valdría nada.
- **Desactivar a un usuario corta también sus tokens**, no solo su login.
- `last_used_at` se escribe con throttle de 5 minutos y vía `.update()`: está en el camino
  caliente de cada petición autenticada por token.
- Revocar es `revoked_at`, no un DELETE: la fila queda como registro de que ese token existió.

## Deuda conocida / pendiente

- Sin tests de frontend (solo backend tiene suite).
- **MCP sin construir** (su prerequisito ya está: ver la sección de tokens abajo). Falta el
  servidor en sí y la cuota por plan (gratis en todos, con tope distinto), que es lo único que
  se cobrará de esa feature.
- **Wiki descartada por ahora** (sigue en la lista de "no construir en 12 meses" de
  `launch-strategy.md`). Que la IA escriba el contenido vía MCP no baja el costo de construirla:
  igual hacen falta modelo de documentos, editor, versionado, permisos y búsqueda. La versión
  barata que prueba la misma hipótesis es un campo markdown largo en la actividad.
- Catálogos (Cliente/Proceso/Aplicación/Stakeholder) son tablas tipadas fijas — un catálogo
  nuevo (Proveedor, Sucursal...) requiere migración. Un modelo genérico tipo EAV lo evitaría;
  decisión consciente de no hacerlo sin un caso de cliente real (ver ROADMAP, Fase 1 punto 3).
- `.agents/skills/` en el repo es una librería de referencia para asistentes de IA, no
  código del proyecto — está en `.gitignore` a propósito.
