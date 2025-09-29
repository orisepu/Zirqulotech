# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for Checkouters Partners platform with multi-tenant architecture:

```
checkouters/Partners/
├── tenant-frontend/       # Next.js 15 + React 19 + TypeScript frontend
└── tenants-backend/       # Django 5 + DRF backend with django-tenants
```

## Development Commands

### Frontend (tenant-frontend)
```bash
cd checkouters/Partners/tenant-frontend
pnpm dev               # Start development server (Turbopack enabled)
pnpm build             # Production build
pnpm start             # Serve production build
pnpm typecheck         # TypeScript type checking
pnpm eslint           # Run ESLint on all source files
pnpm eslint:fix       # Auto-fix ESLint issues
pnpm eslint:file      # Run ESLint on specific file

# Testing Commands
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Run tests with coverage report
pnpm test:critical     # Run only Tier 1 critical API tests (pre-commit)
pnpm test:business     # Run only Tier 2 business API tests (CI/CD)
pnpm test:health       # Run API health check across all 200+ endpoints
pnpm test:all          # Run all test tiers sequentially

# Frontend Unit Testing Commands
pnpm test:unit         # Run frontend unit tests (utilities, hooks, business logic)
pnpm test:frontend     # Alias for test:unit
pnpm test:full         # Run all tests (API + Frontend) for complete coverage
```

### Backend (tenants-backend)
```bash
cd checkouters/Partners/tenants-backend
python manage.py runserver     # Start Django development server
python manage.py migrate       # Run migrations
python manage.py test          # Run Django tests
pytest                         # Run pytest tests (configured in pytest.ini)
```

## Architecture Overview

### Multi-Tenant System
- **Backend**: Uses `django-tenants` with schema separation per partner
- **Frontend**: Sends `X-Tenant` header for tenant identification
- **Authentication**: JWT tokens with axios interceptors
- **API Base URL**: https://progeek.es (configured in api.ts)

### Frontend Architecture
- **Framework**: Next.js 15 with App Router and Turbopack
- **State Management**: TanStack Query (React Query 5) for server state
- **UI Framework**: MUI 7 with custom theme contexts and DatePicker components
- **Forms**: Custom form components with validation
- **Real-time**: WebSocket chat integration via Django Channels
- **Testing**: Comprehensive API test suite with tiered coverage strategy

### Backend Architecture
- **Multi-tenancy**: Each partner has isolated database schema
- **Apps Structure**:
  - `checkouters/` - Core business logic
  - `chat/` - Real-time chat with WebSocket support
  - `productos/` - Product catalog and pricing
  - `progeek/` - Main application logic
  - `notificaciones/` - Notification system

### Key Components
- **CRM**: Multi-step client forms (empresa/autonomo/particular)
- **Opportunities**: Device valuation with configurable questionnaires
- **Dashboards**: Analytics with KPIs and conversion metrics
- **Chat**: Contextual support widget with unread counters

## Code Style and Conventions

### TypeScript/React
- Strict TypeScript mode enabled
- Functional components with hooks preferred
- Use `useMemo` and `useCallback` for optimization
- Path aliases: `@/*` maps to `src/*`
- Avoid `any` types - prefer derived types from APIs

### ESLint Configuration
- Next.js and TypeScript rules enabled
- TanStack Query rules for proper usage
- Unused variables prefixed with `_` are allowed
- React Hooks rules enforced

### File Organization
- **Components**: Organized by feature in `src/components/`
- **Types**: Shared types in `src/types/`
- **Hooks**: Custom hooks in `src/hooks/`
- **Constants**: App constants in `src/constants/`
- **Services**: API and external service integrations

## Multi-Tenant Considerations

### Frontend
- Always include tenant context in API calls
- Handle tenant switching in localStorage
- Components should be tenant-aware for B2B vs B2C flows
- Use `useUsuarioActual()` hook for current user/tenant info

### Backend
- Each tenant has isolated database schema
- Use `tenant_detail` and `tenant_detail_by_schema` for aggregated data
- Django settings configured for multi-tenant setup
- Channels/Redis required for real-time chat functionality

## API Patterns

### Authentication & User
- `/api/token/` - JWT token obtain (POST)
- `/api/token/refresh/` - JWT token refresh (POST)
- `/api/yo/` - Current user and tenant information (GET)
- `/api/verificar-credenciales/` - Verify user credentials (POST)

### Tenants & Partners
- `/api/tenants/` - List all tenants (GET)
- `/api/tenants/<id>/` - Tenant detail (GET/PUT/PATCH)
- `/api/tenants/by-schema/<schema>/` - Tenant by schema slug (GET)
- `/api/tenants/<id>/agreement/` - Upload tenant agreement (POST)
- `/api/tenants/<id>/agreement/download/` - Download agreement (GET)
- `/api/crear-company/` - Create new company/tenant (POST)

