# WebSocket Debug Guide

## Problema actual
- WebSocket falla con código 1006 (Abnormal Closure)
- Intentaba reconectar infinitamente (27,000+ intentos)

## Fix aplicado (2025-10-01)
- ✅ Límite de 3 ciclos de refresh de token (15 intentos totales)
- ✅ WebSocket se deshabilita automáticamente después del límite
- ✅ Mensaje claro: "MÁXIMO DE INTENTOS ALCANZADO"

## Para diagnosticar el problema de backend:

### 1. Verificar que el servidor WebSocket está corriendo
```bash
ps aux | grep uvicorn | grep 9001
# Debe mostrar proceso activo en puerto 9001
```

### 2. Verificar Redis
```bash
redis-cli ping
# Debe responder: PONG
```

### 3. Monitorear logs de Django en tiempo real
```bash
# En una terminal:
sudo journalctl -u tenants-backend -f

# O si hay logs en archivo:
tail -f /ruta/a/logs/django.log
```

### 4. Probar conexión WebSocket manualmente
```bash
# Instalar wscat si no está:
npm install -g wscat

# Probar conexión (reemplaza TOKEN con tu JWT):
wscat -c "ws://127.0.0.1:9001/ws/chat/5/?token=TU_TOKEN_AQUI"
```

### 5. Verificar nginx
```bash
sudo tail -100 /var/log/nginx/error.log | grep -i websocket
```

## Causas comunes de código 1006:

1. **Token JWT inválido o expirado**
   - Middleware Django rechaza con 4401 → navegador convierte a 1006
   - Solución: El frontend ahora refresca el token automáticamente

2. **Usuario sin permisos en el chat**
   - `usuario_puede_conectar()` retorna False
   - Solución: Verificar permisos del usuario en la BD

3. **Chat ID no existe**
   - No existe Chat con ese ID en la base de datos
   - Solución: Verificar que el chat existe antes de conectar

4. **Redis no disponible**
   - Channel layer no puede conectar a Redis
   - Solución: `sudo systemctl start redis-server`

5. **Uvicorn no está corriendo**
   - Proceso no está activo en puerto 9001
   - Solución: Reiniciar el servicio backend

## Verificar en frontend (consola del navegador):

Después de recargar, deberías ver:
```
🔄 Solicitando URL con token actualizado (intento 1/3)...
🔌 Conectando WebSocket: {url: '...', intento: 1}
❌ Error en WebSocket: {...}
🔌 WebSocket cerrado: {code: 1006, ...}
⚠️ Primera conexión falló con código 1006. Reintentando en 1s...
🔌 Conectando WebSocket: {url: '...', intento: 2}
...
(máximo 15 intentos)
❌ MÁXIMO DE INTENTOS ALCANZADO. WebSocket deshabilitado. Recarga la página para reintentar.
```

## Next Steps:

1. Recarga la página para detener el loop actual
2. Abre DevTools → Console
3. Busca el mensaje "MÁXIMO DE INTENTOS ALCANZADO"
4. Copia todos los mensajes de WebSocket y pégalos para análisis
5. Verifica los logs del backend simultáneamente
