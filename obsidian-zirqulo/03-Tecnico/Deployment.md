---
title: Deployment — Zirqulo
tags: [tecnico, deployment, produccion, devops]
fecha: 2025-10-04
tipo: deployment
---

# Deployment de Zirqulo

> **Guía completa de despliegue en producción**

Ver también: [[../../PM2|Guía PM2 Detallada]]

---

## 📋 Requisitos del Sistema

### Hardware Mínimo (Producción)
```
CPU: 4 cores (8 recomendado)
RAM: 16 GB (32 GB recomendado)
Disk: 100 GB SSD
Network: 1 Gbps
```

### Software
```
Sistema Operativo: Ubuntu 22.04 LTS o superior
Python: 3.12+
Node.js: 18+ LTS
PostgreSQL: 14+
Redis: 6+
Nginx: 1.24+
```

---

## 🔧 Variables de Entorno

### Frontend (`tenant-frontend/.env.production`)
```bash
# API
NEXT_PUBLIC_API_URL=https://progeek.es/api
NEXT_PUBLIC_WS_URL=wss://progeek.es/ws

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Environment
NODE_ENV=production
```

### Backend (`tenants-backend/.env`)
```bash
# Django
SECRET_KEY=<generar con: python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'>
DEBUG=False
ALLOWED_HOSTS=progeek.es,www.progeek.es

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/zirqulo_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Multi-tenant
DEFAULT_TENANT_SCHEMA=public

# Security
CORS_ALLOWED_ORIGINS=https://progeek.es

# GeoIP
GEOIP_PATH=/srv/checkouters/Partners/tenants-backend/geoip/GeoLite2-City.mmdb
LOCATION_SECURITY_ENABLED=True

# APIs Externas
LIKEWIZE_API_KEY=<tu-api-key>
BACKMARKET_API_KEY=<tu-api-key>

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@zirqulo.com
EMAIL_HOST_PASSWORD=<app-password>
```

---

## 🚀 Proceso de Deployment

### 1. Preparar Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y python3.12 python3.12-venv python3-pip nodejs npm postgresql postgresql-contrib redis-server nginx git

# Instalar pnpm
npm install -g pnpm

# Instalar PM2
npm install -g pm2
```

---

### 2. Clonar Repositorio

```bash
cd /srv
git clone <repo-url> checkouters
cd checkouters/Partners
```

---

### 3. Configurar Backend

```bash
cd tenants-backend

# Crear virtualenv
python3.12 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar y configurar .env
cp .env.example .env
nano .env  # Editar con valores de producción

# Ejecutar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Descargar GeoLite2 (seguridad)
python manage.py download_geoip

# Collectstatic (archivos estáticos)
python manage.py collectstatic --noinput
```

---

### 4. Configurar Frontend

```bash
cd ../tenant-frontend

# Instalar dependencias
pnpm install

# Copiar y configurar .env
cp .env.example .env.production
nano .env.production  # Editar con valores de producción

# Build de producción
pnpm build
```

---

### 5. Configurar PostgreSQL

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear base de datos
CREATE DATABASE zirqulo_db;

# Crear usuario
CREATE USER zirqulo_user WITH PASSWORD 'strong_password_here';

# Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE zirqulo_db TO zirqulo_user;

# Salir
\q
```

---

### 6. Configurar Nginx

**Crear archivo:** `/etc/nginx/sites-available/zirqulo`

```nginx
# Frontend
server {
    listen 80;
    server_name progeek.es www.progeek.es;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name progeek.es www.progeek.es;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/progeek.es/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/progeek.es/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files (Django)
    location /static/ {
        alias /srv/checkouters/Partners/tenants-backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /srv/checkouters/Partners/tenants-backend/media/;
        expires 7d;
    }
}
```

**Activar configuración:**
```bash
sudo ln -s /etc/nginx/sites-available/zirqulo /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

### 7. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d progeek.es -d www.progeek.es

# Auto-renewal (ya configurado por defecto)
sudo systemctl status certbot.timer
```

