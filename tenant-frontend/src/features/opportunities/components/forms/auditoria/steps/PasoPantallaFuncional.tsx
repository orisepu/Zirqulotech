'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import type { FuncPantallaValue } from '../../tipos'

interface PasoPantallaFuncionalProps {
  pantallaIssues: FuncPantallaValue[]
  setPantallaIssues: (val: FuncPantallaValue[]) => void
}

/**
 * Paso 5: Funcionalidad de la pantalla
 * Detecta issues funcionales (imagen, táctil)
 */
export default function PasoPantallaFuncional({
  pantallaIssues,
  setPantallaIssues,
}: PasoPantallaFuncionalProps) {
  const handleToggle = (value: FuncPantallaValue) => {
    if (pantallaIssues.includes(value)) {
      setPantallaIssues(pantallaIssues.filter((v) => v !== value))
    } else {
      setPantallaIssues([...pantallaIssues, value])
    }
  }

  const opciones: Array<{ value: FuncPantallaValue; label: string; description: string }> = [
    {
      value: 'puntos_brillantes',
      label: 'Puntos brillantes',
      description: 'Píxeles siempre encendidos (bright spots)',
    },
    {
      value: 'pixeles_muertos',
      label: 'Píxeles muertos',
      description: 'Píxeles que no encienden (dead pixels)',
    },
    {
      value: 'lineas_quemaduras',
      label: 'Líneas o quemaduras',
      description: 'Líneas visibles, burn-in, manchas permanentes',
    },
  ]

  const hasIssues = pantallaIssues.length > 0

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: hasIssues ? 'error.main' : 'success.main',
        bgcolor: 'action.hover',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <ScreenshotMonitorIcon color="primary" />
        <Typography variant="subtitle2">Paso 5: Funcionalidad de la pantalla</Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Marque solo si detecta problemas en la imagen de la pantalla
      </Typography>

      <FormGroup>
        {opciones.map((opt) => (
          <FormControlLabel
            key={opt.value}
            control={
              <Checkbox
                checked={pantallaIssues.includes(opt.value)}
                onChange={() => handleToggle(opt.value)}
                sx={{
                  color: pantallaIssues.includes(opt.value) ? 'error.main' : undefined,
                  '&.Mui-checked': {
                    color: 'error.main',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: pantallaIssues.includes(opt.value) ? 'error.main' : 'text.primary',
                    fontWeight: pantallaIssues.includes(opt.value) ? 600 : 400,
                  }}
                >
                  {opt.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {opt.description}
                </Typography>
              </Box>
            }
          />
        ))}
      </FormGroup>

      {hasIssues ? (
        <Typography variant="caption" color="error" sx={{ mt: 2, display: 'block' }}>
          ⚠️ Pantalla con defectos funcionales → Clasificará como Defectuoso (D)
        </Typography>
      ) : (
        <Typography variant="caption" color="success.main" sx={{ mt: 2, display: 'block' }}>
          ✅ Pantalla funciona correctamente (sin defectos de imagen)
        </Typography>
      )}
    </Paper>
  )
}
