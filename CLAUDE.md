# CLAUDE.md

Contexto de proyecto para Claude Code. Léelo al empezar cualquier sesión nueva — evita
re-descubrir decisiones ya tomadas. El roadmap de negocio (fases, monetización) vive en
[docs/ROADMAP.md](docs/ROADMAP.md); este archivo es sobre el código.

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

# Tests backend (83 tests: auth, CRUD, visibilidad, tenancy, maestros, sync, organización, plantillas)
docker compose exec -T backend python manage.py test

# Sync AppSheet (Google Sheets) — requiere GOOGLE_SHEETS_CREDENTIALS_JSON configurado
docker compose exec -T backend python manage.py sync_appsheet --org demo --dry-run
```

`seed_data` crea **dos organizaciones** para poder probar aislamiento multi-tenant a mano:
- `demo` (prefijo `ACT`, flujo de 6 estados "TI clásico"): `admin@empresa.com` / `demo1234`
  (admin), `ana.garcia@empresa.com` / `demo1234` (coordinador).
- `acme` (prefijo `ACM`, flujo propio de 4 estados — para ver que el Kanban y los selects
  son realmente dinámicos): `admin@acme.com` / `demo1234` (admin).

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
`~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`; contexto de negocio y
diferenciadores detectados en el camino, en `docs/ROADMAP.md`.

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
`~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`; contexto de negocio en
`docs/ROADMAP.md`, Fase 1 punto 4.

## Deuda conocida / pendiente

- Sin tests de frontend (solo backend tiene suite).
- Catálogos (Cliente/Proceso/Aplicación/Stakeholder) son tablas tipadas fijas — un catálogo
  nuevo (Proveedor, Sucursal...) requiere migración. Un modelo genérico tipo EAV lo evitaría;
  decisión consciente de no hacerlo sin un caso de cliente real (ver ROADMAP, Fase 1 punto 3).
- Invitaciones al equipo (Bloque C del signup) no están construidas — el único usuario de una
  organización nueva es su Owner; agregar miembros sigue siendo tarea del admin de Django.
- `.agents/skills/` en el repo es una librería de referencia para asistentes de IA, no
  código del proyecto — está en `.gitignore` a propósito.