---

### 8. Configurar PM2

**Archivo ya existente:** `ecosystem.config.js`

```bash
cd /srv/checkouters/Partners

# Iniciar aplicaciones
pm2 start ecosystem.config.js --env production

# Guardar configuración
pm2 save

# Configurar inicio automático
pm2 startup
# Copiar y ejecutar el comando que muestra PM2
```

**Ver logs:**
```bash
pm2 logs
pm2 logs tenant-frontend
pm2 logs tenants-backend
```

---

### 9. Configurar Celery (Tareas Asíncronas)

**Crear servicio systemd:** `/etc/systemd/system/celery.service`

```ini
[Unit]
Description=Celery Service
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/srv/checkouters/Partners/tenants-backend
Environment="PATH=/srv/checkouters/Partners/tenants-backend/venv/bin"
ExecStart=/srv/checkouters/Partners/tenants-backend/venv/bin/celery -A django_test_app worker --loglevel=info --detach

[Install]
WantedBy=multi-user.target
```

**Activar:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable celery
sudo systemctl start celery
sudo systemctl status celery
```

---

## 📊 Monitoreo y Logs

### PM2 Dashboard
```bash
pm2 monit
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Django Logs
```bash
tail -f /srv/checkouters/Partners/logs/backend-*.log
```

### Celery Logs
```bash
journalctl -u celery -f
```

---

## 🔄 Actualización (Deploy de Nueva Versión)

```bash
cd /srv/checkouters/Partners

# Pull cambios
git pull origin main

# Backend
cd tenants-backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Frontend
cd ../tenant-frontend
pnpm install
pnpm build

# Reiniciar servicios (zero-downtime)
cd ..
pm2 reload all

# Verificar
pm2 status
pm2 logs --lines 50
```

---

## 🔥 Troubleshooting

### Backend no inicia
```bash
# Ver logs detallados
pm2 logs tenants-backend --err

# Verificar Uvicorn
ls tenants-backend/venv/bin/uvicorn

# Reinstalar si es necesario
cd tenants-backend
source venv/bin/activate
pip install uvicorn
```

### Frontend no inicia
```bash
# Verificar build
cd tenant-frontend
ls .next/

# Rebuild si es necesario
pnpm build

# Verificar puerto 3000 no esté ocupado
sudo lsof -i :3000
```

### WebSocket no conecta
```bash
# Verificar Redis
redis-cli ping  # Debería responder "PONG"

# Verificar Channels
cd tenants-backend
source venv/bin/activate
python manage.py shell
>>> from channels.layers import get_channel_layer
>>> channel_layer = get_channel_layer()
>>> # Si no hay error, está bien configurado
```

### 502 Bad Gateway (Nginx)
```bash
# Verificar que PM2 esté corriendo
pm2 status

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Test configuración Nginx
sudo nginx -t
```

---

## 🔒 Seguridad Post-Deployment

```bash
# Firewall (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Fail2ban (protección SSH)
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Actualizar sistema regularmente
sudo apt update && sudo apt upgrade -y
```

---

## 📈 Optimizaciones de Performance

### PostgreSQL
```bash
# Editar configuración
sudo nano /etc/postgresql/14/main/postgresql.conf

# Aumentar recursos (ejemplo para 16GB RAM)
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 20MB
min_wal_size = 1GB
max_wal_size = 4GB

# Reiniciar
sudo systemctl restart postgresql
```

### Redis
```bash
# Editar configuración
sudo nano /etc/redis/redis.conf

# Activar persistent storage
save 900 1
save 300 10
save 60 10000

# Max memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Reiniciar
sudo systemctl restart redis
```

---

**[[../00-Indice|← Volver al Índice]]** | **[[../04-Operaciones/Flujos-Negocio|Siguiente: Flujos de Negocio →]]**

---

**Zirqulo Partners** — Deployment robusto y escalable
