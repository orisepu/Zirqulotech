# Fix: Auto-creación de Chat Nuevo al Cerrar Chat Anterior

## Problema

Cuando soporte cerraba un chat, el usuario tenant recibía el evento `chat_closed` y se cerraba la UI, pero si intentaba escribir de nuevo, seguía usando el mismo `chatId` que estaba cerrado. El backend rechazaba los mensajes porque el chat estaba marcado como `cerrado=True`.

## Root Cause

1. El endpoint `POST /api/chat/soporte/` buscaba chats con `Chat.objects.filter(cliente_id=cliente_id).first()` SIN verificar el campo `cerrado`
2. Si existía un chat (aunque estuviera cerrado), lo retornaba
3. El frontend seguía usando el mismo `chatId` cerrado
4. Los mensajes no se enviaban al chat cerrado

## Solución Implementada

### 1. **Backend: Auto-creación de Chat Nuevo** (`tenants-backend/chat/views.py`)

Modificado `obtener_o_crear_chat()` para excluir chats cerrados:

#### Cambio en línea 30 (tenant schema):
```python
# ANTES:
chat = Chat.objects.filter(cliente_id=cliente_id).first()

# DESPUÉS:
chat = Chat.objects.filter(cliente_id=cliente_id, cerrado=False).first()
```

#### Cambio en línea 57 (public schema):
```python
# ANTES:
chat = Chat.objects.filter(cliente_id=cliente_id).first()

# DESPUÉS:
chat = Chat.objects.filter(cliente_id=cliente_id, cerrado=False).first()
```

**Efecto**: Si el chat está cerrado, no lo encuentra y crea uno nuevo automáticamente.

### 2. **Frontend: Invalidar Query al Cerrar**

Modificados ambos componentes de chat:
- `tenant-frontend/src/features/chat/components/ChatConSoporte.tsx`
- `tenant-frontend/src/features/chat/components/ChatConSoporteContextual.tsx`

#### Cambios en el handler de `chat_closed`:

```typescript
// ANTES:
if (data.type === 'chat_closed') {
  console.log('🔒 Chat cerrado por soporte:', data.mensaje)
  setAbierto(false)
  toast.info(data.mensaje || 'El chat ha sido cerrado por el equipo de soporte')
  return
}

// DESPUÉS:
if (data.type === 'chat_closed') {
  console.log('🔒 Chat cerrado por soporte:', data.mensaje)
  setAbierto(false)
  toast.info('El chat fue cerrado por soporte. Se creará uno nuevo cuando vuelvas a escribir.')

  // Invalidar query para forzar creación de nuevo chat
  queryClient.invalidateQueries({ queryKey: ['chat-soporte', usuario?.id] })
  return
}
```

#### Eliminado localStorage de chatId

En `ChatConSoporte.tsx`, eliminado el uso de `localStorage.getItem('chat_id')` para evitar conflictos:

```typescript
// ANTES:
const guardado = localStorage.getItem('chat_id')
if (guardado) {
  return parseInt(guardado)
}

// DESPUÉS:
// Siempre consultar backend, que creará nuevo si está cerrado
const res = await api.post('/api/chat/soporte/', { cliente_id: usuario?.id })
return res.data?.id
```

## Flujo Completo

### Cuando soporte cierra un chat:

1. **Soporte ejecuta**: `POST /api/chat/{id}/cerrar/`
2. **Backend**:
   - Marca `chat.cerrado = True` en BD
   - Envía evento WebSocket `chat_closed` al grupo `chat_{id}`
3. **Frontend (tenant)**:
   - Recibe evento `chat_closed`
   - Cierra el panel de chat
   - Muestra toast: "El chat fue cerrado por soporte. Se creará uno nuevo cuando vuelvas a escribir."
   - Invalida la query `['chat-soporte', usuario?.id]`

### Cuando el tenant vuelve a escribir:

1. **Tenant abre chat** o intenta enviar mensaje
2. **Frontend**: Query `chat-soporte` se refetch automáticamente
3. **Backend** (`obtener_o_crear_chat`):
   - Busca chat con `cerrado=False` → No lo encuentra (anterior está cerrado)
   - Crea nuevo chat automáticamente
   - Retorna nuevo `chatId`
4. **Frontend**:
   - Recibe nuevo `chatId`
   - Conecta WebSocket al nuevo chat
   - Usuario puede chatear normalmente

## Archivos Modificados

1. `tenants-backend/chat/views.py` - Excluir chats cerrados (líneas 30 y 57)
2. `tenant-frontend/src/features/chat/components/ChatConSoporte.tsx` - Invalidar query al cerrar
3. `tenant-frontend/src/features/chat/components/ChatConSoporteContextual.tsx` - Invalidar query al cerrar

## Testing

### 1. Prueba en vivo:

```bash
# Como soporte:
1. Enviar mensaje a tenant
2. Cerrar el chat

# Como tenant:
3. Recibir mensaje
4. Intentar responder → Debería aparecer toast de chat cerrado
5. Abrir chat de nuevo → Se crea automáticamente
6. Enviar mensaje → Funciona con nuevo chat
```

### 2. Verificar en logs de Django:

```bash
sudo journalctl -f | grep "Chat"

# Esperado al cerrar:
# ✅ Chat 123 cerrado y notificado vía WebSocket al grupo chat_123

# Esperado al reabrir:
# ✅ Chat creado en tenant tenant_slug: chat_id=124
```

### 3. Verificar en frontend:

```javascript
// Console del navegador (tenant)
// Esperado al cerrar:
✅ 🔒 Chat cerrado por soporte: El chat ha sido cerrado por el equipo de soporte

// Esperado al reabrir:
✅ POST /api/chat/soporte/ → 200 {id: 124, cliente_id: 5, ...}
✅ 🔄 Construyendo URL de WebSocket con token actualizado
✅ 🔌 Conectando WebSocket [intento 1/6]: wss://domain/ws/chat/124/...
✅ ✅ WebSocket conectado exitosamente
```

## Notas Importantes

⚠️ **Multi-tenancy**: El filtro `cerrado=False` se aplica en ambos contextos (tenant y public schema).

⚠️ **No se borran chats cerrados**: Los chats cerrados quedan en la BD para historial, solo se excluyen de las búsquedas.

⚠️ **Historial separado**: Cada chat (cerrado y nuevo) tiene su propio historial. El frontend solo muestra mensajes del chat activo.

⚠️ **Invalidación automática**: El `queryClient.invalidateQueries()` fuerza refetch inmediato, garantizando que el frontend obtenga el chat correcto.

## Mejoras Futuras (Opcional)

1. **Mostrar historial de chats cerrados**: Agregar sección "Chats anteriores" en el panel
2. **Notificación al soporte**: Avisar cuando tenant crea nuevo chat después de cierre
3. **Razón de cierre**: Agregar campo `razon_cierre` al modelo Chat
4. **Estadísticas**: Dashboard de chats cerrados vs abiertos por usuario
