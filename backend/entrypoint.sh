#!/bin/sh
set -e

python manage.py migrate --noinput

# DEBUG defaults true in settings/docker.py; skip collectstatic there since
# runserver serves static files directly. Only collect for a non-debug run
# (e.g. gunicorn/production), where nothing else serves them.
case "$(printf '%s' "${DEBUG:-true}" | tr '[:upper:]' '[:lower:]')" in
  true | 1 | yes) ;;
  *) python manage.py collectstatic --noinput ;;
esac

exec "$@"
