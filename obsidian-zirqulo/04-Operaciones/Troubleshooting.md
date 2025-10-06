---
title: Troubleshooting — Zirqulo
tags: [operaciones, troubleshooting, soporte, errores]
fecha: 2025-10-04
tipo: troubleshooting
---

# Troubleshooting de Zirqulo

> **Solución de problemas comunes**

---

## 🔐 Problemas de Autenticación

### Error: "Credenciales inválidas"

**Síntoma:**
```
Usuario no puede hacer login
Error: "Email o contraseña incorrectos"
```

**Diagnóstico:**
1. Verificar email exacto (case-sensitive)
2. Verificar tenant correcto seleccionado
3. Verificar usuario activo en BD

**Solución:**
```bash
# Backend - Verificar usuario
cd tenants-backend
source venv/bin/activate
python manage.py shell

from apps.core.models import User
user = User.objects.get(email='usuario@example.com')
print(f"Active: {user.is_active}")
print(f"Tenant: {user.tenant.schema_name}")

# Si está inactivo, activar:
user.is_active = True
user.save()
```

---

### Error: "Token expirado"

**Síntoma:**
```
Después de login exitoso, requests fallan con 401
```

**Diagnóstico:**
- Token JWT expirado (vida útil: 24h)
- Refresh token no funciona

**Solución:**
```typescript
// Frontend - Forzar refresh manual
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
window.location.href = '/login';
```

---

### Error: "Login desde ubicación sospechosa bloqueado"

**Síntoma:**
```
Email recibido: "Hemos bloqueado un login desde [país]"
Usuario no puede acceder
```

**Diagnóstico:**
- Sistema GeoLite2 detectó viaje imposible
- Usuario viajó realmente o VPN activada

**Solución:**
```bash
# Backend - Desbloquear usuario manualmente
python manage.py shell

from apps.core.models import LoginHistory
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.get(email='usuario@example.com')

# Ver historial de logins
logins = LoginHistory.objects.filter(user=user).order_by('-timestamp')[:5]
for login in logins:
    print(f"{login.timestamp} - {login.city}, {login.country} - Blocked: {login.was_blocked}")

# Si es legítimo, permitir próximo login
# (el sistema aprenderá la nueva ubicación)
```

---

## 🏢 Problemas Multi-Tenant

### Error: "Recurso no encontrado" (pero existe)

**Síntoma:**
```
Usuario intenta ver cliente #12345
Error 404: Cliente no encontrado
(pero sabe que existe porque lo creó ayer)
```

**Diagnóstico:**
- Header `X-Tenant` incorrecto o ausente
- Usuario accediendo desde tenant equivocado

**Solución:**
```bash
# Verificar X-Tenant en request
# Frontend Console:
localStorage.getItem('schema')  # Debe coincidir con tenant del usuario

# Backend - Verificar en qué schema está el cliente
python manage.py shell

from apps.crm.models import Cliente
from django_tenants.utils import schema_context

# Buscar en todos los schemas
from apps.core.models import Tenant
tenants = Tenant.objects.all()

for tenant in tenants:
    with schema_context(tenant.schema_name):
        try:
            cliente = Cliente.objects.get(id=12345)
            print(f"Cliente encontrado en schema: {tenant.schema_name}")
            print(f"Nombre: {cliente.nombre}")
        except Cliente.DoesNotExist:
            pass
```

---

## 💬 Problemas de WebSocket (Chat)

### Error: "WebSocket no conecta"

**Síntoma:**
```
Chat widget muestra "Desconectado"
Mensajes no se envían en tiempo real
```

**Diagnóstico:**
```bash
# 1. Verificar Redis
redis-cli ping  # Debe responder "PONG"

# 2. Verificar Django Channels
cd tenants-backend
source venv/bin/activate
python manage.py shell

from channels.layers import get_channel_layer
channel_layer = get_channel_layer()
# Si no hay error, Channels está configurado correctamente
```

**Solución:**
```bash
# Si Redis no responde
sudo systemctl status redis
sudo systemctl restart redis

# Si Channels falla
cd tenants-backend
pip install channels channels-redis

# Reiniciar backend
pm2 restart tenants-backend
```

