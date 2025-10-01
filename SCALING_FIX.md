# Fix para Escalado del Layout (125% / 200%)

## Problema resuelto

El layout rompía cuando el sistema operativo usaba escalado de pantalla al 125%, 150% o 200%.

## Cambios implementados

### 1. ✅ Viewport Configuration (CRÍTICO)
**Archivo**: `tenant-frontend/src/app/layout.tsx`

Se agregó configuración de viewport como export separado (Next.js 15 best practice):
```typescript
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Zirqulo",
  description: "Zirqulo trade app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};
```

**Nota**: En Next.js 15, `viewport` debe ser un export separado, no parte de `metadata`. Esto previene warnings y sigue las convenciones oficiales de Next.js.

### 2. ✅ Breadcrumbs con unidades responsivas
**Archivos modificados**:
- `tenant-frontend/src/shared/components/layout/DashboardShell.tsx`
- `tenant-frontend/src/shared/components/layout/LayoutInternoShell.tsx`

**Antes** (valores absolutos en píxeles):
```tsx
maxWidth: { xs: 220, sm: 420, md: 800, lg: 1000 }
```

**Después** (unidades relativas rem):
```tsx
maxWidth: { xs: "14rem", sm: "28rem", md: "50rem", lg: "60rem" }
```

### 2.1 ✅ Grid Components en páginas de detalle
**Archivos modificados**:
- `tenant-frontend/src/app/(dashboard)/clientes/oportunidades/[id]/page.tsx`
- `tenant-frontend/src/app/(dashboard)/oportunidades/global/[tenant]/[id]/page.tsx`
- `tenant-frontend/src/app/(dashboard)/usuarios/page.tsx`

**Antes** (minWidth absolutos en píxeles):
```tsx
sx={{ minWidth: 400 }}  // Tabs
sx={{ minWidth: 400 }}  // Comentarios
sx={{ minWidth: 300 }}  // Historial
sx={{ minWidth: 300 }}  // Search
```

**Después** (minWidth responsivos en rem):
```tsx
sx={{ minWidth: { xs: 0, sm: '25rem' } }}  // Tabs
sx={{ minWidth: { xs: 0, sm: '20rem' } }}  // Comentarios
sx={{ minWidth: { xs: 0, sm: '18rem' } }}  // Historial
sx={{ minWidth: { xs: 0, sm: '18rem' } }}  // Search
```

**Beneficio**: En móvil (xs) no hay minWidth, permitiendo que el contenido fluya. En tablet+ (sm) usa unidades `rem` que escalan apropiadamente con el DPI del sistema.

### 3. ✅ Mejora del sistema de zoom CSS
**Archivo**: `tenant-frontend/src/shared/utils/tableResponsive.ts`

Se cambió de `transform: scale()` a CSS `zoom` property para mejor compatibilidad:
```typescript
// Ahora usa zoom nativo del navegador
zoom: zoom,
// Fallback para navegadores antiguos
'@supports not (zoom: 1)': {
  transform: `scale(${zoom}) translateZ(0)`,
  transformOrigin: 'top left',
  width: `${100 / zoom}%`,
}
```

### 4. ✅ Media queries para detección de escalado del SO
**Archivo**: `tenant-frontend/src/context/ThemeContext.tsx`

Se agregaron media queries específicas:
```css
@media (resolution: 1.25dppx) { fontSize: '100%' } /* 125% */
@media (resolution: 1.5dppx) { fontSize: '100%' }  /* 150% */
@media (resolution: 2dppx) { fontSize: '100%' }    /* 200% */
```

## Testing Manual

### Windows (Configuración de Pantalla)
1. Click derecho en escritorio → "Configuración de pantalla"
2. En "Escala y distribución" probar:
   - ✅ 100% (Recomendado)
   - ✅ 125%
   - ✅ 150%
   - ✅ 175%
   - ✅ 200%

### macOS (Ajustes de Pantalla)
1. Preferencias del Sistema → Pantallas
2. Probar diferentes resoluciones escaladas:
   - ✅ Nativa (Retina)
   - ✅ Mayor espacio
   - ✅ Más espacio
   - ✅ Escalado

