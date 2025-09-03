from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django_test_app.logging_utils import log_ws_event

class NotificacionesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        print("📢 Entrando a NotificacionesConsumer.connect")
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        log_ws_event("✅ Conexión aceptada a notificaciones", user=user)

    async def disconnect(self, close_code):
        user = self.scope.get("user")
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        log_ws_event("🔌 Desconectado WebSocket notificaciones: {close_code}", user=user)

    async def nueva_notificacion(self, event):
        await self.send_json({
            "type": "nueva_notificacion",
            "mensaje": event["mensaje"],
            "tipo": event["tipo"],
            "url": event.get("url", ""),
            "id": event.get("id"),
            "creada": event.get("creada"),
        })
