'use client'

import React from 'react'
import {
  Paper, Stack, Typography, Box, Slider, TextField, InputAdornment,
  ToggleButtonGroup, ToggleButton, Tooltip, FormHelperText, IconButton
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import PsychologyIcon from '@mui/icons-material/Psychology'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BugReportIcon from '@mui/icons-material/BugReport'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import Image from 'next/image'
import { CatalogoValoracion, FuncPantallaValue } from './tipos'

type Mode = 'battery' | 'basic' | 'screen' | 'all'

export default function PasoEstadoDispositivo({
  catalog, isLaptop,
  saludBateria, setSaludBateria,
  ciclosBateria, setCiclosBateria,
  funcBasica, setFuncBasica,
  pantallaIssues, setPantallaIssues,
  openDemo,
  /** NUEVO (opcionales para compatibilidad): */
  enciende, setEnciende,
  cargaOk, setCargaOk,
  mode = 'all',
}: {
  catalog: CatalogoValoracion; isLaptop: boolean
  saludBateria: number | ''; setSaludBateria: (v: number | '') => void
  ciclosBateria: number | ''; setCiclosBateria: (v: number | '') => void
  funcBasica: 'ok' | 'parcial' | ''; setFuncBasica: (v: 'ok' | 'parcial' | '') => void
  pantallaIssues: FuncPantallaValue[]
  setPantallaIssues: React.Dispatch<React.SetStateAction<FuncPantallaValue[]>>
  openDemo: (demo: { src: string, title: string }) => void
  /** NUEVO: gates de energía */
  enciende?: boolean | null
  setEnciende?: (v: boolean | null) => void
  cargaOk?: boolean | null
  setCargaOk?: (v: boolean | null) => void
  mode?: Mode
}) {
  // Estados locales para retrocompatibilidad si el padre aún no pasa setters:
  const [localEnciende, setLocalEnciende] = React.useState<boolean | null>(enciende ?? null)
  const [localCargaOk, setLocalCargaOk]   = React.useState<boolean | null>(cargaOk ?? null)

  React.useEffect(() => { if (enciende !== undefined) setLocalEnciende(enciende) }, [enciende])
  React.useEffect(() => { if (cargaOk !== undefined) setLocalCargaOk(cargaOk) }, [cargaOk])

  const setPower = (v: boolean | null) => {
    if (setEnciende) setEnciende(v)
    else setLocalEnciende(v)
  }
  const setCharge = (v: boolean | null) => {
    if (setCargaOk) setCargaOk(v)
    else setLocalCargaOk(v)
  }

  const clampPct = (n: number) => Math.max(0, Math.min(100, n))

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {(mode === 'battery' || mode === 'all') && (
        <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <BoltIcon fontSize="small" />
            <Typography variant="subtitle2">Energía y batería</Typography>
          </Stack>

          {/* NUEVO: Encendido y Carga */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ mb: .5 }}>¿Enciende?</Typography>
              <ToggleButtonGroup
                exclusive
                value={enciende ?? localEnciende}
                onChange={(_e, val: boolean | null) => setPower(val)}
                sx={{
                  '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'primary.light', borderColor: 'primary.main', color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.light' },
                  },
                }}
              >
                <ToggleButton value={true}  sx={{ px: 2, textTransform: 'none' }}>Sí</ToggleButton>
                <ToggleButton value={false} sx={{ px: 2, textTransform: 'none' }}>No</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ mb: .5 }}>¿Carga por cable?</Typography>
              <ToggleButtonGroup
                exclusive
                value={cargaOk ?? localCargaOk}
                onChange={(_e, val: boolean | null) => setCharge(val)}
                sx={{
                  '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'primary.light', borderColor: 'primary.main', color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.light' },
                  },
                }}
              >
                <ToggleButton value={true}  sx={{ px: 2, textTransform: 'none' }}>Sí</ToggleButton>
                <ToggleButton value={false} sx={{ px: 2, textTransform: 'none' }}>No</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Stack>

          {/* Salud/Ciclos batería */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="center">
            <Box flex={1} px={{ sm: 1 }} sx={{ maxWidth: 520 }}>
              <Slider
                value={typeof saludBateria === 'number' ? saludBateria : 0}
                onChange={(_e, val) => setSaludBateria(val as number)}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                aria-label="Salud de la batería"
              />
            </Box>
            <TextField
              label="Salud (%)"
              type="number"
              value={saludBateria}
              onChange={(e) => {
                const n = Number(e.target.value)
                setSaludBateria(Number.isFinite(n) ? clampPct(n) : '')
              }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 100 } }}
              sx={{ width: { xs: '100%', sm: 160 } }}
            />
            {isLaptop && (
              <TextField
                label="Ciclos (opcional)"
                type="number"
                value={ciclosBateria}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setCiclosBateria(Number.isFinite(n) ? Math.max(0, n) : '')
                }}
                inputProps={{ min: 0 }}
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
            )}
          </Stack>
        </Paper>
      )}

      {(mode === 'basic' || mode === 'all') && (
        <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <PsychologyIcon fontSize="small" />
            <Typography variant="subtitle2">Funcionalidad básica</Typography>
          </Stack>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <ToggleButtonGroup
              exclusive
              value={funcBasica}
              onChange={(_e, val: 'ok' | 'parcial' | null) => { if (val !== null) setFuncBasica(val) }}
              sx={{
                flexWrap: 'wrap',
                '& .MuiToggleButton-root.Mui-selected': {
                  bgcolor: 'primary.light',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'primary.light' },
                },
              }}
            >
              {catalog.funcBasica.map(o => (
                <Tooltip key={o.value} title={o.desc} arrow placement="top">
                  <ToggleButton value={o.value} sx={{ px: 2, py: 1.2, textTransform: 'none' }}>
                    {o.value === 'ok' ? <CheckCircleIcon fontSize="small" /> : <BugReportIcon fontSize="small" />}
                    <Box ml={1}>{o.label}</Box>
                  </ToggleButton>
                </Tooltip>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {funcBasica
              ? <FormHelperText sx={{ mt: 1 }}>{catalog.funcBasica.find(o => o.value === funcBasica)?.desc}</FormHelperText>
              : <FormHelperText sx={{ mt: 1 }}>Selecciona una opción</FormHelperText>
            }
          </Box>
        </Paper>
      )}

      {(mode === 'screen' || mode === 'all') && (
        <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <ScreenshotMonitorIcon fontSize="small" />
            <Typography variant="subtitle2">Funcionalidad de la pantalla</Typography>
            <IconButton
              size="small"
              onClick={() => setPantallaIssues([])}
              sx={{ ml: 'auto' }}
            >
              <ClearAllIcon />
            </IconButton>
          </Stack>

          <ToggleButtonGroup
            value={pantallaIssues}
            onChange={(_e, list: FuncPantallaValue[]) => setPantallaIssues(list)}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 2,
              justifyItems: 'center',
              '& .MuiToggleButton-root': {
                p: 0,
                m: 0,
                width: '100%',
                borderRadius: 2,
                overflow: 'hidden',
                textTransform: 'none',
                alignItems: 'stretch',
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              },
              '& .MuiToggleButton-root.Mui-selected': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            {catalog.funcPantalla.map((o) => {
              const demo = catalog.demoFuncPantalla[o.value as 'puntos' | 'pixeles' | 'lineas']
              return (
                <ToggleButton key={o.value} value={o.value} sx={{ display: 'flex', flexDirection: 'column', p: 0 }}>
                  <Box sx={{ position: 'relative', width: '100%', height: { xs: 120, sm: 140, md: 160 }, bgcolor: '#000', flexShrink: 0 }}>
                    <Image src={demo.src} alt={o.label} fill style={{ objectFit: 'cover', objectPosition: 'top center' }} draggable={false} />
                    <IconButton
                      component="span"
                      disableRipple
                      disableFocusRipple
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); openDemo(demo) }}
                      sx={{
                        position: 'absolute',
                        right: 8,
                        bottom: 8,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                      }}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box px={1.25} py={1} textAlign="center">
                    <Typography variant="body2" fontWeight={600}>{o.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{o.desc}</Typography>
                  </Box>
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>

          <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
            {pantallaIssues.length === 0
              ? 'Selecciona todas las incidencias que apliquen'
              : pantallaIssues
                  .map((k: FuncPantallaValue) => `• ${catalog.funcPantalla.find(i => i.value === k)?.desc ?? ''}`)
                  .filter((s): s is string => s.length > 0)
                  .join('   ')
            }
          </FormHelperText>
        </Paper>
      )}
    </Box>
  )
}