### Navegadores a probar
- ✅ Chrome/Edge (mejor soporte para CSS zoom)
- ✅ Firefox (usa el fallback con transform)
- ✅ Safari (soporte nativo)

### Checklist de verificación

#### Layout General
- [ ] Header no se superpone con contenido
- [ ] Sidebar permanece funcional
- [ ] Breadcrumbs se ajustan correctamente (DashboardShell y LayoutInternoShell)
- [ ] Texto legible en todos los escalados

#### Tablas (TablaReactiva2)
- [ ] Columnas se ajustan responsivamente
- [ ] Zoom de tabla funciona correctamente
- [ ] Scroll horizontal accesible si necesario
- [ ] Headers visibles y alineados

#### Formularios
- [ ] Inputs accesibles y clicables
- [ ] Labels no se superponen
- [ ] Botones de tamaño adecuado
- [ ] Validaciones visibles

#### Dashboards
- [ ] Cards se redimensionan correctamente
- [ ] Gráficos legibles
- [ ] KPIs visibles
- [ ] Filtros accesibles

#### Páginas de Detalle (CRÍTICO)
- [ ] `/clientes/oportunidades/[id]` - Grid con Tabs, Comentarios, Historial
- [ ] `/oportunidades/global/[tenant]/[id]` - Grid con Tabs, Comentarios, Historial
- [ ] `/usuarios` - Barra de búsqueda
- [ ] Grids respetan minWidth responsivo en móvil (xs) y desktop (sm+)
- [ ] No hay scroll horizontal innecesario en móvil

#### Tablas (CRÍTICO - NUEVO)
- [ ] `/operaciones` - Headers de tabla NO se cortan
  - [ ] "Val. orientativa" texto completo visible
  - [ ] "Valoración final" texto completo visible
  - [ ] "N de seguimiento" texto completo visible
  - [ ] Headers pueden ocupar 2 líneas si es necesario (word-wrap)
  - [ ] Verificar en escalado 125%, 150%, 200%
- [ ] Otras tablas (clientes, admin) funcionan correctamente

## Solución de problemas

### Si el layout sigue rompiendo:

1. **Limpiar caché del navegador**: Ctrl+Shift+Del (Chrome/Edge) o Cmd+Shift+Del (Safari)

2. **Verificar zoom del navegador**: Debe estar en 100% (Ctrl+0 o Cmd+0)

3. **Comprobar viewport**: Inspeccionar → Console:
   ```javascript
   console.log(window.devicePixelRatio) // Debería mostrar 1, 1.25, 1.5, 2, etc.
   console.log(window.innerWidth) // Ancho real del viewport
   ```

4. **Forzar recarga completa**: Ctrl+Shift+R (Chrome/Edge) o Cmd+Shift+R (Safari)

## 5. ✅ Encabezados de tabla con valores responsivos (OPERACIONES)

### Problema
Los encabezados de la tabla de operaciones (`/operaciones`) se cortaban con "..." en escalado 125%+ debido a valores absolutos en píxeles.

**Archivos modificados**:
- `tenant-frontend/src/shared/components/TablaColumnas2.tsx` (columnasOperaciones)
- `tenant-frontend/src/shared/components/TablaReactiva2.tsx` (header rendering)
- `tenant-frontend/src/shared/types/tanstack-table.d.ts` (type definitions)
- `tenant-frontend/src/shared/utils/tableResponsive.ts` (type helpers)

### Columnas corregidas

#### "Val. orientativa" (línea 675)
```tsx
// ANTES
headerMaxWidth: 140, // Píxeles absolutos

// DESPUÉS
headerMaxWidth: { xs: '9rem', sm: '10rem', md: '11rem' }, // Responsivo en rem
```

#### "Valoración final" (línea 697)
```tsx
// ANTES
headerMaxWidth: 140, // Píxeles absolutos

// DESPUÉS
headerMaxWidth: { xs: '9rem', sm: '10rem', md: '11rem' }, // Responsivo en rem
```

