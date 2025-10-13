# Implementación de Sugerencias de Creación de Capacidad

## Resumen

Se ha implementado un sistema completo para detectar cuando v4 identifica correctamente un dispositivo pero falta crear la capacidad en la base de datos. Cuando esto ocurre, el sistema:

1. NO cae en el fallback v3 (que usaría A-number ambiguo)
2. Guarda metadata completa con todos los features extraídos
3. Devuelve sugerencia al frontend para que el usuario cree la capacidad

## Cambios Realizados en Backend

### 1. Modelo de Datos
- **Archivo**: `productos/models/actualizarpreciosfuturos.py`
- **Cambio**: Campo `mapping_metadata` JSONField ya existía (creado en migración 0028)

### 2. Sistema de Mapeo v4 - Adaptador de Compatibilidad
- **Archivo**: `productos/mapping/adapters/v3_compatibility.py`
- **Líneas**: 151-259
- **Cambios**:
  - Detecta cuando v4 extrae features válidas pero no encuentra capacidad exacta
  - Establece `needs_capacity_creation: true`
  - Construye `suggested_capacity` con todos los features extraídos:
    - device_type, variant, cpu, cpu_cores, gpu_cores
    - storage_gb, year, generation
    - screen_size (si aplica)
    - connectivity (si aplica)

### 3. Sistema de Mapeo v4 - API Principal
- **Archivo**: `productos/mapping/__init__.py`
- **Líneas**: 123-166
- **Cambios**:
  - En modo 'auto', cuando v4 sugiere crear capacidad, NO cae en v3
  - Establece flags:
    - `v4_attempted: true`
    - `v3_skipped: true`
    - `v3_skip_reason: 'v4_suggests_capacity_creation'`

### 4. Comando de Actualización
- **Archivo**: `productos/management/commands/actualizar_likewize_v3.py`
- **Líneas**: 488-609
- **Cambios**:
  - Guarda `result_v4` completo para acceder a metadata
  - Incluye en `mapping_metadata`:
    - `needs_capacity_creation`
    - `suggested_capacity`
    - `v3_skipped` y `v3_skip_reason`

### 5. Comando de Remapeo
- **Archivo**: `productos/management/commands/remapear_tarea.py`
- **Líneas**: 116-139
- **Cambios**:
  - Cuando el mapeo falla, guarda metadata completa
  - Incluye `needs_capacity_creation` y `suggested_capacity`

### 6. View de Remapeo (API REST)
- **Archivo**: `productos/views/actualizador.py` - `RemapearTareaLikewizeView`
- **Líneas**: 1223-1244
- **Cambios**:
  - Cuando el mapeo falla, guarda metadata con sugerencia de capacidad

### 7. View de Validación (API REST)
- **Archivo**: `productos/views/actualizador.py` - `ValidationItemsLikewizeView`
- **Líneas**: 2279-2286
- **Cambios**:
  - Incluye `needs_capacity_creation` y `suggested_capacity` en respuesta

## Estructura de la Metadata

Cuando v4 sugiere crear capacidad, la metadata tiene la siguiente estructura:

```json
{
  "is_mapped": false,
  "needs_review": true,
  "confidence_score": null,
  "mapping_algorithm": null,
  "needs_capacity_creation": true,
  "v3_skipped": true,
  "v3_skip_reason": "v4_suggests_capacity_creation",
  "suggested_capacity": {
    "device_type": "MacBook Pro",
    "variant": "Pro",
    "cpu": "M4 Max",
    "cpu_cores": 16,
    "gpu_cores": 40,
    "storage_gb": 4096,
    "year": 2024,
    "generation": null,
    "screen_size": 16.0,
    "connectivity": "Wi-Fi"
  }
}
```

## API Endpoint Actualizado

### GET `/api/precios/likewize/tareas/<tarea_id>/validation-items/`

**Respuesta** (por cada item):
```json
{
  "id": 150012,
  "staging_item_id": 150012,
  "likewize_info": {
    "modelo_raw": "MacBookPro16 5 M4 Max 16 Core CPU 40 Core GPU 16 inch A3186 10/2024 4TB SSD",
    "modelo_norm": "...",
    "tipo": "MacBook Pro",
    ...
  },
  "mapped_info": null,
  "mapping_metadata": {
    "confidence_score": null,
    "mapping_algorithm": null,
    "needs_review": true,
    "is_mapped": false,
    "needs_capacity_creation": true,
    "suggested_capacity": {
      "device_type": "MacBook Pro",
      "variant": "Pro",
      "cpu": "M4 Max",
      "cpu_cores": 16,
      "gpu_cores": 40,
      "storage_gb": 4096,
      "year": 2024,
      "generation": null,
      "screen_size": 16.0,
      "connectivity": "Wi-Fi"
    }
  }
}
```

