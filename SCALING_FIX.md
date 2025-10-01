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

## Mejoras futuras (opcional)

- [ ] Convertir más tablas legacy a valores rem responsivos (clientes, admin, etc.)
- [ ] Agregar detección automática de DPI alto con hook personalizado
- [ ] Implementar ajuste dinámico de tipografía según DPI
- [ ] Crear presets de layout para diferentes resoluciones
- [ ] Testing automatizado con Playwright en diferentes escalados

## Referencias

- [MDN - CSS Zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/zoom)
- [MDN - Viewport Meta Tag](https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag)
- [CSS Resolution Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/resolution)
