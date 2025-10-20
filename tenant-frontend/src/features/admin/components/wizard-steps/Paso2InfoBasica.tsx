'use client'

import React from 'react'
import { Box, TextField, Typography, Stack } from '@mui/material'

interface Paso2InfoBasicaProps {
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function Paso2InfoBasica({ formData, setFormData }: Paso2InfoBasicaProps) {
  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Información básica
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ingresa la marca, modelo y cualquier nota adicional sobre el dispositivo.
      </Typography>

      <Stack spacing={3}>
        <TextField
          label="Marca"
          value={formData.marca}
          onChange={(e) => handleChange('marca', e.target.value)}
          required
          fullWidth
          placeholder="Ej: Samsung, Xiaomi, Dell, LG..."
          helperText="Marca del fabricante del dispositivo"
        />

        <TextField
          label="Modelo"
          value={formData.modelo}
          onChange={(e) => handleChange('modelo', e.target.value)}
          required
          fullWidth
          placeholder="Ej: Galaxy S23, Redmi Note 12, XPS 15..."
          helperText="Modelo específico del dispositivo"
        />

        <TextField
          label="Notas adicionales"
          value={formData.notas}
          onChange={(e) => handleChange('notas', e.target.value)}
          fullWidth
          multiline
          rows={4}
          placeholder="Información adicional, características especiales, observaciones..."
          helperText="Opcional: Cualquier detalle relevante sobre el dispositivo"
        />
      </Stack>
    </Box>
  )
}
