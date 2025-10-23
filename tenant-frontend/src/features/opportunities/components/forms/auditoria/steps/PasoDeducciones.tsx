'use client'

import {
  Box,
  Paper,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Chip,
  Alert,
  Grid,
} from '@mui/material'
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import TabletAndroidIcon from '@mui/icons-material/TabletAndroid'
import BuildIcon from '@mui/icons-material/Build'
import InfoIcon from '@mui/icons-material/Info'
import { useState } from 'react'
import { fmtEUR } from '../utils/auditoriaHelpers'
import type { PasoDeduccionesProps } from '../utils/auditoriaTypes'

/**
 * Paso de Deducciones Ajustadas
 *
 * Permite al usuario revisar y ajustar manualmente las deducciones calculadas
 * automáticamente cuando el sistema no tiene valores predefinidos o cuando
 * se requiere un ajuste especial.
 */
export default function PasoDeducciones({
  deduccionesAutomaticas,
  deduccionesManuales,
  setDeduccionesManuales,
  precioBase,
  precioFinal,
  saludBateria,
  tienePantallaIssues,
  tieneChasisDesgaste,
}: PasoDeduccionesProps) {
  const [editarManualmente, setEditarManualmente] = useState(
    deduccionesManuales.bateria !== null ||
      deduccionesManuales.pantalla !== null ||
      deduccionesManuales.chasis !== null ||
      deduccionesManuales.costoReparacion > 0
  )

  // Obtener valor efectivo (manual si existe, sino automático)
  const deduccionBateriaEfectiva = deduccionesManuales.bateria ?? deduccionesAutomaticas.bateria
  const deduccionPantallaEfectiva =
    deduccionesManuales.pantalla ?? deduccionesAutomaticas.pantalla
  const deduccionChasisEfectiva = deduccionesManuales.chasis ?? deduccionesAutomaticas.chasis
  const costoReparacion = deduccionesManuales.costoReparacion

  const totalDeducciones =
    deduccionBateriaEfectiva + deduccionPantallaEfectiva + deduccionChasisEfectiva + costoReparacion

  const precioResultante = precioBase ? precioBase - totalDeducciones : null

  // Validación: deducciones no pueden exceder precio base
  const deduccionesExcesivas = precioBase && totalDeducciones > precioBase

  const handleToggleEdicion = (enabled: boolean) => {
    setEditarManualmente(enabled)
    if (!enabled) {
      // Resetear a valores automáticos
      setDeduccionesManuales({
        bateria: null,
        pantalla: null,
        chasis: null,
        costoReparacion: 0,
      })
    }
  }

  const handleDeduccionChange = (tipo: 'bateria' | 'pantalla' | 'chasis', valor: string) => {
    const num = valor === '' ? null : Number(valor.replace(',', '.'))
    const parsed = num !== null && Number.isFinite(num) && num >= 0 ? num : null

    setDeduccionesManuales({
      ...deduccionesManuales,
      [tipo]: parsed,
    })
  }

  const handleCostoReparacionChange = (valor: string) => {
    const num = valor === '' ? 0 : Number(valor.replace(',', '.'))
    const parsed = Number.isFinite(num) && num >= 0 ? num : 0

    setDeduccionesManuales({
      ...deduccionesManuales,
      costoReparacion: parsed,
    })
  }

  const deduccionItem = (
    icon: React.ReactNode,
    label: string,
    tipo: 'bateria' | 'pantalla' | 'chasis',
    valorAuto: number,
    valorManual: number | null,
    info: string
  ) => {
    const esManual = valorManual !== null && editarManualmente
    const valorEfectivo = esManual ? valorManual : valorAuto

    return (
      <Box>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {icon}
          <Typography variant="body2" fontWeight={500}>
            {label}
          </Typography>
          {esManual && (
            <Chip label="Manual" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
          )}
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Deducción (€)"
              size="small"
              fullWidth
              type="number"
              disabled={!editarManualmente}
              value={editarManualmente ? (valorManual ?? '') : valorAuto}
              onChange={(e) => handleDeduccionChange(tipo, e.target.value)}
              slotProps={{
                htmlInput: {
                  min: 0,
                  step: 1,
                },
              }}
              helperText={
                editarManualmente ? (
                  <>Automático: {fmtEUR(valorAuto)}</>
                ) : (
                  <>Calculado automáticamente</>
                )
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <InfoIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                {info}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      {/* Header con toggle */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderLeft: 4,
          borderColor: 'warning.main',
          bgcolor: 'warning.lighter',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" fontWeight={600}>
            Deducciones de Valor
          </Typography>
          <FormControlLabel
            control={
              <Switch checked={editarManualmente} onChange={(e) => handleToggleEdicion(e.target.checked)} />
            }
            label={
              <Typography variant="body2" fontWeight={500}>
                Editar manualmente
              </Typography>
            }
          />
        </Box>

        <Typography variant="body2" color="text.secondary">
          {editarManualmente
            ? 'Estás editando las deducciones manualmente. El precio se recalculará automáticamente.'
            : 'Las deducciones se calculan automáticamente según el estado del dispositivo.'}
        </Typography>
      </Paper>

      {/* Warning si deducciones exceden precio base */}
      {deduccionesExcesivas && (
        <Alert severity="warning">
          <strong>Atención:</strong> Las deducciones totales ({fmtEUR(totalDeducciones)}) exceden el
          precio base ({precioBase ? fmtEUR(precioBase) : 'N/A'}). El precio resultante será negativo
          o muy bajo.
        </Alert>
      )}

      {/* Deducciones */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3} divider={<Divider />}>
          {/* Batería */}
          {deduccionItem(
            <BatteryAlertIcon fontSize="small" color="warning" />,
            'Batería (<85% salud)',
            'bateria',
            deduccionesAutomaticas.bateria,
            deduccionesManuales.bateria,
            saludBateria !== '' ? `Salud actual: ${saludBateria}%` : 'Sin datos de batería'
          )}

          {/* Pantalla */}
          {deduccionItem(
            <ScreenshotMonitorIcon fontSize="small" color="warning" />,
            'Pantalla (defectos funcionales/estéticos)',
            'pantalla',
            deduccionesAutomaticas.pantalla,
            deduccionesManuales.pantalla,
            tienePantallaIssues
              ? 'Defectos detectados en pantalla'
              : 'Pantalla en buen estado'
          )}

          {/* Chasis */}
          {deduccionItem(
            <TabletAndroidIcon fontSize="small" color="warning" />,
            'Chasis (desgaste exterior)',
            'chasis',
            deduccionesAutomaticas.chasis,
            deduccionesManuales.chasis,
            tieneChasisDesgaste ? 'Desgaste visible detectado' : 'Chasis en buen estado'
          )}

          {/* Costos de reparación */}
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <BuildIcon fontSize="small" color="warning" />
              <Typography variant="body2" fontWeight={500}>
                Costos de reparación adicionales
              </Typography>
              {costoReparacion > 0 && (
                <Chip
                  label="Manual"
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>

            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Costo de reparación (€)"
                  size="small"
                  fullWidth
                  type="number"
                  disabled={!editarManualmente}
                  value={costoReparacion || ''}
                  onChange={(e) => handleCostoReparacionChange(e.target.value)}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      step: 1,
                    },
                  }}
                  helperText="Costos adicionales de reparación necesarios"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <InfoIcon fontSize="small" color="action" />
                  <Typography variant="caption" color="text.secondary">
                    Incluye piezas y mano de obra
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Paper>

      {/* Resumen de cálculo */}
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
          Resumen de cálculo
        </Typography>

        <Stack spacing={1}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Precio base
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {precioBase ? fmtEUR(precioBase) : 'Calculando...'}
            </Typography>
          </Box>

          <Divider />

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Batería</Typography>
            <Typography variant="body2" color="error">
              -{fmtEUR(deduccionBateriaEfectiva)}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Pantalla</Typography>
            <Typography variant="body2" color="error">
              -{fmtEUR(deduccionPantallaEfectiva)}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2">Chasis</Typography>
            <Typography variant="body2" color="error">
              -{fmtEUR(deduccionChasisEfectiva)}
            </Typography>
          </Box>

          {costoReparacion > 0 && (
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">Reparaciones</Typography>
              <Typography variant="body2" color="error">
                -{fmtEUR(costoReparacion)}
              </Typography>
            </Box>
          )}

          <Divider />

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" fontWeight={600}>
              Total deducciones
            </Typography>
            <Typography variant="body2" fontWeight={700} color="error">
              -{fmtEUR(totalDeducciones)}
            </Typography>
          </Box>

          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              p: 1,
              bgcolor: 'primary.lighter',
              borderRadius: 1,
            }}
          >
            <Typography variant="body1" fontWeight={700}>
              Precio resultante
            </Typography>
            <Typography
              variant="h6"
              fontWeight={700}
              color={deduccionesExcesivas ? 'error' : 'primary'}
            >
              {precioResultante !== null ? fmtEUR(precioResultante) : 'Calculando...'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Box>
        <Typography variant="caption" color="text.secondary">
          💡 Las deducciones se calcularán automáticamente según el estado del dispositivo. Puedes
          ajustarlas manualmente si el sistema no tiene valores predefinidos o si requieres un ajuste
          especial.
        </Typography>
      </Box>
    </Stack>
  )
}
