# CLAUDE.md

Contexto de proyecto para Claude Code. Léelo al empezar cualquier sesión nueva — evita
re-descubrir decisiones ya tomadas. El roadmap (producto, arquitectura, sostenibilidad, plan de
entrega) vive en [docs/ROADMAP.md](docs/ROADMAP.md) — es un índice a `docs/roadmap/*.md` y
`docs/adr/`; este archivo es sobre el código en su estado actual.

## Qué es Nexo

**Gratis en todas sus versiones, Cloud incluido** — no hay planes, pasarela de pagos ni
features detrás de un muro (ADR 0003). Si vas a agregar un límite, no puede ser "del plan".

Plataforma open source de gestión de actividades para equipos de TI: backlog, planeación
semanal/mensual, Kanban, reportes, roles (admin/coordinador/miembro). Nació como herramienta
interna (antes "FlowDesk"), ahora en transición a producto open core (ver ROADMAP).

## Estructura

```
src/              Frontend: TanStack Start + React 19 + Tailwind v4 + shadcn/ui
backend/          Django 5 + DRF, apps: activities, projects, users
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

# Tests backend (259 tests: auth, CRUD, visibilidad, tenancy, maestros, sync, organización,
# plantillas, tokens, MCP, proyectos)
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
  enforcement estaba dentro de `authenticate()` y se encadenaba por herencia (una clase de
  autenticación por regla, heredando de la anterior, todas ya eliminadas); eso funcionaba con un
  solo mecanismo, pero el segundo habría entrado por otra clase salteándose las reglas sin que
  nada avisara. Si agregas un tercero (OAuth), su única obligación es llamar a esa función.
- **Un test no debe depender de la *ausencia* de configuración.** Un test que pasa solo porque
  una variable de entorno no está puesta pasa en CI y falla en la máquina de quien sí la
  configuró — el peor modo de fallo posible. Ya pasó una vez (con las credenciales de la
  facturación, que ya no existe). Si el comportamiento depende de una setting, ponla explícita
  con `@override_settings` en ambos sentidos.

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

## Facturación: ELIMINADA (2026-09-15) — no la reintroduzcas por inercia

Existió: `backend/apps/billing/` con Lemon Squeezy (checkout, webhooks firmados, trial de 14
días, portal de cliente), planes `community`/`cloud`/`enterprise` en `Organization.plan` y un
techo de 5 puestos en el tier gratuito de Cloud. **Se borró entero** — app, campo, tablas
(migración `organizations.0005`), UI, crons y variables `LEMONSQUEEZY_*`. Nexo es gratis en
todas sus versiones. Razonamiento en [docs/adr/0003-nexo-es-gratis.md](docs/adr/0003-nexo-es-gratis.md).

Lo que hay que saber al tocar código hoy:

- **No existe `Organization.plan`.** Si algo necesita ramificar por "tipo de organización", no
  lo hay: todas son iguales. Los feature flags (`DEFAULT_FEATURE_FLAGS` en
  `apps/organizations/models.py`) existen para *apagar* una feature ante un problema, no para
  venderla, y no tienen dimensión de plan.
- **No hay límite de puestos.** `membership.add_member()` y la reactivación por
  `PATCH /users/{pk}/` eran las dos puertas que lo aplicaban; ya no consultan nada. Sumar a
  alguien no puede fallar por cupo.
- **`enforce_global_policy` sigue siendo el punto único de reglas globales**, pero ahora solo
  con demo de solo lectura y alcance del token. El gotcha que lo originó (un ViewSet con
  `permission_classes` propio anula el default de DRF) sigue vigente y es la razón de que exista.
- **La cuota de MCP ya no es "por plan"**: es `MCP_DAILY_LIMIT` (settings), una protección de
  infraestructura del operador, sin valor por defecto = sin tope. Ver `apps/mcp/throttling.py`.
- **`WaitlistSignup` es un archivo cerrado, no una feature.** La lista de espera se quitó el
  2026-09-16 (no protegía ningún cupo: el signup público ya entregaba una org Cloud completa).
  No hay endpoint de alta y el admin es de solo lectura. La tabla sigue ahí por una única razón:
  son correos de gente a la que todavía se le debe el aviso de que Cloud abrió. Después de
  enviarlo, se borra con una migración.
- **La licencia sigue siendo AGPL-3.0.** El motivo cambió (ya no protege un negocio Cloud, sí la
  reciprocidad); la licencia no.

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

## Servidor MCP (COMPLETADO — 2026-07-26)

`POST /api/v1/mcp/` — JSON-RPC 2.0 sobre HTTP, autenticado con un token de acceso personal.
Cinco herramientas: `obtener_workspace`, `listar_actividades`, `listar_usuarios`,
`crear_actividad`, `actualizar_actividad`. App en `backend/apps/mcp/`.

- **Protocolo implementado a mano, sin el SDK de MCP.** El SDK está construido sobre
  ASGI/Starlette y este backend corre WSGI bajo gunicorn: traerlo obligaría a cambiar el
  servidor de toda la aplicación por una sola feature. Un servidor de *solo herramientas*
  necesita un subconjunto chico y estable (`initialize`, `tools/list`, `tools/call`, `ping`).
- **Sin streaming (SSE).** "Streamable HTTP" lo permite pero no lo exige; con solo herramientas,
  responder JSON plano a cada POST alcanza. Agregarlo es el día que haya herramientas largas o
  notificaciones servidor→cliente, no antes.
- **MCP habla POST siempre, así que el verbo HTTP dejó de indicar si algo escribe.** Por eso la
  regla de escritura vive en `assert_write_allowed(user, token=...)`, que es método-agnóstica:
  `enforce_global_policy` la llama cuando el verbo no es seguro, y el despachador de MCP la
  llama directo — así las dos rutas no pueden divergir. `/mcp/` está exento del chequeo por
  verbo (`METHOD_AGNOSTIC_PATH_FRAGMENT`) y **cada herramienta declara `writes`**. Si agregas
  una herramienta que escribe y no lo declaras, se salta la regla.
- **Un token de solo lectura no ve las herramientas que escriben** en `tools/list`. Mostrárselas
  para después rechazarlas hace que el modelo gaste turnos intentando algo imposible.
- **Los errores de dominio y de permisos vuelven como `isError: true` dentro del resultado**, no
  como error de JSON-RPC: así el modelo los lee y puede explicarlos ("tu token es de solo
  lectura") o corregir el intento. Solo lo que es realmente de protocolo (método desconocido,
  argumentos faltantes) va como error JSON-RPC.
- **Ninguna herramienta reimplementa reglas del API.** Las escrituras pasan por
  `ActivitySerializer` y las lecturas por `activities/visibility.py::visible_activities()`, que
  se extrajo del `ActivityViewSet` justamente para esto — una regla de visibilidad con dos
  implementaciones es una fuga esperando a que alguien toque solo una.
- **Cuota en `apps/mcp/throttling.py`: `MCP_DAILY_LIMIT` (settings), por usuario, sin valor por
  defecto = sin tope.** No es un muro comercial —MCP es gratis, como todo— sino una protección
  de infraestructura que decide quien opera la instancia: en self-hosted el servidor lo paga él.
  Era una tabla de topes por plan; si vuelves a ver algo así, es un residuo.
- **La configuración de conexión se le entrega armada al usuario** (`McpConnection.tsx`, en
  Configuración → Cuenta). El bloque con el token real solo puede aparecer en el diálogo de
  "token creado", que es el único momento en que existe en claro; la tarjeta permanente
  (`McpSection`) muestra el mismo bloque con un marcador para quien ya guardó el suyo. La URL
  sale de `API_BASE_URL` (`lib/api.ts`), no está hardcodeada — un self-hosted la necesita
  apuntando a su propio dominio.

## Proyectos (COMPLETADO — 2026-09-20)

Antes de esto no había forma de responder "¿cómo va mi proyecto?": `Activity.proyecto` era un
`CharField` de texto libre que **solo** llenaba el sync de Sheets, no estaba en `types.ts`, no
se podía filtrar y no aparecía en ninguna pantalla. Ahora `Project` (`backend/apps/projects/`)
es un modelo de primera clase y el avance se **deriva**, no se teclea.

- **`Project` es un contenedor, no una segunda unidad de trabajo** — no reabre el punto 3 de
  [ADR 0001](docs/adr/0001-unidad-de-trabajo-en-nexo.md) (no hace falta un `WorkItem` paraguas).
  Sí sigue su regla 1: objeto de dominio propio que reutiliza `for_org()` y el mixin de scoping.
- **No existe un campo `avance`, a propósito.** Sale de `projects/progress.py`:
  finalizadas / (total − canceladas), con `WorkflowState.categoria` como única fuente de verdad
  (nunca `estado.slug`). Un porcentaje manual se congela y termina mintiendo peor que no tenerlo.
  Las canceladas salen del *denominador*: 5 hechas + 5 canceladas es 100%, no 50%.
- **La salud (`en_tiempo`/`en_riesgo`/`atrasado`/…) también se calcula en cada lectura.** Sin
  `fecha_fin_estimada` un proyecto nunca puede estar atrasado — es el campo que hace medible el
  compromiso, por eso el formulario lo explica en vez de dejarlo suelto.
- **GOTCHA GRANDE — el scoping por rol se aplica como subconsulta sobre `pk`, no como
  `.filter(activities__...)`.** Django reutiliza el JOIN de un filtro sobre relación
  multi-valuada en los `Count()` que se anoten después: con la versión "corta", un miembro ve el
  avance calculado **solo sobre sus actividades** (medido: 1 de 4 → 0% en un proyecto al 75%).
  Ver `projects/visibility.py` y el test `ProjectMetricsVisibilityTests`, que falla si alguien
  lo "simplifica". Regla de producto detrás: **el rol decide qué proyectos ves, no qué tan
  avanzados están** — las métricas son del proyecto entero; la *lista* de actividades sí filtra.
- **`Activity.proyecto` acepta dos entradas: `proyecto` (nombre) y `proyecto_id`.** El nombre
  existe porque la columna `Proyecto` de la Google Sheet y el import de Excel solo conocen texto
  (get-or-create, como los catálogos); el id es el que usa la UI. Si llegan los dos, gana el id.
  Ninguno declara `source` en el serializer — dos campos DRF al mismo source se pisan; ambos se
  resuelven a mano en `validate()`.
- **La columna `Proyecto` de Sheets sigue siendo texto** (contrato externo, igual que
  `FlowDeskID`): `sheets_client.activity_to_row()` escribe `proyecto.nombre`, no el objeto.
- **`select_related` debe incluir `proyecto__organization`**, no solo `proyecto`:
  `Project.codigo` lee `organization.codigo_prefix` y sin eso serializar una lista dispara una
  consulta por fila (ya está en `activities/visibility.py::RELATED`).
- **Migración `activities.0010` es a mano y no la que genera `makemigrations`.** El autogenerado
  es un `AlterField` CharField→FK que perdería los nombres existentes; la real hace
  rename → add FK → `RunPython` → drop, y es reversible.
- **Secuencia propia**: código `{PREFIX}-P001` vía `SequenceService.next(org, name="project")`
  (`SequenceService.COUNTERS` mapea nombre lógico → contador en `Organization`). Los contadores
  son `readonly_fields` en el admin: retrocederlos a mano genera códigos duplicados.
- Escribir proyectos requiere rol de planeación (admin/coordinador); leerlos, cualquier miembro.

## Operación (entornos, crons, respaldos)

Runbook completo en [docs/operations.md](docs/operations.md). Lo que hay que tener presente al
tocar código:

- **`backend/entrypoint.sh` corre `migrate --noinput` en cada arranque**, así que un push a
  `main` aplica migraciones a producción sin intervención. Una migración destructiva se ensaya
  en staging primero, no se descubre en producción.
- **La org `demo` de producción NO es dato de prueba** — es la demo pública de la landing
  (usuarios `demo-*` con `is_demo_readonly`, 42 actividades). Borrarla rompe los botones
  "Probar como {rol}". La org `acme` sí es ruido: se limpia con
  `manage.py purge_organization acme` (dry-run por defecto).
- **No hay crons.** Los dos que había (`expire_trials`, `sync_seats`) se fueron con la
  facturación; nada queda que se desincronice con el tiempo.

## Deuda conocida / pendiente

- Sin tests de frontend (solo backend tiene suite).
- **Los proyectos de la demo salen casi todos en rojo.** No es un bug del cálculo: las 42
  actividades que siembra `seed_data` tienen fechas aleatorias en una ventana ya vencida, así
  que arrastran el semáforo. Si la demo pública va a mostrar /projects, hay que sembrar fechas
  más benignas — es cosmético del seed, no de `progress.py`.
- **MCP sin documentación larga ni video.** La UI ya entrega la configuración lista para pegar y
  la landing lo menciona (Roadmap + FAQ), pero no hay una guía paso a paso ni una demo grabada
  del flujo "pídele a Claude que cargue tus actividades" — que es justo lo que haría entender el
  diferenciador de un vistazo.
- **Wiki descartada por ahora** (sigue en la lista de "no construir en 12 meses" de
  `launch-strategy.md`). Que la IA escriba el contenido vía MCP no baja el costo de construirla:
  igual hacen falta modelo de documentos, editor, versionado, permisos y búsqueda. La versión
  barata que prueba la misma hipótesis es un campo markdown largo en la actividad.
- Catálogos (Cliente/Proceso/Aplicación/Stakeholder) son tablas tipadas fijas — un catálogo
  nuevo (Proveedor, Sucursal...) requiere migración. Un modelo genérico tipo EAV lo evitaría;
  decisión consciente de no hacerlo sin un caso de cliente real (ver ROADMAP, Fase 1 punto 3).
- `.agents/skills/` en el repo es una librería de referencia para asistentes de IA, no
  código del proyecto — está en `.gitignore` a propósito.
