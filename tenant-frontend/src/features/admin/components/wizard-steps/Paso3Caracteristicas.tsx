'use client'

import React from 'react'
import { Box, TextField, Typography, Stack, Alert } from '@mui/material'

interface Paso3CaracteristicasProps {
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function Paso3Caracteristicas({
  formData,
  setFormData,
}: Paso3CaracteristicasProps) {
  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const renderCaracteristicasMonitor = () => (
    <Stack spacing={3}>
      <TextField
        label="Pulgadas"
        value={formData.pulgadas}
        onChange={(e) => handleChange('pulgadas', e.target.value)}
        fullWidth
        placeholder='Ej: 24", 27", 32"'
        helperText="Tamaño de la pantalla en pulgadas"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Herzios (Hz)"
          value={formData.herzios}
          onChange={(e) => handleChange('herzios', e.target.value)}
          fullWidth
          placeholder="Ej: 60Hz, 144Hz, 165Hz"
          helperText="Tasa de refresco"
        />
        <TextField
          label="Proporción"
          value={formData.proporcion}
          onChange={(e) => handleChange('proporcion', e.target.value)}
          fullWidth
          placeholder="Ej: 16:9, 21:9, 32:9"
          helperText="Relación de aspecto"
        />
      </Stack>

      <TextField
        label="Resolución"
        value={formData.resolucion}
        onChange={(e) => handleChange('resolucion', e.target.value)}
        fullWidth
        placeholder="Ej: 1920x1080, 2560x1440, 3840x2160"
        helperText="Resolución en píxeles"
      />
    </Stack>
  )

  const renderCaracteristicasMovilTablet = () => (
    <Stack spacing={3}>
      <TextField
        label="Capacidad (Almacenamiento)"
        value={formData.capacidad}
        onChange={(e) => handleChange('capacidad', e.target.value)}
        fullWidth
        placeholder="Ej: 64GB, 128GB, 256GB, 512GB"
        helperText="Capacidad de almacenamiento interno"
      />
    </Stack>
  )

  const renderCaracteristicasPCPortatil = () => (
    <Stack spacing={3}>
      {/* Pantalla (para portátiles y PCs all-in-one) */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
        Pantalla (opcional)
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Pulgadas"
          value={formData.pulgadas}
          onChange={(e) => handleChange('pulgadas', e.target.value)}
          fullWidth
          placeholder='Ej: 13", 15", 17"'
          helperText="Tamaño de pantalla"
        />
        <TextField
          label="Herzios (Hz)"
          value={formData.herzios}
          onChange={(e) => handleChange('herzios', e.target.value)}
          fullWidth
          placeholder="Ej: 60Hz, 144Hz"
          helperText="Tasa de refresco"
        />
      </Stack>

      <TextField
        label="Resolución"
        value={formData.resolucion}
        onChange={(e) => handleChange('resolucion', e.target.value)}
        fullWidth
        placeholder="Ej: 1920x1080, 2560x1440"
        helperText="Resolución de pantalla"
      />

      {/* Hardware */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
        Hardware
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Almacenamiento"
          value={formData.almacenamiento}
          onChange={(e) => handleChange('almacenamiento', e.target.value)}
          fullWidth
          placeholder="Ej: 256GB SSD, 512GB SSD, 1TB SSD"
          helperText="Tipo y capacidad"
        />
        <TextField
          label="RAM"
          value={formData.ram}
          onChange={(e) => handleChange('ram', e.target.value)}
          fullWidth
          placeholder="Ej: 8GB, 16GB, 32GB"
          helperText="Memoria RAM"
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Procesador"
          value={formData.procesador}
          onChange={(e) => handleChange('procesador', e.target.value)}
          fullWidth
          placeholder="Ej: Intel i5 11th Gen, AMD Ryzen 7"
          helperText="CPU del equipo"
        />
        <TextField
          label="Gráfica"
          value={formData.grafica}
          onChange={(e) => handleChange('grafica', e.target.value)}
          fullWidth
          placeholder="Ej: Integrada, NVIDIA GTX 1650"
          helperText="GPU del equipo"
        />
      </Stack>
    </Stack>
  )

  const renderCaracteristicasOtro = () => (
    <Stack spacing={3}>
      <TextField
        label="Capacidad / Descripción"
        value={formData.capacidad}
        onChange={(e) => handleChange('capacidad', e.target.value)}
        fullWidth
        multiline
        rows={3}
        placeholder="Describe las características principales de este dispositivo..."
        helperText="Características específicas de este tipo de dispositivo"
      />
    </Stack>
  )

  const renderCaracteristicas = () => {
    switch (formData.tipo) {
      case 'monitor':
        return renderCaracteristicasMonitor()
      case 'movil':
      case 'tablet':
        return renderCaracteristicasMovilTablet()
      case 'portatil':
      case 'pc':
        return renderCaracteristicasPCPortatil()
      case 'otro':
        return renderCaracteristicasOtro()
      default:
        return (
          <Alert severity="info">
            Selecciona primero un tipo de dispositivo en el paso anterior.
          </Alert>
        )
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Características del dispositivo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Completa las especificaciones técnicas del dispositivo. Todos los campos son opcionales.
      </Typography>

      {renderCaracteristicas()}

      {formData.tipo && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <strong>Nota:</strong> Todos los campos de características son opcionales. Completa solo
          los que conozcas o sean relevantes para la valoración.
        </Alert>
      )}
    </Box>
  )
}