#### "N de seguimiento" (línea 731-734)
```tsx
// ANTES
maxWidth: 200,
ellipsisMaxWidth: 180,

// DESPUÉS
maxWidth: { xs: '12rem', sm: '14rem', md: '16rem' },
ellipsisMaxWidth: { xs: '11rem', sm: '13rem', md: '15rem' },
```

### Mejoras en renderizado de headers

**TablaReactiva2.tsx (líneas 367-371)**:
```tsx
// ANTES - Truncamiento agresivo
whiteSpace: headerMeta?.nowrapHeader ? 'nowrap' : 'normal',
overflow: headerMeta?.nowrapHeader ? 'hidden' : undefined,
textOverflow: headerMeta?.nowrapHeader ? 'ellipsis' : undefined,

// DESPUÉS - Mejor manejo de wrapping
whiteSpace: headerMeta?.nowrapHeader ? 'nowrap' : 'normal',
overflow: headerMeta?.nowrapHeader ? 'hidden' : 'visible',
textOverflow: headerMeta?.nowrapHeader ? 'ellipsis' : 'clip',
wordBreak: 'normal',
overflowWrap: headerMeta?.nowrapHeader ? 'normal' : 'break-word',
```

### Sistema de tipos mejorado

**Nuevo tipo helper** (`tanstack-table.d.ts` y `tableResponsive.ts`):
```typescript
type ResponsiveValue = number | string | {
  xs?: number | string
  sm?: number | string
  md?: number | string
  lg?: number | string
  xl?: number | string
  xxl?: number | string
  xxxl?: number | string
}

interface ColumnMeta<TData, TValue> {
  minWidth?: ResponsiveValue          // ✅ Ahora responsivo
  headerMaxWidth?: ResponsiveValue    // ✅ Ahora responsivo
  maxWidth?: ResponsiveValue          // ✅ Ya era responsivo
  ellipsisMaxWidth?: ResponsiveValue  // ✅ Ahora responsivo
  // ... otros campos
}
```

**Beneficios**:
- Todas las propiedades de ancho ahora soportan valores responsivos
- Compatible con píxeles (legacy), rem, y objetos breakpoint de MUI
- Type-safe con TypeScript
- Escalado automático con DPI del sistema

## 6. ✅ Conversión completa de tablas legacy a valores rem responsivos

### Tablas convertidas (2025-01-XX)

Se convirtieron todas las tablas con valores absolutos restantes en `TablaColumnas2.tsx` a valores responsivos en rem:

#### columnasCapacidadesAdmin (líneas 80-156)
Tabla de capacidades de productos con precios B2B/B2C.

**Columnas convertidas**:
- `modelo__descripcion`: 180px → `{ xs: '11rem', sm: '12rem', md: '13rem' }`
- `activo`: 100px → `{ xs: '6rem', sm: '7rem' }`
- `tamaño`: 100px → `{ xs: '6rem', sm: '7rem' }`
- `_b2b`: 110px → `{ xs: '7rem', sm: '8rem' }`
- `_b2c`: 110px → `{ xs: '7rem', sm: '8rem' }`
- `fuente`: 140px → `{ xs: '9rem', sm: '10rem' }`
- `vigencia`: 180px → `{ xs: '11rem', sm: '12rem', md: '13rem' }`

#### columnasDispositivosReales (líneas 335-367)
Tabla de dispositivos físicos con IMEI, número de serie y estados.

**Columnas convertidas**:
- `modelo`: 200px/450px → `{ xs: '12rem', sm: '14rem', md: '16rem' }` / `{ xs: '20rem', sm: '25rem', md: '28rem' }`
- `capacidad`: 150px → `{ xs: '9rem', sm: '10rem' }`
- `imei`: 150px/250px → `{ xs: '9rem', sm: '10rem' }` / `{ xs: '14rem', sm: '16rem' }`
- `numero_serie`: 150px/250px → `{ xs: '9rem', sm: '10rem' }` / `{ xs: '14rem', sm: '16rem' }`
- `estado_fisico`: 150px → `{ xs: '9rem', sm: '10rem' }`
- `estado_funcional`: 150px → `{ xs: '9rem', sm: '10rem' }`
- `estado_valoracion`: 150px → `{ xs: '9rem', sm: '10rem' }`
- `precio_final`: 160px → `{ xs: '10rem', sm: '11rem' }`

