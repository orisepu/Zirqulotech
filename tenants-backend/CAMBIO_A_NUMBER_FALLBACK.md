# Cambio: NO mapear a otro A-number cuando el modelo existe

## Problema Reportado

**Input**: Mac mini M2 Pro 12-core/19-core **A2816** 8TB
**Resultado anterior**: Mapeaba a **A2686** (A-number diferente) con 70% confidence
**Problema**: El sistema encontraba el modelo A2816 pero como no tenía 8TB, caía al fallback de GenerationMatcher que encontraba A2686

## Regla Implementada

**"Si con A-number encuentra el modelo pero falta la capacidad, NUNCA debe ir a otro A-number diferente"**

## Comportamiento Anterior

```
1. ANumberMatcher busca A2816 → encuentra modelo
2. Busca capacidad 8TB → no existe
3. Cae a GenerationMatcher (fallback)
4. GenerationMatcher encuentra A2686 con 8TB
5. Mapea a A2686 ✗ (A-number DIFERENTE)
```

## Comportamiento Nuevo (Correcto)

```
1. ANumberMatcher busca A2816 → encuentra modelo
2. Busca capacidad 8TB → no existe
3. Como el modelo existe → NO usa GenerationMatcher
4. Retorna NO_MATCH con needs_capacity_creation=True
5. Sugiere crear 8TB para los modelos A2816 encontrados
```

## Cambios en Código

### `/srv/checkouters/Partners/tenants-backend/productos/mapping/engines/macbook_engine.py`

**Antes** (líneas 194-202):
```python
# Si A-number no encontró nada, usar GenerationMatcher como fallback
if not candidates:
    context.info("Usando GenerationMatcher como fallback")
    candidates = self.generation_matcher.find_candidates(features, context)
    # ...
```

**Después** (líneas 194-213):
```python
# Si A-number no encontró candidatos, verificar si el modelo existe
# REGLA IMPORTANTE: Si el modelo con A-number existe pero falta capacidad,
# NO caer a GenerationMatcher (para evitar mapear a otro A-number diferente)
model_exists_but_no_capacity = context.metadata.get('model_found_by_a_number', False)

if not candidates and not model_exists_but_no_capacity:
    # Solo usar GenerationMatcher si NO encontramos el modelo con A-number
    context.info("Usando GenerationMatcher como fallback (modelo con A-number NO existe)")
    candidates = self.generation_matcher.find_candidates(features, context)
    # ...
elif not candidates and model_exists_but_no_capacity:
    # El modelo existe pero falta la capacidad → NO usar GenerationMatcher
    context.warning(
        f"⚠️ Modelo con A-number {features.a_number} existe pero falta capacidad. "
        f"NO se usará GenerationMatcher para evitar mapear a otro A-number diferente."
    )
```

## Casos de Prueba

### ✅ Caso 1: A-number NO existe → Usa GenerationMatcher
**Input**: MacBook Air 15" M3 **A9999** 512GB (A9999 no existe en BD)
**Resultado**: ✓ Usa GenerationMatcher, mapea a modelo similar

### ✅ Caso 2: A-number existe, falta capacidad → NO usa GenerationMatcher
**Input**: Mac mini M2 Pro **A2816** 8TB (A2816 existe, falta 8TB)
**Resultado**: ✓ NO usa GenerationMatcher, sugiere crear capacidad para A2816

### ✅ Caso 3: Sin A-number → Usa GenerationMatcher
**Input**: MacBook Pro 13" M2 1TB (sin A-number en el string)
**Resultado**: ✓ Usa GenerationMatcher directamente

### ✅ Caso 4: A-number existe con capacidad → Mapea correctamente
**Input**: Mac mini M2 Pro **A2816** 512GB (A2816 existe con 512GB)
**Resultado**: ✓ Mapea con ANumberMatcher a 85% confidence

## Metadata Tracking

El sistema ahora rastrea en el contexto:
- `model_found_by_a_number`: True si se encontró el modelo con A-number
- `model_ids_found`: IDs de los modelos encontrados (para sugerir capacidad)
- `capacity_missing_for_model`: True si el modelo existe pero falta la capacidad

Esta metadata es usada por:
1. **MacEngine**: Para decidir si usar GenerationMatcher
2. **V3CompatibilityAdapter**: Para construir sugerencias de capacidad con `model_ids`

## Archivos de Prueba Creados

1. `test_no_fallback_a_number.py` - Verifica que NO cae a otro A-number
2. `test_fallback_cases.py` - Verifica los 4 casos de fallback
3. `test_512gb_investigation.py` - Investiga el caso 512GB
4. `test_512gb_with_filters.py` - Trace completo con filtros

## Resultado Final

Ahora el sistema:
- ✅ Prioriza A-number (85% confidence) sobre Generation (70%)
- ✅ NO mapea a otro A-number cuando el modelo correcto existe
- ✅ Sugiere crear capacidad con `model_ids` específicos
- ✅ Mantiene el fallback a GenerationMatcher cuando el A-number NO existe
- ✅ Evita matches incorrectos que mezclaban A-numbers diferentes

## Siguiente Paso

Remapear la tarea `3611e4a5-b20b-4fdf-ab19-ec1dd78878a6` para verificar que ahora sugiere crear capacidad para A2816 en lugar de mapear a A2686.
