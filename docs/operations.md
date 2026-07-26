# Operación: entornos, tareas programadas y respaldos

Runbook de **cosas que se hacen**, no de cosas que se van a construir (eso es
[roadmap/release-plan.md](roadmap/release-plan.md)). Si estás desplegando, rotando un secreto o
limpiando datos, empieza acá.

## Entornos

Hasta 2026-07-26 hubo **un solo entorno: producción**. Vale la pena nombrar el riesgo que eso
implicaba, porque explica por qué existe este archivo: `backend/entrypoint.sh` corre
`manage.py migrate --noinput` en cada arranque, así que **cada push a `main` aplicaba
migraciones directamente sobre la única base**, sin ensayo previo. Una migración destructiva no
tenía dónde fallar de forma barata.

| | Producción | Staging |
|---|---|---|
| Dominio API | `api.nexoengine.tech` | subdominio propio (ej. `api-staging.…`) |
| Frontend | Worker `nexo` (`nexoengine.tech`) | Worker aparte, o `*.workers.dev` |
| Base de datos | Postgres administrado | **Postgres propio, nunca el de producción** |
| Lemon Squeezy | tienda real | **modo test o tienda aparte** |
| Correo | Postmark real | Postmark, o `EMAIL_BACKEND` de consola |

### Conexión a la base: siempre por referencia

Las cinco variables de base del servicio `backend` apuntan al servicio Postgres **por
referencia**, no por valor:

```
DB_HOST=${{Postgres.PGHOST}}      DB_USER=${{Postgres.PGUSER}}
DB_PORT=${{Postgres.PGPORT}}      DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
```

Hasta 2026-07-26 estaban como **valores literales**, y eso rompía la duplicación de entornos:
Railway provisiona un Postgres nuevo con credenciales nuevas al duplicar, así que el backend de
staging habría intentado entrar a su propio Postgres con la contraseña de producción y no habría
arrancado. (El *host* no era el problema: `postgres.railway.internal` es DNS de la red privada y
se resuelve dentro del mismo entorno, así que staging nunca habría tocado los datos de
producción.) Como efecto secundario, ahora rotar la contraseña de la base tampoco rompe el
backend.

**El CLI no distingue una referencia de un literal** — `railway variable list`, tanto con
`--json` como con `--kv`, muestra el valor ya resuelto. Para comprobarlo hay que mirar el
dashboard, o redesplegar y ver que el servicio arranca. Ojo: `--kv` imprime los secretos sin
enmascarar.

### Lo que hay que separar de verdad

El código no necesita un `settings/staging.py`: `config.settings.prod` ya se configura por
variables de entorno. Lo que sí hay que separar es la configuración, y hay dos trampas:

1. **El webhook de Lemon Squeezy.** Ojo: a 2026-07-26 **producción todavía no tiene ninguna
   variable `LEMONSQUEEZY_*`** — la tienda está conectada solo en el `.env` local, así que en
   producción la facturación está inerte (checkout responde 503 y ningún límite de plan aplica).
   Cuando se configuren, cada entorno necesita su propio webhook apuntando a su propio dominio,
   con su propio `LEMONSQUEEZY_WEBHOOK_SECRET`. Compartirlos haría que los pagos de prueba de
   staging le cambien el plan a organizaciones reales. Lo natural es configurar staging primero
   (modo test) y producción después.
2. **`CORS_ALLOWED_ORIGINS` y `ALLOWED_HOSTS`.** Cada entorno lista solo sus propios dominios.
   Copiar los de producción a staging hace que un bug de CORS en staging no se vea, y aparezca
   recién en producción.

### Procedimiento de despliegue

1. PR a `main` con CI en verde (lint + typecheck + build + 300 tests).
2. Si el cambio trae migraciones: desplegar primero a **staging** y verificar que
   `migrate` corre limpio contra datos parecidos a los reales.
3. Desplegar producción.
4. Frontend: **siempre `npm run deploy`**, nunca `npm run build && wrangler deploy` — el segundo
   hornea `VITE_API_URL=localhost` y rompe el sitio en silencio (ver CLAUDE.md).