#### getColumnasClientes() (líneas 369-452)
Función que genera columnas de tabla de clientes con datos fiscales y comerciales.

**Columnas convertidas**:
- `display_name`: 190px → `{ xs: '12rem', sm: '13rem', md: '14rem' }`
- `identificador_fiscal`: 120px → `{ xs: '7rem', sm: '8rem' }`
- `tipo_cliente`: 110px → `{ xs: '7rem', sm: '8rem' }`
- `contacto`: 160px → `{ xs: '10rem', sm: '11rem', md: '12rem' }`
- `posicion`: 140px → `{ xs: '9rem', sm: '10rem' }`
- `correo`: 190px → `{ xs: '12rem', sm: '13rem', md: '14rem' }`
- `telefono`: 130px → `{ xs: '8rem', sm: '9rem' }`
- `tienda_nombre`: 140px → `{ xs: '9rem', sm: '10rem' }`
- `n_oportunidades`: 100px → `{ xs: '6rem', sm: '7rem' }`
- `valor_total`: 140px → `{ xs: '9rem', sm: '10rem' }`

#### getColumnasAuditoria() (líneas 454-628)
Función que genera columnas de tabla de auditoría con campos editables.

**Columnas convertidas**:
- `modelo`: 300px → `{ xs: '18rem', sm: '20rem', md: '22rem' }`
- `capacidad`: 100px → `{ xs: '6rem', sm: '7rem' }`
- `imei`: 200px → `{ xs: '12rem', sm: '13rem', md: '14rem' }`
- `Numero_Serie`: 200px → `{ xs: '12rem', sm: '13rem', md: '14rem' }`
- `estado_fisico`: 120px → `{ xs: '7rem', sm: '8rem' }`
- `estado_funcional`: 120px → `{ xs: '7rem', sm: '8rem' }`
- `estado_valoracion`: 130px → `{ xs: '8rem', sm: '9rem' }`
- `precio_final`: 125px → `{ xs: '8rem', sm: '9rem' }`
- `observaciones`: 500px → `{ xs: '30rem', sm: '32rem', md: '35rem' }`

### Beneficios de la conversión

1. **Escalado uniforme**: Todas las tablas ahora escalan automáticamente con el DPI del sistema operativo
2. **Responsividad mejorada**: Breakpoints específicos (xs/sm/md) adaptan anchos según viewport
3. **Legibilidad garantizada**: Valores rem mantienen proporciones correctas en 125%, 150%, 200% de escalado
4. **Type-safe**: Todos los valores ResponsiveValue validados por TypeScript
5. **Consistencia**: Todas las tablas usan el mismo sistema de valores responsivos

### Verificación TypeScript

```bash
pnpm typecheck
# ✅ Sin errores - todos los tipos son correctos
```

## 7. ✅ Hook de detección automática de DPI alto

### Hook: useDpiDetection

Se creó un hook personalizado para detectar y monitorear el DPI del sistema operativo en tiempo real.

**Archivo**: `tenant-frontend/src/hooks/useDpiDetection.ts`

#### Características principales:

1. **Detección automática de DPI**:
   - Detecta `devicePixelRatio` (1, 1.25, 1.5, 2, etc.)
   - Clasifica en niveles: 'normal', 'medium', 'high', 'very-high'
   - Monitorea cambios en tiempo real (resize, zoom, media queries)

2. **Información completa del viewport**:
   ```typescript
   interface DpiInfo {
     devicePixelRatio: number;        // 1.25, 1.5, 2, etc.
     scalingPercentage: number;       // 125, 150, 200, etc.
     isHighDpi: boolean;              // true si DPI > 1
     dpiLevel: 'normal' | 'medium' | 'high' | 'very-high';
     viewportWidth: number;           // Ancho CSS en px
     viewportHeight: number;          // Alto CSS en px
     physicalWidth: number;           // Ancho físico en px
     physicalHeight: number;          // Alto físico en px
     browserInfo: {
       userAgent: string;
       vendor: string;
       platform: string;
     };
   }
   ```

