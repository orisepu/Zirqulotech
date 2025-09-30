# Guía de Desarrollo Responsivo - Checkouters Partners Frontend

Esta guía documenta los estándares, patrones y herramientas para garantizar que el frontend sea responsivo y funcione correctamente en todas las resoluciones de pantalla.

---

## 📐 Breakpoints Estándar

El proyecto utiliza los breakpoints predeterminados de Material-UI (MUI):

```typescript
xs: 0px      // Extra small (mobile)
sm: 600px    // Small (large mobile / small tablet)
md: 900px    // Medium (tablet)
lg: 1200px   // Large (desktop)
xl: 1536px   // Extra large (large desktop)
```

### Viewports de Prueba Recomendados

| Dispositivo | Resolución | Breakpoint MUI | Uso |
|-------------|------------|----------------|-----|
| **iPhone SE** | 375x667 | xs | Móvil pequeño |
| **iPad** | 768x1024 | sm/md | Tablet vertical |
| **Desktop Full HD** | 1920x1080 | lg/xl | Escritorio estándar |
| **QHD Desktop** | 2560x1440 | xl | Escritorio grande |
| **Retina Desktop** | 2880x1620 | xl | MacBook Pro 16" |
| **4K Ultra HD** | 3840x2160 | xl | Monitores 4K |

---

## 🛠️ Herramientas de Testing

### 1. Playwright (E2E Testing Automatizado)

**Ubicación**: `e2e/responsive.spec.ts`
**Configuración**: `playwright.config.ts`

**Ejecutar pruebas**:
```bash
# Todas las pruebas en todos los viewports
pnpm test:responsive

# Solo en un proyecto específico
pnpm test:responsive:mobile      # iPhone SE (375x667)
pnpm test:responsive:tablet      # iPad (768x1024)
pnpm test:responsive:desktop     # Full HD (1920x1080)
pnpm test:responsive:retina      # MacBook Pro 16" (2880x1620)
pnpm test:responsive:4k          # Ultra HD (3840x2160)

# Modo UI interactivo
pnpm test:responsive:ui

# Ver reporte HTML
pnpm test:responsive:report
```

**Navegadores instalados**: Chromium (headless)

**Capturas automáticas**: Las pruebas fallan y capturan screenshots en `e2e/screenshots/`

**Capturar screenshots sin fallos**:
```bash
# Capturar solo screenshots de todas las páginas
pnpm test:responsive:capture

# Generar galería HTML desde screenshots existentes
pnpm test:responsive:gallery
```

### 2. Screenshot Capture Tool (✨ Ideal para SSH)

**Ubicación**: `scripts/capture-screenshots.mjs`

**✅ Perfecto para desarrollo remoto via SSH** - No requiere GUI

**Uso**:
```bash
# Capturar página específica en TODAS las resoluciones
pnpm dev:screenshots                    # Homepage
pnpm dev:screenshots /dashboard         # Dashboard
pnpm dev:screenshots /oportunidades     # Oportunidades

# Output: Genera reporte HTML con capturas + detección de overflow
```

**Características**:
- ✅ Funciona en SSH sin GUI (headless)
- 🎯 Captura 6 viewports: mobile, tablet, desktop, QHD, retina (2880x1620), 4K
- 📊 Genera reporte HTML con galería interactiva
- ⚠️ Detecta overflow horizontal automáticamente
- 🖼️ Click para ver full-size
- 🎨 Filtros por tipo de viewport

**Workflow típico en SSH**:
```bash
# 1. En servidor (via SSH)
pnpm dev                              # Terminal 1: dev server
pnpm dev:screenshots /tu-pagina       # Terminal 2: capturas

# 2. En tu Mac local
scp user@server:/path/to/e2e/screenshots/manual/*/index.html ~/Downloads/
open ~/Downloads/index.html           # Abrir en navegador local
```

### 3. Puppeteer (Testing Manual Local - Requiere GUI)

**Ubicación**: `scripts/test-viewports.mjs`

**⚠️ Solo funciona con GUI local** (no en SSH)

