"""
API tests for the activities app: auth, CRUD, and role-based visibility.
Run with `python manage.py test` (or `docker compose exec backend python manage.py test`).
"""
import logging

# The AppSheet push signals fire on every Activity save and log a (harmless)
# error when Google Sheets isn't configured — silence them so test output
# stays readable.
logging.getLogger("apps.activities.signals").setLevel(logging.CRITICAL)
