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

# Tests backend (36 tests: auth, CRUD, visibilidad, tenancy, codigo, catalogos)
docker compose exec -T backend python manage.py test
```

Credenciales de prueba tras `seed_data`: `admin@empresa.com` / `demo1234` (admin),
`ana.garcia@empresa.com` / `demo1234` (coordinador).

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

## Fase 1 — Bloque 1: Multi-tenancy + Maestros (EN PROGRESO — 2026-07-16)

**Estado:** E0, E1, E2 completadas (36 tests OK). E3a-E5 pendientes.

- **E0:** Tests refactorizados en paquete con factories ✅
- **E1:** App organizations, User/Activity org-scoped, scoping multi-tenant ✅
- **E2:** Empresa→Cliente, catálogos con org, numero/codigo por org, CRUD ✅
- **E3a:** WorkflowState/Priority/ActivityType, /workspace/, sync external_mappings (TODO)
- **E3b:** Frontend dinámico useWorkspace, badges, Kanban (TODO)
- **E4:** Admin UI maestros, tabs settings (TODO)
- **E5:** Sync multi-org, segunda org en seed, docs (TODO)

Ver plan detallado en `~/.claude/plans/vamos-a-empezar-la-imperative-pixel.md`.

## Deuda conocida / pendiente

- Sin tests de frontend (solo backend tiene suite).
- `.agents/skills/` en el repo es una librería de referencia para asistentes de IA, no
  código del proyecto — está en `.gitignore` a propósito.
