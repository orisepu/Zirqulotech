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
  const precioSuelo = parseFloat(formData.precio_suelo) || 0
  const ppA = parseFloat(formData.pp_A) || 0.08
  const ppB = parseFloat(formData.pp_B) || 0.12
  const ppC = parseFloat(formData.pp_C) || 0.15

  // Calcular precios por grado (sistema consistente con Apple devices)
  const calcularPreciosPorGrado = (precioBase: number) => {
    if (precioBase === 0) return { aPlus: 0, a: 0, b: 0, c: 0, suelo: precioSuelo }

    const aPlus = precioBase // 100%
    const a = precioBase * (1 - ppA)
    const b = a * (1 - ppB)
    const c = b * (1 - ppC)

    return {
      aPlus: Math.round(aPlus / 5) * 5,
      a: Math.round(a / 5) * 5,
      b: Math.round(b / 5) * 5,
      c: Math.max(Math.round(c / 5) * 5, precioSuelo),
      suelo: precioSuelo,
    }
  }

  const preciosB2BPorGrado = calcularPreciosPorGrado(precioB2B)
  const preciosB2CPorGrado = calcularPreciosPorGrado(precioB2C)

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
              helperText="Precio base para grado A+ en canal B2B"
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
              helperText="Precio base para grado A+ en canal B2C"
            />
          </Stack>

          {/* Configuración de grading */}
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            Configuración de penalizaciones por grado
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Penalización A+ → A"
              value={formData.pp_A}
              onChange={(e) => handleChange('pp_A', e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              helperText="Default: 8%"
              inputProps={{ step: 0.01, min: 0, max: 1 }}
            />
            <TextField
              label="Penalización A → B"
              value={formData.pp_B}
              onChange={(e) => handleChange('pp_B', e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              helperText="Default: 12%"
              inputProps={{ step: 0.01, min: 0, max: 1 }}
            />
            <TextField
              label="Penalización B → C"
              value={formData.pp_C}
              onChange={(e) => handleChange('pp_C', e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              helperText="Default: 15%"
              inputProps={{ step: 0.01, min: 0, max: 1 }}
            />
          </Stack>

          {/* Precio suelo */}
          <TextField
            label="Precio suelo (V_SUELO)"
            value={formData.precio_suelo}
            onChange={(e) => handleChange('precio_suelo', e.target.value)}
            required
            fullWidth
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">€</InputAdornment>,
            }}
            helperText="Precio mínimo ofertable para cualquier estado"
          />

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

          {/* Preview de precios por grado */}
          {(precioB2B > 0 || precioB2C > 0) && (
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Vista previa de ofertas por grado
              </Typography>
              <Typography variant="caption" color="text.secondary" paragraph>
                Sistema de grading consistente con dispositivos Apple:
                <br />
                • A+ (Como nuevo): {precioB2B > 0 ? `€${preciosB2BPorGrado.aPlus}` : '-'}
                <br />
                • A (Excelente): Penalización {(ppA * 100).toFixed(0)}%
                <br />
                • B (Muy bueno): Penalización adicional {(ppB * 100).toFixed(0)}%
                <br />
                • C (Correcto): Penalización adicional {(ppC * 100).toFixed(0)}%
                <br />• V_SUELO (Precio mínimo): €{precioSuelo}
              </Typography>

              <Stack spacing={2}>
                {precioB2B > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Canal B2B:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A+: €{preciosB2BPorGrado.aPlus} | A: €{preciosB2BPorGrado.a} | B: €
                      {preciosB2BPorGrado.b} | C: €{preciosB2BPorGrado.c} | Suelo: €
                      {preciosB2BPorGrado.suelo}
                    </Typography>
                  </Box>
                )}

                {precioB2C > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Canal B2C:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A+: €{preciosB2CPorGrado.aPlus} | A: €{preciosB2CPorGrado.a} | B: €
                      {preciosB2CPorGrado.b} | C: €{preciosB2CPorGrado.c} | Suelo: €
                      {preciosB2CPorGrado.suelo}
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