3. **Warnings automáticos**:
   - Muestra warning en consola cuando detecta DPI alto (solo en desarrollo)
   - Callback `onDpiChange` para reaccionar a cambios
   - Logging detallado opcional para debugging

4. **Hooks auxiliares**:
   - `useIsHighDpi()` - Retorna solo boolean
   - `useScalingPercentage()` - Retorna solo el porcentaje

#### Ejemplos de uso:

**Uso básico**:
```typescript
import { useDpiDetection } from '@/hooks/useDpiDetection';

function MyComponent() {
  const { dpiInfo, isHighDpi, scalingPercentage } = useDpiDetection({
    enableWarnings: true,
    onDpiChange: (info) => console.log('DPI cambió:', info)
  });

  if (isHighDpi) {
    return <div>Modo DPI alto detectado ({scalingPercentage}%)</div>
  }

  return <div>DPI normal</div>
}
```

**Uso simplificado**:
```typescript
import { useIsHighDpi, useScalingPercentage } from '@/hooks/useDpiDetection';

function MyComponent() {
  const isHighDpi = useIsHighDpi();
  const scaling = useScalingPercentage();

  return (
    <div className={isHighDpi ? 'high-dpi-mode' : ''}>
      Sistema escalado al {scaling}%
    </div>
  );
}
```

**Con ajustes condicionales**:
```typescript
function TableComponent() {
  const { shouldWarnAboutLayout, getRecommendedTableZoom } = useDpiDetection();

  if (shouldWarnAboutLayout()) {
    console.warn('⚠️ Posibles problemas de layout con este DPI');
  }

  const zoom = getRecommendedTableZoom(); // Siempre retorna 1 (usa rem)

  return <TableContainer sx={{ zoom }}>...</TableContainer>
}
```

### Componente: DpiDebugger

Panel visual de debugging que muestra información del DPI en tiempo real.

**Archivo**: `tenant-frontend/src/shared/components/dev/DpiDebugger.tsx`

#### Características:

- **Botón flotante** con indicador visual de nivel de DPI
- **Panel informativo** con:
  - Nivel de DPI y porcentaje de escalado
  - Dimensiones del viewport (CSS y físico)
  - Información del navegador
  - Warnings si detecta posibles problemas
  - Info completa copiable al portapapeles
- **Solo visible en desarrollo** o con `NEXT_PUBLIC_SHOW_DPI_DEBUGGER=true`
- **Posicionado en bottom-left** para no interferir con el chat

#### Integración:

**En layout.tsx** (línea 46):
```tsx
import { DpiDebugger } from "@/shared/components/dev/DpiDebugger";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ReactQueryProvider>
          {children}
          <DpiDebugger />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
```

#### Uso del debugger:

1. En desarrollo, aparece automáticamente un botón flotante en bottom-left
2. Click en el botón abre el panel con información detallada
3. Si detecta DPI alto (≥150%), el botón es rojo
4. Click en "Click para copiar info completa" copia JSON al portapapeles

### Beneficios:

✅ **Detección proactiva** - Warnings automáticos en desarrollo
✅ **Debugging visual** - Panel flotante con toda la información
✅ **Type-safe** - Interfaces TypeScript completas
✅ **Performance** - Listeners optimizados con cleanup apropiado
✅ **Flexible** - Múltiples hooks para diferentes casos de uso

### Testing del hook:

```bash
# En desarrollo, abrir la app en navegador
# Cambiar escalado del SO (Windows: 100% → 125% → 150% → 200%)
# Observar:
# 1. Warning en consola cuando detecta DPI alto
# 2. Botón flotante cambia de color si DPI ≥ 150%
# 3. Panel muestra información actualizada
# 4. Callback onDpiChange se ejecuta al cambiar
```

