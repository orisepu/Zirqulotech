# Fix: Notificaciones de Chat en Tiempo Real

## Problema
Cuando un admin enviaba un mensaje a un usuario tenant, el usuario no recibía notificación al hacer login.

## Root Cause
El `ChatConsumer` solo enviaba mensajes al grupo del chat, pero NO creaba notificaciones persistentes ni enviaba notificaciones en tiempo real al canal de notificaciones del usuario.

## Solución Implementada

### 1. **Backend: ChatConsumer** (`tenants-backend/chat/consumers.py`)

Modificado el método `receive()` para:

#### a) Crear notificación persistente en BD
```python
# Crear notificación persistente
notificacion = await self.crear_notificacion(
    cliente_id,
    f"Nuevo mensaje de {self.user_nombre}: {texto[:50]}...",
    "chat",
    f"/chat"
)
```

#### b) Enviar notificación push en tiempo real
```python
# Enviar notificación en tiempo real si el usuario está conectado
await self.channel_layer.group_send(
    f"user_{cliente_id}",  # Canal del usuario receptor
    {
        "type": "nueva_notificacion",
        "mensaje": f"Nuevo mensaje de {self.user_nombre}",
        "tipo": "chat",
        "url": f"/chat",
        "id": notificacion.id if notificacion else None,
        "creada": mensaje.creada.isoformat() if mensaje else None,
    }
)
```

#### c) Métodos helper agregados

**`get_cliente_id()`** - Obtiene el ID del cliente del chat
```python
@database_sync_to_async
def get_cliente_id(self, chat_id):
    from .models import Chat
    from django_tenants.utils import schema_context

    with schema_context(self.tenant_schema):
        try:
            chat = Chat.objects.only('cliente_id').get(id=chat_id)
            return chat.cliente_id
        except Chat.DoesNotExist:
            return None
```

**`crear_notificacion()`** - Crea notificación persistente
```python
@database_sync_to_async
def crear_notificacion(self, user_id, mensaje, tipo, url):
    from notificaciones.models import Notificacion
    from django_tenants.utils import schema_context

    with schema_context(self.tenant_schema):
        try:
            notificacion = Notificacion.objects.create(
                usuario_id=user_id,
                schema=self.tenant_schema,
                mensaje=mensaje,
                tipo='chat',
                url_relacionada=url,
                leida=False
            )
            return notificacion
        except Exception as e:
            print(f"❌ Error creando notificación: {e}")
            return None
```

**`guardar_mensaje()`** modificado para retornar el mensaje
```python
@database_sync_to_async
def guardar_mensaje(self, user_id, texto, oportunidad_id, dispositivo_id):
    # ... código existente ...
    mensaje = Mensaje.objects.create(...)
    return mensaje  # ← Ahora retorna el mensaje
```

### 2. **Backend: Modelo Notificacion** (`tenants-backend/notificaciones/models.py`)

Agregado tipo 'chat' a las opciones:
```python
TIPO_CHOICES = [
    ('estado_cambiado', 'Cambio de estado'),
    ('plazo_pago', 'Plazo de pago'),
    ('estado_prolongado', 'Estado prolongado'),
    ('chat', 'Mensaje de chat'),  # ← NUEVO
    ('otro', 'Otro'),
]
```

## Flujo Completo

### Cuando un admin envía mensaje a un tenant:

1. **Admin envía mensaje** → `ChatConsumer.receive()`
2. **Se guarda en BD** → `guardar_mensaje()` retorna el mensaje con timestamp
3. **Se envía al grupo del chat** → `group_send(chat_{id})` (usuarios conectados al chat)
4. **Se obtiene ID del cliente** → `get_cliente_id()` determina quién es el receptor
5. **Se crea notificación persistente** → `crear_notificacion()` guarda en BD
6. **Se envía notificación push** → `group_send(user_{cliente_id})` al canal de notificaciones

### Cuando el tenant hace login:

1. **WebSocket de notificaciones se conecta** → `NotificacionesConsumer.connect()`
2. **Se une al grupo** → `channel_layer.group_add(f"user_{user.id}")`
3. **Frontend carga notificaciones** → `GET /api/notificaciones/` (incluye las no leídas)
4. **Si llega mensaje nuevo** → recibe evento `nueva_notificacion` por WebSocket
5. **Frontend muestra badge** → contador de notificaciones no leídas
6. **Frontend muestra snackbar** → notificación temporal en pantalla

## Componentes Frontend Involucrados

### LayoutInternoShell
- Conecta WebSocket de notificaciones: `wss://domain/ws/notificaciones/`
- Pasa el socket a `NotificacionesBell`

### NotificacionesBell
- Escucha eventos `nueva_notificacion` del WebSocket
- Agrega notificaciones a la query cache (optimistic update)
- Muestra snackbar con el mensaje
- Actualiza badge con contador de no leídas

## Testing

### 1. Prueba en vivo:
```bash
# Admin envía mensaje a tenant
# Tenant NO está conectado al chat
# Tenant hace login

# Esperado:
# ✅ Badge de notificaciones muestra "1"
# ✅ Click en bell muestra "Nuevo mensaje de Admin"
# ✅ Click en notificación navega al chat
```

### 2. Verificar en logs de Django:
```bash
sudo journalctl -f | grep "Notificación creada"

# Esperado:
# ✅ Notificación creada: ID=123, usuario=5, schema=tenant_slug
```

### 3. Verificar en logs del navegador:
```javascript
// Console del navegador (tenant)
// Esperado:
✅ WebSocket de notificaciones conectado
✅ Notificación recibida: {type: 'nueva_notificacion', mensaje: '...', id: 123}
```

## Archivos Modificados

1. `tenants-backend/chat/consumers.py` - Lógica de notificaciones
2. `tenants-backend/notificaciones/models.py` - Tipo 'chat' agregado
3. `tenant-frontend/src/hooks/useWebSocketWithRetry.ts` - Hook reescrito (limpio)
4. `tenant-frontend/src/features/chat/components/ChatConTenants.tsx` - Optimistic updates

## Next Steps (Opcional)

### Mejoras futuras:
1. **Sonido de notificación** - Agregar beep cuando llega notificación
2. **Desktop notifications** - Usar Notification API del browser
3. **Badge en favicon** - Mostrar contador en el icono de la pestaña
4. **Marcar como leída automáticamente** - Al abrir el chat
5. **Agrupar notificaciones** - "3 mensajes nuevos de Admin"
6. **Persistir en IndexedDB** - Para offline-first

## Notas Importantes

⚠️ **Multi-tenancy**: Todas las operaciones usan `schema_context(self.tenant_schema)` para asegurar aislamiento de datos.

⚠️ **Optimización**: Las notificaciones se envían solo al usuario receptor, no al que envía el mensaje (`if cliente_id != self.user_id`).

⚠️ **Fallback**: Si falla la creación de notificación en BD, aún se envía la notificación push en tiempo real.

⚠️ **Reload automático**: El servidor uvicorn con `--reload` detecta cambios automáticamente. No requiere reinicio manual.
