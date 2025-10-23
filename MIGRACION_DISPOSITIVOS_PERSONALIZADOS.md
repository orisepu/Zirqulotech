# Migración de DispositivoPersonalizado a SHARED_APPS

Este documento describe la migración del modelo `DispositivoPersonalizado` desde la app `checkouters` (TENANT_APPS) hacia `productos` (SHARED_APPS), para que sea compartido entre todos los tenants.

## Cambios Realizados

### 1. Backend: Modelo Movido a productos

**Archivo**: `/tenants-backend/productos/models/modelos.py`

- ✅ Modelo `DispositivoPersonalizado` agregado con todos los campos:
  - `marca`, `modelo`, `capacidad`, `tipo`
  - `precio_base_b2b`, `precio_base_b2c`
  - `ajuste_excelente`, `ajuste_bueno`, `ajuste_malo` (IntegerField)
  - `caracteristicas` (JSONField), `notas` (TextField)
  - `created_by` (ForeignKey a USER), `created_at`, `updated_at`
  - `activo` (BooleanField para soft delete)

- ✅ Método `calcular_oferta(estado, canal)` - calcula precio según estado y canal

**Archivo**: `/tenants-backend/productos/models/__init__.py`
- ✅ Exporta `DispositivoPersonalizado`

### 2. Backend: Serializer Copiado a productos

**Archivo**: `/tenants-backend/productos/serializers/dispositivo_personalizado.py`

- ✅ `DispositivoPersonalizadoSerializer` - Serializer completo con validaciones
- ✅ `DispositivoPersonalizadoSimpleSerializer` - Versión simplificada para formularios

**Archivo**: `/tenants-backend/productos/serializers/__init__.py`
- ✅ Exporta ambos serializers

### 3. Backend: ViewSet Copiado a productos

**Archivo**: `/tenants-backend/productos/views/dispositivo_personalizado.py`

- ✅ `DispositivoPersonalizadoViewSet` con permisos personalizados
  - GET /api/dispositivos-personalizados/ - Listar (autenticado)
  - POST /api/dispositivos-personalizados/ - Crear (admin)
  - GET /api/dispositivos-personalizados/{id}/ - Detalle (autenticado)
  - PUT/PATCH /api/dispositivos-personalizados/{id}/ - Actualizar (admin)
  - DELETE /api/dispositivos-personalizados/{id}/ - Soft delete (admin)
  - GET /api/dispositivos-personalizados/disponibles/ - Listado simple (autenticado)
  - POST /api/dispositivos-personalizados/{id}/calcular_oferta/ - Calcular oferta

**Archivo**: `/tenants-backend/productos/views/__init__.py`
- ✅ Exporta `DispositivoPersonalizadoViewSet`

### 4. Backend: URLs Actualizadas

**Archivo**: `/tenants-backend/productos/urls.py`

- ✅ Importa `DispositivoPersonalizadoViewSet`
- ✅ Registra en router: `router.register(r"dispositivos-personalizados", DispositivoPersonalizadoViewSet, basename="dispositivo-personalizado")`

### 5. Backend: ForeignKey Actualizada en DispositivoReal

**Archivo**: `/tenants-backend/checkouters/models/dispositivo.py`

- ✅ `dispositivo_personalizado` ForeignKey actualizada a `'productos.DispositivoPersonalizado'`

**Archivo**: `/tenants-backend/checkouters/models/__init__.py`
- ✅ Eliminado import de `DispositivoPersonalizado`
- ✅ Comentado en `__all__`

### 6. Backend: Migraciones Creadas

#### Migración productos 0030

**Archivo**: `/tenants-backend/productos/migrations/0030_add_campos_faltantes_dispositivo_personalizado.py`

Agrega campos faltantes a `DispositivoPersonalizado`:
- Convierte `ajuste_*` de DecimalField a IntegerField
- Cambia `tipo` default de 'movil' a 'otro'
- Hace `capacidad` opcional (blank=True)
- Agrega `caracteristicas` (JSONField)
- Agrega `notas` (TextField)
- Agrega `created_by` (ForeignKey a USER)
- Actualiza Meta: ordering a `['-created_at']`
- Agrega indexes: marca+modelo, tipo, activo

#### Migración checkouters 0050

**Archivo**: `/tenants-backend/checkouters/migrations/0050_mover_dispositivopersonalizado_a_productos.py`

Migra `DispositivoReal.dispositivo_personalizado`:
- Actualiza ForeignKey para apuntar a `productos.dispositivopersonalizado`
- Elimina modelo `DispositivoPersonalizado` de checkouters

