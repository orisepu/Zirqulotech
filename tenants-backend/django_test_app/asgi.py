import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_test_app.settings")

from django.core.asgi import get_asgi_application
# 1) Inicializa Django primero (evita Apps aren't loaded yet)
django_asgi_app = get_asgi_application()

# 2) Ahora sí, importa Channels, middlewares y rutas
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from chat.middleware import JWTAuthMiddleware, UsuarioTenantASGIMiddleware

# 3) Importa rutas con alias correctos (y tolera que falte alguna app)
try:
    from chat.routing import websocket_urlpatterns as chat_ws
except Exception:
    chat_ws = []
try:
    from notificaciones.routing import websocket_urlpatterns as noti_ws
except Exception:
    noti_ws = []

websocket_routes = list(chat_ws) + list(noti_ws)

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        UsuarioTenantASGIMiddleware(
            AuthMiddlewareStack(
                URLRouter(websocket_routes)
            )
        )
    ),
})
