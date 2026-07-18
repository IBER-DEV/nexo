from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views_masters import (
    AplicacionViewSet,
    ActivityTypeViewSet,
    ClienteViewSet,
    PriorityViewSet,
    ProcesoViewSet,
    StakeholderViewSet,
    WorkflowStateViewSet,
)
from .views_workspace import WorkspaceView

router = DefaultRouter()
router.register(r"clientes", ClienteViewSet, basename="cliente")
router.register(r"procesos", ProcesoViewSet, basename="proceso")
router.register(r"aplicaciones", AplicacionViewSet, basename="aplicacion")
router.register(r"stakeholders", StakeholderViewSet, basename="stakeholder")
router.register(r"workflow-states", WorkflowStateViewSet, basename="workflow-state")
router.register(r"priorities", PriorityViewSet, basename="priority")
router.register(r"activity-types", ActivityTypeViewSet, basename="activity-type")

urlpatterns = [
    path("workspace/", WorkspaceView.as_view(), name="workspace"),
    path("", include(router.urls)),
]
