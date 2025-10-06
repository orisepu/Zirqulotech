# Endpoints para Verificar y Re-Mapear Tareas Likewize

Este documento explica cómo usar los nuevos endpoints para ver el estado de una tarea Likewize y re-mapear todos los items después de hacer cambios en el código de mapeo.

## Caso de Uso

Cuando haces cambios en el código de mapeo (por ejemplo, mejoras en `feature_extractor_v3.py` o `auto_learning_engine_v3.py`), quieres ver cómo esos cambios afectan el mapeo de una tarea existente sin crear una nueva tarea desde cero.

## Endpoints Disponibles

### 1. Ver Estado y Estadísticas de una Tarea

**GET** `/api/likewize/v3/tareas/<tarea_id>/estado/`

Muestra el estado actual de la tarea con estadísticas detalladas de mapeo.

#### Ejemplo de Uso:

```bash
GET /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/estado/
```

#### Response:

```json
{
  "success": true,
  "task": {
    "tarea_id": "97ad1196-02f1-4a35-8d62-c27aacfabb1b",
    "estado": "SUCCESS",
    "iniciado_en": "2025-10-05T10:30:00Z",
    "finalizado_en": "2025-10-05T10:45:00Z",
    "mapping_stats": {
      "total": 751,
      "mapped": 732,
      "unmapped": 19,
      "mapping_rate": "97.47%",
      "by_type": [
        {
          "tipo": "iPad Pro",
          "total": 105,
          "mapped": 105,
          "unmapped": 0,
          "mapping_rate": "100.00%"
        },
        {
          "tipo": "iPhone",
          "total": 95,
          "mapped": 95,
          "unmapped": 0,
          "mapping_rate": "100.00%"
        },
        {
          "tipo": "Unknown",
          "total": 349,
          "mapped": 330,
          "unmapped": 19,
          "mapping_rate": "94.56%"
        }
      ],
      "unmapped_anumbers": {
        "A3112": 3,
        "A3185": 8,
        "A3186": 8
      }
    }
  }
}
```

---

### 2. Re-Mapear Toda la Tarea con Código Actualizado

**POST** `/api/likewize/v3/tareas/<tarea_id>/remapear-completo/`

Re-mapea **TODOS** los items de la tarea (incluso los ya mapeados) usando el código de mapeo actualizado.

#### Parámetros (Body JSON):

```json
{
  "clear_knowledge_base": false,  // Opcional: limpiar KB antes de re-mapear (default: false)
  "disable_learning": true        // Opcional: deshabilitar aprendizaje automático (default: true)
}
```

**Recomendación**: Usar `disable_learning: true` para evitar que el knowledge base se contamine con mapeos temporales durante las pruebas.

#### Ejemplo de Uso:

```bash
POST /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/remapear-completo/

Body:
{
  "disable_learning": true,
  "clear_knowledge_base": false
}
```

#### Response:

```json
{
  "success": true,
  "tarea_id": "97ad1196-02f1-4a35-8d62-c27aacfabb1b",
  "stats_before": {
    "total": 751,
    "mapped": 708,
    "unmapped": 43,
    "mapping_rate": "94.27%"
  },
  "stats_after": {
    "total": 751,
    "mapped": 732,
    "unmapped": 19,
    "mapping_rate": "97.47%"
  },
  "changes": {
    "total_changed": 24,
    "improved": 24,
    "worsened": 0,
    "remapped": 0
  },
  "knowledge_base_cleared": 0,
  "disable_learning": true,
  "details": [
    {
      "modelo_raw": "iPad Air 5 Wi-Fi 256GB",
      "before": "iPad Air (6.ª generación) Wifi - 256 GB",
      "after": "iPad Air (5.ª generación) Wi-Fi - 256 GB",
      "change_type": "remapped",
      "confidence": "0.85",
      "strategy": "traditional_learned"
    },
    {
      "modelo_raw": "MacBook Pro M4 14-inch 512GB",
      "before": null,
      "after": "MacBook Pro (14 pulgadas, 2024) M4 - 512 GB",
      "change_type": "improved",
      "confidence": "0.95",
      "strategy": "a_number_match"
    }
  ],
  "total_details_shown": 100,
  "total_details_available": 24
}
```

#### Tipos de Cambios:

- **`improved`**: Item que NO estaba mapeado ahora SÍ mapea (✅ mejora)
- **`worsened`**: Item que SÍ estaba mapeado ahora NO mapea (❌ empeora)
- **`remapped`**: Item que cambió de un mapeo a otro diferente (⚠️ puede ser mejora o empeora)

---

### 3. Ver Items No Mapeados

**GET** `/api/likewize/v3/tareas/<tarea_id>/no-mapeados/`

