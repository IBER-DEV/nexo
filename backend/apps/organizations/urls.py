from django.urls import path

from .views import OrganizationDetailView

urlpatterns = [
    path("", OrganizationDetailView.as_view(), name="organization-detail"),
]
