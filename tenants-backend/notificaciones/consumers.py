import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django_test_app.logging_utils import log_ws_event

logger = logging.getLogger(__name__)

class NotificacionesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            logger.warning("WebSocket notificaciones rechazado: usuario no autenticado")
            await self.close()
            return

        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info("Conexión WebSocket notificaciones aceptada: user=%s", user.email if hasattr(user, 'email') else user.id)

    async def disconnect(self, close_code):
        user = self.scope.get("user")
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.debug("WebSocket notificaciones desconectado: code=%s, user=%s", close_code, user.email if user and hasattr(user, 'email') else 'anon')

    async def nueva_notificacion(self, event):
        await self.send_json({
            "type": "nueva_notificacion",
            "mensaje": event["mensaje"],
            "tipo": event["tipo"],
            "url": event.get("url", ""),
            "id": event.get("id"),
            "creada": event.get("creada"),
        })
