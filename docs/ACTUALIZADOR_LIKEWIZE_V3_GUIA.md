# Sistema de Actualización de Precios Likewize V3: Guía Técnica Completa

## Introducción: El Problema que Resuelve

Imagina que trabajas con un catálogo de 1000+ dispositivos móviles (iPhones, iPads, MacBooks, dispositivos Android) y necesitas mantener tus precios de compra sincronizados con Likewize, tu proveedor mayorista. Likewize actualiza precios regularmente: algunos suben, otros bajan, aparecen modelos nuevos (iPhone 16 Pro Max), y se descatalogizan modelos antiguos.

El desafío tradicional (V1/V2) era simple pero ineficiente: **procesar todo el catálogo cada vez**, incluso cuando solo 10 de esos 1000 dispositivos habían cambiado. Esto significaba:
- 10-15 minutos de tiempo de procesamiento
- Procesamiento redundante de dispositivos sin cambios
- Carga innecesaria en la base de datos
- Imposibilidad de actualizar frecuentemente (solo 1-2 veces/semana)

**Likewize V3 introduce la Actualización Inteligente (Incremental)**: un sistema que detecta exactamente qué cambió y procesa solo esos cambios. En lugar de procesar 1000 dispositivos, procesa 10. En lugar de 15 minutos, tarda 2-3 minutos. Esto permite actualizaciones diarias.

---

## Actualización Inteligente (Incremental): El Corazón del Sistema

### ¿Qué es la Actualización Incremental?

La actualización incremental es un algoritmo de detección de cambios que compara el catálogo actual de Likewize con tu base de datos histórica para identificar **solo lo que cambió**. En lugar de procesar todos los dispositivos, identifica tres categorías:

1. **Dispositivos Nuevos**: Aparecieron en Likewize pero no existen en tu base de datos
2. **Dispositivos Modificados**: Existen en ambos lugares pero sus atributos cambiaron (precio, stock, condición)
3. **Dispositivos Eliminados**: Están en tu base de datos pero desaparecieron de Likewize (descatalogados)

### ¿Por Qué es "Inteligente"?

La inteligencia radica en tres pilares:

**1. Detección Eficiente mediante Signatures (Firmas Digitales)**

El sistema genera un "hash criptográfico" (SHA-256) único para cada dispositivo basado en sus atributos clave. Piensa en esto como una huella digital del dispositivo:

```
Dispositivo: iPhone 15 Pro 256GB Grade A+ Unlocked A3108
Atributos clave: tipo=iPhone | marca=Apple | modelo=15 Pro | storage=256GB | grade=A+ | a_number=A3108
Signature: a7f3c9d2e8b1... (hash SHA-256 de 64 caracteres)
```

Si mañana Likewize cambia el precio o la condición de este iPhone, su signature será diferente:

```
Dispositivo: iPhone 15 Pro 256GB Grade A Unlocked A3108  (cambió de A+ a A)
Nueva Signature: b2e9f1c4d7a3... (hash completamente diferente)
```

Esta diferencia en la signature es la **señal de cambio** que dispara el procesamiento.

**2. Ventana Temporal Inteligente (48 horas)**

El sistema no compara contra todo el historial de tu base de datos (años de datos). Solo compara contra mappings creados/actualizados en las **últimas 48 horas**. Esto asume que:

- Si un dispositivo fue mapeado hace 2 días o menos, su mapeo sigue siendo válido
- Los cambios en Likewize (precios, stock) se reflejan en actualizaciones recientes
- Dispositivos sin actividad en 48h probablemente no cambiaron

Esta heurística reduce drásticamente el universo de comparación.

**3. Sistema de Caché de Mapeos Validados (Knowledge Base)**

Cuando un operador humano corrige o valida un mapeo, el sistema lo guarda en una base de conocimiento (caché de mapeos validados):

```python
LikewizeKnowledgeBase.objects.create(
    tipo="iPhone",
    marca="Apple",
    modelo_likewize="iPhone 15 Pro Max 256GB Unlocked",
    modelo_interno_id=42,  # Mapeo validado manualmente
    confidence_score=0.95,  # Alta confianza por validación humana
    validation_count=1
)
```

En la próxima actualización incremental, si ese mismo modelo aparece (nueva condición o precio), el sistema reutiliza el mapeo ya validado en lugar de ejecutar nuevamente el algoritmo de matching. Esto mejora velocidad y precisión.

### Algoritmo de Detección de Cambios: Paso a Paso

Veamos cómo funciona internamente cuando ejecutas una actualización incremental:

**Paso 1: Scraping de Likewize**

El sistema obtiene el catálogo actual de Likewize (vía scraping o API):

```python
# Resultado del scraping (simplificado)
likewize_catalog = [
    {
        'tipo': 'iPhone',
        'marca': 'Apple',
        'modelo': 'iPhone 15 Pro 256GB',
        'almacenamiento_gb': 256,
        'a_number': 'A3108',
        'grado': 'A+',
        'precio': 850.00
    },
    {
        'tipo': 'iPad',
        'marca': 'Apple',
        'modelo': 'iPad Pro 11" M2 128GB',
        'almacenamiento_gb': 128,
        'a_number': 'A2759',
        'grado': 'A',
        'precio': 620.00
    },
    # ... 998 dispositivos más
]
```

**Paso 2: Generación de Signatures para Staging**

Para cada dispositivo scraped, se genera una signature:

```python
def _generate_device_signature(self, device):
    key_parts = [
        device['tipo'],
        device['marca'],
        device['modelo'],
        str(device['almacenamiento_gb']),
        device['a_number'],
        device['grado']
    ]
    signature_string = '|'.join(key_parts)
    # Ejemplo: "iPhone|Apple|iPhone 15 Pro 256GB|256|A3108|A+"
    return hashlib.sha256(signature_string.encode()).hexdigest()
```

Resultado:
```python
staging_signatures = {
    'a7f3c9d2e8b1f4a5c3d7e9b2f1a8c4d6': {  # iPhone 15 Pro
        'tipo': 'iPhone',
        'modelo': 'iPhone 15 Pro 256GB',
        'precio': 850.00,
        # ... resto de datos
    },
    'b2e9f1c4d7a3c8e5b1f9d4a7c2e8b3f5': {  # iPad Pro
        'tipo': 'iPad',
        'modelo': 'iPad Pro 11" M2 128GB',
        'precio': 620.00,
        # ... resto de datos
    },
    # ... 998 signatures más
}
```

**Paso 3: Generación de Signatures para Base de Datos Existente**

Ahora el sistema lee tus mappings existentes (creados en las últimas 48h) y genera sus signatures:

```python
existing_mappings = DeviceMapping.objects.filter(
    tenant_id=tenant_id,
    created_at__gte=cutoff_date  # Últimas 48 horas
).select_related('device_model')

existing_signatures = {}
for mapping in existing_mappings:
    signature = self._generate_mapping_signature(mapping)
    existing_signatures[signature] = mapping
```

Resultado:
```python
existing_signatures = {
    'a7f3c9d2e8b1f4a5c3d7e9b2f1a8c4d6': <DeviceMapping: iPhone 15 Pro 256GB>,  # Mismo iPhone
    'c3f7a9e2d1b4c8f5a7e3d9b1f4c2a8e6': <DeviceMapping: MacBook Air M2 256GB>,  # MacBook que ya no está en Likewize
    # ... otros mappings
}
```

**Paso 4: Comparación y Clasificación**

El sistema compara ambos conjuntos de signatures:

```python
def _detect_changes(self, tarea_id, force_full_update=False):
    if force_full_update:
        # Actualización completa: procesar todo el staging
        return {
            'new': list(staging_signatures.keys()),
            'modified': [],
            'removed': []
        }

    # Actualización incremental: detectar diferencias
    staging_sigs = set(staging_signatures.keys())
    existing_sigs = set(existing_signatures.keys())

    changes = {
        'new': list(staging_sigs - existing_sigs),        # En staging pero no en DB
        'modified': list(staging_sigs & existing_sigs),   # En ambos (puede que precios cambien)
        'removed': list(existing_sigs - staging_sigs)     # En DB pero no en staging
    }

    return changes
```

Ejemplo de resultado:

```python
changes = {
    'new': [
        'f9d4a7c2e8b3f5a1c7e9d2b4f8a3c6e1',  # iPhone 16 Pro (modelo nuevo)
        'd2b4f8a3c6e1f9d4a7c2e8b3f5a1c7e9'   # Samsung Galaxy S24 Ultra (nuevo)
    ],
    'modified': [
        'b2e9f1c4d7a3c8e5b1f9d4a7c2e8b3f5'   # iPad Pro (precio cambió de 620€ a 610€)
    ],
    'removed': [
        'c3f7a9e2d1b4c8f5a7e3d9b1f4c2a8e6'   # MacBook Air M2 (descatalogado)
    ]
}
```

**Paso 5: Procesamiento Selectivo**

Solo los dispositivos en `new` y `modified` se procesan con el sistema de mapeo:

```python
def _process_changes(self, changes, tarea_id):
    mapping_results = []

    # Procesar solo nuevos y modificados
    items_to_process = changes['new'] + changes['modified']

    for signature in items_to_process:
        staging_item = staging_signatures[signature]

        # Intentar usar knowledge base (caché de mapeos validados)
        cached_mapping = self._get_from_knowledge_base(staging_item)

        if cached_mapping:
            # Mapeo ya conocido, reutilizar
            result = self._apply_cached_mapping(staging_item, cached_mapping)
        else:
            # Nuevo dispositivo, ejecutar algoritmos de matching
            result = self.mapping_service.map_device(staging_item)

        mapping_results.append(result)

    return mapping_results
```

**Paso 6: Invalidación de Dispositivos Removidos**

Los dispositivos en `removed` se marcan como obsoletos:

```python
def _invalidate_removed_devices(self, changes):
    removed_sigs = changes['removed']
    invalidated = []

    for signature in removed_sigs:
        mapping = existing_signatures[signature]
        mapping.is_active = False
        mapping.removal_reason = "Descatalogado en Likewize"
        mapping.save()
        invalidated.append(mapping)

    return invalidated
```

### Ventajas vs Actualización Completa

| Aspecto | Actualización Completa | Actualización Incremental |
|---------|------------------------|---------------------------|
| **Dispositivos procesados** | 1000 (todos) | 8-50 (solo cambios) |
| **Tiempo de ejecución** | 10-15 minutos | 30 segundos - 2 minutos |
| **Algoritmos ejecutados** | 1000 | 8-50 (con cache, aún menos) |
| **Frecuencia recomendada** | 1-2 veces/semana | Diaria o múltiple/día |
| **Carga en BD** | Alta (1000 inserts/updates) | Baja (8-50 inserts/updates) |
| **Uso de cache** | No aplica | Reutiliza mappings validados |
| **Cuándo usar** | Cambio de proveedor, migración, reset completo | Operación normal diaria |

