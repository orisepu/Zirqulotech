from django.urls import path
from django_test_app.users.views import TenantLoginView

urlpatterns = [
    path("login/", TenantLoginView.as_view(), name="tenant-login"),
]
