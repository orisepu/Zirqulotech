# Sistema de Dispositivos Personalizados

## Contexto y Objetivo

Permitir al **admin** crear y gestionar dispositivos de **cualquier marca y tipo** (móviles Android, portátiles Windows/Linux, monitores, tablets no-Apple, etc.) para hacer ofertas personalizadas cuando un partner envía dispositivos poco comunes que no están en el catálogo estándar de Apple.

### Casos de Uso
- Partner envía lista con Samsung Galaxy S23, Xiaomi Redmi Note, Dell XPS 15, Monitor LG UltraWide
- Admin crea estos dispositivos personalizados con precio base
- Admin asocia dispositivos personalizados a la oportunidad
- Sistema calcula oferta según estado general (Excelente/Bueno/Malo)
- Dispositivos se guardan en catálogo para reutilizar en futuras oportunidades

### Requisitos Clave
✅ **Solo admin puede crear/editar** dispositivos personalizados
✅ **Partners solo ven** dispositivos personalizados si admin los asoció a su oportunidad
✅ **Gestión dual**: Vista admin dedicada + creación rápida desde formulario valoración
✅ **Valoración simple**: Precio base + ajuste por estado general (sin cuestionario detallado)
✅ **Campos flexibles**: Marca, modelo, capacidad, tipo, características técnicas, notas

---

## Fase 1: Backend - Modelo y API (Django)

### 1.1 Modelo DispositivoPersonalizado

**Ubicación**: `tenants-backend/checkouters/models/dispositivo_personalizado.py`

```python
from django.db import models
from django.contrib.auth.models import User

class DispositivoPersonalizado(models.Model):
    TIPO_CHOICES = [
        ('movil', 'Móvil'),
        ('portatil', 'Portátil'),
        ('monitor', 'Monitor'),
        ('tablet', 'Tablet'),
        ('otro', 'Otro'),
    ]

    # Identificación básica
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=255)
    capacidad = models.CharField(max_length=100, blank=True, help_text="Ej: 256GB, 1TB SSD, configuración especial")
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='otro')

    # Precios base
    precio_base_b2b = models.DecimalField(max_digits=10, decimal_places=2, help_text="Precio base para canal B2B")
    precio_base_b2c = models.DecimalField(max_digits=10, decimal_places=2, help_text="Precio base para canal B2C")

    # Ajustes por estado (porcentajes 0-100)
    ajuste_excelente = models.IntegerField(default=100, help_text="% del precio base para estado excelente")
    ajuste_bueno = models.IntegerField(default=80, help_text="% del precio base para estado bueno")
    ajuste_malo = models.IntegerField(default=50, help_text="% del precio base para estado malo")

    # Metadata
    caracteristicas = models.JSONField(default=dict, blank=True, help_text="RAM, procesador, tamaño pantalla, etc.")
    notas = models.TextField(blank=True, help_text="Descripción adicional o detalles específicos")

    # Auditoría
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='dispositivos_personalizados_creados')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'dispositivos_personalizados'
        ordering = ['-created_at']
        verbose_name = 'Dispositivo Personalizado'
        verbose_name_plural = 'Dispositivos Personalizados'
        indexes = [
            models.Index(fields=['marca', 'modelo']),
            models.Index(fields=['tipo']),
        ]

    def __str__(self):
        capacidad_str = f" {self.capacidad}" if self.capacidad else ""
        return f"{self.marca} {self.modelo}{capacidad_str}"

    def calcular_oferta(self, estado: str, canal: str) -> float:
        """
        Calcula la oferta según estado y canal.

        Args:
            estado: 'excelente', 'bueno', 'malo'
            canal: 'B2B', 'B2C'

        Returns:
            Precio calculado redondeado a múltiplos de 5€
        """
        precio_base = self.precio_base_b2b if canal == 'B2B' else self.precio_base_b2c

        ajuste_map = {
            'excelente': self.ajuste_excelente,
            'bueno': self.ajuste_bueno,
            'malo': self.ajuste_malo,
        }

        ajuste_pct = ajuste_map.get(estado, 100) / 100
        precio_calculado = float(precio_base) * ajuste_pct

        # Redondear a múltiplos de 5€
        precio_redondeado = round(precio_calculado / 5) * 5

        return max(precio_redondeado, 0)
```

**Migración**: `python manage.py makemigrations && python manage.py migrate`

---

### 1.2 Modificar modelo Dispositivo (DispositivoReal)

**Ubicación**: `tenants-backend/checkouters/models.py` (o donde esté DispositivoReal)