## Instrucciones para Completar la Migración

### Paso 1: Detener el Servidor Django

```bash
# Buscar proceso Django
ps aux | grep "manage.py runserver"

# Matar proceso (reemplazar PID con el número real)
kill <PID>
```

### Paso 2: Ejecutar Migraciones

```bash
cd /home/oriol/zirqulo/Zirqulotech/tenants-backend

# Ejecutar migraciones
python manage.py migrate productos 0030
python manage.py migrate checkouters 0050
```

### Paso 3: Reiniciar el Servidor Django

```bash
python manage.py runserver 0.0.0.0:8000
```

### Paso 4: Verificar el Endpoint

```bash
# Probar endpoint
curl -H "X-Tenant: public" http://localhost:8000/api/dispositivos-personalizados/

# O abrir en navegador
http://localhost:8000/api/dispositivos-personalizados/
```

## Arquitectura Final

```
┌─────────────────────────────────────────────────────┐
│           SHARED_APPS (productos)                   │
│                                                     │
│  DispositivoPersonalizado                          │
│  ├─ marca, modelo, capacidad, tipo                 │
│  ├─ precio_base_b2b, precio_base_b2c               │
│  ├─ ajuste_excelente, ajuste_bueno, ajuste_malo    │
│  ├─ caracteristicas (JSON), notas                  │
│  └─ created_by, created_at, updated_at, activo     │
│                                                     │
│  DispositivoPersonalizadoViewSet                   │
│  └─ /api/dispositivos-personalizados/              │
└─────────────────────────────────────────────────────┘
                        ▲
                        │
                        │ ForeignKey
                        │
┌─────────────────────────────────────────────────────┐
│           TENANT_APPS (checkouters)                 │
│                                                     │
│  DispositivoReal                                    │
│  ├─ modelo + capacidad (Apple devices)             │
│  └─ dispositivo_personalizado (Non-Apple devices)  │
│      → productos.DispositivoPersonalizado          │
└─────────────────────────────────────────────────────┘
```

## Ventajas de la Migración

1. **Compartido entre Tenants**: Todos los tenants comparten el mismo catálogo de dispositivos personalizados
2. **Datos Centralizados**: Un solo lugar para agregar/modificar dispositivos personalizados
3. **Eficiencia**: No duplicar datos entre schemas de tenants
4. **Mantenimiento**: Más fácil actualizar precios y ajustes globalmente

## Notas Importantes

- ❗ Los datos existentes en `checkouters.DispositivoPersonalizado` se mantendrán durante la migración
- ❗ La tabla se eliminará de checkouters pero los datos migrarán a la tabla compartida en el schema `public`
- ❗ Las relaciones ForeignKey en `DispositivoReal` se actualizarán automáticamente
- ❗ El endpoint anterior en checkouters se puede deprecar gradualmente (ya no es necesario)

## Limpieza Pendiente (Opcional)

Una vez que confirmes que todo funciona correctamente, puedes eliminar estos archivos de checkouters:

```bash
rm /tenants-backend/checkouters/models/dispositivo_personalizado.py
rm /tenants-backend/checkouters/serializers/dispositivo_personalizado.py
rm /tenants-backend/checkouters/views/dispositivo_personalizado.py
```

Y actualizar `/tenants-backend/checkouters/urls.py` para eliminar las rutas antiguas (si existen).

## Testing

Después de la migración, verifica:

1. ✅ El endpoint `/api/dispositivos-personalizados/` responde correctamente
2. ✅ Puedes crear nuevos dispositivos personalizados desde el admin
3. ✅ El formulario de valoración muestra los dispositivos personalizados
4. ✅ El modal de creación funciona desde el formulario
5. ✅ Los dispositivos personalizados se pueden seleccionar al crear DispositivoReal
6. ✅ El cálculo de oferta funciona correctamente

## Frontend: Cambios Necesarios

El frontend ya tiene los components y types correctos:

- `DispositivoPersonalizadoModal` en `/tenant-frontend/src/features/admin/components/`
- `DispositivosPersonalizadosTable` en `/tenant-frontend/src/features/admin/components/`
- `PasoEstadoGeneral` en `/tenant-frontend/src/features/opportunities/components/forms/`
- Types en `/tenant-frontend/src/shared/types/dispositivos.ts`

**Próximo paso**: Integrar el modal en `FormularioValoracionOportunidad` para permitir crear dispositivos desde el formulario de valoración.
