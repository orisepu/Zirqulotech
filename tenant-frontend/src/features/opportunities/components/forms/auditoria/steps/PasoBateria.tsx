'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material'
import BatteryFullIcon from '@mui/icons-material/BatteryFull'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull'

interface PasoBateriaProps {
  // Energía (combinado)
  enciende: boolean | null
  setEnciende: (val: boolean | null) => void
  cargaOk: boolean | null
  setCargaOk: (val: boolean | null) => void
  cargaInalambrica: boolean | null
  setCargaInalambrica: (val: boolean | null) => void
  // Batería
  saludBateria: number | ''
  setSaludBateria: (val: number | '') => void
  ciclosBateria: number | ''
  setCiclosBateria: (val: number | '') => void
}

/**
 * Paso 2 (V1 style): Batería y energía combinados
 * Captura enciende/carga + salud (%) + ciclos de la batería
 */
export default function PasoBateria({
  enciende,
  setEnciende,
  cargaOk,
  setCargaOk,
  cargaInalambrica,
  setCargaInalambrica,
  saludBateria,
  setSaludBateria,
  ciclosBateria,
  setCiclosBateria,
}: PasoBateriaProps) {
  const handleSaludChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '') {
      setSaludBateria('')
    } else {
      const num = parseFloat(val)
      if (!isNaN(num) && num >= 0 && num <= 100) {
        setSaludBateria(num)
      }
    }
  }

  const handleCiclosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '') {
      setCiclosBateria('')
    } else {
      const num = parseInt(val, 10)
      if (!isNaN(num) && num >= 0) {
        setCiclosBateria(num)
      }
    }
  }

  // Indicador de salud
  const saludColor =
    typeof saludBateria === 'number'
      ? saludBateria >= 85
        ? 'success.main'
        : saludBateria >= 70
          ? 'warning.main'
          : 'error.main'
      : 'text.secondary'

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
        Paso 2: Batería y energía
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

        {/* Carga inalámbrica */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <BatteryChargingFullIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              ¿Carga inalámbrica? (si aplica)
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            value={cargaInalambrica}
            onChange={(_e, val) => setCargaInalambrica(val)}
            fullWidth
          >
            <Tooltip title="Carga inalámbrica funciona" arrow>
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
            <Tooltip title="Carga inalámbrica no funciona o no aplica" arrow>
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
                No / N/A
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>

        {/* Salud de batería */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <BatteryFullIcon sx={{ color: saludColor }} />
            <Typography variant="body2" fontWeight={600}>
              Salud de la batería
            </Typography>
          </Box>
          <TextField
            fullWidth
            type="number"
            value={saludBateria}
            onChange={handleSaludChange}
            placeholder="Ej: 85"
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                inputProps: { min: 0, max: 100, step: 1 },
              },
            }}
            helperText={
              typeof saludBateria === 'number'
                ? saludBateria >= 85
                  ? 'Excelente estado'
                  : saludBateria >= 70
                    ? 'Estado aceptable (puede aplicar deducción)'
                    : 'Estado deficiente (aplica deducción)'
                : 'Ingrese el porcentaje de salud (0-100%)'
            }
            error={typeof saludBateria === 'number' && saludBateria < 70}
          />
        </Grid>

        {/* Ciclos de batería */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <AutorenewIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              Ciclos de carga
            </Typography>
          </Box>
          <TextField
            fullWidth
            type="number"
            value={ciclosBateria}
            onChange={handleCiclosChange}
            placeholder="Ej: 150"
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">ciclos</InputAdornment>,
                inputProps: { min: 0, step: 1 },
              },
            }}
            helperText="Número de ciclos de carga completos (opcional)"
          />
        </Grid>
      </Grid>
    </Paper>
  )
}
