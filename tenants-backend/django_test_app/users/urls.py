from django.urls import path
from django_test_app.users.views import (
    TenantLoginView,
    PasswordResetRequestView,  # SECURITY FIX (MED-03)
    PasswordResetConfirmView,  # SECURITY FIX (MED-03)
)

urlpatterns = [
    path("login/", TenantLoginView.as_view(), name="tenant-login"),
    # SECURITY FIX (MED-03): Password reset endpoints
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
