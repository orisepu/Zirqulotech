# Testing Guide - Checkouters Partners Frontend

Esta guía documenta la estrategia de testing completa implementada en el frontend, incluyendo tests de API, lógica de negocio, y componentes UI.

## 📊 Resumen de Cobertura

- **Total Tests**: 170+ tests
- **API Integration**: 99 tests (200+ endpoints)
- **Frontend Logic**: 70+ tests
- **Execution Time**: < 5 minutos para suite completa
- **Pre-commit Time**: < 3 minutos (critical + frontend)

## 🏗️ Arquitectura de Testing

### Layer 1: API Integration Tests (99 tests)
Ubicación: `src/__tests__/api/`

#### Tier 1 - Critical (30 tests)
- Autenticación y JWT tokens
- Gestión de tenants
- CRM básico (clientes, comentarios)
- Dashboards principales

#### Tier 2 - Business (42 tests)
- Operaciones globales cross-tenant
- Gestión de dispositivos y modelos
- Contratos B2C y KYC
- Sistema de chat en tiempo real

#### Health Check (27 tests)
- Verificación de todos los endpoints
- Monitoreo de performance de API
- Detección de regresiones

### Layer 2: Frontend Unit Tests (70+ tests)

#### Business Logic Testing (25+ tests)
**Archivo**: `src/utils/gradingCalcs.test.ts`
```typescript
// Tests de sistema de grading de dispositivos
describe('gradingCalcs', () => {
  // Gates comerciales para validación de dispositivos
  describe('pasaGatesComercial', () => { /* 8 tests */ })

  // Cálculo de grados estéticos A+, A, B, C, D
  describe('gradoEsteticoDesdeTabla', () => { /* 5 tests */ })

  // Cálculos de ofertas con deducciones
  describe('calcularOferta', () => { /* 12 tests */ })
})
```

Cobertura:
- ✅ Validación de dispositivos defectuosos
- ✅ Cálculo de grados estéticos basado en daños
- ✅ Aplicación de deducciones (batería, pantalla, carcasa)
- ✅ Precios suelo dinámicos por rangos
- ✅ Edge cases y escenarios límite

#### Spanish Market Validators (35+ tests)
**Archivo**: `src/lib/validators.test.ts`
```typescript
// Validadores específicos del mercado español
describe('validators', () => {
  describe('isDNI', () => { /* DNI con dígito de control */ })
  describe('isNIE', () => { /* NIE para extranjeros */ })
  describe('isCIF', () => { /* CIF para empresas */ })
  describe('isIMEI', () => { /* IMEI con algoritmo Luhn */ })
  describe('isTelefonoES', () => { /* Teléfonos españoles */ })
  describe('isCPEsp', () => { /* Códigos postales */ })
})
```

Cobertura:
- ✅ DNI con cálculo matemático de letra de control
- ✅ NIE (X/Y/Z) con transformación numérica
- ✅ CIF con tipos específicos y controles
- ✅ IMEI con validación Luhn completa
- ✅ Validación de teléfonos móviles/fijos españoles
- ✅ Códigos postales por provincias (01-52)

#### Custom Hooks Testing (10+ tests)
**Archivos**:
- `src/hooks/useUsuarioActual.test.ts`
- `src/hooks/useOportunidadFilters.test.ts`

```typescript
// Testing de hooks con TanStack Query
describe('useUsuarioActual', () => {
  // Tests con providers mock y datos realistas
  it('should return user data when API succeeds', async () => {
    // Mock axios response
    // Render hook with QueryClient provider
    // Assert user data structure
  })
})
```

#### Utility Functions (10+ tests)
**Archivos**:
- `src/utils/formato.test.ts` - Formateo de euros
- `src/utils/id.test.ts` - Gestión de IDs
- `src/utils/navigation.test.ts` - Navegación

#### UI Components (5+ tests)
**Archivo**: `src/components/dashboards/manager/KpiCard.test.tsx`
```typescript
// Testing de componentes con MUI
describe('KpiCard', () => {
  it('should render with basic title and value', () => {
    render(<KpiCard title="Test" value={100} />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

## 🛠️ Infraestructura de Testing

### Jest Configuration
**Archivo**: `jest.config.js`
```javascript
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 10000,
}
```

### Setup Global de Tests
**Archivo**: `src/setupTests.ts`
```typescript
import '@testing-library/jest-dom'

// Mock navigation para JSDOM
jest.mock('@/utils/navigation', () => ({
  navigateToLogin: jest.fn(),
}))

// Mock components para testing más ligero
jest.mock('recharts', () => ({ /* mocks */ }))
jest.mock('@mui/x-date-pickers/DatePicker', () => ({ /* mocks */ }))

