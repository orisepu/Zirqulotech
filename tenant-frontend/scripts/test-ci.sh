#!/bin/bash

# CI/CD Optimized Testing Script
# Ejecuta tests de forma inteligente según el contexto

set -e

MODE=${1:-"full"}

echo "🧪 Ejecutando suite de tests: $MODE"

case $MODE in
    "critical")
        echo "🚀 Tier 1 - Tests críticos (APIs esenciales)"
        pnpm test:critical
        ;;
    "frontend")
        echo "🎨 Tests de lógica frontend"
        pnpm test:frontend
        ;;
    "health")
        echo "❤️ Health check (todos los endpoints)"
        pnpm test:health
        ;;
    "full")
        echo "🔍 Suite completa de tests"
        echo "1/3 - Tests de lógica frontend..."
        pnpm test:frontend

        echo "2/3 - Tests críticos de API..."
        pnpm test:critical

        echo "3/3 - Health check completo..."
        pnpm test:health

        echo "✅ Suite completa finalizada"
        ;;
    "pre-commit")
        echo "🔒 Pre-commit verification"
        echo "1/2 - Verificando TypeScript..."
        pnpm typecheck

        echo "2/2 - Tests críticos..."
        pnpm test:critical
        ;;
    *)
        echo "❌ Modo no reconocido: $MODE"
        echo "Modos disponibles:"
        echo "  critical   - Solo tests Tier 1 (2min)"
        echo "  frontend   - Solo lógica frontend (1min)"
        echo "  health     - Health check endpoints (2min)"
        echo "  full       - Suite completa (5min)"
        echo "  pre-commit - Verificación pre-commit (3min)"
        exit 1
        ;;
esac

echo "✅ Tests completados exitosamente"