```python
class DispositivoReal(models.Model):
    # ... campos existentes ...

    # NUEVO: Relación opcional con dispositivo personalizado
    dispositivo_personalizado = models.ForeignKey(
        'DispositivoPersonalizado',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dispositivos_reales'
    )

    # Hacer modelo y capacidad opcionales cuando se usa dispositivo personalizado
    modelo = models.ForeignKey('Modelo', on_delete=models.CASCADE, null=True, blank=True)
    capacidad = models.ForeignKey('Capacidad', on_delete=models.CASCADE, null=True, blank=True)

    # ... resto de campos ...

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()

        # Validar que tenga o bien (modelo + capacidad) o bien dispositivo_personalizado
        tiene_catalogo = self.modelo and self.capacidad
        tiene_personalizado = self.dispositivo_personalizado

        if not tiene_catalogo and not tiene_personalizado:
            raise ValidationError("Debe especificar (modelo + capacidad) o dispositivo_personalizado")

        if tiene_catalogo and tiene_personalizado:
            raise ValidationError("No puede especificar ambos: catálogo normal y dispositivo personalizado")
```

**Migración**:
```bash
python manage.py makemigrations
python manage.py migrate
```

---

### 1.3 Serializers

**Ubicación**: `tenants-backend/checkouters/serializers/dispositivo_personalizado.py`

```python
from rest_framework import serializers
from ..models import DispositivoPersonalizado

class DispositivoPersonalizadoSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    descripcion_completa = serializers.SerializerMethodField()

    class Meta:
        model = DispositivoPersonalizado
        fields = [
            'id',
            'marca',
            'modelo',
            'capacidad',
            'tipo',
            'precio_base_b2b',
            'precio_base_b2c',
            'ajuste_excelente',
            'ajuste_bueno',
            'ajuste_malo',
            'caracteristicas',
            'notas',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'activo',
            'descripcion_completa',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_descripcion_completa(self, obj):
        return str(obj)

    def validate(self, data):
        # Validar que precios sean positivos
        if data.get('precio_base_b2b', 0) < 0:
            raise serializers.ValidationError("El precio B2B debe ser mayor o igual a 0")
        if data.get('precio_base_b2c', 0) < 0:
            raise serializers.ValidationError("El precio B2C debe ser mayor o igual a 0")

        # Validar ajustes entre 0-100
        for field in ['ajuste_excelente', 'ajuste_bueno', 'ajuste_malo']:
            valor = data.get(field, 100)
            if not (0 <= valor <= 100):
                raise serializers.ValidationError(f"{field} debe estar entre 0 y 100")

        return data

    def create(self, validated_data):
        # Asignar usuario que crea
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class DispositivoPersonalizadoSimpleSerializer(serializers.ModelSerializer):
    """Versión simplificada para listados/selección"""
    descripcion_completa = serializers.SerializerMethodField()

    class Meta:
        model = DispositivoPersonalizado
        fields = ['id', 'marca', 'modelo', 'capacidad', 'tipo', 'descripcion_completa']

    def get_descripcion_completa(self, obj):
        return str(obj)
```

---

### 1.4 ViewSets y Endpoints

**Ubicación**: `tenants-backend/checkouters/views/dispositivo_personalizado.py`

```python
from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import DispositivoPersonalizado
from ..serializers.dispositivo_personalizado import (
    DispositivoPersonalizadoSerializer,
    DispositivoPersonalizadoSimpleSerializer
)

class IsAdmin(permissions.BasePermission):
    """Solo usuarios admin pueden crear/editar/eliminar"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class DispositivoPersonalizadoViewSet(viewsets.ModelViewSet):
    queryset = DispositivoPersonalizado.objects.filter(activo=True)
    serializer_class = DispositivoPersonalizadoSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'marca']
    search_fields = ['marca', 'modelo', 'capacidad', 'notas']
    ordering_fields = ['marca', 'modelo', 'created_at', 'precio_base_b2b']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def disponibles(self, request):
        """Listado simplificado para formularios (todos los usuarios autenticados)"""
        queryset = self.get_queryset()
        serializer = DispositivoPersonalizadoSimpleSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def calcular_oferta(self, request, pk=None):
        """Calcular oferta para un dispositivo personalizado"""
        dispositivo = self.get_object()
        estado = request.data.get('estado', 'excelente')  # excelente/bueno/malo
        canal = request.data.get('canal', 'B2B')  # B2B/B2C

        oferta = dispositivo.calcular_oferta(estado, canal)

        return Response({
            'dispositivo_id': dispositivo.id,
            'estado': estado,
            'canal': canal,
            'precio_base': dispositivo.precio_base_b2b if canal == 'B2B' else dispositivo.precio_base_b2c,
            'ajuste_aplicado': getattr(dispositivo, f'ajuste_{estado}'),
            'oferta': oferta,
        })
```

**Registrar en URLs**: `tenants-backend/checkouters/urls.py`

