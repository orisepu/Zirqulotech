'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  InputAdornment,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '@/services/api'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

interface DispositivoPersonalizadoModalProps {
  open: boolean
  onClose: () => void
  dispositivo?: DispositivoPersonalizado | null
  onSuccess?: (dispositivo: DispositivoPersonalizado) => void
}

interface FormData {
  marca: string
  modelo: string
  tipo: 'movil' | 'portatil' | 'tablet' | 'monitor' | 'otro' | ''

  // Campos genéricos (móvil, tablet, otro)
  capacidad: string

  // Campos específicos de Monitor
  pulgadas: string
  herzios: string
  proporcion: string
  resolucion: string

  // Campos específicos de Portátil
  almacenamiento: string
  ram: string
  procesador: string
  grafica: string

  precio_base_b2b: string
  precio_base_b2c: string
  ajuste_excelente: string
  ajuste_bueno: string
  ajuste_malo: string
  notas: string
  activo: boolean
}

const initialFormData: FormData = {
  marca: '',
  modelo: '',
  tipo: '',

  // Campos genéricos
  capacidad: '',

  // Campos Monitor
  pulgadas: '',
  herzios: '',
  proporcion: '',
  resolucion: '',

  // Campos Portátil
  almacenamiento: '',
  ram: '',
  procesador: '',
  grafica: '',

  precio_base_b2b: '',
  precio_base_b2c: '',
  ajuste_excelente: '100',
  ajuste_bueno: '80',
  ajuste_malo: '50',
  notas: '',
  activo: true,
}