**Uso**:
```bash
# Abrir página principal en todos los viewports
pnpm dev:viewports

# Abrir ruta específica
pnpm dev:viewports /dashboard
pnpm dev:viewports /oportunidades

# En ventanas abiertas:
# - Presiona 's' para capturar screenshots
# - Presiona Ctrl+C para cerrar todo
```

**Con SSHFS** (alternativa):
```bash
# En tu Mac
sshfs user@server:/path/to/project ~/mnt/remote
ssh -L 3000:localhost:3000 user@server  # Port forwarding
cd ~/mnt/remote
pnpm dev:viewports  # Se ejecuta localmente, abre ventanas en tu Mac
```

### 4. Browser DevTools (Manual)

**Chrome/Edge DevTools**:
1. `F12` → Toggle device toolbar (`Ctrl+Shift+M`)
2. Seleccionar preset (iPhone SE, iPad, etc.) o tamaño personalizado
3. Probar orientación landscape/portrait

**Extensiones recomendadas**:
- **Responsive Viewer** (Chrome/Edge) - Ver múltiples viewports simultáneamente
- **Window Resizer** - Tamaños de ventana rápidos predefinidos

---

## 🌐 Guía de Uso en SSH

### Problema Común: GUI No Disponible

Cuando trabajas conectado por SSH al servidor, herramientas como Puppeteer que intentan abrir ventanas fallarán porque no hay servidor gráfico (X11/Wayland).

### ✅ Solución: Playwright Headless

El sistema incluye herramientas específicas para SSH que **no requieren GUI**:

#### 1. Captura Rápida de Una Página

```bash
# Conectado por SSH al servidor
ssh user@servidor

# Iniciar dev server
cd /srv/checkouters/Partners/tenant-frontend
pnpm dev  # Terminal 1

# En otra terminal SSH
pnpm dev:screenshots /dashboard
# Captura dashboard en las 6 resoluciones (2-3 segundos)
```

**Output**: `e2e/screenshots/manual/TIMESTAMP/index.html`

#### 2. Descargar y Ver Reporte

**Opción A: SCP (recomendado)**
```bash
# Desde tu Mac (no desde SSH)
scp -r user@servidor:/srv/checkouters/Partners/tenant-frontend/e2e/screenshots/manual/latest ~/Downloads/
open ~/Downloads/latest/index.html
```

**Opción B: SSHFS + Abrir directo**
```bash
# Montar filesystem
sshfs user@servidor:/srv/checkouters ~/mnt/server

# Abrir reporte directo
open ~/mnt/server/checkouters/Partners/tenant-frontend/e2e/screenshots/manual/*/index.html
```

**Opción C: Port forwarding + servidor HTTP**
```bash
# En SSH, dentro del directorio de screenshots
cd e2e/screenshots/manual/TIMESTAMP
python3 -m http.server 8080

# En tu Mac, con tunnel
ssh -L 8080:localhost:8080 user@servidor

# Abrir en navegador
open http://localhost:8080
```

#### 3. Tests Playwright Completos

```bash
# Ejecutar suite completa de tests responsivos (headless)
pnpm test:responsive

# Ver reporte (necesitas descargarlo o usar port forwarding)
pnpm test:responsive:report  # Genera playwright-report/index.html
```

#### 4. Workflow Recomendado para SSH

```bash
# === En servidor (SSH) ===

# Terminal 1: Dev server
pnpm dev

# Terminal 2: Hacer cambios de código
vim src/components/MiComponente.tsx

# Terminal 3: Capturar screenshots después de cada cambio
pnpm dev:screenshots /mi-ruta
# Observar output en terminal para overflow warnings

# === En tu Mac local ===

# Descargar última captura
scp -r user@servidor:/ruta/screenshots/manual/$(ssh user@servidor 'ls -t /ruta/screenshots/manual | head -1') ~/Downloads/latest-screenshots/

# Abrir en navegador
open ~/Downloads/latest-screenshots/index.html
```

### 🔧 Troubleshooting SSH

**Error: "Could not find Chrome"** (Puppeteer)
```bash
# ✅ Solución: Usar Playwright en su lugar
pnpm dev:screenshots  # En lugar de pnpm dev:viewports
```

**Error: "DISPLAY environment variable not set"**
```bash
# ✅ Normal en SSH - usa herramientas headless
pnpm test:responsive  # Playwright headless
pnpm dev:screenshots  # Capture script headless
```

