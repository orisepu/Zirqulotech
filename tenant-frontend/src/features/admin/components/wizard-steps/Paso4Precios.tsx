'use client'

import React from 'react'
import {
  Box,
  TextField,
  Typography,
  Stack,
  InputAdornment,
  Alert,
  Paper,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es'

interface Paso4PreciosProps {
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function Paso4Precios({ formData, setFormData }: Paso4PreciosProps) {
  const handleChange = (field: string, value: string | Date) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const precioB2B = parseFloat(formData.precio_b2b) || 0
  const precioB2C = parseFloat(formData.precio_b2c) || 0

  // Calcular precios estimados por estado
  const calcularPreciosPorEstado = (precioBase: number) => ({
    excelente: Math.round((precioBase * 1.0) / 5) * 5, // 100%
    bueno: Math.round((precioBase * 0.8) / 5) * 5, // 80%
    malo: Math.round((precioBase * 0.5) / 5) * 5, // 50%
  })

  const preciosB2BPorEstado = calcularPreciosPorEstado(precioB2B)
  const preciosB2CPorEstado = calcularPreciosPorEstado(precioB2C)

  // Configurar locale español para dayjs
  dayjs.locale('es')

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <Box>
        <Typography variant="h6" gutterBottom>
          Precios de recompra
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Define los precios base para cada canal. El sistema calculará automáticamente las
          ofertas según el estado del dispositivo.
        </Typography>

        <Stack spacing={3}>
          {/* Precios base */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Precio B2B (empresas)"
              value={formData.precio_b2b}
              onChange={(e) => handleChange('precio_b2b', e.target.value)}
              required
              fullWidth
              type="number"
              InputProps={{
                startAdornment: <InputAdornment position="start">€</InputAdornment>,
              }}
              helperText="Precio base para canal B2B (empresas)"
            />

            <TextField
              label="Precio B2C (particulares)"
              value={formData.precio_b2c}
              onChange={(e) => handleChange('precio_b2c', e.target.value)}
              required
              fullWidth
              type="number"
              InputProps={{
                startAdornment: <InputAdornment position="start">€</InputAdornment>,
              }}
              helperText="Precio base para canal B2C (particulares)"
            />
          </Stack>

          {/* Fecha de inicio de vigencia */}
          <DatePicker
            label="Fecha de inicio de vigencia"
            value={formData.valid_from}
            onChange={(date) => handleChange('valid_from', date || dayjs())}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText:
                  'Fecha desde la cual estos precios entrarán en vigencia (por defecto: hoy)',
              },
            }}
          />

          {/* Preview de precios por estado */}
          {(precioB2B > 0 || precioB2C > 0) && (
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Vista previa de ofertas por estado
              </Typography>
              <Typography variant="caption" color="text.secondary" paragraph>
                El sistema aplicará los siguientes ajustes automáticamente:
                <br />
                • Excelente: 100% del precio base
                <br />
                • Bueno: 80% del precio base
                <br />• Malo: 50% del precio base
              </Typography>

              <Stack spacing={2}>
                {precioB2B > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Canal B2B:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Excelente: €{preciosB2BPorEstado.excelente} | Bueno: €
                      {preciosB2BPorEstado.bueno} | Malo: €{preciosB2BPorEstado.malo}
                    </Typography>
                  </Box>
                )}

                {precioB2C > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Canal B2C:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Excelente: €{preciosB2CPorEstado.excelente} | Bueno: €
                      {preciosB2CPorEstado.bueno} | Malo: €{preciosB2CPorEstado.malo}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          )}

          <Alert severity="info">
            <strong>Sistema de precios versionado:</strong> Estos precios se registrarán con la
            fecha indicada. Puedes actualizar los precios en el futuro creando nuevas versiones
            con fechas diferentes.
          </Alert>
        </Stack>
      </Box>
    </LocalizationProvider>
  )
}
