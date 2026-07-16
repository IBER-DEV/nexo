from .base import *  # noqa: F401, F403

DEBUG = True

# SQLite for local development — zero setup required.
# To use PostgreSQL instead, set the DB_* vars in your .env.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

# Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True