### Client Management (CRM)
- `/api/clientes/` - Client CRUD with pagination & filters (GET/POST)
- `/api/clientes/<id>/` - Client detail (GET/PUT/PATCH/DELETE)
- `/api/comentarios-cliente/` - Client comments (GET/POST)

### Opportunities & Devices
- `/api/oportunidades/` - Opportunity CRUD (GET/POST)
- `/api/oportunidades/<id>/` - Opportunity detail (GET/PUT/PATCH/DELETE)
- `/api/oportunidades/<id>/historial/` - Opportunity history (GET)
- `/api/oportunidades/<id>/generar-pdf/` - Generate PDF offer (GET)
- `/api/oportunidades/<id>/enviar-correo-oferta/` - Send offer email (POST)
- `/api/oportunidades/<id>/dispositivos-reales/` - Real devices for opportunity (GET/POST)
- `/api/dispositivos/` - Device catalog CRUD (GET/POST/PUT/DELETE)
- `/api/modelos/` - Device models (GET/POST)
- `/api/capacidades/` - Device capacities (GET/POST)
- `/api/capacidades-por-modelo/` - Capacities by model (GET)

### Global Opportunities (Cross-tenant)
- `/api/oportunidades-globales/` - Global opportunities list (GET)
- `/api/oportunidades-globales/<tenant>/<id>/` - Global opportunity detail (GET)
- `/api/oportunidades-globales/<tenant>/<id>/detalle-completo/` - Full detail (GET)
- `/api/oportunidades-globales/<tenant>/<id>/cambiar-estado/` - Change status (POST)
- `/api/oportunidades-globales/<tenant>/<id>/historial/` - Global history (GET)
- `/api/oportunidades-globales/<tenant>/<id>/generar-pdf/` - Generate PDF (GET)
- `/api/oportunidades-globales/filtrar/` - Filter by status (GET)

### Comments & Communication
- `/api/comentarios-oportunidad/` - Opportunity comments (GET/POST)
- `/api/chat/soporte/` - Get or create support chat (GET/POST)
- `/api/chat/<id>/mensajes/` - Chat message history (GET)
- `/api/chat/<id>/cerrar/` - Close chat (POST)
- `/api/chats/abiertos/` - List open chats (GET)
- `/ws/chat/<chat_id>/` - WebSocket chat connection

### Documents & Files
- `/api/facturas/subir/` - Upload invoice (POST)
- `/api/facturas/<tenant>/subir/` - Upload global invoice (POST)
- `/api/documentos/<id>/descargar/` - Download document (GET)
- `/api/documentos/<tenant>/<id>/descargar/` - Download global document (GET)

### Dashboard & Analytics
- `/api/mi-dashboard/` - Personal dashboard data (GET)
- `/api/dashboard/valor-por-tienda/` - Value by store (GET)
- `/api/dashboard/valor-por-tienda-manager/` - Manager value by store (GET)
- `/api/dashboard/valor-por-usuario/` - Value by user (GET)
- `/api/dashboard/ranking-productos/` - Product ranking (GET)
- `/api/dashboard/tasa-conversion/` - Conversion rate (GET)
- `/api/dashboard/tiempo-entre-estados/` - Time between states (GET)
- `/api/dashboard/estado-pipeline/` - Pipeline state (GET)
- `/api/dashboard/rechazos-producto/` - Product rejections (GET)
- `/api/dashboard/manager/` - Manager dashboard (GET)
- `/api/dashboard/admin/` - Admin dashboard (GET)
- `/api/dashboard/total-pagado/` - Total paid amounts (GET)
- `/api/resumen-global/` - Global opportunities summary (GET)
- `/api/pipeline-oportunidades/` - Opportunities pipeline (GET)

### User Management
- `/api/usuarios-tenant/` - Tenant users CRUD (GET/POST/PUT/DELETE)
- `/api/usuarios/` - User list (GET)
- `/api/cambiar-contraseña/` - Change password (POST)
- `/api/cambiar-password/` - Alternative change password (POST)

### Stores & Objectives
- `/api/tiendas/` - Store management (GET/POST/PUT/DELETE)
- `/api/objetivos/` - Objectives CRUD (GET/POST/PUT/DELETE)