export default function DispositivoPersonalizadoModal({
  open,
  onClose,
  dispositivo,
  onSuccess,
}: DispositivoPersonalizadoModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const isEditMode = !!dispositivo

  // Populate form when editing
  useEffect(() => {
    if (open && dispositivo) {
      const caract = dispositivo.caracteristicas || {}

      setFormData({
        marca: dispositivo.marca,
        modelo: dispositivo.modelo,
        tipo: dispositivo.tipo,

        // Campos genéricos
        capacidad: dispositivo.capacidad || '',

        // Campos Monitor (desde caracteristicas JSON)
        pulgadas: caract.pulgadas || '',
        herzios: caract.herzios || '',
        proporcion: caract.proporcion || '',
        resolucion: caract.resolucion || '',

        // Campos Portátil (desde caracteristicas JSON)
        almacenamiento: caract.almacenamiento || '',
        ram: caract.ram || '',
        procesador: caract.procesador || '',
        grafica: caract.grafica || '',

        precio_base_b2b: String(dispositivo.precio_base_b2b),
        precio_base_b2c: String(dispositivo.precio_base_b2c),
        ajuste_excelente: String(dispositivo.ajuste_excelente),
        ajuste_bueno: String(dispositivo.ajuste_bueno),
        ajuste_malo: String(dispositivo.ajuste_malo),
        notas: dispositivo.notas || '',
        activo: dispositivo.activo,
      })
      setErrors({})
    } else if (open && !dispositivo) {
      setFormData(initialFormData)
      setErrors({})
    }
  }, [open, dispositivo])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<DispositivoPersonalizado, 'id' | 'created_by' | 'created_by_name' | 'created_at' | 'updated_at' | 'descripcion_completa'>) => {
      const response = await api.post('/api/dispositivos-personalizados/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      // Si hay callback onSuccess, llamarlo (usado cuando se crea desde formulario de valoración)
      if (onSuccess) {
        onSuccess(data)
      } else {
        // Si no hay callback, comportamiento por defecto (usado desde admin)
        toast.success('Dispositivo creado correctamente')
        onClose()
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Error al crear dispositivo')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<DispositivoPersonalizado>) => {
      const response = await api.put(`/api/dispositivos-personalizados/${dispositivo!.id}/`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      toast.success('Dispositivo actualizado correctamente')
      onClose()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Error al actualizar dispositivo')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Validation
  const validateField = (field: keyof FormData, value: string | boolean): string | null => {
    if (field === 'precio_base_b2b' || field === 'precio_base_b2c') {
      const numValue = parseFloat(value as string)
      if (isNaN(numValue) || numValue < 0) {
        return 'El precio debe ser un valor positivo'
      }
    }

    if (field === 'ajuste_excelente' || field === 'ajuste_bueno' || field === 'ajuste_malo') {
      const numValue = parseFloat(value as string)
      if (isNaN(numValue) || numValue < 0 || numValue > 100) {
        return 'El ajuste debe estar entre 0 y 100'
      }
    }

    return null
  }

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Si cambia el tipo, limpiar campos específicos del tipo anterior
      if (field === 'tipo') {
        updated.capacidad = ''
        updated.pulgadas = ''
        updated.herzios = ''
        updated.proporcion = ''
        updated.resolucion = ''
        updated.almacenamiento = ''
        updated.ram = ''
        updated.procesador = ''
        updated.grafica = ''
      }

      return updated
    })

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleBlur = (field: keyof FormData) => {
    const value = formData[field]
    const error = validateField(field, value)
    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }))
    }
  }

  const isFormValid = (): boolean => {
    // Solo campos obligatorios: marca, modelo, tipo, precios
    if (!formData.marca.trim()) return false
    if (!formData.modelo.trim()) return false
    if (!formData.tipo) return false
    if (!formData.precio_base_b2b.trim()) return false
    if (!formData.precio_base_b2c.trim()) return false

    // Check for validation errors
    if (Object.keys(errors).length > 0) return false

    // Validate prices
    const b2b = parseFloat(formData.precio_base_b2b)
    const b2c = parseFloat(formData.precio_base_b2c)
    if (isNaN(b2b) || b2b < 0) return false
    if (isNaN(b2c) || b2c < 0) return false

    // Validate adjustments
    const ajustes = [
      parseFloat(formData.ajuste_excelente),
      parseFloat(formData.ajuste_bueno),
      parseFloat(formData.ajuste_malo),
    ]
    if (ajustes.some((a) => isNaN(a) || a < 0 || a > 100)) return false

    return true
  }

  const handleSave = () => {
    if (!isFormValid()) return

    // Construir objeto caracteristicas según el tipo de dispositivo
    let caracteristicas: Record<string, string> = {}

    if (formData.tipo === 'monitor') {
      caracteristicas = {
        pulgadas: formData.pulgadas.trim(),
        herzios: formData.herzios.trim(),
        proporcion: formData.proporcion.trim(),
        resolucion: formData.resolucion.trim(),
      }
    } else if (formData.tipo === 'portatil') {
      caracteristicas = {
        almacenamiento: formData.almacenamiento.trim(),
        ram: formData.ram.trim(),
        procesador: formData.procesador.trim(),
        grafica: formData.grafica.trim(),
      }
    }

    const payload = {
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      capacidad: formData.capacidad.trim(),
      tipo: formData.tipo as 'movil' | 'portatil' | 'tablet' | 'monitor' | 'otro',
      precio_base_b2b: parseFloat(formData.precio_base_b2b),
      precio_base_b2c: parseFloat(formData.precio_base_b2c),
      ajuste_excelente: parseFloat(formData.ajuste_excelente),
      ajuste_bueno: parseFloat(formData.ajuste_bueno),
      ajuste_malo: parseFloat(formData.ajuste_malo),
      notas: formData.notas.trim(),
      activo: formData.activo,
      caracteristicas,
    }

    if (isEditMode) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleCancel = () => {
    if (!isSaving) {
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {isEditMode ? 'Editar dispositivo personalizado' : 'Crear dispositivo personalizado'}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {/* Marca */}
          <TextField
            label="Marca"
            value={formData.marca}
            onChange={(e) => handleChange('marca', e.target.value)}
            onBlur={() => handleBlur('marca')}
            required
            fullWidth
            error={!!errors.marca}
            helperText={errors.marca}
            disabled={isSaving}
          />

          {/* Modelo */}
          <TextField
            label="Modelo"
            value={formData.modelo}
            onChange={(e) => handleChange('modelo', e.target.value)}
            onBlur={() => handleBlur('modelo')}
            required
            fullWidth
            error={!!errors.modelo}
            helperText={errors.modelo}
            disabled={isSaving}
          />

          {/* Tipo */}
          <FormControl fullWidth required disabled={isSaving}>
            <InputLabel>Tipo</InputLabel>
            <Select
              value={formData.tipo}
              onChange={(e) => handleChange('tipo', e.target.value)}
              label="Tipo"
            >
              <MenuItem value="movil">Móvil</MenuItem>
              <MenuItem value="portatil">Portátil</MenuItem>
              <MenuItem value="tablet">Tablet</MenuItem>
              <MenuItem value="monitor">Monitor</MenuItem>
              <MenuItem value="otro">Otro</MenuItem>
            </Select>
          </FormControl>

          {/* Campos específicos de Monitor */}
          {formData.tipo === 'monitor' && (
            <>
              <TextField
                label="Pulgadas"
                value={formData.pulgadas}
                onChange={(e) => handleChange('pulgadas', e.target.value)}
                onBlur={() => handleBlur('pulgadas')}
                fullWidth
                error={!!errors.pulgadas}
                helperText={errors.pulgadas || 'Ej: 24", 27", 32"'}
                disabled={isSaving}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Herzios"
                  value={formData.herzios}
                  onChange={(e) => handleChange('herzios', e.target.value)}
                  onBlur={() => handleBlur('herzios')}
                  fullWidth
                  error={!!errors.herzios}
                  helperText={errors.herzios || 'Ej: 60Hz, 144Hz, 165Hz'}
                  disabled={isSaving}
                />
                <TextField
                  label="Proporción"
                  value={formData.proporcion}
                  onChange={(e) => handleChange('proporcion', e.target.value)}
                  onBlur={() => handleBlur('proporcion')}
                  fullWidth
                  error={!!errors.proporcion}
                  helperText={errors.proporcion || 'Ej: 16:9, 21:9, 32:9'}
                  disabled={isSaving}
                />
              </Stack>
              <TextField
                label="Resolución"
                value={formData.resolucion}
                onChange={(e) => handleChange('resolucion', e.target.value)}
                onBlur={() => handleBlur('resolucion')}
                fullWidth
                error={!!errors.resolucion}
                helperText={errors.resolucion || 'Ej: 1920x1080, 2560x1440, 3840x2160'}
                disabled={isSaving}
              />
            </>
          )}

          {/* Campos específicos de Móvil/Tablet */}
          {(formData.tipo === 'movil' || formData.tipo === 'tablet') && (
            <TextField
              label="Capacidad (almacenamiento)"
              value={formData.capacidad}
              onChange={(e) => handleChange('capacidad', e.target.value)}
              onBlur={() => handleBlur('capacidad')}
              fullWidth
              error={!!errors.capacidad}
              helperText={errors.capacidad || 'Ej: 64GB, 128GB, 256GB, 512GB'}
              disabled={isSaving}
            />
          )}

          {/* Campos específicos de Portátil */}
          {formData.tipo === 'portatil' && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Almacenamiento"
                  value={formData.almacenamiento}
                  onChange={(e) => handleChange('almacenamiento', e.target.value)}
                  onBlur={() => handleBlur('almacenamiento')}
                  fullWidth
                  error={!!errors.almacenamiento}
                  helperText={errors.almacenamiento || 'Ej: 256GB SSD, 512GB SSD, 1TB SSD'}
                  disabled={isSaving}
                />
                <TextField
                  label="RAM"
                  value={formData.ram}
                  onChange={(e) => handleChange('ram', e.target.value)}
                  onBlur={() => handleBlur('ram')}
                  fullWidth
                  error={!!errors.ram}
                  helperText={errors.ram || 'Ej: 8GB, 16GB, 32GB'}
                  disabled={isSaving}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Procesador"
                  value={formData.procesador}
                  onChange={(e) => handleChange('procesador', e.target.value)}
                  onBlur={() => handleBlur('procesador')}
                  fullWidth
                  error={!!errors.procesador}
                  helperText={errors.procesador || 'Ej: Intel i5 11th Gen, AMD Ryzen 7'}
                  disabled={isSaving}
                />
                <TextField
                  label="Gráfica"
                  value={formData.grafica}
                  onChange={(e) => handleChange('grafica', e.target.value)}
                  onBlur={() => handleBlur('grafica')}
                  fullWidth
                  error={!!errors.grafica}
                  helperText={errors.grafica || 'Ej: Integrada, NVIDIA GTX 1650'}
                  disabled={isSaving}
                />
              </Stack>
            </>
          )}

          {/* Campo genérico para tipo "Otro" */}
          {formData.tipo === 'otro' && (
            <TextField
              label="Capacidad"
              value={formData.capacidad}
              onChange={(e) => handleChange('capacidad', e.target.value)}
              onBlur={() => handleBlur('capacidad')}
              fullWidth
              error={!!errors.capacidad}
              helperText={errors.capacidad || 'Descripción de capacidad o características específicas'}
              disabled={isSaving}
            />
          )}

          {/* Precios */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Precio B2B"
              value={formData.precio_base_b2b}
              onChange={(e) => handleChange('precio_base_b2b', e.target.value)}
              onBlur={() => handleBlur('precio_base_b2b')}
              required
              fullWidth
              type="number"
              error={!!errors.precio_base_b2b}
              helperText={errors.precio_base_b2b}
              InputProps={{
                startAdornment: <InputAdornment position="start">€</InputAdornment>,
              }}
              disabled={isSaving}
            />

            <TextField
              label="Precio B2C"
              value={formData.precio_base_b2c}
              onChange={(e) => handleChange('precio_base_b2c', e.target.value)}
              onBlur={() => handleBlur('precio_base_b2c')}
              required
              fullWidth
              type="number"
              error={!!errors.precio_base_b2c}
              helperText={errors.precio_base_b2c}
              InputProps={{
                startAdornment: <InputAdornment position="start">€</InputAdornment>,
              }}
              disabled={isSaving}
            />
          </Stack>

          {/* Ajustes de estado */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Ajuste Excelente (%)"
              value={formData.ajuste_excelente}
              onChange={(e) => handleChange('ajuste_excelente', e.target.value)}
              onBlur={() => handleBlur('ajuste_excelente')}
              fullWidth
              type="number"
              error={!!errors.ajuste_excelente}
              helperText={errors.ajuste_excelente}
              disabled={isSaving}
            />

            <TextField
              label="Ajuste Bueno (%)"
              value={formData.ajuste_bueno}
              onChange={(e) => handleChange('ajuste_bueno', e.target.value)}
              onBlur={() => handleBlur('ajuste_bueno')}
              fullWidth
              type="number"
              error={!!errors.ajuste_bueno}
              helperText={errors.ajuste_bueno}
              disabled={isSaving}
            />

            <TextField
              label="Ajuste Malo (%)"
              value={formData.ajuste_malo}
              onChange={(e) => handleChange('ajuste_malo', e.target.value)}
              onBlur={() => handleBlur('ajuste_malo')}
              fullWidth
              type="number"
              error={!!errors.ajuste_malo}
              helperText={errors.ajuste_malo}
              disabled={isSaving}
            />
          </Stack>

          {/* Notas */}
          <TextField
            label="Notas"
            value={formData.notas}
            onChange={(e) => handleChange('notas', e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Notas adicionales sobre el dispositivo (opcional)"
            disabled={isSaving}
          />

          {/* Activo */}
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.activo}
                onChange={(e) => handleChange('activo', e.target.checked)}
                disabled={isSaving}
              />
            }
            label="Activo"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!isFormValid() || isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
