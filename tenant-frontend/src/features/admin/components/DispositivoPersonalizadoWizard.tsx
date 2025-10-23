'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  CircularProgress,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import dayjs from 'dayjs'
import api from '@/services/api'
import type { DispositivoPersonalizado, TipoDispositivo } from '@/shared/types/dispositivos'

// Importar pasos del wizard
import Paso1Tipo from './wizard-steps/Paso1Tipo'
import Paso2InfoBasica from './wizard-steps/Paso2InfoBasica'
import Paso3Caracteristicas from './wizard-steps/Paso3Caracteristicas'
import Paso4Precios from './wizard-steps/Paso4Precios'
import Paso5Resumen from './wizard-steps/Paso5Resumen'

interface DispositivoPersonalizadoWizardProps {
  open: boolean
  onClose: () => void
  dispositivo?: DispositivoPersonalizado | null
  onSuccess?: (dispositivo: DispositivoPersonalizado) => void
}

interface WizardFormData {
  // Paso 1: Tipo
  tipo: TipoDispositivo | ''

  // Paso 2: Info básica
  marca: string
  modelo: string
  notas: string

  // Paso 3: Características (dinámicas según tipo)
  // Móvil/Tablet
  capacidad: string

  // Monitor
  pulgadas: string
  herzios: string
  proporcion: string
  resolucion: string

  // PC/Portátil
  almacenamiento: string
  ram: string
  procesador: string
  grafica: string

  // Paso 4: Precios
  precio_b2b: string
  precio_b2c: string
  valid_from: any // Dayjs object

  // Sistema de grading
  pp_A: string
  pp_B: string
  pp_C: string
  precio_suelo: string

  // Metadata
  activo: boolean
}

const initialFormData: WizardFormData = {
  tipo: '',
  marca: '',
  modelo: '',
  notas: '',
  capacidad: '',
  pulgadas: '',
  herzios: '',
  proporcion: '',
  resolucion: '',
  almacenamiento: '',
  ram: '',
  procesador: '',
  grafica: '',
  precio_b2b: '',
  precio_b2c: '',
  valid_from: dayjs(),
  pp_A: '0.08',
  pp_B: '0.12',
  pp_C: '0.15',
  precio_suelo: '0',
  activo: true,
}

const PASOS = [
  'Tipo de dispositivo',
  'Información básica',
  'Características',
  'Precios',
  'Confirmación',
]