## Resultados de Prueba

### Tarea: 5489d371-4366-4c6e-9c61-f700e9b420bb
- Total items: 751
- Mapeados: 627
- Sin mapear: 124
- **Items con sugerencia de crear capacidad: 121** ✓

### Ejemplos de Sugerencias
1. **MacBook Pro M4 Max 16-core CPU, 40-core GPU, 16", 4TB**
2. **Mac Pro 7,1 24-core 2.7GHz, 8TB**
3. **Mac Studio M2 Ultra 24-core CPU, 76-core GPU, 8TB**
4. **Mac mini M2 10-core CPU, 16-core GPU, 512GB** ← El caso original del usuario

## Próximos Pasos: Frontend

### 1. Actualizar Interfaz de Validación de Likewize

La interfaz debe mostrar visualmente los items que necesitan creación de capacidad:

#### Indicador Visual
- Badge/Chip: "⚠️ Crear Capacidad" (color warning/amarillo)
- O icono distintivo junto al item

#### Modal/Drawer de Detalles
Al hacer clic en un item con `needs_capacity_creation: true`, mostrar:

```
┌─────────────────────────────────────────────────┐
│ ⚠️  Capacidad No Encontrada                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ El dispositivo fue identificado correctamente   │
│ pero falta crear esta capacidad en la BD:       │
│                                                 │
│ Dispositivo Identificado:                       │
│ ├─ Tipo: MacBook Pro                           │
│ ├─ Variante: Pro                               │
│ ├─ Chip: M4 Max                                │
│ ├─ CPU: 16 cores                               │
│ ├─ GPU: 40 cores                               │
│ ├─ Almacenamiento: 4TB                         │
│ ├─ Pantalla: 16"                               │
│ ├─ Año: 2024                                   │
│ └─ Conectividad: Wi-Fi                         │
│                                                 │
│ [Crear Capacidad] [Ignorar]                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Botón "Crear Capacidad"
- Abre un formulario pre-llenado con los datos de `suggested_capacity`
- Usuario puede revisar/ajustar antes de crear
- Al guardar, llamar al endpoint de creación de capacidades:
  - `POST /api/capacidades/`
  - Con los datos del `suggested_capacity`

#### Estadísticas
En el header/resumen de la página de validación:
```
Total: 751
✓ Mapeados: 627
✗ Sin mapear: 3
⚠️ Necesitan capacidad: 121
```

### 2. Filtros
Agregar filtro para mostrar solo items con `needs_capacity_creation: true`

### 3. Acción en Masa (Opcional)
Permitir crear múltiples capacidades a la vez
- Seleccionar items con checkbox
- Botón "Crear Capacidades Seleccionadas"
- Revisa lista y confirma antes de crear

## Beneficios de la Implementación

1. **Precisión Mejorada**: Evita mapeos incorrectos por A-numbers ambiguos
2. **Trabajo Eficiente**: Usuario sabe exactamente qué capacidades faltan
3. **Datos Completos**: Toda la información necesaria para crear la capacidad
4. **Trazabilidad**: Metadata completa para auditoría y debugging
5. **UX Clara**: Usuario entiende por qué un item no se mapeó

## Casos de Uso Cubiertos

✓ Mac mini M2 10-core/16-core GPU (caso original del usuario)
✓ MacBook Pro M4 Max con configuraciones de 8TB
✓ Mac Pro 7,1 con múltiples configuraciones de cores
✓ Mac Studio M2 Ultra con 60-core y 76-core GPU
✓ iMac Pro con múltiples configuraciones
✓ MacBook Pro M3/M2 con configuraciones no estándar

## Notas Técnicas

- El sistema usa el modo 'auto' que intenta v4 primero
- Si v4 detecta que el modelo existe pero falta capacidad específica, NO cae en v3
- v3 solo se usa cuando v4 no puede identificar el dispositivo en absoluto
- Todos los metadatos se guardan en el campo `mapping_metadata` (JSONField)