---

## Flujo Completo de una Actualización V3

Veamos el journey completo desde que un usuario hace clic en el botón "Actualizar Precios V3":

### **Fase 1: Configuración e Inicio**

**Frontend (EnhancedLikewizePage.tsx)**

```typescript
// Usuario activa el switch "Modo Incremental"
const [incrementalMode, setIncrementalMode] = useState(true);

// Usuario hace clic en "Actualizar Apple"
const handleUpdateApple = async () => {
    const result = await actualizarLikewizeAPI({
        tenant_id: currentTenant.id,
        incremental: incrementalMode,  // true = incremental
        tipos: ['iPhone', 'iPad', 'MacBook', 'Apple Watch']
    });

    // Poll para obtener progreso en tiempo real
    pollTaskStatus(result.task_id);
};
```

**Backend (views/actualizador.py)**

```python
@api_view(['POST'])
def actualizar_likewize(request):
    tenant_id = request.data.get('tenant_id')
    incremental = request.data.get('incremental', False)
    tipos = request.data.get('tipos', [])

    # Crear tarea de actualización
    tarea = LikewizePriceUpdateTask.objects.create(
        tenant_id=tenant_id,
        task_type='incremental' if incremental else 'full',
        status='pending',
        device_types=tipos
    )

    # Lanzar procesamiento asíncrono
    process_likewize_update.delay(tarea.id, incremental)

    return Response({'task_id': tarea.id})
```

### **Fase 2: Scraping de Likewize**

**Servicio de Scraping (scraper_service.py)**

```python
def scrape_likewize_catalog(tipos):
    """
    Scraping del catálogo de Likewize (simplificado)
    En producción, esto implica:
    - Login a portal Likewize
    - Navegación por categorías
    - Extracción de precios, stock, condiciones
    """
    scraped_items = []

    for tipo in tipos:
        # Ejemplo: scraping de iPhones
        if tipo == 'iPhone':
            items = scrape_iphone_category()
            scraped_items.extend(items)

    return scraped_items

# Resultado ejemplo:
scraped_items = [
    {
        'tipo': 'iPhone',
        'marca': 'Apple',
        'modelo_raw': 'Apple iPhone 15 Pro Max 256GB Blue Titanium Unlocked Grade A+ A3108',
        'precio': 1050.00,
        'stock': 15,
        'grado': 'A+',
        'a_number': 'A3108'
    },
    # ... más items
]
```

### **Fase 3: Staging y Normalización**

Los datos scraped se guardan en `LikewizeItemStaging` con normalización:

```python
def create_staging_items(scraped_items, tarea_id):
    for item in scraped_items:
        # Normalizar modelo (quitar "Apple", "Unlocked", etc)
        modelo_norm = normalize_model_name(item['modelo_raw'])
        # "iPhone 15 Pro Max 256GB Blue Titanium"

        # Extraer almacenamiento
        storage_gb = extract_storage(modelo_norm)  # 256

        # Calcular signature
        signature = generate_signature(item)

        LikewizeItemStaging.objects.create(
            task=tarea_id,
            tipo=item['tipo'],
            marca=item['marca'],
            modelo_raw=item['modelo_raw'],
            modelo_norm=modelo_norm,
            almacenamiento_gb=storage_gb,
            precio=item['precio'],
            grado=item['grado'],
            a_number=item['a_number'],
            signature=signature,
            status='pending'
        )
```

### **Fase 4: Detección de Cambios (Incremental)**

**IncrementalMappingService**

```python
def process_incremental_update(self, tarea_id, force_full_update=False):
    # Detectar cambios (explicado anteriormente)
    changes = self._detect_changes(tarea_id, force_full_update)

    logger.info(f"Cambios detectados: {len(changes['new'])} nuevos, "
                f"{len(changes['modified'])} modificados, "
                f"{len(changes['removed'])} removidos")

    # Procesar solo cambios
    mapping_results = self._process_changes(changes, tarea_id)

    # Invalidar removidos
    invalidated = self._invalidate_removed_devices(changes)

    return {
        'total_processed': len(mapping_results),
        'total_invalidated': len(invalidated),
        'changes': changes
    }
```

### **Fase 5: Mapeo Automático con Algoritmos Basados en Reglas**

**DeviceMappingV2Service (ios_mapping_service.py)**

Para cada dispositivo nuevo/modificado, el sistema ejecuta una cascada de algoritmos de matching:

```python
def map_iphone_device(self, staging_item):
    # 1. Consultar knowledge base (caché de mappings validados)
    cached = LikewizeKnowledgeBase.objects.filter(
        tipo=staging_item.tipo,
        modelo_likewize__icontains=staging_item.modelo_norm,
        is_active=True
    ).order_by('-confidence_score').first()

    if cached and cached.confidence_score > 0.85:
        # Reutilizar mapeo validado
        return {
            'capacidad_id': cached.capacidad_id,
            'confidence': cached.confidence_score,
            'algorithm': 'knowledge_base'
        }

    # 2. Intentar exact match (A-Number)
    if staging_item.a_number:
        exact_match = Modelo.objects.filter(
            a_number=staging_item.a_number
        ).first()
        if exact_match:
            capacidad = exact_match.capacidades.filter(
                tamaño__contains=f"{staging_item.almacenamiento_gb}GB"
            ).first()
            if capacidad:
                return {
                    'capacidad_id': capacidad.id,
                    'confidence': 1.0,
                    'algorithm': 'exact_match'
                }

    # 3. Fuzzy name matching (similitud de strings con fuzzywuzzy)
    internal_models = Modelo.objects.filter(tipo='iPhone', activo=True)

    best_match = None
    best_score = 0

    for modelo in internal_models:
        # Calcular similitud con fuzzywuzzy
        similarity = fuzz.token_sort_ratio(
            staging_item.modelo_norm.lower(),
            modelo.descripcion.lower()
        )

        # Verificar capacidad match
        capacidad = modelo.capacidades.filter(
            tamaño__contains=f"{staging_item.almacenamiento_gb}GB"
        ).first()

        if not capacidad:
            continue  # Capacidad debe coincidir

        # Verificar screen size match (para iPads)
        if not self._screen_size_matches(staging_item, modelo):
            continue  # Screen size debe coincidir

        # Penalizaciones por diferencias
        if similarity > best_score:
            best_score = similarity
            best_match = capacidad

    if best_match and best_score >= 70:  # Umbral mínimo
        return {
            'capacidad_id': best_match.id,
            'confidence': best_score / 100.0,
            'algorithm': 'fuzzy_match'
        }

    # 4. No se encontró match
    return {
        'capacidad_id': None,
        'confidence': 0.0,
        'algorithm': 'no_match'
    }
```

**Algoritmos de Matching Implementados:**

1. **Knowledge Base Cache** (instantáneo)
   - Busca en mapeos validados previamente
   - Confidence: hereda del mapeo original (0.85-1.0)

2. **Exact Match por A-Number** (100% confianza)
   - Usa el código Apple único (ej: A3108 = iPhone 15 Pro)
   - Verifica que la capacidad coincida

3. **Fuzzy String Matching** (variable confianza)
   - Usa librería `fuzzywuzzy` para similitud de nombres
   - Requiere: capacidad match + screen size match (para iPads)
   - Umbral mínimo: 70% similaridad
   - Penalizaciones por diferencias de tamaño de pantalla

4. **No Match** (requiere intervención manual)
   - Cuando ningún algoritmo produce un match válido
   - El operador debe crear o corregir manualmente

### **Fase 6: Confidence Scoring y Staging**

Los resultados del mapeo se almacenan con métricas de confianza:

```python
def save_mapping_result(staging_item, mapping_result):
    staging_item.mapped_device_id = mapping_result['device_model_id']
    staging_item.confidence_score = mapping_result['confidence']
    staging_item.mapping_source = mapping_result['source']

    # Clasificar por confidence
    if mapping_result['confidence'] >= 0.9:
        staging_item.status = 'mapped_high_confidence'
    elif mapping_result['confidence'] >= 0.7:
        staging_item.status = 'mapped_medium_confidence'
    else:
        staging_item.status = 'mapped_low_confidence'  # Requiere revisión

    staging_item.save()

    # Actualizar métricas de la tarea
    MappingMetrics.objects.create(
        task_id=staging_item.task_id,
        device_type=staging_item.tipo,
        total_items=1,
        high_confidence=1 if staging_item.status == 'mapped_high_confidence' else 0,
        needs_review=1 if staging_item.status == 'mapped_low_confidence' else 0
    )
```

### **Fase 7: Validación Manual (UI)**

**Frontend (ValidationTabPanel.tsx)**

Los operadores revisan items con baja confianza:

```typescript
// Tabla de items que requieren revisión
<ValidationTable
    items={lowConfidenceItems}
    onCorrect={(itemId, correctedModelId) => {
        // Operador corrige mapeo incorrecto
        await correctMappingAPI(itemId, correctedModelId);

        // Sistema aprende de la corrección
        await updateKnowledgeBaseAPI({
            likewize_model: item.modelo_norm,
            correct_model_id: correctedModelId,
            confidence: 0.95  // Alta confianza por validación humana
        });
    }}
    onApprove={(itemId) => {
        // Operador confirma que el mapeo es correcto
        await approveMappingAPI(itemId);
    }}
/>
```

### **Fase 8: Aplicación de Precios**

Una vez validados los mappings, se aplican a producción:

```python
@api_view(['POST'])
def aplicar_cambios(request, task_id):
    tarea = LikewizePriceUpdateTask.objects.get(id=task_id)

    # Obtener items aprobados
    approved_items = LikewizeItemStaging.objects.filter(
        task=tarea,
        status__in=['mapped_high_confidence', 'validated']
    )

    applied_count = 0

    for item in approved_items:
        # Crear o actualizar DeviceMapping
        mapping, created = DeviceMapping.objects.update_or_create(
            tenant=tarea.tenant,
            device_model_id=item.mapped_device_id,
            likewize_grade=item.grado,
            defaults={
                'likewize_price': item.precio,
                'likewize_model_raw': item.modelo_raw,
                'likewize_model_norm': item.modelo_norm,
                'confidence_score': item.confidence_score,
                'last_synced': timezone.now()
            }
        )

        # Actualizar precio del dispositivo interno
        internal_device = DeviceModel.objects.get(id=item.mapped_device_id)
        internal_device.purchase_price = item.precio
        internal_device.save()

        applied_count += 1

    tarea.status = 'completed'
    tarea.applied_count = applied_count
    tarea.save()

    return Response({'applied': applied_count})
```