### B2C Contracts & Legal
- `/api/b2c/contratos/` - B2C contracts CRUD (GET/POST/PUT/DELETE)
- `/api/b2c/contratos/kyc/<token>/flags/` - KYC flags by token (GET)
- `/api/b2c/contratos/kyc/<token>/finalizar/` - Finalize KYC (POST)
- `/api/b2c/contratos/kyc/<id>/renovar/` - Renew KYC (POST)
- `/api/b2c/contratos/kyc/<id>/reenviar-kyc/` - Resend KYC (POST)
- `/api/b2c/contratos/pdf/<token>/` - Contract PDF by token (GET)
- `/api/ajustes/legales/plantilla/` - Legal template management (GET/POST)
- `/api/ajustes/legales/plantilla/publicar` - Publish template (POST)
- `/api/ajustes/legales/variables/` - Legal variables (GET)
- `/api/ajustes/legales/render-preview/` - Render preview (POST)

### Product Management & Pricing
- `/api/tipos-modelo/` - Model types (GET)
- `/api/marcas-modelo/` - Model brands (GET)
- `/api/admin/capacidades/` - Admin capacity management (GET)
- `/api/admin/precios/set/` - Set prices (POST)
- `/api/valoraciones/iphone/comercial/` - iPhone commercial valuation (POST)
- `/api/valoraciones/iphone/auditoria/` - iPhone audit valuation (POST)

### Price Updates & External APIs
- `/api/precios/likewize/actualizar/` - Update Likewize prices (POST)
- `/api/precios/likewize/presets/` - Likewize presets (GET)
- `/api/precios/likewize/ultima/` - Last Likewize task (GET)
- `/api/precios/likewize/tareas/<id>/` - Task status (GET)
- `/api/precios/likewize/tareas/<id>/diff/` - Price diff (GET)
- `/api/precios/likewize/tareas/<id>/aplicar/` - Apply changes (POST)
- `/api/precios/b2c/actualizar/` - Update B2C prices (POST)
- `/api/precios/backmarket/actualizar/` - Update BackMarket prices (POST)

### Search & Filters
- `/api/busqueda-global/` - Global search across tenants (GET)

### Device Management (Advanced)
- `/api/dispositivos-reales/crear/` - Create real device (POST)
- `/api/dispositivos-reales-globales/<tenant>/<opp_id>/` - Global real devices (GET)
- `/api/dispositivos-reales-globales/<tenant>/crear/` - Create global device (POST)
- `/api/dispositivos-reales-globales/<tenant>/borrar/` - Delete global device (DELETE)
- `/api/dispositivos-globales/<tenant>/` - Global device operations (POST)
- `/api/lotes-globales/<tenant>/<id>/dispositivos/` - Batch device operations (GET)

### Authentication Flow
- JWT tokens stored in localStorage
- Automatic token refresh via axios interceptors
- Tenant selection stored in localStorage as `schema` or `currentTenant`

## Testing

### Comprehensive Testing Architecture

#### Frontend Testing Framework
- **Testing Stack**: Jest + React Testing Library + axios-mock-adapter
- **Configuration**: Next.js 15 optimized Jest setup with TypeScript support
- **Test Organization**: Multi-layer architecture for complete coverage
- **Total Coverage**: 170+ tests across API integration and frontend logic
- **Mock Strategy**: Intelligent mocking for APIs, navigation, UI components

#### Test Layer Architecture

##### API Integration Tests (99 tests)
- **Tier 1 - Critical (30 tests)**: Core functionality (authentication, tenants, basic CRM, dashboards)
- **Tier 2 - Business (42 tests)**: Business features (global ops, devices, B2C contracts, chat)
- **Health Check (27 tests)**: Complete endpoint verification across all 200+ backend endpoints

##### Frontend Unit Tests (70+ tests)
- **Business Logic Testing (25+ tests)**:
  - `gradingCalcs.test.ts`: Device grading system (A+/A/B/C/D grades)
  - Valuation calculations with deductions and floor prices
  - Commercial vs audit grading gates and thresholds

- **Spanish Market Validators (35+ tests)**:
  - `validators.test.ts`: DNI/NIE/CIF validation with check digits
  - IMEI validation using Luhn algorithm
  - Spanish postal codes and phone number validation
  - Email validation with comprehensive edge cases

- **Custom Hooks Testing (10+ tests)**:
  - `useUsuarioActual.test.ts`: User/tenant context management
  - `useOportunidadFilters.test.ts`: Opportunity filtering logic
  - Mock providers for TanStack Query integration

- **Utility Functions (10+ tests)**:
  - `formato.test.ts`: Euro formatting with Spanish locale
  - `id.test.ts`: ID priority handling (hashid > uuid > id)
  - `navigation.test.ts`: Navigation utilities for JSDOM compatibility

