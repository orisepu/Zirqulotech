'use client'

import { Box, Grid, Typography, Chip } from '@mui/material'
import { GRADE_DESCRIPTIONS, type Grade } from '@/shared/types/grading'
import { fmtEUR, gradeToPrecioKey } from '../utils'

export interface BannerEstadoPrecioProps {
  grado?: Grade
  precioSugerido?: number | null
  precio_por_estado?: Record<string, number>
}

/**
 * Banner global que muestra el estado calculado y precio sugerido.
 * Se muestra arriba del stepper en todos los pasos para feedback en tiempo real.
 */
export default function BannerEstadoPrecio({
  grado,
  precioSugerido,
  precio_por_estado,
}: BannerEstadoPrecioProps) {

  const getGradeColor = (grade?: Grade) => {
    if (!grade) return 'default'
    if (grade === 'A+' || grade === 'A') return 'success'
    if (grade === 'B') return 'primary'
    if (grade === 'C') return 'warning'
    if (grade === 'D') return 'error'
    return 'default'
  }

  const precioMostrar = precioSugerido ?? (
    grado && precio_por_estado?.[gradeToPrecioKey(grado)]
  )

  return (
    <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="body2" color="text.secondary">
            Estado calculado
          </Typography>
          <Chip
            label={grado ? GRADE_DESCRIPTIONS[grado].label : '—'}
            color={getGradeColor(grado)}
            variant="filled"
            sx={{ mt: 1 }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="body2" color="text.secondary">
            Precio sugerido
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.5 }}>
            {precioMostrar != null ? fmtEUR(precioMostrar) : '—'}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  )
}
