from django.urls import path
from .views import UserListView, CurrentUserView, UserTeamUpdateView

urlpatterns = [
    path("", UserListView.as_view(), name="user_list"),
    path("me/", CurrentUserView.as_view(), name="user_me"),
    path("<int:pk>/", UserTeamUpdateView.as_view(), name="user_team_update"),
]
