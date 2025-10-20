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
  const precioSuelo = parseFloat(formData.precio_suelo) || 0
  const ppA = parseFloat(formData.pp_A) || 0.08
  const ppB = parseFloat(formData.pp_B) || 0.12
  const ppC = parseFloat(formData.pp_C) || 0.15

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

  const preciosB2B = calcularPreciosPorGrado(precioB2B)
  const preciosB2C = calcularPreciosPorGrado(precioB2C)

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
                €{precioB2B.toFixed(2)} (Grado A+)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                A+: €{preciosB2B.aPlus} • A: €{preciosB2B.a} • B: €{preciosB2B.b} • C: €
                {preciosB2B.c} • Suelo: €{preciosB2B.suelo}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Canal B2C (Particulares)
              </Typography>
              <Typography variant="h6" color="secondary.main">
                €{precioB2C.toFixed(2)} (Grado A+)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                A+: €{preciosB2C.aPlus} • A: €{preciosB2C.a} • B: €{preciosB2C.b} • C: €
                {preciosB2C.c} • Suelo: €{preciosB2C.suelo}
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
