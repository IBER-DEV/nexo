from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AccessCodeResolveView,
    CustomTokenObtainPairView,
    DemoLoginView,
    EmailVerifyView,
    PasswordForgotView,
    PasswordResetConfirmView,
    ResendVerificationView,
    SignupTemplatesView,
    SignupView,
)

urlpatterns = [
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("signup/", SignupView.as_view(), name="signup"),
    path("signup/templates/", SignupTemplatesView.as_view(), name="signup_templates"),
    path("demo-login/", DemoLoginView.as_view(), name="demo_login"),
    path("access-codes/resolve/", AccessCodeResolveView.as_view(), name="access_code_resolve"),
    path("email/verify/", EmailVerifyView.as_view(), name="email_verify"),
    path("email/resend/", ResendVerificationView.as_view(), name="email_resend"),
    path("password/forgot/", PasswordForgotView.as_view(), name="password_forgot"),
    path("password/reset/", PasswordResetConfirmView.as_view(), name="password_reset"),
]