```python
from .views.dispositivo_personalizado import DispositivoPersonalizadoViewSet

router.register(r'dispositivos-personalizados', DispositivoPersonalizadoViewSet, basename='dispositivo-personalizado')
```

**Endpoints resultantes**:
- `GET /api/dispositivos-personalizados/` - Listar (solo admin puede ver todos)
- `POST /api/dispositivos-personalizados/` - Crear (solo admin)
- `GET /api/dispositivos-personalizados/{id}/` - Detalle
- `PUT/PATCH /api/dispositivos-personalizados/{id}/` - Actualizar (solo admin)
- `DELETE /api/dispositivos-personalizados/{id}/` - Eliminar (soft delete, solo admin)
- `GET /api/dispositivos-personalizados/disponibles/` - Listado simple para formularios (todos)
- `POST /api/dispositivos-personalizados/{id}/calcular_oferta/` - Calcular oferta

---

### 1.5 Modificar Serializer de DispositivoReal

**Ubicación**: Serializer existente de DispositivoReal

```python
class DispositivoRealSerializer(serializers.ModelSerializer):
    # ... campos existentes ...

    dispositivo_personalizado = DispositivoPersonalizadoSimpleSerializer(read_only=True)
    dispositivo_personalizado_id = serializers.PrimaryKeyRelatedField(
        queryset=DispositivoPersonalizado.objects.filter(activo=True),
        source='dispositivo_personalizado',
        write_only=True,
        required=False,
        allow_null=True
    )

    # Hacer modelo y capacidad opcionales
    modelo_id = serializers.PrimaryKeyRelatedField(
        queryset=Modelo.objects.all(),
        source='modelo',
        required=False,
        allow_null=True
    )
    capacidad_id = serializers.PrimaryKeyRelatedField(
        queryset=Capacidad.objects.all(),
        source='capacidad',
        required=False,
        allow_null=True
    )

    def validate(self, data):
        tiene_catalogo = data.get('modelo') and data.get('capacidad')
        tiene_personalizado = data.get('dispositivo_personalizado')

        if not tiene_catalogo and not tiene_personalizado:
            raise serializers.ValidationError("Debe especificar (modelo + capacidad) o dispositivo_personalizado")

        if tiene_catalogo and tiene_personalizado:
            raise serializers.ValidationError("No puede especificar ambos: catálogo normal y dispositivo personalizado")

        return data
```

---

## Fase 2: Frontend - Vista Admin

### 2.1 Nueva página `/admin/dispositivos-personalizados`

**Ubicación**: `tenant-frontend/src/app/(dashboard)/admin/dispositivos-personalizados/page.tsx`

```typescript
import { Container, Typography, Box, Button } from '@mui/material'
import { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DispositivosPersonalizadosTable from '@/features/admin/components/DispositivosPersonalizadosTable'
import DispositivoPersonalizadoModal from '@/features/admin/components/DispositivoPersonalizadoModal'

export default function DispositivosPersonalizadosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const handleCreate = () => {
    setEditingId(null)
    setModalOpen(true)
  }

  const handleEdit = (id: number) => {
    setEditingId(id)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Dispositivos Personalizados
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            Crear Dispositivo
          </Button>
        </Box>

        <DispositivosPersonalizadosTable onEdit={handleEdit} />

        <DispositivoPersonalizadoModal
          open={modalOpen}
          onClose={handleClose}
          dispositivoId={editingId}
        />
      </Box>
    </Container>
  )
}
```

---

### 2.2 Componente Tabla

**Ubicación**: `tenant-frontend/src/features/admin/components/DispositivosPersonalizadosTable.tsx`

```typescript
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, IconButton, Tooltip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import TablaReactiva2 from '@/shared/components/tables/TablaReactiva2'
import { DispositivoPersonalizado } from '@/shared/types/dispositivos'
import api from '@/services/api'

interface Props {
  onEdit: (id: number) => void
}

export default function DispositivosPersonalizadosTable({ onEdit }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['dispositivos-personalizados'],
    queryFn: async () => {
      const response = await api.get<DispositivoPersonalizado[]>('/api/dispositivos-personalizados/')
      return response.data
    },
  })

  const columns = useMemo(() => [
    {
      accessorKey: 'marca',
      header: 'Marca',
    },
    {
      accessorKey: 'modelo',
      header: 'Modelo',
    },
    {
      accessorKey: 'capacidad',
      header: 'Capacidad',
      cell: ({ row }) => row.original.capacidad || '-',
    },
    {
      accessorKey: 'tipo',
      header: 'Tipo',
      cell: ({ row }) => {
        const tipos = {
          movil: 'Móvil',
          portatil: 'Portátil',
          monitor: 'Monitor',
          tablet: 'Tablet',
          otro: 'Otro',
        }
        return <Chip label={tipos[row.original.tipo as keyof typeof tipos]} size="small" />
      },
    },
    {
      accessorKey: 'precio_base_b2b',
      header: 'Precio B2B',
      cell: ({ row }) => `${row.original.precio_base_b2b}€`,
    },
    {
      accessorKey: 'precio_base_b2c',
      header: 'Precio B2C',
      cell: ({ row }) => `${row.original.precio_base_b2c}€`,
    },
    {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => (
        <Box>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(row.original.id)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ], [onEdit])

  return (
    <TablaReactiva2
      data={data ?? []}
      columns={columns}
      isLoading={isLoading}
      enableGlobalFilter
      globalFilterPlaceholder="Buscar por marca, modelo, capacidad..."
    />
  )
}
```

