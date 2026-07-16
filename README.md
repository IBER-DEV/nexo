# Nexo

[![CI](https://github.com/IBER-DEV/nexo/actions/workflows/ci.yml/badge.svg)](https://github.com/IBER-DEV/nexo/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

Plataforma open source de gestión de actividades y proyectos para equipos de TI: backlog,
planeación semanal/mensual, tablero Kanban, reportes ejecutivos y administración de usuarios.

## Stack

- **Frontend**: React 19 + TanStack Start + TanStack Router/Query + Tailwind CSS v4 +
  shadcn/ui. Despliega como Cloudflare Worker (`wrangler.jsonc`).
- **Backend**: Django 5 + Django REST Framework + JWT (SimpleJWT). PostgreSQL en producción,
  SQLite en desarrollo local.
- **Sync opcional**: integración con Google Sheets/AppSheet para mantener actividades
  sincronizadas en ambas direcciones.

## Requisitos

- Node.js 20+ y npm
- Python 3.12
- Docker + Docker Compose (opcional, para levantar el backend containerizado)

## Desarrollo local

### Frontend

```bash
npm install
cp .env.example .env.local   # ajustar VITE_API_URL si hace falta
npm run dev
```

Corre en `http://localhost:8080` (o el puerto que indique Vite).

### Backend

**Opción A — nativo:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_data   # usuarios y actividades de prueba
python manage.py runserver
```

**Opción B — Docker (Postgres real, sin instalar Python):**

```bash
docker compose up --build
```

Levanta Postgres + Django en `http://localhost:8000`, con recarga automática al editar
archivos `.py`. Ver `docker-compose.yml` y `backend/Dockerfile`.

> El frontend siempre corre nativo (`npm run dev`) y despliega a Cloudflare Workers — Docker
> cubre únicamente el backend.

### Credenciales de prueba

Tras correr `seed_data`:

```
admin@empresa.com / demo1234        (administrador)
ana.garcia@empresa.com / demo1234   (coordinador)
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo del frontend |
| `npm run build` | Build de producción (Cloudflare Worker) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `python manage.py sync_appsheet --dry-run` | Simula la sincronización con AppSheet sin escribir cambios |

## Variables de entorno

- **Frontend** (`.env.local`): ver `.env.example`.
- **Backend** (`backend/.env`): ver `backend/.env.example` — incluye configuración de base de
  datos, CORS y las credenciales opcionales de Google Sheets/AppSheet.

## Estructura

```
src/                  Frontend (rutas, componentes, providers, servicios)
backend/apps/         Apps Django (activities, users)
backend/config/       Settings (dev / docker / prod), URLs
docker-compose.yml    Backend + Postgres para desarrollo local
```

## Documentación

- [CLAUDE.md](CLAUDE.md) — contexto técnico, decisiones de arquitectura y gotchas conocidos.
- [docs/ROADMAP.md](docs/ROADMAP.md) — estrategia open core y fases del producto (Community
  / Cloud / Enterprise).

## Contribuir

Las contribuciones son bienvenidas — lee la [guía de contribución](CONTRIBUTING.md) y el
[código de conducta](CODE_OF_CONDUCT.md). El CI ejecuta lint, typecheck, build y las
pruebas del backend en cada pull request.

## Licencia

Nexo se distribuye bajo la licencia [AGPL-3.0](LICENSE). Puedes usarlo, modificarlo y
auto-alojarlo libremente; si lo ofreces como servicio con modificaciones, debes publicar
esas modificaciones bajo la misma licencia.
