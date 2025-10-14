# Fix: Filtro de Modelos Samsung No Europeos

## Problema Identificado

El sistema de importación de precios de Likewize estaba importando variantes regionales **NO europeas** de modelos Samsung (USA, Canadá, Corea, China, etc.), que no deberían estar en el catálogo español.

### Análisis del Problema

**Tarea afectada**: `a9c6c33b-2fd2-43a5-8127-c2d797c16eac`
- **Total modelos Samsung**: 577
- **Modelos NO europeos detectados**: 253 (43.8%)
- **Variantes encontradas**:
  - 65 modelos USA (sufijo U)
  - 63 modelos USA unlocked (sufijo U1)
  - 52 modelos Canadá (sufijo W)
  - 65 modelos Corea (sufijo N)
  - 3 modelos China Qualcomm (sufijo Q)
  - 5 modelos Verizon (sufijo V)

### Causa Raíz

El filtro en AMBOS comandos (`actualizar_likewize.py` y `actualizar_likewize_v3.py`) usaba coincidencia exacta:

```python
# ❌ ANTES (NO FUNCIONABA) - actualizar_likewize_v3.py:360
if item.get('M_Model') not in exclude_list

# ❌ ANTES (NO FUNCIONABA) - actualizar_likewize.py:1498
if excluded_m_models and (m_model_upper in excluded_m_models or m_model_suffix in excluded_m_models):
    continue
```

**Problema**: El campo `M_Model` de Likewize contiene el nombre completo:
- Valor real: `"Galaxy Note10 Plus 5G SM-N976U"`
- Lista de exclusión: `["SM-N976U", ...]`
- Resultado: **NO hace match** (busca string completo, no substring)

**Descubrimiento crítico**: El sistema tiene DOS comandos separados para actualización de Likewize. El fix inicial solo se aplicó a `actualizar_likewize_v3.py`, pero el comando que se estaba usando en producción era `actualizar_likewize.py`, por lo que el problema persistía.

## Solución Implementada

### 1. Filtro por Substring Matching

Modificado el filtro para buscar el código **dentro** del string completo:

```python
# ✅ AHORA (FUNCIONA)
def should_exclude_item(item):
    m_model = item.get('M_Model', '')
    model_name = item.get('ModelName', '')
    full_name = item.get('FullName', '')

    # Buscar si algún código excluido aparece en cualquiera de los campos
    for excluded_code in exclude_list:
        if (excluded_code in m_model or
            excluded_code in model_name or
            excluded_code in full_name):
            return True
    return False
```

### 2. Filtro Adicional por Regex

Agregado patrón regex para detectar automáticamente variantes regionales:

```python
# Detecta códigos Samsung con sufijos regionales NO europeos
NON_EUROPEAN_SAMSUNG_PATTERN = re.compile(
    r'SM-[A-Z]\d+[NUWVQ](?:1)?(?:\s|$)',
    re.IGNORECASE
)
```

**Sufijos detectados**:
- `U` / `U1`: Estados Unidos
- `W`: Canadá
- `N`: Corea del Sur
- `Q`: China (Qualcomm)
- `V`: Verizon (USA)

**Sufijos europeos permitidos** (NO filtrados):
- `F`: Europa (genérico)
- `B`: Europa (dual SIM)
- `DS`: Dual SIM europeo

### 3. Logging Mejorado

Agregado logging detallado para Samsung:

```python
logger.info(
    f"Samsung: {explicit_filtered} filtrados por lista explícita, "
    f"{pattern_filtered} por patrón regex (variantes regionales)"
)
```

## Archivos Modificados

### 1. `/tenants-backend/productos/management/commands/actualizar_likewize.py` (COMANDO PRINCIPAL)

**Cambios**:
- **Líneas 1498-1516**: Reemplazado filtro con substring matching en loop
  - Cambiado de `if m_model_upper in excluded_m_models` (exact match)
  - A loop con `if excluded_code in m_model_upper` (substring match)
  - Agregados comentarios explicando el bug original
- **Líneas 1408-1417**: Patrón regex automático para Samsung
  - Agregado `samsung_non_eu_pattern` al array `excluded_m_model_patterns`
  - Se aplica automáticamente cuando `marca_por_defecto == 'Samsung'`
  - Detecta sufijos NO europeos: U/U1/W/N/Q/V

**Ubicación del cambio**: Método principal de procesamiento de items

### 2. `/tenants-backend/productos/management/commands/actualizar_likewize_v3.py`

**Cambios**:
- **Línea 5**: Agregado `import re`
- **Líneas 355-442**: Reemplazado filtro de exclusión completo
  - Nueva función `should_exclude_item()` con búsqueda por substring
  - Patrón regex para Samsung: `NON_EUROPEAN_SAMSUNG_PATTERN`
  - Logging detallado con estadísticas de filtrado

**Ubicación del cambio**: Método `_fetch_preset_data()`

### 3. `/tenants-backend/test_samsung_filter_simple.py` (NUEVO)

Script de prueba independiente para validar el filtro.

**Resultados del test**:
```
✅ 16/16 tests pasaron (100.0%)
- 10 variantes NO europeas correctamente excluidas
- 6 variantes europeas correctamente incluidas
```

