#!/bin/bash

# Developer Experience Setup Script - Checkouters Frontend
# Este script configura el entorno de desarrollo óptimo

set -e

echo "🚀 Configurando entorno de desarrollo optimizado para Checkouters Frontend..."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde el directorio tenant-frontend"
    exit 1
fi

# Verificar Node.js version
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "⚠️ Advertencia: Se recomienda Node.js 18+ (actual: $(node -v))"
fi

# Verificar pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm no está instalado. Instálalo con: npm i -g pnpm"
    exit 1
fi

echo "✅ Node.js: $(node -v)"
echo "✅ pnpm: $(pnpm -v)"

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    pnpm install
else
    echo "✅ Dependencias ya instaladas"
fi

# Crear .env.local si no existe
if [ ! -f ".env.local" ]; then
    echo "🔧 Creando configuración de entorno local..."
    cp .env.local.example .env.local
    echo "✅ Archivo .env.local creado. Edítalo según tu configuración."
else
    echo "✅ .env.local ya existe"
fi

# Verificar configuración de TypeScript
echo "🔍 Verificando configuración de TypeScript..."
if pnpm typecheck > /dev/null 2>&1; then
    echo "✅ TypeScript configurado correctamente"
else
    echo "⚠️ Hay errores de TypeScript. Ejecuta 'pnpm typecheck' para verlos."
fi

# Verificar ESLint
echo "🔍 Verificando ESLint..."
if pnpm lint > /dev/null 2>&1; then
    echo "✅ ESLint configurado correctamente"
else
    echo "⚠️ Hay errores de ESLint. Ejecuta 'pnpm lint' para verlos."
fi

# Crear directorios necesarios si no existen
mkdir -p coverage
mkdir -p .next
echo "✅ Directorios de trabajo creados"

echo ""
echo "🎉 ¡Configuración completada!"
echo ""
echo "Comandos útiles:"
echo "  pnpm dev          - Desarrollo con Turbopack (recomendado)"
echo "  pnpm dx:check     - Verificación completa (TypeScript + ESLint + Tests)"
echo "  pnpm test:watch   - Tests en modo watch"
echo "  pnpm build:analyze - Análisis de bundle"
echo ""
echo "Configuración VS Code:"
echo "  - Extensiones recomendadas en .vscode/extensions.json"
echo "  - Settings optimizados en .vscode/settings.json"
echo "  - Debug configurado en .vscode/launch.json"
echo ""
echo "Para más información, consulta dx-tools.md"