---

### 2.3 Componente Modal Crear/Editar

**Ubicación**: `tenant-frontend/src/features/admin/components/DispositivoPersonalizadoModal.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  Typography,
  Divider,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '@/services/api'
import { DispositivoPersonalizado, TipoDispositivo } from '@/shared/types/dispositivos'

interface Props {
  open: boolean
  onClose: () => void
  dispositivoId?: number | null
}

const TIPOS: { value: TipoDispositivo; label: string }[] = [
  { value: 'movil', label: 'Móvil' },
  { value: 'portatil', label: 'Portátil' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'otro', label: 'Otro' },
]

export default function DispositivoPersonalizadoModal({ open, onClose, dispositivoId }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!dispositivoId

  const [formData, setFormData] = useState({
    marca: '',
    modelo: '',
    capacidad: '',
    tipo: 'movil' as TipoDispositivo,
    precio_base_b2b: '',
    precio_base_b2c: '',
    ajuste_excelente: '100',
    ajuste_bueno: '80',
    ajuste_malo: '50',
    caracteristicas: '',
    notas: '',
  })

  const { data: dispositivo } = useQuery({
    queryKey: ['dispositivo-personalizado', dispositivoId],
    queryFn: async () => {
      const response = await api.get<DispositivoPersonalizado>(`/api/dispositivos-personalizados/${dispositivoId}/`)
      return response.data
    },
    enabled: !!dispositivoId,
  })

  useEffect(() => {
    if (dispositivo) {
      setFormData({
        marca: dispositivo.marca,
        modelo: dispositivo.modelo,
        capacidad: dispositivo.capacidad || '',
        tipo: dispositivo.tipo,
        precio_base_b2b: String(dispositivo.precio_base_b2b),
        precio_base_b2c: String(dispositivo.precio_base_b2c),
        ajuste_excelente: String(dispositivo.ajuste_excelente),
        ajuste_bueno: String(dispositivo.ajuste_bueno),
        ajuste_malo: String(dispositivo.ajuste_malo),
        caracteristicas: JSON.stringify(dispositivo.caracteristicas || {}, null, 2),
        notas: dispositivo.notas || '',
      })
    } else {
      // Reset form cuando no hay dispositivo
      setFormData({
        marca: '',
        modelo: '',
        capacidad: '',
        tipo: 'movil',
        precio_base_b2b: '',
        precio_base_b2c: '',
        ajuste_excelente: '100',
        ajuste_bueno: '80',
        ajuste_malo: '50',
        caracteristicas: '',
        notas: '',
      })
    }
  }, [dispositivo])

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        precio_base_b2b: parseFloat(data.precio_base_b2b),
        precio_base_b2c: parseFloat(data.precio_base_b2c),
        ajuste_excelente: parseInt(data.ajuste_excelente),
        ajuste_bueno: parseInt(data.ajuste_bueno),
        ajuste_malo: parseInt(data.ajuste_malo),
        caracteristicas: data.caracteristicas ? JSON.parse(data.caracteristicas) : {},
      }

      if (isEdit) {
        return api.put(`/api/dispositivos-personalizados/${dispositivoId}/`, payload)
      } else {
        return api.post('/api/dispositivos-personalizados/', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      toast.success(isEdit ? 'Dispositivo actualizado' : 'Dispositivo creado')
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Error al guardar')
    },
  })

  const handleSubmit = () => {
    if (!formData.marca || !formData.modelo || !formData.precio_base_b2b || !formData.precio_base_b2c) {
      toast.error('Completa los campos obligatorios')
      return
    }

    mutation.mutate(formData)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? 'Editar' : 'Crear'} Dispositivo Personalizado</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Marca *"
              value={formData.marca}
              onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
              placeholder="Samsung, Xiaomi, Dell, LG..."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Modelo *"
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              placeholder="Galaxy S23, XPS 15, UltraWide 34..."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Capacidad"
              value={formData.capacidad}
              onChange={(e) => setFormData({ ...formData, capacidad: e.target.value })}
              placeholder="256GB, 1TB SSD..."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Tipo *"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoDispositivo })}
            >
              {TIPOS.map((tipo) => (
                <MenuItem key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">Precios Base</Typography>
            </Divider>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Precio Base B2B *"
              value={formData.precio_base_b2b}
              onChange={(e) => setFormData({ ...formData, precio_base_b2b: e.target.value })}
              InputProps={{ endAdornment: '€' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Precio Base B2C *"
              value={formData.precio_base_b2c}
              onChange={(e) => setFormData({ ...formData, precio_base_b2c: e.target.value })}
              InputProps={{ endAdornment: '€' }}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">Ajustes por Estado (%)</Typography>
            </Divider>
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Excelente"
              value={formData.ajuste_excelente}
              onChange={(e) => setFormData({ ...formData, ajuste_excelente: e.target.value })}
              InputProps={{ endAdornment: '%' }}
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Bueno"
              value={formData.ajuste_bueno}
              onChange={(e) => setFormData({ ...formData, ajuste_bueno: e.target.value })}
              InputProps={{ endAdornment: '%' }}
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type="number"
              label="Malo"
              value={formData.ajuste_malo}
              onChange={(e) => setFormData({ ...formData, ajuste_malo: e.target.value })}
              InputProps={{ endAdornment: '%' }}
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Características (JSON)"
              value={formData.caracteristicas}
              onChange={(e) => setFormData({ ...formData, caracteristicas: e.target.value })}
              placeholder='{"RAM": "16GB", "Procesador": "i7", "Pantalla": "15.6\""}'
              helperText="Formato JSON opcional para características técnicas"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Información adicional, detalles específicos..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

---

## Fase 3: Frontend - Integración con Formulario Valoración

### 3.1 Types TypeScript

**Ubicación**: `tenant-frontend/src/shared/types/dispositivos.ts`

```typescript
export type TipoDispositivo = 'movil' | 'portatil' | 'monitor' | 'tablet' | 'otro'
export type EstadoGeneral = 'excelente' | 'bueno' | 'malo'