---

### Error: "Mensajes se duplican"

**Síntoma:**
```
Cada mensaje aparece 2 o 3 veces en el chat
```

**Diagnóstico:**
- Múltiples conexiones WebSocket abiertas

**Solución:**
```typescript
// Frontend - Asegurar que solo hay 1 conexión
useEffect(() => {
  const ws = new WebSocket(`wss://...`);

  // Limpiar al desmontar componente
  return () => {
    ws.close();
  };
}, [chatId]); // Dependencia importante
```

---

## 📊 Problemas de Performance

### Problema: "Dashboard carga muy lento (>10 seg)"

**Síntoma:**
```
Dashboard tarda más de 10 segundos en cargar
Queries SQL lentas en logs
```

**Diagnóstico:**
```bash
# Backend - Activar SQL logging
# settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        },
    },
}

# Ver queries lentas
tail -f logs/backend-out.log | grep "SELECT"
```

**Solución:**
```python
# Backend - Optimizar queries con select_related/prefetch_related
# apps/dashboards/views.py

# ❌ MAL (genera N+1 queries)
oportunidades = Oportunidad.objects.all()
for opp in oportunidades:
    print(opp.cliente.nombre)  # Query por cada oportunidad

# ✅ BIEN
oportunidades = Oportunidad.objects.select_related('cliente').all()
for opp in oportunidades:
    print(opp.cliente.nombre)  # 1 sola query con JOIN
```

**Crear índices en PostgreSQL:**
```sql
-- Índices recomendados
CREATE INDEX idx_oportunidad_estado ON oportunidades (estado);
CREATE INDEX idx_oportunidad_created_at ON oportunidades (created_at);
CREATE INDEX idx_cliente_dni ON clientes (dni_cif);
```

---

### Problema: "Tabla con 1000+ filas se congela"

**Síntoma:**
```
Tabla de oportunidades con paginación tarda en renderizar
Browser se congela al scrollear
```

**Solución:**
```typescript
// Frontend - Usar virtualización
import { useVirtualizer } from '@tanstack/react-virtual';

// En vez de renderizar todas las filas, solo las visibles
const rowVirtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // altura de cada fila
});
```

---

## 📄 Problemas con PDFs

### Error: "PDF no se genera"

**Síntoma:**
```
Botón "Generar PDF" no hace nada
O genera PDF vacío
```

**Diagnóstico:**
```bash
# Backend logs
pm2 logs tenants-backend | grep -i pdf

# Verificar dependencias
cd tenants-backend
source venv/bin/activate
python -c "import weasyprint; print('OK')"
```

**Solución:**
```bash
# Si weasyprint falla
pip install weasyprint

# Reiniciar backend
pm2 restart tenants-backend
```

---

## 💰 Problemas de Precios

### Error: "Valoración devuelve 0.00€"

**Síntoma:**
```
Al valorar dispositivo, precio muestra 0.00€
```

**Diagnóstico:**
```bash
# Backend - Verificar que hay precios en BD
python manage.py shell

from apps.productos.models import Precio, Modelo, Capacidad

modelo = Modelo.objects.get(nombre__icontains='iPhone 13 Pro')
capacidad = Capacidad.objects.get(valor='256GB')

precio = Precio.objects.filter(
    modelo=modelo,
    capacidad=capacidad,
    grado='B'
).first()

print(f"Precio: {precio.precio_b2b if precio else 'NO ENCONTRADO'}")
```

**Solución:**
```bash
# Si no hay precios, ejecutar ingesta
python manage.py shell

from apps.productos.services import PrecioService
from apps.core.models import Tenant

