'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { FuncPantallaValue, EsteticaPantallaKey, CatalogoValoracion } from '../../tipos'

interface PasoPantallaProps {
  // Funcional
  pantallaIssues: FuncPantallaValue[]
  setPantallaIssues: (val: FuncPantallaValue[]) => void
  // Estética (usa EsteticaPantallaKey para incluir 'astillado')
  estadoPantalla: EsteticaPantallaKey | ''
  setEstadoPantalla: (val: EsteticaPantallaKey | '') => void
  // Catálogo
  catalog: CatalogoValoracion
}

/**
 * Paso 3 (V1 style): Pantalla - Funcional + Estética combinados
 * Evalúa issues funcionales (puntos, píxeles, líneas) + estado estético del cristal
 */
export default function PasoPantalla({
  pantallaIssues,
  setPantallaIssues,
  estadoPantalla,
  setEstadoPantalla,
  catalog,
}: PasoPantallaProps) {

  const handleIssueToggle = (issue: FuncPantallaValue) => {
    setPantallaIssues(
      pantallaIssues.includes(issue)
        ? pantallaIssues.filter((i) => i !== issue)
        : [...pantallaIssues, issue]
    )
  }

  const hayIssues = pantallaIssues.length > 0

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: hayIssues ? 'error.main' : 'primary.light',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Paso 3: Pantalla (funcional y estética)
      </Typography>

      <Grid container spacing={3}>
        {/* Sección 1: Issues funcionales */}
        <Grid size={{ xs: 12 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <VisibilityIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              ¿Problemas funcionales en la pantalla?
            </Typography>
          </Box>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={pantallaIssues.includes('puntos_brillantes')}
                  onChange={() => handleIssueToggle('puntos_brillantes')}
                />
              }
              label="Puntos brillantes"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={pantallaIssues.includes('pixeles_muertos')}
                  onChange={() => handleIssueToggle('pixeles_muertos')}
                />
              }
              label="Píxeles muertos"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={pantallaIssues.includes('lineas_quemaduras')}
                  onChange={() => handleIssueToggle('lineas_quemaduras')}
                />
              }
              label="Líneas o quemaduras"
            />
          </FormGroup>
          {hayIssues && (
            <Chip
              size="small"
              label="Issues detectados - puede afectar la valoración"
              color="error"
              sx={{ mt: 1 }}
            />
          )}
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Divider sx={{ my: 1 }} />
        </Grid>

        {/* Sección 2: Estado estético del cristal */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="body2" fontWeight={600} mb={1}>
            Estado estético del cristal
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={estadoPantalla}
            onChange={(_e, val) => setEstadoPantalla(val ?? '')}
            fullWidth
            size="small"
          >
            {(catalog.esteticaPantalla || []).map((opt) => (
              <ToggleButton
                key={opt.value}
                value={opt.value}
                sx={{
                  '&.Mui-selected': {
                    bgcolor:
                      opt.value === 'sin_signos' || opt.value === 'minimos'
                        ? 'success.main'
                        : opt.value === 'algunos'
                          ? 'primary.main'
                          : opt.value === 'desgaste_visible'
                            ? 'warning.main'
                            : 'error.main',
                    color: 'common.white',
                    fontWeight: 700,
                    '&:hover': {
                      bgcolor:
                        opt.value === 'sin_signos' || opt.value === 'minimos'
                          ? 'success.dark'
                          : opt.value === 'algunos'
                            ? 'primary.dark'
                            : opt.value === 'desgaste_visible'
                              ? 'warning.dark'
                              : 'error.dark',
                    },
                  },
                }}
              >
                {opt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {estadoPantalla === 'agrietado_roto' && (
            <Chip
              size="small"
              label="Pantalla agrietada/rota - dispositivo será marcado como defectuoso (D)"
              color="error"
              sx={{ mt: 1 }}
            />
          )}
        </Grid>
      </Grid>
    </Paper>
  )
}
