# Developer Experience Tools - Checkouters Frontend

## Comandos Optimizados de Desarrollo

### Desarrollo Principal
```bash
# Desarrollo con Turbopack (recomendado)
pnpm dev

# Desarrollo sin Turbopack (legacy)
pnpm dev:legacy

# Verificación completa antes de commit
pnpm dx:check

# Corrección automática de issues
pnpm dx:fix
```

### Testing Optimizado
```bash
# Tests por tiers (CI/CD optimizado)
pnpm test:critical    # Tier 1 - Solo APIs críticas (2min)
pnpm test:frontend    # Solo lógica frontend (1min)
pnpm test:full        # Suite completa (5min)

# Desarrollo de tests
pnpm test:watch       # Watch mode interactivo
pnpm test:coverage    # Con reporte de coverage
```

### Build y Análisis
```bash
# Build optimizado
pnpm build

# Análisis de bundle
pnpm build:analyze

# Limpieza completa
pnpm clean:all
```

## Configuraciones VS Code

### Extensiones Requeridas
- ESLint + Prettier (formateo automático)
- TypeScript Hero (imports automáticos)
- Jest (testing integrado)
- TailwindCSS IntelliSense
- GitLens

### Shortcuts Útiles
- `Ctrl/Cmd + Shift + P` → "TypeScript: Restart TS Server"
- `Ctrl/Cmd + Shift + P` → "ESLint: Fix all auto-fixable Problems"
- `F5` → Debug Next.js server + client

## Estructura de Imports Optimizada

```typescript
// ✅ CORRECTO - Usa path aliases nuevos
import { formatEuro } from '@/shared/utils/formato'
import { UserContext } from '@/shared/contexts/UsuarioContext'
import { OportunidadForm } from '@/features/oportunidades/components'

// ❌ INCORRECTO - Imports relativos largos
import { formatEuro } from '../../../shared/utils/formato'
```

## Debugging Multi-tenant

### Variables de Entorno
```bash
# .env.local
NEXT_PUBLIC_DEFAULT_TENANT=progeek
NEXT_PUBLIC_DEBUG_MODE=true
```

### Debug Headers en DevTools
```typescript
// Verificar headers X-Tenant en Network tab
// Headers automáticos añadidos por axios interceptors
```

## Performance Tips

### Build Times
- Turbopack habilitado por defecto (`pnpm dev`)
- Bundle análisis con `ANALYZE=true pnpm build`
- Tree-shaking optimizado para MUI/lodash

### Hot Reload
- Configuración optimizada para componentes MUI
- Preservación de estado en desarrollo
- Error overlay mejorado

## Troubleshooting Común

### TypeScript Errors
```bash
# Reiniciar TypeScript server
pnpm typecheck

# Limpiar cache
pnpm clean && pnpm install
```

### ESLint Issues
```bash
# Fix automático
pnpm lint:fix

# Verificar configuración
pnpm lint --debug
```

### Tests Failing
```bash
# Solo critical tests (CI)
pnpm test:critical

# Ver coverage específico
pnpm test:coverage
```

## Comandos de Productividad

### Pre-commit Hook Simulation
```bash
pnpm dx:check  # typecheck + lint + unit tests
```

### Rapid Feedback Loop
```bash
pnpm dev        # Terminal 1: Next.js con Turbopack
pnpm test:watch # Terminal 2: Jest en watch mode
pnpm typecheck:watch # Terminal 3: TypeScript checker
```

### Bundle Analysis Workflow
```bash
pnpm build:analyze
# Abre automáticamente el analyzer en browser
# Identifica imports pesados y oportunidades de code splitting
```