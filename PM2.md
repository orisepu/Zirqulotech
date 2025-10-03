# Guía de PM2 para Checkouters Partners

## Instalación de PM2

```bash
# Instalar PM2 globalmente
npm install -g pm2

# O con pnpm
pnpm add -g pm2
```

## Preparación

### 1. Build del Frontend
Antes de iniciar con PM2, asegúrate de hacer el build de producción:

```bash
cd tenant-frontend
pnpm build
cd ..
```

### 2. Verificar Uvicorn en el Backend
```bash
# Uvicorn debe estar instalado en tenants-backend/venv/bin/uvicorn
# Si no está, el script pm2-start.sh lo instalará automáticamente
ls tenants-backend/venv/bin/uvicorn
```

## Comandos Básicos

### Iniciar Aplicaciones

```bash
# Iniciar en modo producción (recomendado)
pm2 start ecosystem.config.js --env production

# Iniciar en modo desarrollo
pm2 start ecosystem.config.js --env development

# Iniciar solo el frontend
pm2 start ecosystem.config.js --only tenant-frontend

# Iniciar solo el backend
pm2 start ecosystem.config.js --only tenants-backend
```

### Gestión de Procesos

```bash
# Ver estado de las aplicaciones
pm2 status

# Ver logs en tiempo real
pm2 logs

# Ver logs solo del frontend
pm2 logs tenant-frontend

# Ver logs solo del backend
pm2 logs tenants-backend

# Reiniciar aplicaciones
pm2 restart all
pm2 restart tenant-frontend
pm2 restart tenants-backend

# Recargar aplicaciones (sin downtime)
pm2 reload all

# Detener aplicaciones
pm2 stop all
pm2 stop tenant-frontend
pm2 stop tenants-backend

# Eliminar procesos de PM2
pm2 delete all
pm2 delete tenant-frontend
pm2 delete tenants-backend
```

### Monitoreo

```bash
# Dashboard interactivo
pm2 monit

# Información detallada
pm2 show tenant-frontend
pm2 show tenants-backend

# Métricas del sistema
pm2 status
```

## Configuración de Inicio Automático

Para que PM2 inicie automáticamente al arrancar el servidor:

```bash
# Generar script de inicio
pm2 startup

# Guardar configuración actual
pm2 save

# Para desactivar el inicio automático
pm2 unstartup
```

## Estructura de Logs

Los logs se guardan en el directorio `logs/`:
- `logs/frontend-error.log` - Errores del frontend
- `logs/frontend-out.log` - Salida estándar del frontend
- `logs/backend-error.log` - Errores del backend
- `logs/backend-out.log` - Salida estándar del backend

## Configuración

### Frontend
- **Puerto**: 3000
- **Instancias**: Modo cluster con todas las CPUs disponibles
- **Memoria máxima**: 1GB por instancia

### Backend
- **Puerto**: 8000
- **Workers Uvicorn**: 4
- **ASGI Server**: Uvicorn (Django Channels compatible)
- **Memoria máxima**: 1GB

## Troubleshooting

### El frontend no inicia
```bash
# Verificar que el build está hecho
cd tenant-frontend
pnpm build
```

### El backend no encuentra uvicorn
```bash
cd tenants-backend
source venv/bin/activate
pip install uvicorn
deactivate
```

### Ver errores específicos
```bash
pm2 logs tenant-frontend --err
pm2 logs tenants-backend --err
```

### Limpiar logs
```bash
pm2 flush  # Limpia todos los logs
```

## Comandos Rápidos

```bash
# Todo en uno: detener, eliminar y reiniciar limpiamente
pm2 delete all && pm2 start ecosystem.config.js --env production

# Reinicio sin downtime
pm2 reload all

# Ver uso de recursos
pm2 monit
```

## Notas Importantes

1. **Producción**: Siempre usar `--env production` para mejor rendimiento
2. **Build**: El frontend DEBE estar compilado antes de iniciar PM2
3. **Virtualenv**: Uvicorn debe estar instalado en `venv/bin/` del backend
4. **Puertos**: Frontend en 3000, Backend en 8000
5. **Cluster Mode**: El frontend usa todas las CPUs disponibles para mejor rendimiento
6. **ASGI**: El backend usa ASGI (Uvicorn) para soportar WebSockets y Django Channels