// Global utilities
global.ResizeObserver = jest.fn().mockImplementation(/* ... */)
```

### Test Utilities
**Archivo**: `src/test-utils.tsx`
```typescript
// Render personalizado con todos los providers
const AllTheProviders = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  </QueryClientProvider>
)

export const render = (ui, options) =>
  render(ui, { wrapper: AllTheProviders, ...options })
```

## 📝 Comandos de Testing

### Comandos Básicos
```bash
# Ejecutar todos los tests
pnpm test

# Modo watch para desarrollo
pnpm test:watch

# Reporte de cobertura
pnpm test:coverage
```

### Comandos por Layer
```bash
# Tests de API (Backend Integration)
pnpm test:critical    # Tier 1 - Pre-commit (2 min)
pnpm test:business    # Tier 2 - CI/CD
pnpm test:health      # Health checks
pnpm test:all         # Todos los API tests

# Tests Frontend (Logic + UI)
pnpm test:unit        # Tests unitarios
pnpm test:frontend    # Alias para unit

# Suite Completa
pnpm test:full        # API + Frontend (5 min)
```

### Comandos Específicos
```bash
# Test individual por archivo
pnpm test src/utils/gradingCalcs.test.ts

# Tests por patrón
pnpm test --testNamePattern="grading"

# Tests con cobertura específica
pnpm test --collectCoverageFrom="src/utils/**"
```

## 🔄 Workflow de Testing

### Desarrollo Local
1. **Setup inicial**: `pnpm test:watch`
2. **Desarrollo TDD**: Escribir test → Implementar → Refactor
3. **Pre-commit**: `pnpm test:critical && pnpm test:frontend`

### CI/CD Pipeline
1. **Pull Request**: `pnpm test:critical` (fast feedback)
2. **Pre-merge**: `pnpm test:full` (complete verification)
3. **Post-merge**: `pnpm test:all` (regression detection)

### Debugging Tests
```bash
# Test específico con logs
pnpm test src/path/to/test.ts --verbose

# Test con debugger
pnpm test --runInBand --detectOpenHandles

# Test con timeout extendido
pnpm test --testTimeout=30000
```

## 📋 Best Practices

### Escribiendo Tests
1. **Arrange-Act-Assert**: Estructura clara en todos los tests
2. **Descriptive Names**: Nombres que explican el comportamiento esperado
3. **One Assertion**: Un concepto por test cuando sea posible
4. **Mock External Dependencies**: Aislar la unidad bajo test

### Datos de Test
```typescript
// ✅ Buenos datos de test
const validDNI = '12345678Z' // Calculado correctamente
const mockUserResponse = {
  id: 1,
  name: 'Test User',
  tenant: { schema: 'test-tenant' }
}

// ❌ Datos de test problemáticos
const fakeDNI = '00000000A' // No pasa validación real
const emptyResponse = {} // No refleja estructura de API
```

### Mocking Strategy
```typescript
// ✅ Mock específico y útil
jest.mock('@/services/api', () => ({
  get: jest.fn(),
  post: jest.fn().mockResolvedValue({ data: mockResponse })
}))

// ❌ Mock demasiado genérico
jest.mock('@/services/api')
```

### Error Testing
```typescript
// ✅ Test de errores específicos
it('should handle network errors gracefully', async () => {
  mockAxios.onGet('/api/yo/').networkError()

  const { result } = renderHook(() => useUsuarioActual(), { wrapper })

  await waitFor(() => {
    expect(result.current).toBeNull()
  })
})
```

## 🎯 Objetivos de Calidad

### Métricas de Cobertura
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

### Tiempo de Ejecución
- **Pre-commit**: < 3 minutos
- **Suite completa**: < 5 minutos
- **Tests individuales**: < 30 segundos

### Calidad de Tests
- **Flaky Tests**: 0% tolerancia
- **Test Independence**: Tests no dependen de orden
- **Clear Failures**: Mensajes de error informativos
- **Maintainability**: Tests fáciles de actualizar

## 🔧 Troubleshooting

### Problemas Comunes

#### Tests Lentos
```bash
# Identificar tests lentos
pnpm test --verbose --detectSlowTests

# Ejecutar en paralelo
pnpm test --maxWorkers=4
```

#### Problemas de JSDOM
```typescript
// Error: Not implemented: navigation
// Solución: Mock en setupTests.ts
jest.mock('@/utils/navigation', () => ({
  navigateToLogin: jest.fn(),
}))
```

#### Problemas de Memoria
```bash
# Incrementar memoria para Jest
node --max-old-space-size=4096 node_modules/.bin/jest
```

## 📚 Recursos Adicionales

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TanStack Query Testing](https://tanstack.com/query/latest/docs/react/guides/testing)

---

Esta documentación se mantiene actualizada con cada nueva implementación de tests. Para sugerencias o mejoras, consultar con el equipo de desarrollo.