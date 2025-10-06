'use client'

import React from 'react'
import { Box, Paper, Typography, Chip, Grid } from '@mui/material'
import GradeIcon from '@mui/icons-material/Grade'
import EuroIcon from '@mui/icons-material/Euro'
import { GRADE_DESCRIPTIONS, type Grade } from '@/shared/types/grading'
import { fmtEUR } from '../utils/auditoriaHelpers'

interface ResumenValoracionProps {
  grado: Grade
  precioFinal: number | null
  precioBase?: number
  isSecurityKO?: boolean
}

/**
 * Componente que muestra el resumen de valoración:
 * - Grado (A+/A/B/C/D/R)
 * - Precio final calculado
 */
export default function ResumenValoracion({
  grado,
  precioFinal,
  precioBase,
  isSecurityKO = false,
}: ResumenValoracionProps) {
  const gradeInfo = GRADE_DESCRIPTIONS[grado]

  const getGradeColor = (grade: Grade) => {
    if (grade === 'A+' || grade === 'A') return 'success'
    if (grade === 'B') return 'primary'
    if (grade === 'C') return 'warning'
    if (grade === 'D') return 'error'
    if (grade === 'R') return 'default'
    return 'default'
  }

  const color = getGradeColor(grado)

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Resumen de valoración
      </Typography>

      <Grid container spacing={2} alignItems="center">
        {/* Grado */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <GradeIcon fontSize="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              Grado
            </Typography>
          </Box>
          <Chip
            label={`${gradeInfo.label} (${grado})`}
            color={color}
            variant="filled"
            sx={{
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {gradeInfo.label}
          </Typography>
        </Grid>

        {/* Precio Final */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <EuroIcon fontSize="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              Precio final
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight={700}>
            {precioFinal !== null ? fmtEUR(precioFinal) : '—'}
          </Typography>
          {precioBase !== undefined && precioFinal !== null && (
            <Typography variant="caption" color="text.secondary">
              Base: {fmtEUR(precioBase)} · Deducciones: {fmtEUR(precioBase - precioFinal)}
            </Typography>
          )}
          {isSecurityKO && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              ⚠️ Rechazado por seguridad
            </Typography>
          )}
        </Grid>
      </Grid>
    </Paper>
  )
}
