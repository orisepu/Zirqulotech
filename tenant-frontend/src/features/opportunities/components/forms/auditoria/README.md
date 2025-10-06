# Auditoría de Dispositivos - Arquitectura Modular

Refactorización del componente `FormularioAuditoriaDispositivo` (1856 líneas) en una arquitectura modular alineada con el documento oficial de grading.

## 📁 Estructura

```
auditoria/
├── utils/              # Utilidades y lógica de negocio
│   ├── auditoriaTypes.ts      # Tipos TypeScript
│   ├── auditoriaMappers.ts    # Funciones de mapeo (Grade, estados, etc.)
│   ├── auditoriaHelpers.ts    # Helpers (título, IDs, catálogo)
│   └── index.ts               # Exports
│
├── hooks/              # Custom hooks
│   ├── useGradingEngine.ts    # Motor de grading y pricing (core)
│   ├── useValoracionTecnica.ts # Integración backend valoración
│   └── index.ts               # Exports
│
├── steps/              # Componentes de pasos (7 pasos del documento)
│   ├── PasoSeguridad.tsx      # Paso 1: FMI, Blacklist, SIM-lock, MDM
│   ├── PasoEncendidoCarga.tsx # Paso 2: Encendido y carga
│   ├── PasoBateria.tsx        # Paso 3: Estado batería
│   ├── PasoFuncional.tsx      # Paso 4: Telefonía, audio, sensores, biometría
│   ├── PasoPantallaFuncional.tsx # Paso 5: Funcionalidad pantalla
│   ├── PasoPantallaEstetica.tsx  # Paso 6: Estética pantalla (cristal)
│   └── PasoChasisEstetica.tsx    # Paso 7: Estética chasis/trasera
│
├── components/         # Componentes de UI reutilizables
│   ├── ResumenValoracion.tsx  # Display de grado y precio
│   └── DetallesDeducciones.tsx # Desglose de deducciones
│
├── FormularioAuditoriaDispositivoV2.tsx # Componente principal (orquestador)
├── index.ts            # Main export
└── README.md           # Este archivo
```

## 🎯 Ventajas de la nueva arquitectura