---

## Sistema de Caché de Mapeos (Knowledge Base)

El sistema optimiza el rendimiento mediante tres mecanismos de caché:

### **1. Base de Conocimiento (LikewizeKnowledgeBase)**

Cada vez que un mapeo es validado manualmente por un operador, se almacena en caché:

```python
class LikewizeKnowledgeBase(models.Model):
    tipo = models.CharField(max_length=50)  # "iPhone"
    marca = models.CharField(max_length=100)  # "Apple"
    modelo_likewize = models.TextField()  # "iPhone 15 Pro Max 256GB"
    capacidad = models.ForeignKey(Capacidad)  # Link a tu catálogo
    confidence_score = models.FloatField()  # 0.0 - 1.0
    validation_count = models.IntegerField(default=1)  # Veces que se validó
    last_validated = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
```

**Ejemplo de uso:**

```python
# Primera vez: ejecutar algoritmos de matching (fuzzy, exact match, etc.)
result = map_device_with_algorithms("iPhone 15 Pro 512GB", internal_models)
# confidence: 0.92, time: 0.5 segundos

# Operador valida el mapeo → guardar en knowledge base
LikewizeKnowledgeBase.objects.create(
    tipo="iPhone",
    modelo_likewize="iPhone 15 Pro 512GB",
    capacidad_id=result['capacidad_id'],
    confidence_score=0.95  # Alta confianza por validación humana
)

# Segunda vez (incremental update): caché hit (instantáneo)
cached = LikewizeKnowledgeBase.objects.get(
    modelo_likewize="iPhone 15 Pro 512GB"
)
# confidence: 0.95, time: 0.01 segundos
```

### **2. Retroalimentación de Correcciones**

Cuando un operador corrige un mapeo incorrecto generado por los algoritmos automáticos:

```python
def handle_user_correction(staging_item_id, correct_capacidad_id):
    staging_item = LikewizeItemStaging.objects.get(id=staging_item_id)

    # Actualizar knowledge base con corrección
    kb_entry, created = LikewizeKnowledgeBase.objects.update_or_create(
        tipo=staging_item.tipo,
        modelo_likewize=staging_item.modelo_norm,
        defaults={
            'capacidad_id': correct_capacidad_id,
            'confidence_score': 0.95,  # Alta confianza por validación humana
            'validation_count': F('validation_count') + 1
        }
    )

    # Si el mapeo automático original fue incorrecto, registrar la corrección
    if staging_item.capacidad_id != correct_capacidad_id:
        MappingFeedback.objects.create(
            original_mapping=staging_item.capacidad_id,
            corrected_mapping=correct_capacidad_id,
            likewize_model=staging_item.modelo_norm,
            feedback_type='user_correction'
        )

    staging_item.capacidad_id = correct_capacidad_id
    staging_item.confidence_score = 0.95
    staging_item.status = 'validated'
    staging_item.save()
```

### **3. Mejora Continua con Métricas**

El sistema rastrea métricas de desempeño:

```python
class MappingMetrics(models.Model):
    task = models.ForeignKey(LikewizePriceUpdateTask)
    device_type = models.CharField(max_length=50)

    # Métricas de mapeo
    total_items = models.IntegerField()
    high_confidence = models.IntegerField()  # >= 0.9
    medium_confidence = models.IntegerField()  # 0.7 - 0.89
    low_confidence = models.IntegerField()  # < 0.7

    # Métricas de validación
    user_corrections = models.IntegerField(default=0)
    auto_approved = models.IntegerField(default=0)

    # Performance
    avg_confidence = models.FloatField()
    processing_time_seconds = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)
```

**Dashboard de métricas:**

```typescript
// Frontend muestra evolución temporal
<MetricsChart
    data={[
        { date: '2024-01-01', accuracy: 0.85, corrections: 15 },
        { date: '2024-01-08', accuracy: 0.89, corrections: 10 },
        { date: '2024-01-15', accuracy: 0.93, corrections: 5 },  // Mejora
        { date: '2024-01-22', accuracy: 0.96, corrections: 2 }   // Excelente
    ]}
/>
```

---

## Componentes Técnicos Clave

### **Backend**

**Modelos (productos/models.py)**

```python
# Staging temporal para items scraped
class LikewizeItemStaging(models.Model):
    task = ForeignKey(LikewizePriceUpdateTask)
    tipo = CharField(max_length=50)
    marca = CharField(max_length=100)
    modelo_raw = TextField()
    modelo_norm = TextField()
    almacenamiento_gb = IntegerField()
    precio = DecimalField()
    grado = CharField(max_length=10)
    signature = CharField(max_length=64, db_index=True)  # Para incremental
    mapped_device = ForeignKey(DeviceModel, null=True)
    confidence_score = FloatField(null=True)
    status = CharField(choices=STATUS_CHOICES)

# Mappings aplicados en producción
class DeviceMapping(models.Model):
    tenant = ForeignKey(Tenant)
    device_model = ForeignKey(DeviceModel)
    likewize_model_norm = TextField()
    likewize_price = DecimalField()
    likewize_grade = CharField(max_length=10)
    confidence_score = FloatField()
    is_active = BooleanField(default=True)
    last_synced = DateTimeField()
    created_at = DateTimeField(auto_now_add=True)

# Base de conocimiento para auto-aprendizaje
class LikewizeKnowledgeBase(models.Model):
    tipo = CharField(max_length=50)
    modelo_likewize = TextField(db_index=True)
    modelo_interno = ForeignKey(DeviceModel)
    confidence_score = FloatField()
    validation_count = IntegerField()
    is_active = BooleanField(default=True)
```