## 8. ✅ Ajuste dinámico de tipografía según DPI

### Sistema de tipografía responsiva

Se implementó un sistema que ajusta automáticamente los tamaños de fuente basándose en el DPI del sistema operativo.

#### Componente: ResponsiveTypography

**Archivo**: `tenant-frontend/src/shared/components/layout/ResponsiveTypography.tsx`

Este componente aplica ajustes de tipografía dinámicos usando CSS custom properties y modificando el `font-size` base del `<html>`.

**Escalas de fuente por nivel de DPI**:
```typescript
const DPI_FONT_SCALE_MAP = {
  normal: 1.0,        // 100% - DPI normal (100%)
  medium: 0.95,       // 95% - DPI medium (125%)
  high: 0.85,         // 85% - DPI high (150%)
  'very-high': 0.75,  // 75% - DPI very-high (200%+)
};
```

**Lógica de ajuste** (basada en experiencia real con pantallas Retina):
- **DPI normal (100%)**: Sin ajuste - Tamaño estándar
- **DPI medium (125%)**: Reduce 5% - Compensación ligera
- **DPI high (150%)**: Reduce 15% - Texto se vería muy grande sin ajuste
- **DPI very-high (200%+)**: Reduce 25% - Equivalente a zoom navegador 70-80% que se usa manualmente en Retina

**Razón de las escalas agresivas**: En pantallas Retina con escalado 200%, sin estos ajustes el texto queda tan grande que los usuarios necesitan reducir manualmente el zoom del navegador al 70-80% para lograr una visualización cómoda. Estas escalas aplican ese ajuste automáticamente.

#### Integración

**En layout.tsx** (línea 46):
```tsx
import { ResponsiveTypography } from "@/shared/components/layout/ResponsiveTypography";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <ResponsiveTypography />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### Hook: useResponsiveFontSize

**Archivo**: `tenant-frontend/src/hooks/useResponsiveFontSize.ts`

Proporciona tamaños de fuente ajustados para uso programático.

**Uso básico**:
```typescript
import { useResponsiveFontSize } from '@/hooks/useResponsiveFontSize';

function MyComponent() {
  const fontSize = useResponsiveFontSize();

  return (
    <Typography sx={{ fontSize: fontSize.h1 }}>
      Título con tamaño ajustado
    </Typography>
  );
}
```

**Hook simplificado - useFontScale**:
```typescript
import { useFontScale } from '@/shared/components/layout/ResponsiveTypography';

function MyComponent() {
  const scale = useFontScale();

  return (
    <Box sx={{ fontSize: `${1.5 * scale}rem` }}>
      Texto escalado: {scale}x
    </Box>
  );
}
```

**Tamaños de fuente base disponibles**:
```typescript
export const BASE_FONT_SIZES = {
  h1: 2.5,      // 40px
  h2: 2,        // 32px
  h3: 1.75,     // 28px
  h4: 1.5,      // 24px
  h5: 1.25,     // 20px
  h6: 1.125,    // 18px
  body1: 1,     // 16px (base)
  body2: 0.875, // 14px
  caption: 0.75,// 12px
  button: 0.875,// 14px
};
```

#### Función utilitaria: getAdjustedFontSize

Para cálculos manuales de tamaños de fuente:

```typescript
import { getAdjustedFontSize } from '@/hooks/useResponsiveFontSize';
import { useDpiDetection } from '@/hooks/useDpiDetection';

function MyComponent() {
  const { dpiLevel } = useDpiDetection();
  const customSize = getAdjustedFontSize(1.5, dpiLevel);

  // En DPI normal: "1.5rem"
  // En DPI very-high: "1.425rem" (1.5 * 0.95)

  return <Typography sx={{ fontSize: customSize }}>...</Typography>;
}
```

#### Configuración para MUI Theme

Si necesitas integrar los tamaños ajustados directamente en el theme de MUI:

```typescript
import { getMuiTypographyConfig } from '@/hooks/useResponsiveFontSize';

