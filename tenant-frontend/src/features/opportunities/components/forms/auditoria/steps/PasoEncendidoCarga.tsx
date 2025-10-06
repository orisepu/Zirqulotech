'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull'

interface PasoEncendidoCargaProps {
  enciende: boolean | null
  setEnciende: (val: boolean | null) => void
  cargaOk: boolean | null
  setCargaOk: (val: boolean | null) => void
}

/**
 * Paso 2: Encendido y carga
 * Verifica si el dispositivo enciende y carga correctamente
 */
export default function PasoEncendidoCarga({
  enciende,
  setEnciende,
  cargaOk,
  setCargaOk,
}: PasoEncendidoCargaProps) {
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
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Paso 2: Encendido y carga
      </Typography>

      <Grid container spacing={3}>
        {/* Enciende */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <PowerSettingsNewIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              ¿Enciende?
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            value={enciende}
            onChange={(_e, val) => setEnciende(val)}
            fullWidth
          >
            <Tooltip title="El dispositivo enciende normalmente" arrow>
              <ToggleButton
                value={true}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'success.main',
                    borderColor: 'success.main',
                    color: 'common.white',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'success.main' },
                  },
                }}
              >
                Sí
              </ToggleButton>
            </Tooltip>
            <Tooltip title="El dispositivo no enciende" arrow>
              <ToggleButton
                value={false}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'error.main',
                    borderColor: 'error.main',
                    color: 'common.white',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'error.main' },
                  },
                }}
              >
                No
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>

        {/* Carga */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <BatteryChargingFullIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              ¿Carga correctamente?
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            value={cargaOk}
            onChange={(_e, val) => setCargaOk(val)}
            fullWidth
          >
            <Tooltip title="El dispositivo carga correctamente" arrow>
              <ToggleButton
                value={true}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'success.main',
                    borderColor: 'success.main',
                    color: 'common.white',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'success.main' },
                  },
                }}
              >
                Sí
              </ToggleButton>
            </Tooltip>
            <Tooltip title="El dispositivo no carga" arrow>
              <ToggleButton
                value={false}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'error.main',
                    borderColor: 'error.main',
                    color: 'common.white',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'error.main' },
                  },
                }}
              >
                No
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>
      </Grid>
    </Paper>
  )
}