**Servicios**

```python
# productos/services/incremental_mapping.py
class IncrementalMappingService:
    def process_incremental_update(self, tarea_id, force_full_update=False)
    def _detect_changes(self, tarea_id, force_full_update)
    def _generate_device_signature(self, device)
    def _get_from_knowledge_base(self, staging_item)

# productos/services/ios_mapping_service.py
class IOSMappingService(DeviceMappingV2Service):
    def map_device(self, staging_item)
    def _call_gpt_mapping(self, staging_item, internal_models)
    def _save_to_knowledge_base(self, staging_item, mapping_result)

# productos/services/mac_mapping_service.py
class MacMappingService(DeviceMappingV2Service):
    # Similar a iOS pero para MacBooks
```

**Endpoints (productos/urls.py)**

```python
urlpatterns = [
    # Actualización principal
    path('precios/likewize/actualizar/', actualizar_likewize),

    # Gestión de tareas
    path('precios/likewize/tareas/<int:task_id>/', get_task_status),
    path('precios/likewize/tareas/<int:task_id>/diff/', get_price_diff),
    path('precios/likewize/tareas/<int:task_id>/aplicar/', aplicar_cambios),

    # Validación y correcciones
    path('precios/likewize/staging/<int:item_id>/corregir/', corregir_mapeo),
    path('precios/likewize/staging/<int:item_id>/aprobar/', aprobar_mapeo),

    # Métricas
    path('precios/likewize/metricas/', get_mapping_metrics),
]
```

### **Frontend**

**Componentes (tenant-frontend/src/features/opportunities/components/devices/)**

```typescript
// EnhancedLikewizePage.tsx
// Página principal con tabs y controles
export default function EnhancedLikewizePage() {
    const [incrementalMode, setIncrementalMode] = useState(true);
    const [activeTab, setActiveTab] = useState('staging');

    return (
        <Box>
            <IncrementalUpdateControls
                incrementalMode={incrementalMode}
                onToggleMode={setIncrementalMode}
                onUpdateApple={handleUpdateApple}
                onUpdateOthers={handleUpdateOthers}
            />

            <Tabs value={activeTab} onChange={setActiveTab}>
                <Tab label="Staging" value="staging" />
                <Tab label="Validación" value="validation" />
                <Tab label="Métricas" value="metrics" />
            </Tabs>

            {activeTab === 'validation' && (
                <ValidationTabPanel
                    items={lowConfidenceItems}
                    onCorrect={handleCorrection}
                />
            )}
        </Box>
    );
}

// ValidationTable.tsx
// Tabla para revisar mappings de baja confianza
export function ValidationTable({ items, onCorrect, onApprove }) {
    return (
        <Table>
            {items.map(item => (
                <TableRow key={item.id}>
                    <TableCell>{item.modelo_norm}</TableCell>
                    <TableCell>
                        <Chip
                            label={`${(item.confidence_score * 100).toFixed(0)}%`}
                            color={getConfidenceColor(item.confidence_score)}
                        />
                    </TableCell>
                    <TableCell>{item.mapped_device_name}</TableCell>
                    <TableCell>
                        <Button onClick={() => handleEdit(item)}>
                            Corregir
                        </Button>
                        <Button onClick={() => onApprove(item.id)}>
                            Aprobar
                        </Button>
                    </TableCell>
                </TableRow>
            ))}
        </Table>
    );
}

// CorrectionModal.tsx
// Modal para corregir mapeos incorrectos
export function CorrectionModal({ item, onSave, open, onClose }) {
    const [selectedModel, setSelectedModel] = useState(null);

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                Corregir Mapeo: {item.modelo_norm}
            </DialogTitle>
            <DialogContent>
                <Typography color="error">
                    Mapeo actual (incorrecto): {item.mapped_device_name}
                </Typography>

                <Autocomplete
                    options={internalModels}
                    getOptionLabel={(option) => option.name}
                    onChange={(e, value) => setSelectedModel(value)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Selecciona el modelo correcto"
                        />
                    )}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    onClick={() => onSave(item.id, selectedModel.id)}
                    variant="contained"
                >
                    Guardar Corrección
                </Button>
            </DialogActions>
        </Dialog>
    );
}
```

**Hooks (tenant-frontend/src/shared/hooks/)**

```typescript
// useDeviceMappingEnhanced.ts
export function useDeviceMappingEnhanced() {
    const [taskId, setTaskId] = useState<number | null>(null);
    const [metrics, setMetrics] = useState<MappingMetrics | null>(null);

    // Iniciar actualización
    const startUpdate = useMutation({
        mutationFn: async (params: UpdateParams) => {
            const response = await api.post('/precios/likewize/actualizar/', {
                tenant_id: params.tenantId,
                incremental: params.incremental,
                tipos: params.tipos
            });
            return response.data;
        },
        onSuccess: (data) => {
            setTaskId(data.task_id);
            pollTaskStatus(data.task_id);
        }
    });

    // Poll de progreso
    const pollTaskStatus = useCallback(async (taskId: number) => {
        const interval = setInterval(async () => {
            const status = await api.get(`/precios/likewize/tareas/${taskId}/`);

            if (status.data.status === 'completed') {
                clearInterval(interval);
                loadMetrics(taskId);
            }
        }, 2000);
    }, []);

    // Corregir mapeo
    const correctMapping = useMutation({
        mutationFn: async ({ itemId, correctModelId }: CorrectionParams) => {
            return api.post(`/precios/likewize/staging/${itemId}/corregir/`, {
                correct_model_id: correctModelId
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['staging-items']);
            toast.success('Mapeo corregido y guardado en knowledge base');
        }
    });

    return {
        startUpdate,
        correctMapping,
        taskId,
        metrics
    };
}
```

