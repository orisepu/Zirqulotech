#!/bin/bash

# Script de inicio rápido para PM2
# Uso: ./pm2-start.sh [production|development]

ENV=${1:-production}

echo "🚀 Iniciando Checkouters Partners con PM2 en modo $ENV..."

# Verificar si PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 no está instalado. Instalando..."
    npm install -g pm2
fi

# Crear directorio de logs si no existe
mkdir -p logs

# Verificar build del frontend
if [ ! -d "tenant-frontend/.next" ]; then
    echo "⚠️  Build del frontend no encontrado. Construyendo..."
    cd tenant-frontend
    pnpm build
    cd ..
fi

# Verificar Uvicorn en el virtualenv del backend
if [ ! -f "tenants-backend/venv/bin/uvicorn" ]; then
    echo "⚠️  Uvicorn no encontrado en venv. Instalando..."
    cd tenants-backend
    source venv/bin/activate
    pip install uvicorn
    deactivate
    cd ..
fi

# Detener procesos anteriores si existen
echo "🛑 Deteniendo procesos anteriores..."
pm2 delete all 2>/dev/null || true

# Iniciar con PM2
echo "▶️  Iniciando aplicaciones..."
pm2 start ecosystem.config.js --env $ENV

# Mostrar estado
echo ""
echo "✅ Aplicaciones iniciadas!"
echo ""
pm2 status

echo ""
echo "📊 Para ver logs en tiempo real: pm2 logs"
echo "📈 Para monitoreo: pm2 monit"
echo "🔄 Para reiniciar: pm2 reload all"
echo "🛑 Para detener: pm2 stop all"
