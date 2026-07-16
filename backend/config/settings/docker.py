from .base import *  # noqa: F401, F403
from decouple import config

DEBUG = config("DEBUG", default=True, cast=bool)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="nexo"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="db"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

# With DEBUG (runserver) static files come from source dirs; entrypoint.sh
# only runs collectstatic for non-debug (gunicorn) runs.
WHITENOISE_AUTOREFRESH = DEBUG