---

## Ejemplo Práctico Real: Actualización de Catálogo Apple

Imaginemos que eres el administrador de Progeek Partners y necesitas actualizar precios el lunes por la mañana.

### **Escenario: Actualización Completa (fuerza bruta)**

**Contexto:**
- Catálogo Likewize: 1000 dispositivos Apple (iPhones, iPads, MacBooks)
- Última actualización: hace 1 mes (primera vez usando el sistema)

**Pasos:**

1. **Desactivas el modo incremental**
   ```typescript
   <Switch checked={false} /> // Modo incremental OFF
   ```

2. **Inicias actualización completa**
   ```
   Click en "Actualizar Apple" → Force Full Update
   ```

3. **Procesamiento:**
   ```
   [09:00:00] Scraping Likewize... 1000 dispositivos encontrados
   [09:02:30] Generando signatures... OK
   [09:03:00] Modo completo: procesando TODOS los 1000 items
   [09:03:15] Ejecutando algoritmos de matching... 0/1000
   [09:05:30] Ejecutando algoritmos de matching... 100/1000 (10%)
   [09:10:45] Ejecutando algoritmos de matching... 500/1000 (50%)
   [09:16:20] Ejecutando algoritmos de matching... 1000/1000 (100%)
   [09:16:30] Guardando en staging... OK
   [09:17:00] Actualización completa finalizada
   ```

4. **Resultados:**
   - **Tiempo total:** 17 minutos
   - **Dispositivos procesados:** 1000
   - **Algoritmos ejecutados:** 1000 (exact match + fuzzy match)
   - **Items para revisar:** 150 (baja confianza <0.7)

5. **Validación manual:**
   ```
   [09:18:00] Operador revisa 150 items de baja confianza
   [09:48:00] Correcciones completadas (30 correcciones, 120 aprobaciones)
   [09:49:00] Aplicando cambios a producción...
   [09:50:00] 1000 precios actualizados
   ```

**Total: 50 minutos** (17 min procesamiento + 30 min validación + 3 min aplicación)

---

### **Escenario: Actualización Incremental (inteligente)**

**Contexto:**
- Mismo catálogo: 1000 dispositivos Apple
- Última actualización: ayer (ya tienes mappings recientes)
- **Cambios reales en Likewize desde ayer:**
  - 3 modelos nuevos (iPhone 16 Plus nuevas capacidades)
  - 8 dispositivos con precio modificado
  - 2 dispositivos descatalogados (iPhone 12 Mini grados bajos)

**Pasos:**

1. **Activas el modo incremental**
   ```typescript
   <Switch checked={true} /> // Modo incremental ON
   ```

2. **Inicias actualización inteligente**
   ```
   Click en "Actualizar Apple" → Incremental Update
   ```

3. **Procesamiento:**
   ```
   [10:00:00] Scraping Likewize... 1000 dispositivos encontrados
   [10:02:30] Generando signatures... OK
   [10:02:45] Comparando con base de datos (últimas 48h)...
   [10:02:50] Cambios detectados:
               - Nuevos: 3 dispositivos
               - Modificados: 8 dispositivos
               - Removidos: 2 dispositivos
   [10:02:51] Modo incremental: procesando solo 11 items (1.1% del catálogo)
   [10:02:52] Verificando knowledge base...
               - 7 items encontrados en caché (mapeo instantáneo)
               - 4 items requieren algoritmos de matching
   [10:03:05] Ejecutando matching en 4 items... OK
   [10:03:10] Invalidando 2 dispositivos removidos... OK
   [10:03:15] Guardando en staging... OK
   [10:03:20] Actualización incremental finalizada
   ```

4. **Resultados:**
   - **Tiempo total:** 3 minutos 20 segundos
   - **Dispositivos procesados:** 11 (vs 1000 en modo completo)
   - **Algoritmos ejecutados:** 4 (vs 1000 en modo completo)
   - **Items para revisar:** 1 (solo 1 con baja confianza)
   - **Tasa de acierto con caché:** 63.6% (7/11 usaron knowledge base)

5. **Validación manual:**
   ```
   [10:04:00] Operador revisa 1 item de baja confianza
   [10:05:00] Corrección aplicada (1 corrección)
   [10:05:10] Aplicando cambios a producción...
   [10:05:30] 11 precios actualizados, 2 dispositivos desactivados
   ```

**Total: 5 minutos 30 segundos** (3.5 min procesamiento + 1 min validación + 1 min aplicación)

---

### **Comparación Visual:**

```
ACTUALIZACIÓN COMPLETA (Fuerza Bruta)
========================================
Tiempo:      |████████████████████████████████████████████| 50 min
Algoritmos:  |████████████████████████████████████████████| 1000
Validación:  |████████████████████████████████████████████| 150 items

ACTUALIZACIÓN INCREMENTAL (Inteligente)
========================================
Tiempo:      |██                                          | 5.5 min (-89%)
Algoritmos:  |                                            | 4 (-99.6%)
Validación:  |                                            | 1 item (-99.3%)
```