tenant = Tenant.objects.get(schema_name='tutienda')
PrecioService.ingestar_desde_likewize(tenant)
```

---

## 🔧 Problemas de Deployment

### Error: "PM2 no inicia el backend"

**Síntoma:**
```bash
pm2 start ecosystem.config.js
# Backend aparece como "errored"
```

**Diagnóstico:**
```bash
pm2 logs tenants-backend --err
```

**Soluciones Comunes:**

**1. Uvicorn no instalado:**
```bash
cd tenants-backend
source venv/bin/activate
pip install uvicorn
pm2 restart tenants-backend
```

**2. Puerto 8000 ocupado:**
```bash
sudo lsof -i :8000
# Si hay proceso, matar:
sudo kill -9 <PID>
pm2 restart tenants-backend
```

**3. Permisos de virtualenv:**
```bash
chmod +x tenants-backend/venv/bin/uvicorn
pm2 restart tenants-backend
```

---

### Error: "502 Bad Gateway (Nginx)"

**Síntoma:**
```
Al acceder a https://progeek.es
Error 502 Bad Gateway
```

**Diagnóstico:**
```bash
# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Verificar que PM2 está corriendo
pm2 status
```

**Solución:**
```bash
# Si PM2 no está corriendo
pm2 start ecosystem.config.js --env production

# Si Nginx está mal configurado
sudo nginx -t  # Test configuración
sudo systemctl reload nginx
```

---

## 🗄️ Problemas de Base de Datos

### Error: "too many connections"

**Síntoma:**
```
Django error: "FATAL: sorry, too many clients already"
```

**Solución:**
```bash
# PostgreSQL - Aumentar max_connections
sudo nano /etc/postgresql/14/main/postgresql.conf

# Cambiar:
max_connections = 100  # Default
# Por:
max_connections = 200

sudo systemctl restart postgresql
```

---

### Error: "Migraciones no aplican"

**Síntoma:**
```bash
python manage.py migrate
# Error: "Table already exists"
```

**Solución:**
```bash
# Fake migration (si la tabla ya existe manualmente)
python manage.py migrate --fake nombre_app

# O eliminar y recrear (SOLO EN DEV):
python manage.py migrate nombre_app zero
python manage.py migrate nombre_app
```

---

## 🔍 Herramientas de Diagnóstico

### Logs Centralizados

```bash
# Ver todos los logs en tiempo real
pm2 logs

# Ver solo errores
pm2 logs --err

# Ver logs específicos
pm2 logs tenant-frontend
pm2 logs tenants-backend

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Logs de Redis
sudo tail -f /var/log/redis/redis-server.log
```

---

### Monitoreo de Recursos

```bash
# CPU y Memoria
htop

# Disco
df -h

# Conexiones activas
netstat -tuln | grep LISTEN

# PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Redis info
redis-cli info | grep connected_clients
```

---

### Health Check Endpoints

```bash
# Backend health
curl https://progeek.es/api/health/

# Frontend (Next.js)
curl https://progeek.es/

# Redis
redis-cli ping

# PostgreSQL
sudo -u postgres psql -c "SELECT 1;"
```

---

## 📞 Contacto de Soporte

### Escalamiento de Issues

**Nivel 1: Soporte Básico**
- Email: soporte@zirqulo.com
- Chat interno (para partners)
- Tiempo respuesta: < 4 horas hábiles

**Nivel 2: Soporte Técnico**
- Email: tech@zirqulo.com
- Para issues técnicos complejos
- Tiempo respuesta: < 2 horas hábiles

**Nivel 3: Incidentes Críticos**
- Email urgente: incidentes@zirqulo.com
- Teléfono: [Número 24/7]
- Para downtime o pérdida de datos
- Tiempo respuesta: < 30 minutos

---

## 🛠️ Comandos de Recuperación Rápida

### Reset Completo (Last Resort)

```bash
# ⚠️ SOLO USAR EN DEV O CON BACKUP

# Parar todo
pm2 delete all

# Limpiar Redis
redis-cli FLUSHALL

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Reiniciar servicios
cd /srv/checkouters/Partners
pm2 start ecosystem.config.js --env production

# Verificar
pm2 status
pm2 logs
```

---

**[[../00-Indice|← Volver al Índice]]**

---

> [!warning] Contactar Soporte
> Si el problema persiste después de seguir estos pasos, contacta con el equipo técnico incluyendo logs relevantes.

**Zirqulo Partners** — Soporte técnico profesional