export interface DispositivoPersonalizado {
  id: number
  marca: string
  modelo: string
  capacidad?: string
  tipo: TipoDispositivo
  precio_base_b2b: number
  precio_base_b2c: number
  ajuste_excelente: number
  ajuste_bueno: number
  ajuste_malo: number
  caracteristicas: Record<string, any>
  notas?: string
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  activo: boolean
  descripcion_completa: string
}

export interface DispositivoPersonalizadoSimple {
  id: number
  marca: string
  modelo: string
  capacidad?: string
  tipo: TipoDispositivo
  descripcion_completa: string
}
```

---

### 3.2 Modificar PasoDatosBasicos

**Ubicación**: `tenant-frontend/src/features/opportunities/components/forms/PasoDatosBasicos.tsx`

Agregar toggle al inicio:

```typescript
import { Switch, FormControlLabel, Autocomplete, Button } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

// Agregar nuevos props
interface Props {
  // ... props existentes ...
  esDispositivoPersonalizado: boolean
  setEsDispositivoPersonalizado: (value: boolean) => void
  dispositivoPersonalizado: number | string
  setDispositivoPersonalizado: (value: number | string) => void
  onCrearPersonalizado: () => void
}

export default function PasoDatosBasicos({
  // ... destructuring existente ...
  esDispositivoPersonalizado,
  setEsDispositivoPersonalizado,
  dispositivoPersonalizado,
  setDispositivoPersonalizado,
  onCrearPersonalizado,
}: Props) {
  const { data: dispositivosPersonalizados = [] } = useQuery({
    queryKey: ['dispositivos-personalizados-disponibles'],
    queryFn: async () => {
      const response = await api.get('/api/dispositivos-personalizados/disponibles/')
      return response.data
    },
  })

  return (
    <Box>
      {/* Toggle Dispositivo Personalizado */}
      <FormControlLabel
        control={
          <Switch
            checked={esDispositivoPersonalizado}
            onChange={(e) => setEsDispositivoPersonalizado(e.target.checked)}
          />
        }
        label="Dispositivo personalizado (no Apple)"
      />

      {esDispositivoPersonalizado ? (
        <Box sx={{ mt: 2 }}>
          <Autocomplete
            options={dispositivosPersonalizados}
            getOptionLabel={(option) => option.descripcion_completa}
            value={dispositivosPersonalizados.find(d => d.id === dispositivoPersonalizado) || null}
            onChange={(_, newValue) => setDispositivoPersonalizado(newValue?.id || '')}
            renderInput={(params) => (
              <TextField {...params} label="Dispositivo personalizado" />
            )}
          />

          <Button
            startIcon={<AddIcon />}
            onClick={onCrearPersonalizado}
            sx={{ mt: 1 }}
            size="small"
          >
            Crear nuevo dispositivo personalizado
          </Button>
        </Box>
      ) : (
        <>
          {/* Selectores normales de marca/tipo/modelo/capacidad */}
          {/* ... código existente ... */}
        </>
      )}
    </Box>
  )
}
```

---

### 3.3 Nuevo componente PasoEstadoGeneral

**Ubicación**: `tenant-frontend/src/features/opportunities/components/forms/PasoEstadoGeneral.tsx`

```typescript
'use client'

