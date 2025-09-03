from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


urlpatterns = [
    
    path("admin/", admin.site.urls),
    path("api/", include("django_test_app.users.urls")),
    path("api/", include("checkouters.urls")),
    path("api/", include("progeek.urls")),
    path("api/", include("productos.urls")),
    path("api/", include("chat.urls")),
    path("api/", include("notificaciones.urls")),

    # JWT endpoints → al final
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),


]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)