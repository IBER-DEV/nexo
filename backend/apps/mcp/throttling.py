"""Cuota de MCP por plan.

MCP va **gratis en todos los planes** — es el diferenciador de "trae tu
propia IA" y no nos cuesta inferencia, así que su trabajo es atraer, no
cobrar (ver docs/roadmap/monetization.md). Lo que sí cuesta es la
infraestructura que atiende las llamadas, y eso es lo que se acota.

Igual que los límites de puestos: **el self-hosted no se limita nunca**. El
gate es `provider.is_configured()`, el mismo de la facturación.
"""
from rest_framework.throttling import SimpleRateThrottle

# Llamadas por día y por usuario. `None` = sin tope.
PLAN_RATES = {
    "community": 200,
    "cloud": 5000,
    "enterprise": None,
}


class McpPlanThrottle(SimpleRateThrottle):
    scope = "mcp"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": user.pk}

    def allow_request(self, request, view):
        from apps.billing.limits import effective_plan
        from apps.billing.provider import is_configured

        if not is_configured():
            return True  # self-hosted: sin cuota

        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return True  # el rechazo por no autenticado ya lo hizo la vista

        limite = PLAN_RATES.get(effective_plan(user.organization), PLAN_RATES["community"])
        if limite is None:
            return True

        # SimpleRateThrottle lee `self.rate` en __init__; acá el plan se
        # resuelve por petición, así que se arma a mano.
        self.num_requests = limite
        self.duration = 86400
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
        return "200/day"
