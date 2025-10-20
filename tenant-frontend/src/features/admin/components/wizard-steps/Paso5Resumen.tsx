'use client'

import React from 'react'
import {
  Box,
  Typography,
  Stack,
  Paper,
  Divider,
  Chip,
  Grid,
} from '@mui/material'
import { TIPO_DISPOSITIVO_LABELS } from '@/shared/types/dispositivos'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

interface Paso5ResumenProps {
  formData: any
}

export default function Paso5Resumen({ formData }: Paso5ResumenProps) {
  const renderCaracteristicas = () => {
    const caract: string[] = []

    if (formData.tipo === 'monitor') {
      if (formData.pulgadas) caract.push(`${formData.pulgadas} pulgadas`)
      if (formData.herzios) caract.push(`${formData.herzios}`)
      if (formData.proporcion) caract.push(`${formData.proporcion}`)
      if (formData.resolucion) caract.push(`${formData.resolucion}`)
    } else if (formData.tipo === 'movil' || formData.tipo === 'tablet') {
      if (formData.capacidad) caract.push(formData.capacidad)
    } else if (formData.tipo === 'portatil' || formData.tipo === 'pc') {
      if (formData.pulgadas) caract.push(`Pantalla: ${formData.pulgadas}"`)
      if (formData.herzios) caract.push(`${formData.herzios}`)
      if (formData.resolucion) caract.push(formData.resolucion)
      if (formData.almacenamiento) caract.push(`Almacenamiento: ${formData.almacenamiento}`)
      if (formData.ram) caract.push(`RAM: ${formData.ram}`)
      if (formData.procesador) caract.push(`CPU: ${formData.procesador}`)
      if (formData.grafica) caract.push(`GPU: ${formData.grafica}`)
    } else if (formData.tipo === 'otro') {
      if (formData.capacidad) caract.push(formData.capacidad)
    }

    return caract
  }

  const caracteristicas = renderCaracteristicas()
  const precioB2B = parseFloat(formData.precio_b2b) || 0
  const precioB2C = parseFloat(formData.precio_b2c) || 0

  const calcularPreciosPorEstado = (precioBase: number) => ({
    excelente: Math.round((precioBase * 1.0) / 5) * 5,
    bueno: Math.round((precioBase * 0.8) / 5) * 5,
    malo: Math.round((precioBase * 0.5) / 5) * 5,
  })

  const preciosB2B = calcularPreciosPorEstado(precioB2B)
  const preciosB2C = calcularPreciosPorEstado(precioB2C)

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Resumen del dispositivo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Revisa la información antes de crear el dispositivo personalizado.
      </Typography>

      <Stack spacing={3}>
        {/* Información básica */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Información básica
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Tipo:
              </Typography>
              <Typography variant="body1">
                {TIPO_DISPOSITIVO_LABELS[formData.tipo as keyof typeof TIPO_DISPOSITIVO_LABELS] ||
                  '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Marca:
              </Typography>
              <Typography variant="body1">{formData.marca || '-'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Modelo:
              </Typography>
              <Typography variant="body1">{formData.modelo || '-'}</Typography>
            </Grid>
            {formData.notas && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Notas:
                </Typography>
                <Typography variant="body2">{formData.notas}</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Características */}
        {caracteristicas.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Características
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {caracteristicas.map((caract, index) => (
                <Chip key={index} label={caract} size="small" />
              ))}
            </Box>
          </Paper>
        )}

        {/* Precios */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Precios
          </Typography>
          <Divider sx={{ my: 1 }} />

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Fecha de vigencia:
              </Typography>
              <Typography variant="body1">
                Desde {dayjs(formData.valid_from).locale('es').format('D [de] MMMM [de] YYYY')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Canal B2B (Empresas)
              </Typography>
              <Typography variant="h6" color="primary.main">
                €{precioB2B.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Excelente: €{preciosB2B.excelente} • Bueno: €{preciosB2B.bueno} • Malo: €
                {preciosB2B.malo}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Canal B2C (Particulares)
              </Typography>
              <Typography variant="h6" color="secondary.main">
                €{precioB2C.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Excelente: €{preciosB2C.excelente} • Bueno: €{preciosB2C.bueno} • Malo: €
                {preciosB2C.malo}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 2, bgcolor: 'success.lighter' }}>
          <Typography variant="body2" color="success.dark">
            <strong>¿Todo correcto?</strong> Haz clic en "Crear dispositivo" para guardar este
            dispositivo personalizado en el sistema.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  )
}