Lista todos los items que no pudieron ser mapeados.

#### Ejemplo de Uso:

```bash
GET /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/no-mapeados/
```

#### Response:

```json
{
  "success": true,
  "tarea_id": "97ad1196-02f1-4a35-8d62-c27aacfabb1b",
  "total_unmapped": 19,
  "items": [
    {
      "id": 12345,
      "modelo_raw": "MacBookPro16 1 M4 10 Core CPU 10 Core GPU 14 inch A3112 10/2024 512GB SSD",
      "modelo_norm": "MacBookPro16",
      "marca": "Apple",
      "tipo": "Unknown",
      "almacenamiento_gb": 512,
      "precio_b2b": "1200.00",
      "likewize_model_code": "ABC123"
    }
  ]
}
```

---

## Flujo de Trabajo Recomendado

### Escenario: Mejoraste el código de mapeo y quieres verificar si funciona

1. **Ver estado actual de la tarea**:

```bash
GET /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/estado/
```

Esto te muestra el mapping rate actual (ej: 94.27%) y qué tipos de dispositivos están fallando.

2. **Hacer cambios en el código** (por ejemplo, en `feature_extractor_v3.py` o `auto_learning_engine_v3.py`)

3. **Re-mapear la tarea completa**:

```bash
POST /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/remapear-completo/

Body: {"disable_learning": true}
```

Esto te retorna:
- Estadísticas antes/después
- Cuántos items mejoraron, empeoraron o cambiaron
- Lista detallada de los primeros 100 cambios

4. **Verificar el resultado**:

```bash
GET /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/estado/
```

Ahora verás el nuevo mapping rate (ej: 97.47%). Si mejoró, ¡tu cambio funcionó! ✅

5. **Ver qué sigue sin mapear**:

```bash
GET /api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/no-mapeados/
```

Esto te muestra los items que aún faltan. Puedes analizar los A-numbers y añadir los modelos faltantes a la BD.

---

## Ejemplo Completo con curl

```bash
# 1. Ver estado actual
curl -X GET "https://progeek.es/api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/estado/" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Re-mapear después de cambios
curl -X POST "https://progeek.es/api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/remapear-completo/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disable_learning": true, "clear_knowledge_base": false}'

# 3. Ver items que siguen sin mapear
curl -X GET "https://progeek.es/api/likewize/v3/tareas/97ad1196-02f1-4a35-8d62-c27aacfabb1b/no-mapeados/" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Notas Importantes

### ⚠️ Sobre `disable_learning`

**Recomendación**: Siempre usar `"disable_learning": true` cuando estés probando cambios en el código.

- Con `disable_learning: true`: El knowledge base NO se actualiza durante el re-mapeo. Esto evita contaminar el KB con mapeos temporales mientras pruebas.
- Con `disable_learning: false`: El sistema aprenderá de los mapeos y los guardará en el knowledge base. Úsalo solo cuando estés seguro de que los cambios son finales.

### 📊 Límite de Detalles

El endpoint de re-mapeo retorna un máximo de **100 items en `details`** para evitar respuestas demasiado grandes. Si tuviste más cambios, el campo `total_details_available` te dirá cuántos fueron en total.

### 🔍 Validación de Mejoras

Usa los campos `changes.improved`, `changes.worsened` y `changes.remapped` para evaluar rápidamente si tus cambios mejoraron el mapeo:

- **Mejora clara**: `improved > 0` y `worsened = 0`
- **Empeoramiento**: `worsened > 0`
- **Cambios laterales**: `remapped > 0` (necesitas revisar manualmente si son mejoras)

---

## Ejemplo de Uso Real

```bash
# Escenario: Añadiste filtro por generación para iPad Air

# 1. Ver estado antes
GET /api/likewize/v3/tareas/504fca69-9ae1-457a-91f8-0aa60dde0f39/estado/
# Resultado: 94.27% mapped (708/751)

# 2. Re-mapear con tu código actualizado
POST /api/likewize/v3/tareas/504fca69-9ae1-457a-91f8-0aa60dde0f39/remapear-completo/
Body: {"disable_learning": true}

# Resultado:
# - improved: 6 (iPad Air 3/4/5 ahora mapean correctamente)
# - worsened: 0
# - mapping_rate: 97.47% (mejora de 3.2%)

# 3. Ver qué sigue sin mapear
GET /api/likewize/v3/tareas/504fca69-9ae1-457a-91f8-0aa60dde0f39/no-mapeados/
# Resultado: Solo MacBook Pro M4 (A3112, A3185, A3186) - modelos que no existen en BD
```

✅ **Conclusión**: Tu cambio mejoró el mapeo de 94.27% a 97.47%. Los únicos items sin mapear son modelos que faltan en la BD.
