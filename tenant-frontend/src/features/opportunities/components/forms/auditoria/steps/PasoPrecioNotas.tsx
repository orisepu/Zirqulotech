'use client'

import { Box, TextField, Typography, Paper, Grid } from '@mui/material'
import { fmtEUR } from '../utils'
import type { Grade } from '@/shared/types/grading'

export interface PasoPrecioNotasProps {
  precioFinal: number | null
  setPrecioFinal: (val: number | null) => void
  observaciones: string
  setObservaciones: (val: string) => void
  setEditadoPorUsuario: (val: boolean) => void

  // Para mostrar precio sugerido
  grado?: Grade
  precioBase?: number

  // Para editar grado manualmente
  gradoCalculado?: Grade
  gradoManual: Grade | null
  setGradoManual: (val: Grade | null) => void
}

/**
 * Paso 8: Precio y notas
 *
 * Permite editar manualmente el precio final y agregar observaciones.
 * Al editar el precio, marca el flag editadoPorUsuario para que el motor
 * de grading no sobrescriba el valor.
 */
export default function PasoPrecioNotas({
  precioFinal,
  setPrecioFinal,
  observaciones,
  setObservaciones,
  setEditadoPorUsuario,
  grado,
  precioBase,
  gradoCalculado,
  gradoManual,
  setGradoManual,
}: PasoPrecioNotasProps) {

  const handlePrecioChange = (raw: string) => {
    let parsed: number | null
    if (raw === '' || raw == null) {
      parsed = null
    } else {
      // Parseador español: permite puntos como separadores de miles y coma como decimal
      const n = Number(String(raw).replace(/\./g, '').replace(',', '.'))
      parsed = Number.isFinite(n) ? n : null
    }
    setPrecioFinal(parsed)
    setEditadoPorUsuario(true) // Marca como editado manualmente
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: 'primary.light',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="h6" gutterBottom>
        Precio final y observaciones
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Precio final (€)"
            size="small"
            fullWidth
            value={precioFinal ?? ''}
            onChange={(e) => handlePrecioChange(e.target.value)}
            helperText={
              <>
                {precioBase != null && grado && (
                  <>
                    Sugerido por estado ({grado}): <strong>{fmtEUR(precioBase)}</strong>
                  </>
                )}
                {!precioBase && grado && (
                  <>Grado calculado: {grado}</>
                )}
              </>
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Estado/Grado"
            size="small"
            fullWidth
            value={gradoManual ?? gradoCalculado ?? ''}
            onChange={(e) => {
              const val = e.target.value as Grade
              setGradoManual(val === gradoCalculado ? null : val)
            }}
            helperText={
              gradoManual
                ? `Manual (calculado: ${gradoCalculado})`
                : `Automático: ${gradoCalculado || 'Calculando...'}`
            }
            slotProps={{
              select: {
                native: true,
              },
            }}
          >
            <option value="A+">A+ - Como nuevo</option>
            <option value="A">A - Excelente</option>
            <option value="B">B - Muy bueno</option>
            <option value="C">C - Correcto</option>
            <option value="D">D - Defectuoso</option>
            <option value="R">R - Reciclaje</option>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Observaciones"
            size="small"
            fullWidth
            multiline
            minRows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas adicionales sobre el dispositivo..."
          />
        </Grid>
      </Grid>

      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          💡 El grado y precio final pueden ajustarse manualmente si es necesario. Una vez editados, el sistema no los recalculará automáticamente.
        </Typography>
      </Box>
    </Paper>
  )
}