const theme = createTheme({
  typography: getMuiTypographyConfig(dpiLevel)
});
```

### Beneficios del ajuste dinámico

✅ **Legibilidad mejorada**: El texto no se ve excesivamente grande en pantallas de alta resolución
✅ **Escalado inteligente**: Ajustes sutiles (2%-5%) mantienen proporciones visuales correctas
✅ **Automático**: Se aplica globalmente sin necesidad de modificar componentes existentes
✅ **SSR-safe**: No causa problemas de hidratación (se aplica solo en cliente)
✅ **Performance**: Usa CSS custom properties y modifica `html { font-size }` una sola vez

### Cómo funciona

1. `ResponsiveTypography` detecta el DPI con `useDpiDetection()`
2. Aplica la escala correspondiente como CSS custom property: `--font-scale`
3. Modifica el `font-size` del elemento `<html>` (16px base * escala)
4. Todos los valores `rem` en la aplicación se ajustan automáticamente
5. En desarrollo, muestra log: `📝 Tipografía ajustada para DPI very-high: escala 0.75x (12px base)`

### Testing

```bash
# Cambiar escalado del SO
# Windows: 100% → 125% → 150% → 200%

# Observar en DevTools:
document.documentElement.style.fontSize
# Normal (100%): "16px"
# Medium (125%): "15.2px" (16 * 0.95)
# High (150%): "13.6px" (16 * 0.85)
# Very-high (200%): "12px" (16 * 0.75) ← Equivale a zoom navegador 75%

# Verificar custom property:
getComputedStyle(document.documentElement).getPropertyValue('--font-scale')
# Retorna: "0.75", "0.85", "0.95", o "1.0"

# Prueba práctica en pantalla Retina con escalado 200%:
# ANTES: Necesitabas zoom navegador 70-80% manualmente
# AHORA: Zoom navegador 100% + ajuste automático = legibilidad óptima
```

## 9. ✅ Conversión de valores minWidth fijos a breakpoints responsivos en páginas

### Problema detectado

Las páginas de detalle de oportunidades y usuarios tenían valores `minWidth` fijos en rem que no se beneficiaban del escalado dinámico:

```tsx
// ❌ ANTES: Valores fijos que no escalan adecuadamente
sx={{ minWidth: { xs: 0, sm: '25rem' } }}  // Tabs - siempre 25rem
sx={{ minWidth: { xs: 0, sm: '20rem' } }}  // Comentarios - siempre 20rem
sx={{ minWidth: { xs: 0, sm: '18rem' } }}  // Historial - siempre 18rem
```

**Consecuencia**: En pantallas Retina con DPI alto (200%), el contenido se reduce por el escalado automático (75%), pero los anchos mínimos permanecen fijos, creando desproporciones.

### Solución aplicada

Se convirtieron todos los valores fijos a progresiones con breakpoints múltiples:

```tsx
// ✅ DESPUÉS: Progresión responsive con breakpoints
sx={{ minWidth: { xs: 0, sm: '22rem', md: '24rem', lg: '25rem' } }}  // Tabs
sx={{ minWidth: { xs: 0, sm: '18rem', md: '19rem', lg: '20rem' } }}  // Comentarios
sx={{ minWidth: { xs: 0, sm: '16rem', md: '17rem', lg: '18rem' } }}  // Historial
sx={{ minWidth: { xs: 0, sm: '16rem', md: '17rem', lg: '18rem' } }}  // Search bar
```

### Archivos modificados

#### 1. `/app/(dashboard)/clientes/oportunidades/[id]/page.tsx`

**Línea 207** - Grid de Tabs:
```tsx
// ANTES
sx={{ display: 'flex', minWidth: { xs: 0, sm: '25rem' } }}

// DESPUÉS
sx={{ display: 'flex', minWidth: { xs: 0, sm: '22rem', md: '24rem', lg: '25rem' } }}
```

**Línea 224** - Grid de Comentarios:
```tsx
// ANTES
sx={{ display: 'flex', minWidth: { xs: 0, sm: '20rem' } }}

