# Fix: Mac mini A2816 Capacidad Assignment

## Problem

Capacidades for Mac mini A2816 are assigned to the wrong model, causing mapping failures.

## Current State

### Model 1527 - Mac mini (2023) A2816 M2 10 Core CPU 16 Core GPU
- **Variant**: M2 base
- **Cores**: 10 CPU / 16 GPU
- **Capacidades**: **0** ❌

### Model 1531 - Mac mini (2023) A2816 M2 Pro 12 Core CPU 19 Core GPU
- **Variant**: M2 Pro
- **Cores**: 12 CPU / 19 GPU
- **Capacidades**: 4 (256GB, 512GB, 1TB, 2TB) ✓

## Problem Explanation

When Likewize sends:
```
Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD
```

The system:
1. Extracts: chip=M2 base, cpu_cores=10, gpu_cores=16, storage=512GB
2. ANumberMatcher finds model 1531 (M2 Pro) with 512GB
3. ChipVariantFilter CORRECTLY eliminates it: "M2 Pro ≠ M2 base"
4. No candidates remain
5. Suggests creating capacity for model 1527 (correct behavior given the data)

## Solution Options

### Option 1: Move Capacidades from Model 1531 to Model 1527 (RECOMMENDED)

The 256GB, 512GB, 1TB, 2TB capacidades currently on model 1531 (M2 Pro) should be on model 1527 (M2 base).

**SQL to fix**:
```sql
-- Update capacidades to point to model 1527 instead of 1531
UPDATE capacidad
SET modelo_id = 1527
WHERE modelo_id = 1531
AND tamaño IN ('256 GB', '512 GB', '1 TB', '2 TB');
```

Then add higher capacities for model 1531 (M2 Pro) if needed (4TB, 8TB).

### Option 2: Fix Model 1531 Description

Change model 1531 description from "M2 Pro" to "M2":
```sql
UPDATE modelo
SET descripcion = 'Mac mini (2023) A2816 M2 10 Core CPU 16 Core GPU'
WHERE id = 1531;
```

But this loses the M2 Pro variant distinction, which is valuable.

### Option 3: Create New Capacidades for Model 1527

Add capacidades to model 1527:
```python
# Via Django shell
from productos.models.modelos import Modelo, Capacidad

modelo_1527 = Modelo.objects.get(id=1527)

for size in ['256 GB', '512 GB', '1 TB', '2 TB']:
    Capacidad.objects.create(
        modelo=modelo_1527,
        tamaño=size,
        activo=True
    )
```

## Recommendation

Use **Option 1** - move the capacidades from 1531 to 1527. This:
- Fixes the immediate 512GB mapping issue
- Maintains model variant accuracy (M2 vs M2 Pro)
- Allows adding higher capacities (4TB, 8TB) to M2 Pro model later

## Testing After Fix

Run:
```bash
python test_capacity_suggestion.py
```

Expected results after fix:
- ✓ Mac mini M2 base 512GB → Maps to model 1527, capacidad 512GB
- ✓ Mac mini M2 Pro 8TB → Suggests creating 8TB capacity for model 1531
- ✓ Mac mini M2 base 8TB → Suggests creating 8TB capacity for model 1527

## Related Models

- **Model 1528**: Mac mini (2023) A2816 M2 Pro 12 Core CPU 19 Core GPU - 0 capacidades (duplicate of 1531?)
- Consider consolidating models 1528 and 1531 if they're the same device
