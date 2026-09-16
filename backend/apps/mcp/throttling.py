"""Cuota de MCP.

Nexo es gratis en todas sus versiones, así que esto no es un muro comercial
—no hay nada que desbloquear pagando—: es la única protección de la
infraestructura que atiende las llamadas.

Por eso el tope es una decisión del operador (`MCP_DAILY_LIMIT`) y no del
software: en un self-hosted el servidor lo paga quien lo corre y el valor
por defecto es "sin tope"; quien aloje una instancia pública para terceros
le pone un número.
"""
from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

DURATION_SECONDS = 86400


class McpDailyThrottle(SimpleRateThrottle):
    scope = "mcp"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": user.pk}

    def allow_request(self, request, view):
        limite = getattr(settings, "MCP_DAILY_LIMIT", None)
        if limite is None:
            return True  # sin tope: el caso por defecto

        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return True  # el rechazo por no autenticado ya lo hizo la vista

        # SimpleRateThrottle lee `self.rate` en __init__; acá el tope se
        # resuelve por petición (settings pueden cambiar con
        # override_settings en tests), así que se arma a mano.
        self.num_requests = limite
        self.duration = DURATION_SECONDS
        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True
        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        if len(self.history) >= self.num_requests:
            return self.throttle_failure()
        return self.throttle_success()

    def get_rate(self):
        # El rate real se calcula por petición en allow_request; este valor
        # solo evita que SimpleRateThrottle falle al construirse.
        return "1000/day"
