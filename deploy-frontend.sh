#!/bin/bash

# Script de deploy con zero downtime para tenant-frontend

set -e

echo "🚀 Iniciando deploy de tenant-frontend..."

# Ir al directorio del frontend
cd tenant-frontend

echo "📦 Instalando dependencias..."
# Si hay problemas con lockfile, regenerarlo
if ! pnpm install --frozen-lockfile 2>/dev/null; then
  echo "⚠️  Lockfile corrupto, regenerando..."
  pnpm install --no-frozen-lockfile
fi

echo "🔨 Construyendo nueva versión..."
pnpm build

echo "♻️  Recargando PM2 con zero downtime (cluster mode)..."
cd ..
pm2 reload ecosystem.config.js --only tenant-frontend --update-env

echo "✅ Deploy completado con éxito!"
echo "📊 Estado de PM2:"
pm2 list