import { Box, Typography, Card, CardContent, CardActionArea, Stack, Chip } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { EstadoGeneral } from '@/shared/types/dispositivos'

interface Props {
  estadoGeneral: EstadoGeneral | ''
  setEstadoGeneral: (estado: EstadoGeneral) => void
}

const ESTADOS: { value: EstadoGeneral; label: string; descripcion: string; color: string }[] = [
  {
    value: 'excelente',
    label: 'Excelente',
    descripcion: 'Dispositivo en perfecto estado, sin marcas visibles, funciona perfectamente',
    color: '#4caf50',
  },
  {
    value: 'bueno',
    label: 'Bueno',
    descripcion: 'Signos leves de uso, pequeños arañazos, funcionalidad completa',
    color: '#ff9800',
  },
  {
    value: 'malo',
    label: 'Malo',
    descripcion: 'Desgaste visible, golpes, arañazos profundos, puede tener fallos funcionales',
    color: '#f44336',
  },
]

export default function PasoEstadoGeneral({ estadoGeneral, setEstadoGeneral }: Props) {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        ¿En qué estado general está el dispositivo?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Selecciona el estado que mejor describa el dispositivo. El precio se ajustará automáticamente.
      </Typography>

      <Stack spacing={2}>
        {ESTADOS.map((estado) => (
          <Card
            key={estado.value}
            variant="outlined"
            sx={{
              borderColor: estadoGeneral === estado.value ? estado.color : 'divider',
              borderWidth: estadoGeneral === estado.value ? 2 : 1,
            }}
          >
            <CardActionArea onClick={() => setEstadoGeneral(estado.value)}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: estado.color }}>
                      {estado.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {estado.descripcion}
                    </Typography>
                  </Box>
                  {estadoGeneral === estado.value && (
                    <CheckCircleIcon sx={{ color: estado.color, fontSize: 32 }} />
                  )}
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
```

---

### 3.4 Modificar FormularioValoracionOportunidad

**Cambios principales**:

1. **Nuevo estado para dispositivos personalizados**:
```typescript
const [esDispositivoPersonalizado, setEsDispositivoPersonalizado] = useState(false)
const [dispositivoPersonalizado, setDispositivoPersonalizado] = useState<number | string>('')
const [estadoGeneral, setEstadoGeneral] = useState<EstadoGeneral | ''>('')
const [modalPersonalizadoOpen, setModalPersonalizadoOpen] = useState(false)
```

2. **Modificar visibleSteps**:
```typescript
const visibleSteps: FormStep[] = useMemo(() => {
  if (esDispositivoPersonalizado) {
    return ['Datos básicos', 'Estado general', 'Valoración']
  }

  // ... lógica existente para dispositivos Apple ...
}, [esDispositivoPersonalizado, saltarsePreguntas, hasBattery, hasScreen])
```

3. **Query para calcular oferta de dispositivo personalizado**:
```typescript
const { data: ofertaPersonalizada } = useQuery({
  queryKey: ['oferta-personalizada', dispositivoPersonalizado, estadoGeneral, tipoCliente],
  queryFn: async () => {
    const response = await api.post(
      `/api/dispositivos-personalizados/${dispositivoPersonalizado}/calcular_oferta/`,
      { estado: estadoGeneral, canal: tipoCliente }
    )
    return response.data
  },
  enabled: !!esDispositivoPersonalizado && !!dispositivoPersonalizado && !!estadoGeneral,
})
```

4. **Modificar handleSubmit**:
```typescript
const handleSubmit = async (continuar = false) => {
  const data: Record<string, unknown> = esDispositivoPersonalizado
    ? {
        dispositivo_personalizado_id: dispositivoPersonalizado,
        estado_valoracion: estadoGeneral,
        precio_orientativo: ofertaPersonalizada?.oferta,
        cantidad: 1,
        oportunidad: Number(oportunidadId),
      }
    : {
        // ... datos normales para dispositivos Apple ...
      }

  // ... resto del código de guardado ...
}
```

---

## Fase 4: Testing

### 4.1 Backend Tests

**Ubicación**: `tenants-backend/checkouters/tests/test_dispositivos_personalizados.py`

```python
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from ..models import DispositivoPersonalizado

class DispositivoPersonalizadoTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin',
            password='admin123',
            is_staff=True
        )
        self.partner = User.objects.create_user(
            username='partner',
            password='partner123'
        )
        self.client = APIClient()

    def test_solo_admin_puede_crear(self):
        """Solo usuarios admin pueden crear dispositivos personalizados"""
        self.client.force_authenticate(user=self.partner)

        response = self.client.post('/api/dispositivos-personalizados/', {
            'marca': 'Samsung',
            'modelo': 'Galaxy S23',
            'tipo': 'movil',
            'precio_base_b2b': 450,
            'precio_base_b2c': 500,
        })

        self.assertEqual(response.status_code, 403)

        # Admin sí puede
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/dispositivos-personalizados/', {
            'marca': 'Samsung',
            'modelo': 'Galaxy S23',
            'tipo': 'movil',
            'precio_base_b2b': 450,
            'precio_base_b2c': 500,
        })

        self.assertEqual(response.status_code, 201)

    def test_calcular_oferta(self):
        """Calcular oferta según estado y canal"""
        self.client.force_authenticate(user=self.admin)

        dispositivo = DispositivoPersonalizado.objects.create(
            marca='Xiaomi',
            modelo='Redmi Note 12',
            tipo='movil',
            precio_base_b2b=200,
            precio_base_b2c=250,
            ajuste_excelente=100,
            ajuste_bueno=80,
            ajuste_malo=50,
            created_by=self.admin,
        )

        # Excelente B2B: 200 * 100% = 200€
        self.assertEqual(dispositivo.calcular_oferta('excelente', 'B2B'), 200)

        # Bueno B2B: 200 * 80% = 160€
        self.assertEqual(dispositivo.calcular_oferta('bueno', 'B2B'), 160)

        # Malo B2C: 250 * 50% = 125€
        self.assertEqual(dispositivo.calcular_oferta('malo', 'B2C'), 125)

    def test_validacion_precios_positivos(self):
        """Los precios deben ser mayores o iguales a 0"""
        self.client.force_authenticate(user=self.admin)

        response = self.client.post('/api/dispositivos-personalizados/', {
            'marca': 'Dell',
            'modelo': 'XPS 15',
            'tipo': 'portatil',
            'precio_base_b2b': -100,  # Precio negativo
            'precio_base_b2c': 800,
        })

        self.assertEqual(response.status_code, 400)
