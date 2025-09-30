# Checkouters Partners - Frontend

Plataforma frontend multi-tenant para compra de dispositivos construida con Next.js 15, React 19 y TypeScript. Parte del ecosistema Checkouters Partners para gestionar valoraciones de dispositivos, relaciones con clientes y analíticas de negocio a través de múltiples tenants de partners.

## 🏗️ Arquitectura

- **Framework**: Next.js 15 con App Router y Turbopack
- **Librería UI**: Material-UI 7 con sistema de temas personalizado
- **Gestión de Estado**: TanStack Query (React Query 5)
- **Multi-tenancy**: Enrutado y llamadas API conscientes del tenant
- **Tiempo Real**: Integración de chat WebSocket
- **Testing**: Suite completa de tests API + Frontend (170+ tests totales)

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local según tus necesidades

# Iniciar servidor de desarrollo
pnpm dev

# Abrir http://localhost:3000
```

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env.local` basado en `.env.local.example`:

```bash
# Multi-tenant development
NEXT_PUBLIC_DEFAULT_TENANT=progeek
NEXT_PUBLIC_API_BASE_URL=https://zirqulartech.com

# Homepage behavior
# Set to 'true' to redirect homepage (/) directly to /login
# Set to 'false' or omit to show the landing page
NEXT_PUBLIC_SKIP_HOMEPAGE=false

# Debug y performance
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_ENABLE_DEVTOOLS=true
```

#### Configuración de Homepage

La variable `NEXT_PUBLIC_SKIP_HOMEPAGE` controla el comportamiento de la página de inicio:

- **`true`**: La homepage (`/`) redirige automáticamente a `/login`
  - Útil para entornos de producción donde no necesitas mostrar la landing page
  - Optimiza el flujo para usuarios que solo necesitan acceder al dashboard
  - Muestra un spinner de carga durante el redirect (sin flash de contenido)

- **`false` o no definida**: Muestra la landing page completa con información del producto
  - Ideal para entornos de demostración y marketing
  - Permite a visitantes conocer el producto antes de hacer login

**Ejemplo de uso:**

```bash
# Producción - Saltar directamente al login
NEXT_PUBLIC_SKIP_HOMEPAGE=true

# Demo/Marketing - Mostrar landing page
NEXT_PUBLIC_SKIP_HOMEPAGE=false
```

## 📋 Scripts Disponibles

### Desarrollo
```bash
pnpm dev               # Iniciar servidor de desarrollo (Turbopack habilitado)
pnpm build             # Build de producción
pnpm start             # Servir build de producción
pnpm typecheck         # Verificación de tipos TypeScript
pnpm eslint            # Ejecutar ESLint en todos los archivos fuente
pnpm eslint:fix        # Auto-reparar problemas de ESLint
```

### Testing
```bash
# Tests Generales
pnpm test              # Ejecutar todos los tests
pnpm test:watch        # Ejecutar tests en modo watch
pnpm test:coverage     # Ejecutar tests con reporte de cobertura

# Tests de API (Backend Integration)
pnpm test:critical     # Ejecutar tests críticos Tier 1 (pre-commit)
pnpm test:business     # Ejecutar tests de negocio Tier 2 (CI/CD)
pnpm test:health       # Verificar salud de API (200+ endpoints)
pnpm test:all          # Ejecutar todos los tiers de API secuencialmente

# Tests Frontend (Lógica de Negocio + Componentes)
pnpm test:unit         # Tests unitarios frontend (utilidades, hooks, lógica)
pnpm test:frontend     # Alias para test:unit
pnpm test:full         # Ejecutar todos los tests (API + Frontend)
```

## 🧪 Estrategia de Testing

### Arquitectura de Tests Multicapa

#### Tests de API (Backend Integration) - 99 tests
- **Tier 1 - Crítico (30 tests)**: Autenticación, tenants, CRM básico, dashboards
- **Tier 2 - Negocio (42 tests)**: Operaciones globales, dispositivos, contratos B2C, chat
- **Health Check (27 tests)**: Verificación completa de endpoints (200+)

#### Tests Frontend (Lógica de Negocio) - 70+ tests
- **Lógica de Grading (25+ tests)**: Sistema de valoración de dispositivos (A+ a D)
- **Validadores Españoles (35+ tests)**: DNI/NIE/CIF, IMEI, códigos postales, teléfonos
- **Custom Hooks (10+ tests)**: `useUsuarioActual`, `useOportunidadFilters`
- **Utilidades (10+ tests)**: Formateo de euros, gestión de IDs, navegación
- **Componentes UI (5+ tests)**: `KpiCard`, dashboards críticos

