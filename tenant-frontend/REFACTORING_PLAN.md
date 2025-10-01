# Plan de Refactorización - Componentes Grandes

**Fecha**: 2025-10-01
**Objetivo**: Refactorizar 4 componentes >1000 líneas para mejorar mantenibilidad
**Tiempo estimado total**: 1-2 semanas
**Líneas totales**: ~7,500

---

## 📊 Componentes Identificados

| Archivo | Líneas | Complejidad | Prioridad | Estimado |
|---------|--------|-------------|-----------|----------|
| `EnhancedLikewizePage.tsx` | 2,303 | ⚠️ MUY ALTA | Alta | 3-4 días |
| `dispositivos/actualizar/page.tsx` | 2,214 | ⚠️ MUY ALTA | Alta | 3-4 días |
| `FormularioAuditoriaDispositivo.tsx` | 1,800 | 🟡 ALTA | Media | 2-3 días |
| `FromularioValoracioncompleta.tsx` | 1,172 | 🟡 ALTA | Media | 1-2 días |

---

## 🎯 Estrategia de Refactorización

### Principios

1. **Incremental**: Refactorizar en pasos pequeños verificables
2. **Test-First**: Agregar tests antes de refactorizar (si no existen)
3. **Type-Safe**: Mantener/mejorar type safety
4. **Backward Compatible**: No romper funcionalidad existente
5. **Performance**: No degradar rendimiento

### Approach

- **Extraer Types**: Mover interfaces/types a archivos separados
- **Extraer Utils**: Funciones helper a `utils/`
- **Extraer Hooks**: Lógica de estado a custom hooks
- **Extraer Components**: UI a componentes reutilizables
- **Simplificar Main**: Componente principal solo orquesta

---

## 🔍 Análisis Detallado

### 1. EnhancedLikewizePage.tsx (2,303 líneas)

**Ubicación**: `src/features/opportunities/components/devices/EnhancedLikewizePage.tsx`

#### Estructura Actual

```typescript
// Types (líneas 10-58)
type Cambio = { ... }
type DiffData = { ... }

// Helper Components (líneas 72-92)
interface TabPanelProps { ... }
function TabPanel(props: TabPanelProps) { ... }

// Main Component (líneas 99-2303)
export function EnhancedLikewizePage() {
  // 15+ estados locales
  // 10+ queries (useQuery)
  // 5+ mutations (useMutation)
  // 3+ funciones helper grandes (cleanModelName, etc.)
  // Modales de búsqueda y creación
  // Lógica de V3 learning system
  // Renderizado complejo con 5+ tabs
  // ~2000 líneas de JSX
}
```

#### Problemas

- 🔴 **Demasiados estados**: 15+ useState hooks
- 🔴 **Lógica mezclada**: UI + business logic + data fetching
- 🔴 **Funciones inline**: cleanModelName() debería estar en utils
- 🔴 **Modales inline**: SearchModal y CreateDeviceModal dentro del componente
- 🔴 **JSX masivo**: ~2000 líneas de renderizado
- 🟡 **Queries agrupadas**: Dificulta testing individual

#### Plan de Refactorización

**Fase 1: Extraer Types y Utils (1-2 horas)**
```bash
# Crear archivos:
src/features/opportunities/types/likewize.ts         # Types: Cambio, DiffData
src/features/opportunities/utils/deviceNameCleaner.ts # cleanModelName()
src/shared/components/TabPanel.tsx                    # TabPanel component
```

**Fase 2: Extraer Modales (3-4 horas)**
```bash
# Crear componentes:
src/features/opportunities/components/devices/modals/SearchDeviceModal.tsx
src/features/opportunities/components/devices/modals/CreateDeviceModal.tsx
```

**Fase 3: Extraer Custom Hooks (1 día)**
```bash
# Crear hooks:
src/features/opportunities/hooks/useDeviceCorrection.ts    # Search + correction logic
src/features/opportunities/hooks/useDeviceCreation.ts     # Device creation logic
src/features/opportunities/hooks/useLikewizeTaskData.ts   # Queries consolidadas
```

**Fase 4: Extraer Secciones de UI (1-2 días)**
```bash
# Crear componentes:
src/features/opportunities/components/devices/sections/V3UpdateSection.tsx
src/features/opportunities/components/devices/sections/DiffSection.tsx
src/features/opportunities/components/devices/sections/UnmappedItemsSection.tsx
src/features/opportunities/components/devices/sections/HistoricalTasksSection.tsx
```

**Fase 5: Simplificar Main Component (4 horas)**
- Componente principal solo orquesta subcomponentes
- Objetivo: <300 líneas en EnhancedLikewizePage.tsx

#### Meta Final

```typescript
// EnhancedLikewizePage.tsx (target: ~250 líneas)
export function EnhancedLikewizePage({ tareaId, onUpdateComplete }: Props) {
  const taskData = useLikewizeTaskData(tareaId)
  const deviceCorrection = useDeviceCorrection()
  const deviceCreation = useDeviceCreation()

  return (
    <Box>
      <Tabs value={tabValue} onChange={handleTabChange}>
        <Tab label="V3 Update" />
        <Tab label="Diff Review" />
        <Tab label="Unmapped Items" />
        <Tab label="Historical Tasks" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <V3UpdateSection {...v3Props} />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <DiffSection {...diffProps} />
      </TabPanel>

      {/* ... más tabs */}

      <SearchDeviceModal {...deviceCorrection} />
      <CreateDeviceModal {...deviceCreation} />
    </Box>
  )
}
```

---

### 2. dispositivos/actualizar/page.tsx (2,214 líneas)

**Ubicación**: `src/app/(dashboard)/dispositivos/actualizar/page.tsx`

#### Estructura Actual