**Quiero usar Puppeteer con ventanas desde SSH**
```bash
# Opción 1: X11 Forwarding (lento)
ssh -X user@servidor
export DISPLAY=localhost:10.0
pnpm dev:viewports

# Opción 2: SSHFS + ejecución local (mejor)
sshfs user@servidor:/ruta ~/mnt/server
cd ~/mnt/server
ssh -L 3000:localhost:3000 user@servidor  # En otra terminal
pnpm dev:viewports  # Se ejecuta en tu Mac local
```

### 📊 Comparación de Herramientas

| Herramienta | Funciona en SSH | Velocidad | Interactivo | Output |
|-------------|-----------------|-----------|-------------|--------|
| `pnpm dev:screenshots` | ✅ Sí | ⚡ Rápido (2-3s) | ❌ No | HTML report |
| `pnpm test:responsive` | ✅ Sí | 🐌 Lento (30-60s) | ❌ No | Playwright report + screenshots |
| `pnpm test:responsive:capture` | ✅ Sí | 🏃 Medio (10-15s) | ❌ No | Screenshots organizados |
| `pnpm dev:viewports` | ❌ No (requiere GUI) | ⚡ Rápido | ✅ Sí | Ventanas en vivo |

**Recomendación para SSH**: `pnpm dev:screenshots` + `scp` para desarrollo rápido

---

## 📝 Patrones de Código Responsivo

### 1. Uso de `useMediaQuery`

**✅ Correcto** (usando theme):
```typescript
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
```

**❌ Incorrecto** (hardcoded):
```typescript
// NO hacer esto
const isMobile = useMediaQuery('(max-width: 900px)');
```

### 2. Estilos Responsivos con `sx`

**Método recomendado** (objeto por breakpoint):
```typescript
<Box
  sx={{
    width: { xs: '100%', md: '50%', lg: '33%' },
    padding: { xs: 1, sm: 2, md: 3 },
    display: { xs: 'block', md: 'flex' },
    flexDirection: { xs: 'column', md: 'row' }
  }}
>
```

**Utilities comunes**:
```typescript
// Ocultar en móvil, mostrar en desktop
display: { xs: 'none', md: 'block' }

// Mostrar solo en móvil
display: { xs: 'block', md: 'none' }

// Spacing responsivo
gap: { xs: 1, sm: 2, md: 3 }
mt: { xs: 2, md: 4 }
```

### 3. Layout con Grid/Stack

**Grid2 (recomendado)**:
```typescript
import Grid from '@mui/material/Grid2';

<Grid container spacing={{ xs: 1, md: 2, lg: 3 }}>
  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
    {/* 100% móvil, 50% tablet, 33% desktop, 25% large */}
  </Grid>
</Grid>
```

**Stack (para layouts simples)**:
```typescript
<Stack
  direction={{ xs: 'column', md: 'row' }}
  spacing={{ xs: 1, md: 2 }}
  alignItems={{ xs: 'stretch', md: 'center' }}
>
  <Box>Item 1</Box>
  <Box>Item 2</Box>
</Stack>
```

### 4. Typography Responsivo

```typescript
<Typography
  variant="h3"
  sx={{
    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
    fontWeight: { xs: 600, md: 700 }
  }}
>
```

### 5. Sidebar/Drawer Responsivo

**Patrón actual** (ver `DashboardShell.tsx:45`):
```typescript
const isMobile = useMediaQuery(theme.breakpoints.down('md'));

<Drawer
  variant={isMobile ? 'temporary' : 'permanent'}
  open={isMobile ? mobileOpen : true}
  onClose={handleDrawerToggle}
  sx={{
    '& .MuiDrawer-paper': {
      width: collapsed ? collapsedWidth : drawerWidth
    }
  }}
/>
```

### 6. Tablas Responsivas

**Opción 1**: Scroll horizontal en móvil
```typescript
<Box sx={{ overflowX: 'auto' }}>
  <Table sx={{ minWidth: 650 }}>
    {/* table content */}
  </Table>
</Box>
```