### Integración en Workflow
- **Pre-commit**: `pnpm test:critical` - APIs esenciales (2 min)
- **Pre-push**: `pnpm test:frontend` - Lógica frontend (1 min)
- **CI/CD**: `pnpm test:full` - Suite completa (5 min)
- **Desarrollo**: `pnpm test:watch` - Feedback continuo

## 🏢 Características Multi-Tenant

- **Aislamiento de Tenant**: Separación completa de datos por partner
- **Temas Dinámicos**: Branding y colores específicos del tenant
- **API Contextual**: Inyección automática de headers de tenant
- **Acceso Basado en Roles**: Permisos de manager, admin y empleado
- **Operaciones Globales**: Gestión de oportunidades cross-tenant

## 🔧 Componentes Principales

### CRM y Oportunidades
- Onboarding multi-paso de clientes (empresa/autónomo/particular)
- Wizard de valoración de dispositivos con sistema de grading
- Gestión del pipeline de oportunidades
- Actualizaciones de estado en tiempo real

### Analytics y Dashboards
- Dashboards de analytics para manager y admin
- Seguimiento de KPIs y métricas de conversión
- Analytics de ingresos y rendimiento
- Rangos de fecha personalizables con MUI DatePicker

### Gestión de Dispositivos
- Valoración de iPhone con precios comerciales/auditoría
- Sistema de grading de dispositivos (A+ a D)
- Procesamiento por lotes para múltiples dispositivos
- Integración con APIs de precios externos

### Comunicación
- Sistema de chat de soporte en tiempo real
- Mensajería contextual con oportunidades
- Gestión de notificaciones
- Integración WebSocket

## 🎨 Características UI/UX

- **Material-UI 7**: Librería de componentes moderna
- **Diseño Responsive**: Enfoque mobile-first
- **Temas Oscuro/Claro**: Temas configurables por tenant
- **Localización Española**: Soporte completo para el mercado español
- **Accesibilidad**: Componentes compatibles con WCAG

## 🔐 Seguridad y Autenticación

- **Autenticación JWT**: Auth basado en tokens seguros
- **Refresh Automático de Token**: Gestión de sesiones transparente
- **Permisos Basados en Roles**: Control de acceso granular
- **Seguridad de Contexto de Tenant**: Acceso aislado a datos

## 📊 Rendimiento

- **Turbopack**: Builds de desarrollo rápidos
- **TanStack Query**: Gestión optimizada del estado del servidor
- **Code Splitting**: División automática por rutas
- **Optimización de Bundle**: Builds listos para producción

## 🛠️ Desarrollo

### Stack Tecnológico
- Next.js 15 + React 19 + TypeScript
- Material-UI 7 + Emotion
- TanStack Query + Axios
- Jest + React Testing Library
- ESLint + Prettier

### Estructura del Proyecto
```
src/
├── components/        # Componentes UI reutilizables
├── pages/            # Páginas y enrutado de Next.js
├── hooks/            # Hooks personalizados de React
├── services/         # API y servicios externos
├── types/            # Definiciones de tipos TypeScript
├── utils/            # Funciones de utilidad
├── __tests__/        # Archivos de test y configuración
└── constants/        # Constantes y configuraciones de la app
```

## 🌐 Integración Backend

Se conecta a backend Django 5 + DRF con:
- **Base API**: https://progeek.es
- **Multi-tenant**: Separación por esquemas django-tenants
- **Tiempo Real**: Soporte WebSocket con Django Channels
- **200+ Endpoints**: Cobertura completa de API de negocio

## 📈 Actualizaciones Recientes

### Optimizaciones de Dashboard
- Integración MUI DatePicker para mejor UX
- Eliminación de controles UI redundantes
- Mejora en selección de rangos de fecha

### Infraestructura de Testing Completa
- **API Testing**: 99 tests cubriendo 200+ endpoints backend
- **Frontend Testing**: 70+ tests de lógica de negocio crítica
- **Mocking Inteligente**: axios-mock-adapter, React components, navegación
- **Test Utilities**: Helpers para providers, datos mock realistas
- **Estrategia por Niveles**: Testing optimizado para CI/CD y desarrollo
- **Cobertura Integral**: Desde validadores hasta componentes UI

### Mejoras de Rendimiento
- Builds de desarrollo Turbopack
- Seguridad de tipos mejorada
- Mejoras en calidad de código

## 📚 Documentación

Para documentación detallada, ver [CLAUDE.md](../../../CLAUDE.md) que incluye:
- Referencia completa de API (200+ endpoints)
- Análisis profundo de arquitectura
- Documentación de componentes
- Guías de desarrollo
- Estrategias de testing

## 🚢 Despliegue

```bash
# Build para producción
pnpm build

# Iniciar servidor de producción
pnpm start
```

Construido para despliegue en Vercel, Netlify, o cualquier plataforma de hosting Node.js.