```typescript
// Types (múltiples)
type Preset = { ... }
type EstadoTarea = { ... }
type PrecioLikewize = { ... }

// Muchas funciones helper inline
const sanitizeNombre = (valor) => ...
const extractYear = (text) => ...
const extractProcessor = (text) => ...
// +10 más funciones helper

// Main Page Component (1900+ líneas)
export default function LikewizeB2BPage() {
  // Similar a EnhancedLikewizePage pero legacy
  // Mucho JSX repetitivo
  // Lógica de staging/mapping duplicada
}
```

#### Plan de Refactorización

**Fase 1: Extraer Utils (4 horas)**
```bash
src/features/opportunities/utils/deviceTextExtraction.ts
  - sanitizeNombre()
  - extractYear()
  - extractProcessor()
  - extractMemory()
  - extractDisplay()
  - +10 más funciones
```

**Fase 2: Consolidar con EnhancedLikewizePage (1-2 días)**
- Evaluar si este componente puede ser reemplazado por EnhancedLikewizePage
- Si no, extraer lógica común a hooks compartidos

**Fase 3: Simplificar UI (1 día)**
- Extraer tablas a componentes
- Extraer formularios a componentes

---

### 3. FormularioAuditoriaDispositivo.tsx (1,800 líneas)

**Ubicación**: `src/features/opportunities/components/forms/FormularioAuditoriaDispositivo.tsx`

#### Estructura Esperada

```typescript
// Formulario multi-step para auditoría de dispositivos
// Probablemente con validación compleja
```

#### Plan de Refactorización

**Fase 1: Extraer Steps (1 día)**
```bash
src/features/opportunities/components/forms/audit-steps/
  - DeviceInfoStep.tsx
  - ConditionStep.tsx
  - PhotosStep.tsx
  - GradingStep.tsx
  - SummaryStep.tsx
```

**Fase 2: Extraer Validation Logic (4 horas)**
```bash
src/features/opportunities/utils/auditValidation.ts
```

**Fase 3: Hook de Formulario (4 horas)**
```bash
src/features/opportunities/hooks/useAuditForm.ts
```

---

### 4. FromularioValoracioncompleta.tsx (1,172 líneas)

**Ubicación**: `src/features/clients/components/FromularioValoracioncompleta.tsx`

**Nota**: Typo en nombre (debería ser `FormularioValoracionCompleta.tsx`)

#### Plan de Refactorización

Similar a FormularioAuditoriaDispositivo.tsx - extraer steps y validation.

---

## 📝 Checklist de Refactorización

### Pre-Refactorización

- [ ] Crear branch de refactorización: `git checkout -b refactor/large-components`
- [ ] Asegurar que `pnpm typecheck` pasa: ✅ (0 errores)
- [ ] Documentar funcionalidad actual (screenshots si es UI crítica)
- [ ] Revisar si existen tests (agregar si faltan)

### Durante Refactorización

- [ ] Extraer 1 pieza a la vez
- [ ] Verificar `pnpm typecheck` después de cada extracción
- [ ] Verificar que la app funciona después de cada extracción
- [ ] Commit frecuente con mensajes descriptivos

### Post-Refactorización

- [ ] Ejecutar `pnpm typecheck` final
- [ ] Ejecutar `pnpm test` (si hay tests)
- [ ] Testing manual de funcionalidad crítica
- [ ] Code review
- [ ] Merge a main

---

## 🚀 Inicio Rápido (Hoy)

### Mejoras de Bajo Riesgo (1-2 horas)

Estas pueden hacerse ahora sin afectar funcionalidad:

1. **Extraer TabPanel a shared component**
```bash
# Crear: src/shared/components/TabPanel.tsx
# Actualizar imports en EnhancedLikewizePage.tsx
```

2. **Extraer Types de Likewize**
```bash
# Crear: src/features/opportunities/types/likewize.ts
# Mover: Cambio, DiffData, EstadoTarea, PrecioLikewize
```

3. **Extraer cleanModelName utility**
```bash
# Crear: src/features/opportunities/utils/deviceNameCleaner.ts
# Mover: cleanModelName() + tests
```

4. **Extraer device text extraction utils**
```bash
# Crear: src/features/opportunities/utils/deviceTextExtraction.ts
# Mover: sanitizeNombre, extractYear, extractProcessor, etc.
```

**Beneficios inmediatos**:
- ✅ Reduce líneas en componentes principales: ~150 líneas
- ✅ Utils son testables independientemente
- ✅ Types son reutilizables
- ✅ Sin riesgo de romper funcionalidad

**Tiempo**: 1-2 horas
**Riesgo**: ⚠️ BAJO

---

## 📌 Recomendación

Dado el alcance (7,500 líneas, 1-2 semanas), recomiendo:

1. **Hoy**: Hacer las mejoras de bajo riesgo (1-2 horas)
2. **Esta semana**: Planificar sesiones dedicadas de 2-3 horas para cada componente
3. **Gradual**: Refactorizar 1 componente por semana
4. **Testing**: Agregar tests antes/durante refactorización

### Timeline Sugerido

- **Semana 1**: EnhancedLikewizePage.tsx (componente más crítico)
- **Semana 2**: dispositivos/actualizar/page.tsx
- **Semana 3**: FormularioAuditoriaDispositivo.tsx
- **Semana 4**: FromularioValoracioncompleta.tsx + cleanup final

---

## ✅ Quick Wins para Hoy

Voy a extraer ahora:
1. TabPanel component → `src/shared/components/TabPanel.tsx`
2. Likewize types → `src/features/opportunities/types/likewize.ts`
3. Device name cleaner → `src/features/opportunities/utils/deviceNameCleaner.ts`

**Impacto**: ~100 líneas menos en componentes principales
**Tiempo**: 30-60 minutos
**Riesgo**: Muy bajo