**Opción 2**: Convertir a cards en móvil
```typescript
const isMobile = useMediaQuery(theme.breakpoints.down('md'));

{isMobile ? (
  <Stack spacing={2}>
    {rows.map(row => <Card key={row.id}>{/* card content */}</Card>)}
  </Stack>
) : (
  <Table>{/* table content */}</Table>
)}
```

### 7. Charts Responsivos

**Ejemplo actual** (ver `PieRankinga.tsx:41-42`):
```typescript
const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
const legendPosition = isNarrow ? 'bottom' : 'right';

<MuiPieChart
  height={height}
  slotProps={{
    legend: {
      position: legendPosition,
      itemMarkWidth: isNarrow ? 12 : 16
    }
  }}
/>
```

**Recharts**:
```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    {/* chart config */}
  </LineChart>
</ResponsiveContainer>
```

---

## 🔍 Auditoría de Componentes

### Componentes Críticos Auditados

| Componente | Ubicación | Estado Responsivo | Notas |
|------------|-----------|-------------------|-------|
| **DashboardShell** | `src/shared/components/layout/DashboardShell.tsx:45` | ✅ Bueno | Usa `useMediaQuery` correctamente, drawer temporal en móvil |
| **BreadcrumbsExplorador** | `src/components/BreadcrumbsExplorador.tsx:22` | ✅ Bueno | Detecta `sm` breakpoint para altura del toolbar |
| **PieRankinga** | `src/features/dashboards/components/manager/PieRankinga.tsx:41` | ✅ Bueno | Legend adapta posición según `md` breakpoint |
| **TablaReactiva2** | `src/components/tablacolumnas.tsx` | ⚠️ Revisar | Verificar scroll horizontal en móvil |
| **FormularioValoracion** | `src/components/FormularioValoracion.tsx` | ⚠️ Revisar | Formularios largos pueden requerir optimización |
| **OportunidadesTablev2** | `src/components/OportunidadesTablev2.tsx` | ⚠️ Revisar | Tablas complejas necesitan scrolling o cards |

### Componentes Pendientes de Revisión

**Prioridad Alta**:
- [ ] `src/components/OportunidadesTablev2.tsx` - Tabla principal de oportunidades
- [ ] `src/components/tablacolumnas.tsx` - Tablas genéricas
- [ ] `src/components/FormularioValoracion.tsx` - Formularios de valoración
- [ ] `src/features/opportunities/components/devices/` - Componentes de dispositivos

**Prioridad Media**:
- [ ] `src/features/dashboards/components/` - Otros componentes de dashboard
- [ ] `src/components/formularios/` - Formularios multi-paso
- [ ] `src/components/pdf/` - Generación de PDF (no aplica responsividad web)

---

## ✅ Checklist Pre-Commit

Antes de hacer commit de nuevos componentes o cambios de UI:

- [ ] **Breakpoints**: ¿Se usan breakpoints de theme en lugar de hardcoded?
- [ ] **useMediaQuery**: ¿Se usa con `theme.breakpoints` correctamente?
- [ ] **Testing Manual**: ¿Probaste en al menos 2 viewports (móvil + desktop)?
- [ ] **Overflow**: ¿Verificaste que no hay scroll horizontal no deseado?
- [ ] **Touch Targets**: ¿Botones tienen al menos 44x44px en móvil?
- [ ] **Typography**: ¿Textos legibles en móvil (min 14px body, 16px inputs)?
- [ ] **Spacing**: ¿Márgenes/padding reducidos en móvil?
- [ ] **Navegación**: ¿Menús/sidebars se adaptan a móvil (hamburger/drawer)?
- [ ] **Formularios**: ¿Inputs de tamaño completo en móvil?
- [ ] **Tablas**: ¿Scroll horizontal o conversión a cards en móvil?
- [ ] **Modals**: ¿Se ajustan al viewport sin desbordar?
- [ ] **Charts**: ¿Legend y labels legibles en viewport pequeño?

---

## 🐛 Problemas Comunes y Soluciones

### 1. Scroll Horizontal No Deseado

**Causa**: Contenido más ancho que viewport
**Detección**:
```typescript
const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
```

