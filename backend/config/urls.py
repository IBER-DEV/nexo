from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include([
        path("auth/", include("apps.users.urls")),
        path("users/", include("apps.users.urls_users")),
        path("activities/", include("apps.activities.urls")),
    ])),
]
