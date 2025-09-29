# Checkouters Partners

Plataforma multi-tenant para la compra y valoración de dispositivos móviles. Un ecosistema completo que conecta partners, clientes y dispositivos a través de una solución tecnológica integral.

## 🏗️ Arquitectura

Este es un monorepo que contiene:

```
checkouters/Partners/
├── tenant-frontend/       # Frontend Next.js 15 + React 19 + TypeScript
└── tenants-backend/       # Backend Django 5 + DRF con django-tenants
```

### Tecnologías Principales
- **Frontend**: Next.js 15 con App Router y Turbopack
- **Backend**: Django 5 + Django REST Framework
- **Base de Datos**: PostgreSQL con separación por esquemas (multi-tenant)
- **UI**: Material-UI 7 con sistema de temas personalizado
- **Estado**: TanStack Query (React Query 5)
- **Tiempo Real**: WebSocket con Django Channels
- **Testing**: Suite completa de tests (99 tests, 200+ endpoints)

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ y pnpm
- Python 3.12+ y pip
- PostgreSQL 14+
- Redis (para WebSocket)

### Configuración del Frontend
```bash
cd tenant-frontend
pnpm install
pnpm dev
# Abre http://localhost:3000
```

### Configuración del Backend
```bash
cd tenants-backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# API disponible en http://localhost:8000
```

## 📋 Comandos Disponibles

### Frontend (tenant-frontend)
```bash
# Desarrollo
pnpm dev               # Servidor de desarrollo (Turbopack habilitado)
pnpm build             # Build de producción
pnpm start             # Servir build de producción
pnpm typecheck         # Verificación de tipos TypeScript
pnpm eslint            # Ejecutar ESLint en todos los archivos
pnpm eslint:fix        # Auto-reparar problemas de ESLint

# Testing
pnpm test              # Ejecutar todos los tests
pnpm test:watch        # Ejecutar tests en modo watch
pnpm test:coverage     # Ejecutar tests con reporte de cobertura
pnpm test:critical     # Ejecutar tests críticos Tier 1 (pre-commit)
pnpm test:business     # Ejecutar tests de negocio Tier 2 (CI/CD)
pnpm test:health       # Verificar salud de API (200+ endpoints)
pnpm test:all          # Ejecutar todos los tiers secuencialmente
```

### Backend (tenants-backend)
```bash
python manage.py runserver     # Servidor de desarrollo Django
python manage.py migrate       # Ejecutar migraciones
python manage.py test          # Ejecutar tests Django
pytest                         # Ejecutar tests pytest
```

## 🏢 Sistema Multi-Tenant

### Características Principales
- **Aislamiento de Datos**: Separación completa por esquemas de BD
- **Temas Dinámicos**: Branding y colores específicos por tenant
- **API Contextual**: Inyección automática de headers de tenant
- **Permisos por Rol**: Manager, admin y permisos de empleado
- **Operaciones Globales**: Gestión de oportunidades cross-tenant

### Flujo de Autenticación
1. **JWT Tokens**: Almacenados en localStorage
2. **Refresh Automático**: Interceptores de axios
3. **Selección de Tenant**: Almacenada como `schema` en localStorage
4. **Headers API**: `X-Tenant` enviado automáticamente

## 🔧 Componentes Principales

### CRM y Oportunidades
- **Formularios Multi-paso**: Onboarding de clientes (empresa/autónomo/particular)
- **Wizard de Valoración**: Sistema de valoración de dispositivos con grading
- **Pipeline de Oportunidades**: Gestión del estado de oportunidades
- **Actualizaciones en Tiempo Real**: Estados y notificaciones

### Analytics y Dashboards
- **Dashboards de Manager/Admin**: Analytics y métricas de negocio
- **Seguimiento de KPIs**: Métricas de conversión y rendimiento
- **Analytics de Ingresos**: Análisis de performance financiera
- **Rangos de Fecha**: MUI DatePicker para selección personalizada

### Gestión de Dispositivos
- **Valoración de iPhone**: Precios comerciales y de auditoría
- **Sistema de Grading**: Clasificación A+ a D
- **Procesamiento por Lotes**: Múltiples dispositivos
- **APIs Externas**: Integración con Likewize, BackMarket

### Comunicación
- **Sistema de Chat**: Soporte en tiempo real
- **Mensajería Contextual**: Integrado con oportunidades
- **Gestión de Notificaciones**: Sistema completo de alertas
- **WebSocket**: Conexiones en tiempo real