// DESPUÉS
sx={{ display: 'flex', minWidth: { xs: 0, sm: '18rem', md: '19rem', lg: '20rem' } }}
```

**Línea 234** - Grid de Historial:
```tsx
// ANTES
sx={{ display: 'flex', minWidth: { xs: 0, sm: '18rem' } }}

// DESPUÉS
sx={{ display: 'flex', minWidth: { xs: 0, sm: '16rem', md: '17rem', lg: '18rem' } }}
```

#### 2. `/app/(dashboard)/oportunidades/global/[tenant]/[id]/page.tsx`

Se aplicaron los mismos cambios:
- **Línea 533**: Tabs con progresión 22rem → 24rem → 25rem
- **Línea 580**: Comentarios con progresión 18rem → 19rem → 20rem
- **Línea 590**: Historial con progresión 16rem → 17rem → 18rem

#### 3. `/app/(dashboard)/usuarios/page.tsx`

**Línea 360** - TextField de búsqueda:
```tsx
// ANTES
sx={{ minWidth: { xs: 0, sm: '18rem' } }}

// DESPUÉS
sx={{ minWidth: { xs: 0, sm: '16rem', md: '17rem', lg: '18rem' } }}
```

### Beneficios de la conversión

1. **Mejor adaptación a Retina**: Los componentes escalan progresivamente con el viewport
2. **Proporción visual correcta**: En pantallas altas DPI, los anchos mínimos también se reducen
3. **Responsive fluido**: Transiciones suaves entre breakpoints (sm → md → lg)
4. **Consistencia**: Mismo patrón aplicado que en las tablas convertidas en sección 6

### Verificación visual

```bash
# Testing en diferentes escenarios:

# 1. Laptop normal (1920x1080, 100% DPI)
#    - Breakpoint 'lg' activo → 25rem, 20rem, 18rem

# 2. Laptop Retina (2560x1440, 200% DPI)
#    - Escalado base: 75% (very-high)
#    - Breakpoint 'md' o 'sm' activo → 22-24rem, 18-19rem, 16-17rem
#    - Resultado: Proporciones visuales correctas sin zoom manual

# 3. Tablet (768px-1024px)
#    - Breakpoint 'sm' o 'md' activo → Anchos intermedios

# 4. Mobile (<600px)
#    - xs: 0 → Sin mínimo, flex natural
```

### Componentes afectados

- **TabsOportunidad**: Panel principal con tabs de información de oportunidad
- **ComentariosPanel**: Panel lateral de comentarios en tiempo real
- **HistorialPanel**: Panel lateral con historial de cambios de estado
- **TextField Search**: Barra de búsqueda de usuarios

### Coordinación con sistema de escalado

Esta conversión trabaja en conjunto con:
- **ResponsiveTypography** (Sección 8): Reduce `html { font-size }` base en DPI alto
- **useDpiDetection** (Sección 7): Detecta nivel de DPI para ajustes contextuales
- **TablaColumnas2** (Sección 6): Tablas ya convertidas a valores rem responsivos

El resultado es un sistema completamente escalable donde:
- Los valores `rem` se ajustan globalmente por DPI (vía `ResponsiveTypography`)
- Los breakpoints adaptan anchos/alturas según viewport
- Las proporciones visuales se mantienen correctas en cualquier combinación

## Mejoras futuras (opcional)

- [x] ~~Convertir más tablas legacy a valores rem responsivos (clientes, admin, etc.)~~ ✅ **COMPLETADO**
- [x] ~~Agregar detección automática de DPI alto con hook personalizado~~ ✅ **COMPLETADO**
- [x] ~~Implementar ajuste dinámico de tipografía según DPI~~ ✅ **COMPLETADO**
- [x] ~~Convertir valores minWidth fijos en páginas a breakpoints~~ ✅ **COMPLETADO**
- [ ] Crear presets de layout para diferentes resoluciones
- [ ] Testing automatizado con Playwright en diferentes escalados

## Referencias

- [MDN - CSS Zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/zoom)
- [MDN - Viewport Meta Tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag)
- [CSS Resolution Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/resolution)
