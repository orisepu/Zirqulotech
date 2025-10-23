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
  tipo: 'movil' | 'portatil' | 'pc' | 'tablet' | 'monitor' | 'otro' | ''

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

  // Sistema de grading (porcentajes de penalización)
  pp_A: string  // Penalización A+ → A (default 0.08 = 8%)
  pp_B: string  // Penalización A → B (default 0.12 = 12%)
  pp_C: string  // Penalización B → C (default 0.15 = 15%)
  precio_suelo: string  // Precio mínimo ofertable
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

  // Valores por defecto del sistema de grading
  pp_A: '0.08',  // 8%
  pp_B: '0.12',  // 12%
  pp_C: '0.15',  // 15%
  precio_suelo: '0',
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

        pp_A: String(dispositivo.pp_A),
        pp_B: String(dispositivo.pp_B),
        pp_C: String(dispositivo.pp_C),
        precio_suelo: String(dispositivo.precio_suelo),
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
    mutationFn: async (data: any) => {
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
    mutationFn: async (data: any) => {
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
    if (field === 'pp_A' || field === 'pp_B' || field === 'pp_C') {
      const numValue = parseFloat(value as string)
      if (isNaN(numValue) || numValue < 0 || numValue > 1) {
        return 'El porcentaje debe estar entre 0 y 1 (ej: 0.08 para 8%)'
      }
    }

    if (field === 'precio_suelo') {
      const numValue = parseFloat(value as string)
      if (isNaN(numValue) || numValue < 0) {
        return 'El precio suelo debe ser un valor positivo o 0'
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
    // Solo campos obligatorios: marca, modelo, tipo
    if (!formData.marca.trim()) return false
    if (!formData.modelo.trim()) return false
    if (!formData.tipo) return false

    // Check for validation errors
    if (Object.keys(errors).length > 0) return false

    // Validate grading percentages
    const pp_a = parseFloat(formData.pp_A)
    const pp_b = parseFloat(formData.pp_B)
    const pp_c = parseFloat(formData.pp_C)
    const precio_suelo = parseFloat(formData.precio_suelo)

    if (isNaN(pp_a) || pp_a < 0 || pp_a > 1) return false
    if (isNaN(pp_b) || pp_b < 0 || pp_b > 1) return false
    if (isNaN(pp_c) || pp_c < 0 || pp_c > 1) return false
    if (isNaN(precio_suelo) || precio_suelo < 0) return false

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
    } else if (formData.tipo === 'portatil' || formData.tipo === 'pc') {
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
      tipo: formData.tipo as 'movil' | 'portatil' | 'pc' | 'tablet' | 'monitor' | 'otro',
      pp_A: parseFloat(formData.pp_A),
      pp_B: parseFloat(formData.pp_B),
      pp_C: parseFloat(formData.pp_C),
      precio_suelo: parseFloat(formData.precio_suelo),
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
              <MenuItem value="pc">PC</MenuItem>
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

          {/* Campos específicos de Portátil/PC */}
          {(formData.tipo === 'portatil' || formData.tipo === 'pc') && (
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

          {/* Sistema de Grading (porcentajes de penalización en cascada) */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Penalización A+ → A (pp_A)"
              value={formData.pp_A}
              onChange={(e) => handleChange('pp_A', e.target.value)}
              onBlur={() => handleBlur('pp_A')}
              required
              fullWidth
              type="number"
              error={!!errors.pp_A}
              helperText={errors.pp_A || 'Ej: 0.08 para 8% de penalización'}
              inputProps={{ step: '0.01', min: '0', max: '1' }}
              disabled={isSaving}
            />

            <TextField
              label="Penalización A → B (pp_B)"
              value={formData.pp_B}
              onChange={(e) => handleChange('pp_B', e.target.value)}
              onBlur={() => handleBlur('pp_B')}
              required
              fullWidth
              type="number"
              error={!!errors.pp_B}
              helperText={errors.pp_B || 'Ej: 0.12 para 12% de penalización'}
              inputProps={{ step: '0.01', min: '0', max: '1' }}
              disabled={isSaving}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Penalización B → C (pp_C)"
              value={formData.pp_C}
              onChange={(e) => handleChange('pp_C', e.target.value)}
              onBlur={() => handleBlur('pp_C')}
              required
              fullWidth
              type="number"
              error={!!errors.pp_C}
              helperText={errors.pp_C || 'Ej: 0.15 para 15% de penalización'}
              inputProps={{ step: '0.01', min: '0', max: '1' }}
              disabled={isSaving}
            />

            <TextField
              label="Precio Suelo (mínimo ofertable)"
              value={formData.precio_suelo}
              onChange={(e) => handleChange('precio_suelo', e.target.value)}
              onBlur={() => handleBlur('precio_suelo')}
              required
              fullWidth
              type="number"
              error={!!errors.precio_suelo}
              helperText={errors.precio_suelo || 'Precio mínimo garantizado'}
              InputProps={{
                startAdornment: <InputAdornment position="start">€</InputAdornment>,
              }}
              inputProps={{ step: '1', min: '0' }}
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