**Soluciones**:
```typescript
// Wrapper con overflow controlado
<Box sx={{ maxWidth: '100vw', overflowX: 'hidden' }}>

// O permitir scroll en contenedor específico
<Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
```

### 2. Sidebar Siempre Visible en Móvil

**Problema**: Drawer permanent en móvil
**Solución**: Ver patrón en `DashboardShell.tsx:252`

### 3. Tabla Desborda en Móvil

**Solución 1**: Wrapper scrolleable
```typescript
<Box sx={{ overflowX: 'auto', width: '100%' }}>
  <Table sx={{ minWidth: 650 }} />
</Box>
```

**Solución 2**: Cards en móvil (mejor UX)

### 4. Modals Demasiado Grandes

```typescript
<Dialog
  fullScreen={isMobile}
  maxWidth="md"
  PaperProps={{
    sx: {
      width: { xs: '100%', sm: '90%', md: '80%' },
      maxHeight: { xs: '100%', sm: '90vh' }
    }
  }}
/>
```

### 5. Charts No Se Redimensionan

**Recharts**: Usar `<ResponsiveContainer>`
**MUI Charts**: Especificar `width="100%"` o valor dinámico
**Ajustar legend**: Ver ejemplo en `PieRankinga.tsx`

### 6. Typography Muy Pequeña en Móvil

```typescript
<Typography
  sx={{
    fontSize: { xs: '0.875rem', md: '1rem' },
    lineHeight: 1.5
  }}
>
```

---

## 🚀 Mejores Prácticas

### 1. Mobile First

Diseña pensando primero en móvil, luego expande:
```typescript
sx={{
  width: '100%',              // Default (móvil)
  md: { width: '50%' },       // Desktop
  lg: { width: '33%' }        // Large desktop
}}
```

### 2. Touch Targets

Mínimo 44x44px para elementos interactivos en móvil:
```typescript
<IconButton
  sx={{
    minWidth: 44,
    minHeight: 44,
    padding: { xs: 1.5, md: 1 }
  }}
/>
```

### 3. Spacing Escalable

```typescript
const spacing = { xs: 1, sm: 2, md: 3, lg: 4 };

<Stack spacing={spacing} />
<Box sx={{ p: spacing }} />
```

### 4. Imágenes Responsivas

```typescript
<Box
  component="img"
  src="/image.jpg"
  sx={{
    width: '100%',
    maxWidth: { xs: '100%', md: 600 },
    height: 'auto',
    objectFit: 'cover'
  }}
/>
```

### 5. Conditional Rendering

Preferir estilos responsivos sobre conditional rendering cuando sea posible:

**✅ Mejor**:
```typescript
<Box sx={{ display: { xs: 'none', md: 'block' } }}>Desktop only</Box>
```

**⚠️ Solo si necesario**:
```typescript
{!isMobile && <DesktopComponent />}
```

---

## 📊 Integración CI/CD

### GitHub Actions (Pendiente)

```yaml
# .github/workflows/responsive-tests.yml
name: Responsive Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm playwright install --with-deps chromium
      - run: pnpm test:responsive
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-screenshots
          path: e2e/screenshots/
```

---

## 🔗 Referencias

### Documentación Oficial
- [MUI Breakpoints](https://mui.com/material-ui/customization/breakpoints/)
- [MUI useMediaQuery](https://mui.com/material-ui/react-use-media-query/)
- [MUI Responsive UI](https://mui.com/material-ui/guides/responsive-ui/)
- [Playwright Testing](https://playwright.dev/docs/intro)

### Recursos del Proyecto
- Theme configuration: `src/context/ThemeContext.tsx`
- Main layout: `src/shared/components/layout/DashboardShell.tsx`
- Test suite: `e2e/responsive.spec.ts`
- Viewport script: `scripts/test-viewports.mjs`

---

## 📞 Soporte

Si encuentras problemas de responsividad:

1. **Ejecutar pruebas**: `pnpm test:responsive`
2. **Testing manual**: `pnpm dev:viewports`
3. **Revisar esta guía**: Buscar patrones similares
4. **Verificar breakpoints**: Confirmar uso de `theme.breakpoints`
5. **Capturar screenshots**: Documentar el problema visualmente

---

**Última actualización**: 2025-09-30
**Versión**: 1.0.0