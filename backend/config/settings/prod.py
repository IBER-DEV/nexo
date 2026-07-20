from .base import *  # noqa: F401, F403
from decouple import config

DEBUG = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
    }
}

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# El proxy del hosting (Railway) termina TLS en su borde y reenvía HTTP plano
# al contenedor — sin esto, SECURE_SSL_REDIRECT nunca ve la request como https
# y redirige en loop a sí misma (301 infinito).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Envío real de correo vía Postmark (dev/docker usan la consola por defecto).
EMAIL_BACKEND = "anymail.backends.postmark.EmailBackend"