- **UI Components (5+ tests)**:
  - `KpiCard.test.tsx`: Dashboard component testing
  - Component rendering with MUI theme providers
  - Value formatting and display logic

#### Testing Workflow & CI/CD Integration
1. **Pre-commit**: `pnpm test:critical` - Essential API verification (2 min)
2. **Pre-push**: `pnpm test:frontend` - Frontend logic validation (1 min)
3. **CI/CD**: `pnpm test:full` - Complete regression testing (5 min)
4. **Development**: `pnpm test:watch` - Continuous feedback loop
5. **Debugging**: Individual test files for focused investigation

#### Mock Infrastructure & Helpers
- **API Mocking**: axios-mock-adapter for stable API simulation
- **Component Mocking**: MUI components, date pickers, charts (recharts)
- **Navigation Mocking**: JSDOM-compatible navigation utilities
- **Test Utilities**: Custom render helpers with all providers
- **Realistic Data**: Mock data matching production API models
- **Error Scenarios**: Comprehensive error state testing

### Backend
- pytest configured with Django test settings
- Test files: `tests.py`, `test_*.py`, `*_tests.py`
- Factory Boy for test data generation

## Frontend Architecture Deep Dive

### Component Structure
```
src/components/
├── layout/                 # Layout components (headers, sidebars)
├── formularios/           # Form components
│   ├── Clientes/         # Multi-step client forms (empresa/autonomo/particular)
│   └── dispositivos/     # Device valuation forms (quick/complete questionnaire)
├── dashboards/           # Dashboard components
│   ├── manager/         # Manager-level dashboards
│   └── componentesManager/ # Reusable dashboard components
├── oportunidades/        # Opportunity management components (refactored)
├── chat/                # Real-time chat components
├── pdf/                 # PDF generation components
├── contratos/           # Contract management
├── clientes/            # Client-specific components
├── inputs/              # Custom input components
├── ui/                  # Reusable UI components
├── grading/             # Device grading logic
└── etiquetas/           # Label/tag components
```

### Key Components
- **TablaReactiva2.tsx** - TanStack Table integration with sorting, filtering, pagination
- **FormularioValoracionOportunidad.tsx** - Complex device valuation wizard
- **BuscadorUniversal.tsx** - Global search component
- **cambiosestadochipselector.tsx** - Status change with chip selection
- **DatosRecogida.tsx** - Collection data management

### Custom Hooks
- **useOportunidadData.tsx** - Complete opportunity data management with mutations
- **useUsuarioActual.ts** - Current user and tenant context
- **useBreadcrumbs.ts** - Dynamic breadcrumb navigation
- **useDashboardManager.ts** - Manager dashboard state
- **useOportunidadFilters.ts** - Opportunity filtering logic
- **useClienteSearch.ts** - Client search and creation

### Type System
- **types/grading.ts** - Device grading enums and interfaces (A+/A/B/C/D grades)
- **types/oportunidades.ts** - Opportunity and client interfaces
- **types/tanstack-table.d.ts** - TanStack Table type extensions

### Utilities & Libraries
- **utils/id.ts** - Entity ID handling (uuid/hashid/id priority)
- **utils/gradingCalcs.ts** - Device valuation calculations
- **utils/formato.ts** - Text formatting utilities
- **utils/alertStyles.ts** - Consistent alert styling
- **lib/validators.ts** - Spanish validation (DNI/NIE/CIF/IMEI/postal codes)
- **lib/reactQuery.ts** - TanStack Query configuration
- **lib/toastApiError.ts** - API error handling and toast notifications

### Context System
- **ThemeContext.tsx** - MUI theme with tenant-specific colors and ColoredPaper component
- **UsuarioContext.tsx** - User authentication and tenant state
- **ReactQueryProvider.tsx** - TanStack Query setup
- **estados.ts** - Opportunity status definitions with colors and icons
- **precios.ts** - Price formatting and display utilities

### Form Architecture
Multi-step forms with validation:
- **Client Forms**: TipoClienteStep → ComercialStep → DireccionStep → FinancieroStep → SectorStep
- **Device Forms**: PasoEstadoDispositivo → PasoEstetica → PasoValoracion
- Dynamic form steps based on client type (B2B/B2C) and tenant configuration