```

---

### 4.2 Frontend API Tests

**Ubicación**: `tenant-frontend/src/__tests__/api/dispositivos-personalizados.test.ts`

```typescript
import MockAdapter from 'axios-mock-adapter'
import api from '@/services/api'
import { DispositivoPersonalizado } from '@/shared/types/dispositivos'

describe('API: Dispositivos Personalizados', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(api)
  })

  afterEach(() => {
    mock.restore()
  })

  it('debe listar dispositivos personalizados disponibles', async () => {
    const mockData: DispositivoPersonalizado[] = [
      {
        id: 1,
        marca: 'Samsung',
        modelo: 'Galaxy S23',
        capacidad: '256GB',
        tipo: 'movil',
        precio_base_b2b: 450,
        precio_base_b2c: 500,
        ajuste_excelente: 100,
        ajuste_bueno: 80,
        ajuste_malo: 50,
        caracteristicas: {},
        activo: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
        descripcion_completa: 'Samsung Galaxy S23 256GB',
      },
    ]

    mock.onGet('/api/dispositivos-personalizados/disponibles/').reply(200, mockData)

    const response = await api.get('/api/dispositivos-personalizados/disponibles/')

    expect(response.data).toHaveLength(1)
    expect(response.data[0].marca).toBe('Samsung')
  })

  it('debe calcular oferta correctamente', async () => {
    const mockResponse = {
      dispositivo_id: 1,
      estado: 'bueno',
      canal: 'B2B',
      precio_base: 450,
      ajuste_aplicado: 80,
      oferta: 360,
    }

    mock.onPost('/api/dispositivos-personalizados/1/calcular_oferta/').reply(200, mockResponse)

    const response = await api.post('/api/dispositivos-personalizados/1/calcular_oferta/', {
      estado: 'bueno',
      canal: 'B2B',
    })

    expect(response.data.oferta).toBe(360)
    expect(response.data.ajuste_aplicado).toBe(80)
  })

  it('debe crear dispositivo personalizado (solo admin)', async () => {
    const nuevoDispositivo = {
      marca: 'Xiaomi',
      modelo: 'Redmi Note 12',
      tipo: 'movil',
      precio_base_b2b: 200,
      precio_base_b2c: 250,
    }

    mock.onPost('/api/dispositivos-personalizados/').reply(201, {
      id: 2,
      ...nuevoDispositivo,
      ajuste_excelente: 100,
      ajuste_bueno: 80,
      ajuste_malo: 50,
      caracteristicas: {},
      activo: true,
    })

    const response = await api.post('/api/dispositivos-personalizados/', nuevoDispositivo)

    expect(response.status).toBe(201)
    expect(response.data.marca).toBe('Xiaomi')
  })
})
```

---

## Fase 5: Navegación

### Agregar enlace en menú admin

**Ubicación**: Componente de navegación principal (layout o sidebar)

```typescript
{
  label: 'Dispositivos Personalizados',
  href: '/admin/dispositivos-personalizados',
  icon: <DevicesOtherIcon />,
  roles: ['admin'],
}
```

---

## Resumen de Implementación

### Archivos Nuevos (Backend)
1. `tenants-backend/checkouters/models/dispositivo_personalizado.py`
2. `tenants-backend/checkouters/serializers/dispositivo_personalizado.py`
3. `tenants-backend/checkouters/views/dispositivo_personalizado.py`
4. `tenants-backend/checkouters/tests/test_dispositivos_personalizados.py`
5. Migración para DispositivoPersonalizado
6. Migración para modificar DispositivoReal

### Archivos Nuevos (Frontend)
1. `tenant-frontend/src/app/(dashboard)/admin/dispositivos-personalizados/page.tsx`
2. `tenant-frontend/src/features/admin/components/DispositivosPersonalizadosTable.tsx`
3. `tenant-frontend/src/features/admin/components/DispositivoPersonalizadoModal.tsx`
4. `tenant-frontend/src/features/opportunities/components/forms/PasoEstadoGeneral.tsx`
5. `tenant-frontend/src/shared/types/dispositivos.ts`
6. `tenant-frontend/src/__tests__/api/dispositivos-personalizados.test.ts`

### Archivos Modificados
1. `tenants-backend/checkouters/urls.py` (registrar router)
2. `tenants-backend/checkouters/serializers.py` (modificar DispositivoRealSerializer)
3. `tenant-frontend/src/features/opportunities/components/forms/FormularioValoracionOportunidad.tsx`
4. `tenant-frontend/src/features/opportunities/components/forms/PasoDatosBasicos.tsx`
5. Navegación principal (agregar enlace)

---

## Flujo de Usuario Completo

### Admin crea dispositivo personalizado
1. Admin va a `/admin/dispositivos-personalizados`
2. Click "Crear Dispositivo"
3. Rellena: Samsung Galaxy S23 256GB, Móvil, B2B: 450€, B2C: 500€
4. Ajustes: Excelente 100%, Bueno 80%, Malo 50%
5. Guarda → dispositivo disponible en catálogo

### Admin valora dispositivo personalizado en oportunidad
1. Admin abre oportunidad de partner
2. Click "Añadir dispositivo"
3. Activa toggle "Dispositivo personalizado"
4. Selecciona "Samsung Galaxy S23 256GB" del dropdown
5. Elige estado: "Bueno" (80%)
6. Sistema calcula: 450€ × 80% = 360€
7. Guarda → dispositivo asociado a oportunidad

### Partner ve dispositivo personalizado
1. Partner abre su oportunidad
2. Ve listado de dispositivos con "Samsung Galaxy S23 256GB - 360€"
3. No puede editar ni crear dispositivos personalizados (solo admin)

---

## Estimaciones

- **Backend**: 4-5 horas (modelos, serializers, viewsets, tests)
- **Frontend Admin**: 2-3 horas (vista, tabla, modal)
- **Frontend Formulario**: 2-3 horas (integración, paso estado general)
- **Testing**: 1-2 horas (API tests, component tests)
- **Total**: 9-13 horas

---

## Notas Técnicas

### Permisos
- Solo usuarios con `is_staff=True` pueden crear/editar/eliminar
- Todos los usuarios autenticados pueden listar para selección
- Partners solo ven dispositivos personalizados asociados a sus oportunidades

### Validaciones
- Precios deben ser ≥ 0
- Ajustes deben estar entre 0-100
- Características en formato JSON válido
- Dispositivo real debe tener o bien (modelo + capacidad) o bien dispositivo_personalizado

### Cálculo de Oferta
```
oferta = precio_base[canal] × (ajuste[estado] / 100)
oferta_redondeada = round(oferta / 5) × 5
```

### Extensibilidad
- Fácil agregar más tipos de dispositivos
- Ajustes de estado personalizables por dispositivo
- Características técnicas flexibles con JSONField
- Sistema de soft-delete con campo `activo`
