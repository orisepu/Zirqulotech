from django.urls import path
from .views import MisNotificacionesAPIView

urlpatterns = [
    path('notificaciones/', MisNotificacionesAPIView.as_view(), name='mis_notificaciones'),
]
