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
  FormHelperText,
  Alert,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

export type FMIStatus = '' | 'OFF' | 'ON'
export type SIMLockStatus = '' | 'LIBRE' | 'BLOQUEADO'
export type MDMStatus = '' | 'NO' | 'SI'
export type BlacklistStatus = '' | 'LIMPIO' | 'REPORTADO'

interface PasoSeguridadProps {
  fmiStatus: FMIStatus
  setFmiStatus: (val: FMIStatus) => void
  simLock: SIMLockStatus
  setSimLock: (val: SIMLockStatus) => void
  mdm: MDMStatus
  setMdm: (val: MDMStatus) => void
  blacklist: BlacklistStatus
  setBlacklist: (val: BlacklistStatus) => void
}

/**
 * Paso 1: Seguridad y autenticidad
 * Verifica FMI, SIM-lock, MDM y Blacklist según documento oficial
 */
export default function PasoSeguridad({
  fmiStatus,
  setFmiStatus,
  simLock,
  setSimLock,
  mdm,
  setMdm,
  blacklist,
  setBlacklist,
}: PasoSeguridadProps) {
  // Verificar si hay fallo de seguridad
  const isSecurityKO =
    fmiStatus === 'ON' || simLock === 'BLOQUEADO' || mdm === 'SI' || blacklist === 'REPORTADO'

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: isSecurityKO ? 'error.main' : 'primary.light',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Paso 1: Seguridad y autenticidad
      </Typography>

      <Grid container spacing={2}>
        {/* FMI / Activation Lock */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            FMI / Activation Lock
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={fmiStatus}
            onChange={(_e, val) => setFmiStatus(val)}
            fullWidth
          >
            <Tooltip title="iCloud/Activation Lock desactivado" arrow>
              <ToggleButton
                value="OFF"
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
                OFF
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Bloqueo activo (debe estar OFF)" arrow>
              <ToggleButton
                value="ON"
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
                ON
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
          <FormHelperText>Debe estar OFF</FormHelperText>
        </Grid>

        {/* SIM-lock */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            SIM‑lock
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={simLock}
            onChange={(_e, val) => setSimLock(val)}
            fullWidth
          >
            <Tooltip title="Sin bloqueo de operador" arrow>
              <ToggleButton
                value="LIBRE"
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
                Libre
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Bloqueado por operador" arrow>
              <ToggleButton
                value="BLOQUEADO"
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
                Bloqueado
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>

        {/* MDM / Supervisión */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            MDM / Supervisión
          </Typography>
          <ToggleButtonGroup exclusive value={mdm} onChange={(_e, val) => setMdm(val)} fullWidth>
            <Tooltip title="No gestionado por MDM" arrow>
              <ToggleButton
                value="NO"
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
                No
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Supervisión/MDM corporativo activo" arrow>
              <ToggleButton
                value="SI"
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
                Sí
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>

        {/* Blacklist / Deuda */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Blacklist / Deuda
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={blacklist}
            onChange={(_e, val) => setBlacklist(val)}
            fullWidth
          >
            <Tooltip title="No reportado / sin deuda" arrow>
              <ToggleButton
                value="LIMPIO"
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
                Limpio
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Reportado / con deuda" arrow>
              <ToggleButton
                value="REPORTADO"
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
                Reportado
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {/* Alert de seguridad */}
      {isSecurityKO ? (
        <Alert
          severity="error"
          icon={<WarningAmberIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" fontWeight={600}>
            Dispositivo rechazado por seguridad
          </Typography>
          <Typography variant="caption">
            FMI ON, SIM bloqueado, MDM activo o Blacklist reportado → No aceptado según protocolo
          </Typography>
        </Alert>
      ) : (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2">
            Verificaciones de seguridad superadas
          </Typography>
        </Alert>
      )}

      <FormHelperText sx={{ mt: 1 }}>
        Si FMI = ON, SIM bloqueado, MDM = Sí o Blacklist reportado → Dispositivo rechazado
      </FormHelperText>
    </Paper>
  )
}
