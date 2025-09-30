# Checkouters Frontend - Developer Experience Makefile
# Comandos optimizados para desarrollo y CI/CD

.PHONY: help install dev build test clean

# Variables
PNPM := pnpm
NODE_ENV := development

# Default target
help:
	@echo "🚀 Checkouters Frontend - Developer Experience"
	@echo ""
	@echo "Comandos de desarrollo:"
	@echo "  make install    - Instalar dependencias"
	@echo "  make dev        - Desarrollo con Turbopack"
	@echo "  make build      - Build de producción"
	@echo "  make clean      - Limpiar archivos generados"
	@echo ""
	@echo "Testing (optimizado para CI/CD):"
	@echo "  make test       - Suite completa de tests"
	@echo "  make test-critical - Solo tests Tier 1 (2min)"
	@echo "  make test-frontend - Solo lógica frontend (1min)"
	@echo "  make test-watch - Tests en modo watch"
	@echo ""
	@echo "Calidad de código:"
	@echo "  make lint       - ESLint con cache"
	@echo "  make typecheck  - Verificación TypeScript"
	@echo "  make dx-check   - Verificación completa pre-commit"
	@echo "  make dx-fix     - Corrección automática de issues"
	@echo ""
	@echo "Multi-tenant:"
	@echo "  make dev-tenant TENANT=progeek - Desarrollo con tenant específico"
	@echo "  make test-tenant TENANT=test   - Tests con contexto tenant"

# Installation
install:
	@echo "📦 Instalando dependencias..."
	$(PNPM) install

# Development
dev:
	@echo "🚀 Iniciando desarrollo con Turbopack..."
	$(PNPM) dev

dev-legacy:
	@echo "🔄 Iniciando desarrollo sin Turbopack..."
	$(PNPM) dev:legacy

dev-tenant:
	@echo "🏢 Desarrollo con tenant: $(TENANT)"
	@NEXT_PUBLIC_DEFAULT_TENANT=$(TENANT) $(PNPM) dev

# Build
build:
	@echo "🏗️ Building para producción..."
	$(PNPM) build

build-analyze:
	@echo "📊 Build con análisis de bundle..."
	$(PNPM) build:analyze

# Testing (Tiered approach optimizado para CI/CD)
test:
	@echo "🧪 Ejecutando suite completa de tests..."
	./scripts/test-ci.sh full

test-critical:
	@echo "🚀 Tests críticos (Tier 1) - APIs esenciales..."
	./scripts/test-ci.sh critical

test-frontend:
	@echo "🎨 Tests de lógica frontend..."
	./scripts/test-ci.sh frontend

test-health:
	@echo "❤️ Health check - todos los endpoints..."
	./scripts/test-ci.sh health

test-watch:
	@echo "👀 Tests en modo watch..."
	$(PNPM) test:watch

test-coverage:
	@echo "📊 Tests con reporte de coverage..."
	$(PNPM) test:coverage

test-tenant:
	@echo "🏢 Tests con contexto tenant: $(TENANT)"
	@NEXT_PUBLIC_DEFAULT_TENANT=$(TENANT) $(PNPM) test:critical

# Code Quality
lint:
	@echo "🔍 Ejecutando ESLint..."
	$(PNPM) lint

lint-fix:
	@echo "🔧 Corrigiendo issues de ESLint..."
	$(PNPM) lint:fix

typecheck:
	@echo "📝 Verificando TypeScript..."
	$(PNPM) typecheck

typecheck-watch:
	@echo "👀 TypeScript en modo watch..."
	$(PNPM) typecheck:watch

# Developer Experience
dx-check:
	@echo "✅ Verificación completa pre-commit..."
	./scripts/test-ci.sh pre-commit

dx-fix:
	@echo "🔧 Corrección automática de issues..."
	$(PNPM) dx:fix

dx-setup:
	@echo "⚙️ Configuración inicial del entorno..."
	./scripts/dev-setup.sh

# Maintenance
clean:
	@echo "🧹 Limpiando archivos generados..."
	$(PNPM) clean

clean-all:
	@echo "🧹 Limpieza completa (incluyendo node_modules)..."
	$(PNPM) clean:all

reset:
	@echo "🔄 Reset completo del proyecto..."
	$(PNPM) clean:all
	$(PNPM) install

# CI/CD Helpers
ci-install:
	@echo "🤖 CI: Instalación..."
	$(PNPM) install --frozen-lockfile

ci-test:
	@echo "🤖 CI: Testing completo..."
	make dx-check
	make test

ci-build:
	@echo "🤖 CI: Build y verificación..."
	make build
	@echo "✅ CI pipeline completado"

# Performance
perf-build:
	@echo "⚡ Análisis de performance de build..."
	time make build

perf-test:
	@echo "⚡ Análisis de performance de tests..."
	time make test-critical