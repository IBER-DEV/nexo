from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_masters import (
    AplicacionViewSet,
    ClienteViewSet,
    ProcesoViewSet,
    StakeholderViewSet,
)

router = DefaultRouter()
router.register(r"clientes", ClienteViewSet, basename="cliente")
router.register(r"procesos", ProcesoViewSet, basename="proceso")
router.register(r"aplicaciones", AplicacionViewSet, basename="aplicacion")
router.register(r"stakeholders", StakeholderViewSet, basename="stakeholder")

urlpatterns = [
    path("", include(router.urls)),
]
