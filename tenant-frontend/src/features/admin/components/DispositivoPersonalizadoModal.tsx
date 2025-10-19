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
  dispositivo: DispositivoPersonalizado | null
}

interface FormData {
  marca: string
  modelo: string
  capacidad: string
  tipo: 'movil' | 'portatil' | 'tablet' | 'monitor' | 'otro' | ''
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
  capacidad: '',
  tipo: '',
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
}: DispositivoPersonalizadoModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const isEditMode = !!dispositivo

  // Populate form when editing
  useEffect(() => {
    if (open && dispositivo) {
      setFormData({
        marca: dispositivo.marca,
        modelo: dispositivo.modelo,
        capacidad: dispositivo.capacidad,
        tipo: dispositivo.tipo,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      toast.success('Dispositivo creado correctamente')
      onClose()
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
    setFormData((prev) => ({ ...prev, [field]: value }))

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
    // Check required fields
    if (!formData.marca.trim()) return false
    if (!formData.modelo.trim()) return false
    if (!formData.capacidad.trim()) return false
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

          {/* Capacidad */}
          <TextField
            label="Capacidad"
            value={formData.capacidad}
            onChange={(e) => handleChange('capacidad', e.target.value)}
            onBlur={() => handleBlur('capacidad')}
            required
            fullWidth
            error={!!errors.capacidad}
            helperText={errors.capacidad}
            placeholder="Ej: 256GB, 512GB, 1TB SSD"
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