### **¿Cómo detectó el sistema esos 11 cambios?**

**Ejemplo concreto con signatures:**

**Dispositivo Nuevo (iPhone 16 Plus 512GB):**
```python
# No existe en base de datos (nueva capacity)
likewize_signature = hash("iPhone|Apple|iPhone 16 Plus 512GB|512|A3294|A+")
# → "f2a9d8c3e1b7f4a5..."

existing_signatures = {
    # Solo tienen 256GB y 1TB, no 512GB
    hash("iPhone|Apple|iPhone 16 Plus 256GB|256|A3294|A+"): <Mapping>,
    hash("iPhone|Apple|iPhone 16 Plus 1TB|1024|A3294|A+"): <Mapping>
}

# Signature no encontrada → NUEVO dispositivo
```

**Dispositivo Modificado (iPhone 15 Pro cambió de precio):**
```python
# Ayer (en base de datos):
yesterday_data = {
    'modelo': 'iPhone 15 Pro 256GB',
    'precio': 850.00,
    'grado': 'A+'
}
yesterday_signature = hash("iPhone|Apple|iPhone 15 Pro 256GB|256|A3108|A+")
# → "a7f3c9d2e8b1..."

# Hoy (en Likewize):
today_data = {
    'modelo': 'iPhone 15 Pro 256GB',
    'precio': 820.00,  # ¡Precio bajó!
    'grado': 'A+'
}
today_signature = hash("iPhone|Apple|iPhone 15 Pro 256GB|256|A3108|A+")
# → "a7f3c9d2e8b1..." (misma signature)

# Signature coincide → detecta como "modificado" (precio cambió)
# Nota: En realidad, la signature NO incluye precio, así que este ejemplo
# ilustra la lógica conceptual. El sistema detecta modificaciones comparando
# staging items con mappings recientes y verificando si hay cambios en campos
# como precio, stock, etc.
```

**Dispositivo Removido (iPhone 12 Mini Grade C):**
```python
# En base de datos (ayer):
existing_signature = hash("iPhone|Apple|iPhone 12 Mini 128GB|128|A2176|C")
# → "c3f7a9e2d1b4..."

# En Likewize (hoy):
# (No aparece en el scraping)

# Signature existe en BD pero no en staging → REMOVIDO
```

---

## Conclusión: ¿Cuándo Usar Cada Modo?

### **Usa Actualización Completa cuando:**

- **Primera vez usando el sistema** (no hay mappings previos)
- **Cambio de proveedor** (migración desde otro sistema)
- **Reset completo** (sospechas corrupción de datos)
- **Auditoría exhaustiva** (quieres revalidar todo el catálogo)
- **Han pasado >7 días sin actualizar** (ventana temporal muy antigua)
- **Cambio estructural en catálogo** (Likewize cambió nomenclatura)

**Frecuencia recomendada:** 1 vez/mes o cuando sea estrictamente necesario

### **Usa Actualización Incremental cuando:**

- **Operación diaria normal** (mantenimiento de precios)
- **Actualizaste recientemente** (<48h)
- **Quieres minimizar costos** (optimización de API calls)
- **Necesitas rapidez** (actualización en minutos)
- **Alta frecuencia de actualización** (2-3 veces/día)
- **Catálogo estable** (solo cambios de precio/stock)

**Frecuencia recomendada:** Diaria o incluso múltiple/día

### **Métricas de Éxito:**

Después de implementar V3 con modo incremental, esperarías ver:

| Métrica | Antes (V2) | Después (V3 Incremental) | Mejora |
|---------|-----------|--------------------------|--------|
| **Tiempo de actualización** | 15 min | 3-5 min | -70% |
| **Frecuencia posible** | 2x/semana | 2-3x/día | +10x |
| **Precisión de mapeo** | 85% | 95% (con caché) | +12% |
| **Items para revisar** | 150 | 5-10 | -95% |
| **Procesamiento optimizado** | 100% items | 1-5% items | -95% |

---

## Referencias a Archivos del Código

Para implementar o modificar este sistema, consulta:

**Backend:**
- `tenants-backend/productos/services/incremental_mapping.py` - Lógica de detección de cambios
- `tenants-backend/productos/services/ios_mapping_service.py` - Mapeo IA para iOS
- `tenants-backend/productos/services/mac_mapping_service.py` - Mapeo IA para Mac
- `tenants-backend/productos/views/actualizador.py` - Endpoints API
- `tenants-backend/productos/models.py` - Modelos de base de datos

**Frontend:**
- `tenant-frontend/src/features/opportunities/components/devices/EnhancedLikewizePage.tsx` - Página principal
- `tenant-frontend/src/features/opportunities/components/devices/ValidationTabPanel.tsx` - Panel de validación
- `tenant-frontend/src/features/opportunities/components/devices/ValidationTable.tsx` - Tabla de revisión
- `tenant-frontend/src/features/opportunities/components/devices/CorrectionModal.tsx` - Modal de corrección
- `tenant-frontend/src/shared/hooks/useDeviceMappingEnhanced.ts` - Hook principal

**Documentación:**
- `tenants-backend/productos/LIKEWIZE_V3_README.md` - Documentación completa del sistema

---

*Documentación generada: 2 de octubre de 2025*
*Sistema: Likewize V3.1.0*
