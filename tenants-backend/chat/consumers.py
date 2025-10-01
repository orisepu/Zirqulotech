import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django_tenants.utils import schema_context
from django_test_app.logging_utils import log_exception, log_ws_event


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from .models import Chat, Mensaje
        user = self.scope.get("user")
        self.chat_id = self.scope["url_route"]["kwargs"]["chat_id"]
        self.group_name = f"chat_{self.chat_id}"
        self.user_group_name = f"user_{getattr(user, 'id', 'anon')}"
        # ← lee el schema string resuelto por tu middleware
        self.tenant_schema = self.scope.get("tenant_schema", "public")

        if not user or not getattr(user, "is_authenticated", False):
            log_ws_event(user or "anon", f"❌ Conexión WS rechazada: usuario no autenticado (chat {self.chat_id})", success=False)
            await self.close()
            return

        self.user_id = user.id
        self.user_nombre = getattr(user, "name", getattr(user, "email", "Usuario"))

        log_ws_event(f"📡 Conectando al chat {self.chat_id}", self.tenant_schema, user)

        try:
            puede = await self.usuario_puede_conectar(self.user_id, self.chat_id)
            if puede:
                await self.channel_layer.group_add(self.group_name, self.channel_name)
                await self.channel_layer.group_add(self.user_group_name, self.channel_name)
                await self.accept()
                log_ws_event(user, f"✅ Conexión aceptada al chat {self.chat_id}", extra={"schema": self.tenant_schema})
            else:
                await self.close()
                log_ws_event(user, f"❌ Acceso denegado al chat {self.chat_id}", success=False, extra={"schema": self.tenant_schema})
        except Exception as e:
            log_exception("connect", e)
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard(f"user_{self.scope['user'].id}", self.channel_name)
        print(f"🔌 Desconectado WebSocket: code={close_code}, user={self.scope.get('user')}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            texto = data.get("texto")
            oportunidad_id = data.get("oportunidad_id")

            if not texto:
                await self.send(text_data=json.dumps({"error": "Falta el texto del mensaje."}))
                return

            log_ws_event(self.scope["user"], "✉️ Mensaje recibido", texto)

            # Guardar mensaje
            await self.guardar_mensaje(self.user_id, texto, oportunidad_id, None)

            # Enviar mensaje a todos los del grupo
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "autor": self.user_nombre,
                    "texto": texto,
                    "oportunidad_id": oportunidad_id,
                    "tenant": self.tenant_schema,
                }
            )
        except Exception as e:
            log_exception("receive", e)
            await self.send(text_data=json.dumps({"error": "Error al procesar el mensaje."}))


    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'autor': event['autor'],
            'texto': event['texto'],
            'oportunidad_id': event.get('oportunidad_id'),
            'tenant': event.get('tenant'),
        }))

    async def nueva_notificacion(self, event):
        await self.send_json({
            "type": "nueva_notificacion",
            "mensaje": event["mensaje"],
            "tipo": event["tipo"],
            "url": event.get("url", ""),
            "id": event.get("id"),
            "creada": event.get("creada"),
        })

    async def chat_closed(self, event):
        """Notifica a los clientes conectados que el chat ha sido cerrado"""
        await self.send(text_data=json.dumps({
            'type': 'chat_closed',
            'mensaje': event.get('mensaje', 'El chat ha sido cerrado por soporte'),
            'cerrado_por': event.get('cerrado_por', 'Soporte'),
        }))

    
    @database_sync_to_async
    def guardar_mensaje(self, user_id, texto, oportunidad_id, dispositivo_id):
        from .models import Mensaje  # ✅ Import local, multitenant-safe
        from django_tenants.utils import schema_context
        from django.db import connection

        
        with schema_context(self.tenant_schema):
            print(f"📝 Guardando mensaje en schema: {connection.schema_name}")
            return Mensaje.objects.create(
                chat_id=self.chat_id,
                autor_id=user_id,
                texto=texto,
                oportunidad_id=oportunidad_id,
                dispositivo_id=dispositivo_id,
            )

    @database_sync_to_async

    def get_cliente_id(self, chat_id):
        return Chat.objects.only('cliente_id').get(id=chat_id).cliente_id


        
    @database_sync_to_async
    def usuario_puede_conectar(self, user_id, chat_id):
        from .models import Chat
        from progeek.models import UserGlobalRole
        from django.db import connection
        

        

        with schema_context(self.tenant_schema):
            print(f"🔍 [DEBUG] Schema actual al validar conexión: {connection.schema_name}")
            
            try:
                chat = Chat.objects.only("cliente_id").get(id=chat_id)
                print(f"🔎 Chat encontrado: chat_id={chat.id}, cliente_id={chat.cliente_id}")

                if chat.cliente_id == user_id:
                    return True

                es_soporte = UserGlobalRole.objects.filter(user_id=user_id, es_empleado_interno=True).exists()
                return es_soporte

            except Chat.DoesNotExist:
                return False

    @staticmethod
    @database_sync_to_async
    def _es_empleado_interno(user_id):
        from progeek.models import UserGlobalRole
        return UserGlobalRole.objects.filter(user_id=user_id, es_empleado_interno=True).exists()
