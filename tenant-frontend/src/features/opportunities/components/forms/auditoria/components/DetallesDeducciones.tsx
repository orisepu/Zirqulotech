'use client'

import React from 'react'
import { Box, Paper, Typography, Stack, Divider } from '@mui/material'
import BatteryAlertIcon from '@mui/icons-material/BatteryAlert'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import TabletAndroidIcon from '@mui/icons-material/TabletAndroid'
import BuildIcon from '@mui/icons-material/Build'
import { fmtEUR } from '../utils/auditoriaHelpers'

interface DetallesDeduccionesProps {
  deducciones: {
    bateria: number
    pantalla: number
    chasis: number
  }
  costoReparacion?: number
  precioBase?: number
  precioFinal: number | null
}

/**
 * Componente que muestra el desglose de deducciones aplicadas
 */
export default function DetallesDeducciones({
  deducciones,
  costoReparacion = 0,
  precioBase,
  precioFinal,
}: DetallesDeduccionesProps) {
  const totalDeducciones =
    deducciones.bateria + deducciones.pantalla + deducciones.chasis + costoReparacion

  const items = [
    {
      icon: <BatteryAlertIcon fontSize="small" color="warning" />,
      label: 'Batería (<85%)',
      valor: deducciones.bateria,
    },
    {
      icon: <ScreenshotMonitorIcon fontSize="small" color="warning" />,
      label: 'Pantalla (defectos)',
      valor: deducciones.pantalla,
    },
    {
      icon: <TabletAndroidIcon fontSize="small" color="warning" />,
      label: 'Chasis (desgaste)',
      valor: deducciones.chasis,
    },
    {
      icon: <BuildIcon fontSize="small" color="warning" />,
      label: 'Costos de reparación',
      valor: costoReparacion,
    },
  ].filter((item) => item.valor > 0)

  if (totalDeducciones === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'success.main',
          borderRadius: 2,
          bgcolor: 'success.lighter',
        }}
      >
        <Typography variant="body2" color="success.dark" fontWeight={600}>
          ✓ Sin deducciones aplicadas
        </Typography>
      </Paper>
    )
  }

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
        Deducciones aplicadas
      </Typography>

      <Stack spacing={1}>
        {items.map((item, idx) => (
          <Box key={idx} display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              {item.icon}
              <Typography variant="body2">{item.label}</Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} color="error">
              -{fmtEUR(item.valor)}
            </Typography>
          </Box>
        ))}

        <Divider sx={{ my: 1 }} />

        {/* Total deducciones */}
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" fontWeight={600}>
            Total deducciones
          </Typography>
          <Typography variant="body2" fontWeight={700} color="error">
            -{fmtEUR(totalDeducciones)}
          </Typography>
        </Box>

        {/* Cálculo final */}
        {precioBase !== undefined && precioFinal !== null && (
          <>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Precio base
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fmtEUR(precioBase)}
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
                Precio final
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary">
                {fmtEUR(precioFinal)}
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  )
}