export default function DispositivoPersonalizadoWizard({
  open,
  onClose,
  dispositivo,
  onSuccess,
}: DispositivoPersonalizadoWizardProps) {
  const queryClient = useQueryClient()
  const [pasoActual, setPasoActual] = useState(0)
  const [formData, setFormData] = useState<WizardFormData>(initialFormData)

  const isEditMode = !!dispositivo

  // Reset wizard al abrir
  React.useEffect(() => {
    if (open && !dispositivo) {
      setPasoActual(0)
      setFormData(initialFormData)
    } else if (open && dispositivo) {
      // TODO: Cargar datos del dispositivo en modo edición
      setPasoActual(0)
    }
  }, [open, dispositivo])

  // Mutation para crear dispositivo
  const createDispositivoMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/dispositivos-personalizados/', data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      // El dispositivo fue creado, ahora crear precios
      return data
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Error al crear dispositivo')
    },
  })

  // Mutation para crear precio B2B
  const createPrecioB2BMutation = useMutation({
    mutationFn: async ({ dispositivoId, precio }: { dispositivoId: number; precio: number }) => {
      const response = await api.post(
        `/api/dispositivos-personalizados/${dispositivoId}/set_precio/`,
        {
          canal: 'B2B',
          precio_neto: precio,
          valid_from: formData.valid_from.toISOString(),
          fuente: 'manual',
        }
      )
      return response.data
    },
  })

  // Mutation para crear precio B2C
  const createPrecioB2CMutation = useMutation({
    mutationFn: async ({ dispositivoId, precio }: { dispositivoId: number; precio: number }) => {
      const response = await api.post(
        `/api/dispositivos-personalizados/${dispositivoId}/set_precio/`,
        {
          canal: 'B2C',
          precio_neto: precio,
          valid_from: formData.valid_from.toISOString(),
          fuente: 'manual',
        }
      )
      return response.data
    },
  })

  const handleNext = () => {
    if (pasoActual < PASOS.length - 1) {
      setPasoActual(pasoActual + 1)
    }
  }

  const handleBack = () => {
    if (pasoActual > 0) {
      setPasoActual(pasoActual - 1)
    }
  }

  const handleCancel = () => {
    if (!isSaving) {
      onClose()
    }
  }

  const handleSubmit = async () => {
    // Construir payload del dispositivo
    const caracteristicas: Record<string, string> = {}

    if (formData.tipo === 'monitor') {
      if (formData.pulgadas) caracteristicas.pulgadas = formData.pulgadas
      if (formData.herzios) caracteristicas.herzios = formData.herzios
      if (formData.proporcion) caracteristicas.proporcion = formData.proporcion
      if (formData.resolucion) caracteristicas.resolucion = formData.resolucion
    } else if (formData.tipo === 'portatil' || formData.tipo === 'pc') {
      if (formData.pulgadas) caracteristicas.pulgadas = formData.pulgadas
      if (formData.herzios) caracteristicas.herzios = formData.herzios
      if (formData.resolucion) caracteristicas.resolucion = formData.resolucion
      if (formData.almacenamiento) caracteristicas.almacenamiento = formData.almacenamiento
      if (formData.ram) caracteristicas.ram = formData.ram
      if (formData.procesador) caracteristicas.procesador = formData.procesador
      if (formData.grafica) caracteristicas.grafica = formData.grafica
    }

    const dispositivoPayload = {
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      capacidad: formData.capacidad.trim(),
      tipo: formData.tipo,
      caracteristicas,
      notas: formData.notas.trim(),
      activo: formData.activo,
      pp_A: parseFloat(formData.pp_A),
      pp_B: parseFloat(formData.pp_B),
      pp_C: parseFloat(formData.pp_C),
      precio_suelo: parseFloat(formData.precio_suelo),
    }

    try {
      // Paso 1: Crear dispositivo
      const nuevoDispositivo = await createDispositivoMutation.mutateAsync(dispositivoPayload)

      // Paso 2: Crear precio B2B
      const precioB2B = parseFloat(formData.precio_b2b)
      if (precioB2B > 0) {
        await createPrecioB2BMutation.mutateAsync({
          dispositivoId: nuevoDispositivo.id,
          precio: precioB2B,
        })
      }

      // Paso 3: Crear precio B2C
      const precioB2C = parseFloat(formData.precio_b2c)
      if (precioB2C > 0) {
        await createPrecioB2CMutation.mutateAsync({
          dispositivoId: nuevoDispositivo.id,
          precio: precioB2C,
        })
      }

      // Éxito
      toast.success('Dispositivo personalizado creado exitosamente')

      if (onSuccess) {
        onSuccess(nuevoDispositivo)
      } else {
        onClose()
      }
    } catch (error) {
      // Los errores ya se manejan en las mutations
      console.error('Error al crear dispositivo:', error)
    }
  }

  const isSaving =
    createDispositivoMutation.isPending ||
    createPrecioB2BMutation.isPending ||
    createPrecioB2CMutation.isPending

  // Validación por paso
  const canGoNext = (): boolean => {
    switch (pasoActual) {
      case 0: // Tipo
        return formData.tipo !== ''
      case 1: // Info básica
        return formData.marca.trim() !== '' && formData.modelo.trim() !== ''
      case 2: // Características - siempre puede avanzar (todos opcionales)
        return true
      case 3: // Precios
        const b2b = parseFloat(formData.precio_b2b)
        const b2c = parseFloat(formData.precio_b2c)
        return !isNaN(b2b) && b2b >= 0 && !isNaN(b2c) && b2c >= 0
      case 4: // Resumen
        return true
      default:
        return false
    }
  }

  const renderPaso = () => {
    switch (pasoActual) {
      case 0:
        return <Paso1Tipo formData={formData} setFormData={setFormData} />
      case 1:
        return <Paso2InfoBasica formData={formData} setFormData={setFormData} />
      case 2:
        return <Paso3Caracteristicas formData={formData} setFormData={setFormData} />
      case 3:
        return <Paso4Precios formData={formData} setFormData={setFormData} />
      case 4:
        return <Paso5Resumen formData={formData} />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditMode ? 'Editar dispositivo personalizado' : 'Crear dispositivo personalizado'}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={pasoActual} sx={{ mb: 4 }}>
            {PASOS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderPaso()}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button onClick={handleBack} disabled={pasoActual === 0 || isSaving}>
          Atrás
        </Button>
        {pasoActual < PASOS.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={!canGoNext() || isSaving}>
            Siguiente
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!canGoNext() || isSaving}
            startIcon={isSaving ? <CircularProgress size={16} /> : null}
          >
            {isSaving ? 'Guardando...' : 'Crear dispositivo'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