### 1. **Separación de responsabilidades**
- **utils/**: Lógica pura de negocio (mapeos, helpers, tipos)
- **hooks/**: Lógica con estado (grading, backend)
- **steps/**: UI de cada paso de auditoría
- **components/**: UI reutilizable

### 2. **Alineación con documento oficial**
Los 7 pasos siguen exactamente la estructura del documento `grading_i_phone_v_1_trade_x.md`:
1. Seguridad y autenticidad
2. Encendido y carga
3. Estado batería
4. Pruebas funcionales
5. Funcionalidad pantalla
6. Estética pantalla
7. Estética chasis/trasera

### 3. **Motor de grading centralizado** (`useGradingEngine`)
- Calcula grado oficial (A+/A/B/C/D/R) usando tabla oficial
- Maneja gates (security, defectuoso, reciclaje)
- Calcula deducciones (batería, pantalla, chasis)
- Calcula precio final
- Integra valoración backend cuando disponible

### 4. **Testeable y mantenible**
- Funciones puras fácilmente testeables
- Hooks aislados con responsabilidades claras
- Componentes pequeños y enfocados
- Tipos TypeScript estrictos

## 🔧 Uso

### Importar utilities y hooks

```typescript
import {
  // Types
  type ValoresAuditoria,
  type BuildDetalladoParams,

  // Mappers
  gradeToPrecioKey,
  buildDetalladoFromUI,
  mapBackendGradeToFrontend,

  // Helpers
  fmtEUR,
  buildTituloAuditoria,
  getModeloSerieCapacidad,

  // Hooks
  useGradingEngine,
  useValoracionTecnica,
} from './auditoria'
```

### Usar el motor de grading

```typescript
const {
  grado,               // Grade calculado ('A+' | 'A' | 'B' | 'C' | 'D' | 'R')
  precioFinal,         // Precio final calculado
  deducciones,         // { bateria, pantalla, chasis }
  estadoDetallado,     // Estado completo para persistir
  precioBase,          // Base antes de deducciones
} = useGradingEngine({
  saludBateria,
  ciclosBateria,
  pantallaIssues,
  estadoPantalla,
  estadoLados,
  estadoEspalda,
  enciende,
  cargaOk,
  funcChecks,
  precio_por_estado,
  valoracionTecnica,   // opcional: respuesta backend
  costoReparacion,
  isSecurityKO,
  editadoPorUsuario,
})
```

### Integrar valoración backend

```typescript
const {
  valoracionTecnica,   // Respuesta del backend
  isLoading,
  error,
  canQuery,            // ¿Puede hacer la query?
} = useValoracionTecnica({
  enciende,
  cargaOk,
  funcChecks,
  saludBateria,
  pantallaIssues,
  estadoPantalla,
  estadoLados,
  estadoEspalda,
  dispositivo,
  modeloId,
  capacidadId,
  tenant,
  canal,
  isSecurityKO,
})
```

## 🎨 Componente principal

El componente `FormularioAuditoriaDispositivoV2` actúa como orquestador:
- Maneja navegación entre pasos
- Coordina estado global del formulario
- Usa hooks centralizados
- Renderiza componentes de pasos

**Tamaño objetivo**: ~200-300 líneas (vs 1856 del original)

## 🚀 Plan de migración

1. ✅ **Fase 1: Infraestructura** (completado)
   - Estructura de directorios
   - Types, mappers, helpers
   - Hooks centralizados (grading, valoración)

2. ✅ **Fase 2: Componentes de pasos** (completado)
   - PasoSeguridad (FMI, Blacklist, SIM-lock, MDM)
   - PasoEncendidoCarga (enciende, carga)
   - PasoBateria (salud %, ciclos)
   - PasoFuncional (13 verificaciones: telefonía, audio, sensores, etc.)
   - PasoPantallaFuncional (defectos de imagen)
   - PasoPantallaEstetica (cristal)
   - PasoChasisEstetica (laterales, trasera)

3. ✅ **Fase 3: Componentes UI** (completado)
   - ResumenValoracion (grado + precio)
   - DetallesDeducciones (desglose de deducciones)

4. ✅ **Fase 4: Componente principal** (completado)
   - FormularioAuditoriaDispositivoV2 (307 líneas)
   - Orquestador de pasos
   - Integración completa con hooks

5. ⏳ **Fase 5: Testing y migración** (pendiente)
   - Testing completo con todos los tipos de dispositivos
   - Feature flag para rollout gradual
   - Migración desde V1
   - Eliminación del componente legacy

## 📝 Convenciones

### Tipos
- `ValoresAuditoria`: Estado del dispositivo en auditoría
- `Grade`: Grados oficiales ('A+' | 'A' | 'B' | 'C' | 'D' | 'R')
- `GlassStatus`: Estado del cristal (NONE, MICRO, VISIBLE, DEEP, CHIP, CRACK)
- `HousingStatus`: Estado del chasis (SIN_SIGNOS, MINIMOS, ALGUNOS, DESGASTE_VISIBLE, DOBLADO)

### Funciones de mapeo
- `gradeToPrecioKey()`: Grade → clave legacy de precio_por_estado
- `buildDetalladoFromUI()`: Parámetros UI → estado detallado
- `mapBackendGradeToFrontend()`: Grado backend → Grade frontend

### Helpers
- `fmtEUR()`: Formatear euros
- `buildTituloAuditoria()`: Generar título del diálogo
- `getModeloSerieCapacidad()`: Extraer info del dispositivo
- `pickIdsFromDispositivo()`: Extraer IDs numéricos

## 🔍 Testing

Cada módulo es testeable de forma aislada:
- **utils/**: Funciones puras → unit tests
- **hooks/**: Custom hooks → React Testing Library
- **components/**: UI components → RTL + snapshot tests

---

**Documentación del sistema de grading**: Ver `grading_i_phone_v_1_trade_x.md`