### Testing File Structure
Frontend testing files organized by functionality:
```
src/
├── test-utils.tsx                    # React Testing Library providers and utilities
├── setupTests.ts                     # Jest global setup with mocks
├── test-examples.test.ts             # Practical testing examples and patterns
├── utils/
│   ├── formato.test.ts               # Euro formatting with Spanish locale
│   ├── id.test.ts                    # ID priority handling (hashid > uuid > id)
│   ├── gradingCalcs.test.ts          # Device grading business logic (25+ tests)
│   └── navigation.test.ts            # Navigation utilities (JSDOM compatible)
├── lib/
│   └── validators.test.ts            # Spanish market validators (35+ tests)
├── hooks/
│   ├── useUsuarioActual.test.ts      # User/tenant context management
│   └── useOportunidadFilters.test.ts # Opportunity filtering logic
└── components/dashboards/manager/
    └── KpiCard.test.tsx              # Dashboard component testing
```

### State Management Patterns
- **TanStack Query** for server state with optimistic updates
- **React Hook Form** for form state management
- **Local Storage** for tenant selection and authentication tokens
- **Context API** for global app state (user, theme, tenant)

### Validation System
Custom validators for Spanish market:
- DNI/NIE validation with check digit calculation
- CIF validation for companies
- IMEI validation for devices
- Spanish postal code validation
- Email validation

### Grading System
Device condition assessment with:
- **Grades**: A+ (excellent) → A → B → C → D (defective)
- **Display Status**: OK, PIX (pixels), LINES, BURN, MURA
- **Glass Status**: NONE → MICRO → VISIBLE → DEEP → CHIP → CRACK
- **Housing Status**: SIN_SIGNOS → MINIMOS → ALGUNOS → DESGASTE_VISIBLE → DOBLADO

### Special Configurations

### Next.js
- Turbopack enabled for fast development builds
- CKEditor 5 transpilation configured
- API rewrites to backend domain
- React Strict Mode enabled

### Django
- CORS headers configured for frontend integration
- Custom settings for pricing models and capacity handling
- Static files and media configuration for production
- Channel layers for WebSocket support

## Recent Updates & Improvements

### Dashboard Optimizations (2024)
- **MUI DatePicker Integration**: Replaced basic TextField date inputs with proper MUI DatePicker components using `@mui/x-date-pickers` and dayjs adapter
- **UI Consistency**: Removed redundant granularity selectors from dashboard filters, centralizing granularity control in chart components
- **Component Standardization**: Applied consistent date picker patterns across DashboardAdmin and DashboardInterno components
- **LocalizationProvider**: Proper date localization setup for Spanish market requirements

### Complete Frontend Testing Suite (2024)
- **Comprehensive Test Infrastructure**: Jest + React Testing Library + axios-mock-adapter optimized for Next.js 15 and TypeScript
- **Multi-Layer Testing Strategy**:
  - **API Layer**: 99 tests organized by business criticality covering 200+ backend endpoints
  - **Logic Layer**: 70+ tests for business logic, validators, hooks, and utilities
  - **UI Layer**: Component testing with MUI integration and provider mocking
  - **Integration Layer**: End-to-end testing workflows for critical user journeys
- **Advanced Mock Architecture**:
  - axios-mock-adapter for stable API simulation
  - Intelligent component mocking (MUI, charts, date pickers)
  - Navigation and browser API mocking for JSDOM compatibility
  - Realistic test data matching production models with Spanish market specifics
- **Spanish Market Validation Testing**:
  - Complete DNI/NIE/CIF validation with mathematical check digits
  - IMEI validation using Luhn algorithm implementation
  - Spanish postal codes, phone numbers, and locale-specific formatting
- **Business Logic Coverage**:
  - Device grading system (A+ to D grades) with comprehensive edge cases
  - Price calculation algorithms with deductions and floor pricing
  - Commercial vs audit valuation workflows
- **CI/CD Integration & Performance**:
  - Tiered testing for optimized CI/CD pipelines (critical → frontend → full)
  - Pre-commit hooks for rapid feedback (under 3 minutes total)
  - Performance monitoring and test execution optimization
  - Coverage reporting with quality gates
- **Developer Experience Excellence**:
  - Watch mode for continuous development feedback
  - Focused test execution for debugging specific layers
  - Test utilities and helpers for DRY test development
  - Comprehensive mock infrastructure for isolated testing

### Authentication & Security Enhancements
- **Hardcoded Schema Resolution**: Identified and documented authentication flow issue where "progeek" company logins are forced to "public" schema instead of proper tenant resolution (src/services/api.ts:69)
- **Error Handling**: Improved error boundary patterns and user feedback mechanisms
- **Token Refresh**: Robust JWT token refresh mechanism with automatic retry logic

### Performance & Developer Productivity
- **Build Optimization**: Turbopack integration for faster development builds
- **Type Safety**: Strict TypeScript configuration with comprehensive type coverage
- **Code Quality**: Enhanced ESLint rules with TanStack Query specific linting
- **Documentation**: Updated developer documentation with latest architectural decisions and testing practices