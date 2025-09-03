from django.urls import path
from .views import obtener_o_crear_chat, historial_mensajes
from . import views


urlpatterns = [
    path("chat/soporte/", obtener_o_crear_chat),
    path('chat/<int:chat_id>/mensajes/', historial_mensajes),
    path('chat/<int:chat_id>/cerrar/', views.cerrar_chat, name='cerrar_chat'),
    path('chats/abiertos/', views.listar_chats_abiertos, name='listar_chats_abiertos'),
]