## Tareas programadas (cron)

Dos comandos idempotentes que hoy **no están programados**. Sin ellos nada se rompe, pero los
valores guardados se van desincronizando de la realidad.

| Comando | Frecuencia | Qué pasa si no corre |
|---|---|---|
| `python manage.py expire_trials` | diaria | El `plan` guardado de un trial vencido se queda en `cloud`. El *acceso* y los *límites* no se ven afectados: se resuelven en caliente (`limits.effective_plan`). |
| `python manage.py sync_seats` | diaria | La cantidad facturada queda desactualizada si un empujón en caliente falló (es best-effort a propósito, para no bloquear a alguien que suma un compañero por un timeout del proveedor). |

Ambos aceptan `--dry-run` para ver qué harían sin escribir.

En Railway se configuran creando un servicio con el mismo repo/imagen, un **Cron Schedule**
(ej. `0 6 * * *`) y ese comando como start command en lugar de gunicorn.

## Respaldos

**Prioridad más alta de esta lista.** Un entorno de staging reduce la probabilidad de romper
producción; un respaldo es lo que te salva cuando la rompes igual. Se activan en la
configuración del servicio Postgres en Railway.

Comprobación que vale la pena hacer una vez: restaurar un respaldo en staging. Un backup que
nunca se restauró es una hipótesis, no un respaldo.

## Limpieza de datos de prueba

`seed_data` se corrió sobre producción durante el despliegue inicial, así que ahí quedaron dos
organizaciones. **No son lo mismo y no se tratan igual:**

- **Org `demo`** — es la **demo pública** de la landing. Sus usuarios `demo-*@nexoengine.tech`
  (`is_demo_readonly=True`) y sus 42 actividades son el contenido que ven los botones "Probar
  como {rol}". **No se toca:** borrarla rompe la landing en producción.
- **Org `acme`** — solo existía para probar aislamiento multi-tenant a mano. Es ruido, e
  incluye `admin@acme.com` como **superusuario de Django**.

Para eliminarla:

```bash
# 1. Siempre primero el inventario (es el modo por defecto, no borra nada)
python manage.py purge_organization acme

# 2. Solo si el inventario es el esperado
python manage.py purge_organization acme --execute
```

El comando resuelve el orden de borrado (`Activity.responsable` y `User.organization` son
`PROTECT`, así que hay que ir de adentro hacia afuera) y **se niega a tocar una organización con
usuarios de la demo pública** salvo que se le pase `--force`.

### Contraseñas y secretos

- Las contraseñas de `seed_data` (`demo1234`) se rotaron a mano en producción el 2026-07-21 y
  **no** en `seed_data.py`, para que el self-hosted siga siendo cómodo. `get_or_create` no
  resetea la contraseña de un usuario existente, así que volver a correr `seed_data` en Railway
  no deshace la rotación.
- **Pendiente:** el `LEMONSQUEEZY_WEBHOOK_SECRET` de producción se creó con 6 caracteres.
  Funciona (HMAC acepta cualquier string) pero es corto para lo que protege — quién puede
  cambiarle el plan a una organización. Rotar por uno largo y aleatorio, actualizándolo en los
  dos lados a la vez: el `.env` del servicio y el webhook en el dashboard de Lemon Squeezy.

## Bitácora

- **2026-07-26** — Documentado el modelo de dos entornos al detectar que producción era el único
  y contenía datos de `seed_data`. Se agregó `purge_organization` para poder limpiarlos sin
  pelear con los `PROTECT` a mitad de camino, en producción.
- **2026-07-26** — Las cinco variables `DB_*` de producción pasaron de valores literales a
  referencias `${{Postgres.*}}`, como prerequisito de poder duplicar el entorno. Se verificó
  antes que las huellas de `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` fueran idénticas
  a los literales, así que el cambio resolvía a los mismos valores; y después, con un redeploy
  real (`SUCCESS`, `/auth/demo-login/` en 200) que el backend siguiera hablando con la base.
