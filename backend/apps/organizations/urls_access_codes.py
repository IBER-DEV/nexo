from rest_framework.routers import DefaultRouter

from .views_access_codes import AccessCodeViewSet

router = DefaultRouter()
router.register("", AccessCodeViewSet, basename="access-code")

urlpatterns = router.urls
