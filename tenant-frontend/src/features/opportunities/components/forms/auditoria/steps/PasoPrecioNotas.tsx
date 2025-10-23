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

  // Deducciones aplicadas (para mostrar desglose)
  deducciones?: {
    bateria: number
    pantalla: number
    chasis: number
  }
  costoReparacion?: number
  precioCalculado?: number | null // Precio final calculado automáticamente (con deducciones)
  precioSuelo?: number // Precio suelo (v_suelo) del dispositivo
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
  deducciones,
  costoReparacion = 0,
  precioCalculado,
  precioSuelo = 0,
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

  // Calcular total de deducciones
  const totalDeducciones = deducciones
    ? deducciones.bateria + deducciones.pantalla + deducciones.chasis + costoReparacion
    : 0

  // Determinar si hay deducciones aplicadas
  const hayDeducciones = totalDeducciones > 0

  // Calcular precio antes del suelo (precio con deducciones pero sin aplicar floor)
  const precioAntesSuelo = precioBase !== undefined ? precioBase - totalDeducciones : null

  // Verificar si se aplicó el precio suelo
  const seAplicoPrecioSuelo =
    precioSuelo > 0 &&
    precioAntesSuelo !== null &&
    precioAntesSuelo < precioSuelo &&
    precioCalculado !== null &&
    precioCalculado === precioSuelo

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
        {/* Mostrar desglose de deducciones si existen */}
        {hayDeducciones && precioBase != null && (
          <Grid size={{ xs: 12 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderLeft: 3,
                borderColor: 'info.main',
              }}
            >
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Desglose de precio
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Precio base ({grado}):
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {fmtEUR(precioBase)}
                </Typography>
              </Box>
              {deducciones && deducciones.bateria > 0 && (
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Deducción batería:
                  </Typography>
                  <Typography variant="body2" color="error">
                    -{fmtEUR(deducciones.bateria)}
                  </Typography>
                </Box>
              )}
              {deducciones && deducciones.pantalla > 0 && (
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Deducción pantalla:
                  </Typography>
                  <Typography variant="body2" color="error">
                    -{fmtEUR(deducciones.pantalla)}
                  </Typography>
                </Box>
              )}
              {deducciones && deducciones.chasis > 0 && (
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Deducción chasis:
                  </Typography>
                  <Typography variant="body2" color="error">
                    -{fmtEUR(deducciones.chasis)}
                  </Typography>
                </Box>
              )}
              {costoReparacion > 0 && (
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Costos de reparación:
                  </Typography>
                  <Typography variant="body2" color="error">
                    -{fmtEUR(costoReparacion)}
                  </Typography>
                </Box>
              )}
              <Box
                display="flex"
                justifyContent="space-between"
                mt={1}
                pt={1}
                borderTop="1px solid"
                borderColor="divider"
              >
                <Typography variant="body2" fontWeight={600}>
                  {seAplicoPrecioSuelo ? 'Precio antes del suelo:' : 'Precio calculado:'}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={seAplicoPrecioSuelo ? 500 : 700}
                  color={seAplicoPrecioSuelo ? 'text.secondary' : 'primary'}
                  sx={seAplicoPrecioSuelo ? { textDecoration: 'line-through' } : {}}
                >
                  {precioAntesSuelo !== null ? fmtEUR(precioAntesSuelo) : 'Calculando...'}
                </Typography>
              </Box>

              {seAplicoPrecioSuelo && (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  mt={1}
                  p={1}
                  bgcolor="success.lighter"
                  borderRadius={1}
                >
                  <Typography variant="body2" fontWeight={600}>
                    Precio suelo aplicado:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {fmtEUR(precioSuelo)}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Precio final (€)"
            size="small"
            fullWidth
            value={precioFinal ?? ''}
            onChange={(e) => handlePrecioChange(e.target.value)}
            helperText={
              hayDeducciones
                ? `Calculado con deducciones: ${precioCalculado !== null && precioCalculado !== undefined ? fmtEUR(precioCalculado) : 'Calculando...'}`
                : precioBase != null && grado
                  ? `Sugerido por estado (${grado}): ${fmtEUR(precioBase)}`
                  : grado
                    ? `Grado calculado: ${grado}`
                    : 'Ingrese el precio final'
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