## 🧪 Estrategia de Testing

### Arquitectura de Tests por Niveles
- **Tier 1 - Crítico (30 tests)**: Autenticación, tenants, CRM básico, dashboards
- **Tier 2 - Negocio (42 tests)**: Operaciones globales, dispositivos, contratos B2C, chat
- **Health Check (27 tests)**: Verificación completa de endpoints

### Integración en Workflow
- **Pre-commit**: `pnpm test:critical` - Verificación rápida (APIs esenciales)
- **CI/CD**: `pnpm test:all` - Testing completo de regresión
- **Desarrollo**: `pnpm test:watch` - Feedback continuo

## 🎨 Características UI/UX

- **Material-UI 7**: Librería de componentes moderna
- **Diseño Responsive**: Enfoque mobile-first
- **Temas Oscuro/Claro**: Temas configurables por tenant
- **Localización Española**: Soporte completo para el mercado español
- **Accesibilidad**: Componentes compatibles con WCAG

## 🔐 Seguridad y Autenticación

- **Autenticación JWT**: Auth basado en tokens seguros
- **Refresh Automático**: Gestión de sesiones transparente
- **Permisos por Rol**: Control de acceso granular
- **Seguridad de Contexto**: Acceso aislado a datos por tenant

## 📊 Rendimiento

- **Turbopack**: Builds de desarrollo rápidos
- **TanStack Query**: Gestión optimizada del estado del servidor
- **Code Splitting**: División automática por rutas
- **Optimización de Bundle**: Builds listos para producción

## 🌐 Integración Backend

### APIs Principales (200+ endpoints)
- **Base API**: https://progeek.es
- **Multi-tenant**: Separación por esquemas django-tenants
- **Tiempo Real**: Soporte WebSocket con Django Channels
- **Documentación**: Ver [CLAUDE.md](./CLAUDE.md) para referencia completa

### Módulos Backend
- `checkouters/` - Lógica de negocio principal
- `chat/` - Chat en tiempo real con WebSocket
- `productos/` - Catálogo de productos y precios
- `progeek/` - Lógica de aplicación principal
- `notificaciones/` - Sistema de notificaciones

## 📈 Actualizaciones Recientes

### Optimizaciones de Dashboard (2024)
- **Integración MUI DatePicker**: Mejor UX para selección de fechas
- **Consistencia UI**: Eliminación de controles redundantes
- **Estandarización de Componentes**: Patrones consistentes

### Infraestructura de Testing (2024)
- **Cobertura Completa**: 99 tests cubriendo 200+ endpoints
- **Estrategia por Niveles**: Testing eficiente para CI/CD
- **Arquitectura de Mocks**: Datos realistas para testing
- **Monitoreo de Performance**: Tiempo de respuesta de APIs

### Mejoras de Rendimiento
- **Builds Turbopack**: Desarrollo más rápido
- **Seguridad de Tipos**: TypeScript estricto
- **Calidad de Código**: ESLint mejorado

## 🚢 Despliegue

### Frontend
```bash
cd tenant-frontend
pnpm build
pnpm start
```

### Backend
```bash
cd tenants-backend
python manage.py collectstatic
python manage.py migrate
gunicorn django_test_app.wsgi:application
```

### Variables de Entorno
- **Frontend**: API_URL, TENANT_HEADER
- **Backend**: DATABASE_URL, REDIS_URL, SECRET_KEY

## 📚 Documentación

Para documentación detallada, consulta [CLAUDE.md](./CLAUDE.md) que incluye:
- Referencia completa de API (200+ endpoints)
- Análisis profundo de arquitectura
- Documentación de componentes
- Guías de desarrollo
- Estrategias de testing

## 🤝 Contribución

1. Fork del repositorio
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'feat: añadir nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Estándares de Código
- **TypeScript**: Modo estricto habilitado
- **ESLint**: Reglas de Next.js y TanStack Query
- **Commits**: Formato conventional commits
- **Testing**: Tests para nuevas funcionalidades

## 📄 Licencia

Este proyecto es propiedad de Checkouters. Todos los derechos reservados.

## 🆘 Soporte

Para soporte técnico o consultas:
- **Documentación**: [CLAUDE.md](./CLAUDE.md)
- **Issues**: GitHub Issues
- **Email**: soporte@checkouters.com

---

**Checkouters Partners** - La plataforma integral para la gestión de dispositivos móviles y partners.