## Testing

### Script de Validación

```bash
python3 test_samsung_filter_simple.py
```

### Casos de Prueba

| Modelo | Región | Esperado | Resultado | Filtro |
|--------|--------|----------|-----------|--------|
| SM-N976U | USA | Excluir | ✅ Excluido | Lista explícita |
| SM-G973U1 | USA Unlocked | Excluir | ✅ Excluido | Lista explícita |
| SM-G973W | Canadá | Excluir | ✅ Excluido | Lista explícita |
| SM-N971N | Corea | Excluir | ✅ Excluido | Lista explícita |
| SM-G988Q | China | Excluir | ✅ Excluido | Lista explícita |
| SM-N975F | Europa | Incluir | ✅ Incluido | - |
| SM-G973F | Europa | Incluir | ✅ Incluido | - |
| SM-G781B | Europa | Incluir | ✅ Incluido | - |

## Resultado Esperado

### Antes del Fix
- **Total Samsung**: 577 modelos
- **NO europeos**: 253 modelos (43.8%)
- **Europeos**: 324 modelos (56.2%)

### Después del Fix
- **Total Samsung**: ~324 modelos (solo europeos)
- **NO europeos**: 0 modelos (filtrados correctamente)
- **Reducción**: 253 modelos filtrados

### Beneficios
1. ✅ Solo precios de modelos europeos en el catálogo
2. ✅ Evita confusión con precios de mercados USA/Asia
3. ✅ Mejora la precisión del sistema de precios B2B
4. ✅ Filtrado automático con doble capa (lista + regex)

## Próximos Pasos

1. **Ejecutar nueva actualización**: Crear nueva tarea de importación con el filtro corregido
2. **Verificar staging**: Confirmar que solo modelos europeos llegan al staging
3. **Comparar resultados**: Comparar tarea antigua vs nueva
4. **Aplicar cambios**: Una vez validado, aplicar precios europeos a producción

## Comandos

### Ejecutar Test
```bash
python3 test_samsung_filter_simple.py
```

### Ejecutar Nueva Actualización (cuando esté listo)
```bash
# Comando principal (actualizar_likewize.py)
env/bin/python manage.py actualizar_likewize --mode=others --brands Samsung

# Comando alternativo v3 (actualizar_likewize_v3.py)
env/bin/python manage.py actualizar_likewize_v3 --mode=others --brands Samsung
```

### Verificar Staging de Tarea
```bash
env/bin/python manage.py shell -c "
from productos.models import LikewizeItemStaging
import re

tarea_id = '<NUEVA_TAREA_ID>'
samsung = LikewizeItemStaging.objects.filter(tarea_id=tarea_id, marca='Samsung')

# Verificar si hay modelos con sufijos NO europeos
pattern = re.compile(r'SM-[A-Z]\d+[NUWVQ](?:1)?')
non_eu = 0
for item in samsung:
    if pattern.search(item.likewize_model_code):
        non_eu += 1
        print(f'Encontrado NO europeo: {item.likewize_model_code}')

print(f'Total Samsung: {samsung.count()}')
print(f'NO europeos encontrados: {non_eu}')
print(f'Europeos: {samsung.count() - non_eu}')
"
```

## Notas Técnicas

### Patrones de Nomenclatura Samsung

Samsung usa sufijos regionales en sus códigos de modelo:

**Formato**: `SM-{SERIE}{MODELO}{REGION}`
- Ejemplo europeo: `SM-G973F` (Galaxy S10, Europa)
- Ejemplo USA: `SM-G973U` (Galaxy S10, USA)

**Sufijos por región**:
- `F`: Europa (Francia base)
- `B`: Europa (dual SIM)
- `U`: USA (carrier locked)
- `U1`: USA (unlocked)
- `W`: Canadá
- `N`: Corea del Sur
- `Q`: China (Qualcomm)
- `V`: Verizon (USA)
- `J`: Japón

### Modelos Europeos Válidos

Los modelos europeos **siempre** terminan en:
- `F`, `B`, `DS` (Dual SIM), `FD` (Francia dual SIM)
- **NUNCA** en: `U`, `U1`, `W`, `N`, `Q`, `V`, `J`

### Performance del Filtro

- **Lista explícita**: O(n*m) donde n=items, m=lista exclusión (~61 modelos)
- **Regex pattern**: O(n) con compilación previa del patrón
- **Impacto**: Mínimo (< 1 segundo para 1000+ modelos)

## Referencias

- **Tareas afectadas**:
  - `a9c6c33b-2fd2-43a5-8127-c2d797c16eac` (primera detección del problema)
  - `9b4ed05e-72ef-43aa-bae7-72766e17409e` (problema persistente)
  - `676a67ec-9d30-42c7-86f7-59aa6148d316` (post-fix parcial, problema aún presente)
- **Archivos principales**:
  - `productos/management/commands/actualizar_likewize.py` (comando principal)
  - `productos/management/commands/actualizar_likewize_v3.py` (comando alternativo)
- **Configuración**: `productos/likewize_config.py`
- **Test**: `test_samsung_filter_simple.py`

---

**Fecha**: 14 Octubre 2025
**Versión**: 2.0 (fix completo en ambos comandos)
