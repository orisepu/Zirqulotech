'use client'

import React from 'react'
import {
  Paper, Stack, Typography, Box, Button, Chip, ToggleButton, IconButton, FormHelperText
} from '@mui/material'
import BrushIcon from '@mui/icons-material/Brush'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import Image from 'next/image'
import { CatalogoValoracion, EsteticaKey, EsteticaPantallaKey } from './tipos'

type Mode = 'screen' | 'body' | 'all'
type Setter<T> = React.Dispatch<React.SetStateAction<T>>

export default function PasoEstetica({
  catalog,
  estadoPantalla, setEstadoPantalla,
  estadoLados, setEstadoLados,
  estadoEspalda, setEstadoEspalda,
  openDemo,
  mode = 'all',
}: {
  catalog: CatalogoValoracion
  estadoPantalla: EsteticaKey | ''
  setEstadoPantalla: Setter<EsteticaKey | ''>
  estadoLados: EsteticaKey | ''
  setEstadoLados: Setter<EsteticaKey | ''>
  estadoEspalda: EsteticaKey | ''
  setEstadoEspalda: Setter<EsteticaKey | ''>
  openDemo: (demo: { src: string; title: string }) => void
  mode?: Mode
}) {
  const PANT_KEYS: EsteticaPantallaKey[] = ['sin_signos','minimos','algunos','desgaste_visible']

  const LABEL_DESC: Record<EsteticaKey, { label: string; desc: string }> =
    (['sin_signos','minimos','algunos','desgaste_visible','agrietado_roto'] as EsteticaKey[])
      .reduce((acc, k) => {
        const o = catalog.esteticaEspalda.find(x => x.value === k)!
        acc[k] = { label: o.label, desc: o.desc }
        return acc
      }, {} as Record<EsteticaKey, {label: string; desc: string}>)

  return (
    <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
      {(mode === 'screen' || mode === 'all') && (
        <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <BrushIcon fontSize="small" />
            <Typography variant="subtitle2">Estética — Pantalla</Typography>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1 }}>
            {PANT_KEYS.map((k) => {
              const o = catalog.esteticaPantalla.find(x => x.value === k)!
              const demo = catalog.demoEsteticaPantalla[k]
              return (
                <ToggleButton
                  key={k}
                  value={k}
                  selected={estadoPantalla === k}
                  onClick={() => setEstadoPantalla(k as EsteticaKey)} 
                  sx={{
                    justifySelf: 'stretch',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    p: 0, m: 0, borderRadius: 2, overflow: 'hidden',
                    textTransform: 'none',
                    border: '2px solid',
                    borderColor: estadoPantalla === k ? 'primary.main' : 'divider',
                    bgcolor: 'background.paper',
                    '&.Mui-selected': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                    <Image src={demo.src} alt={o.label} fill draggable={false} style={{ objectFit: 'cover', objectPosition: 'top center' }} />
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openDemo({ src: demo.src, title: o.label }) }}
                      sx={{ position: 'absolute', right: 8, bottom: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box px={1.25} py={1} textAlign="center">
                    <Typography variant="body2" fontWeight={600} sx={{ minHeight: 24 }}>{o.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.desc}</Typography>
                  </Box>
                </ToggleButton>
              )
            })}
          </Box>

          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Button size="small" startIcon={<ClearAllIcon />} onClick={() => setEstadoPantalla('')}>
              Limpiar selección
            </Button>
          </Box>

          <FormHelperText sx={{ textAlign: 'center' }}>
            {estadoPantalla
              ? catalog.esteticaPantalla.find(o => o.value === estadoPantalla)?.desc
              : 'Selecciona un estado'}
          </FormHelperText>
        </Paper>
      )}

      {(mode === 'body' || mode === 'all') && (
        <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <BrushIcon fontSize="small" />
            <Typography variant="subtitle2">Estética — Laterales y trasera</Typography>

            <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" onClick={() => estadoEspalda && setEstadoLados(estadoEspalda)} disabled={!estadoEspalda}>
                Copiar trasera → laterales
              </Button>
              <Button size="small" onClick={() => estadoLados && setEstadoEspalda(estadoLados)} disabled={!estadoLados}>
                Copiar laterales → trasera
              </Button>
              <Button size="small" startIcon={<ClearAllIcon />} onClick={() => { setEstadoLados(''); setEstadoEspalda('') }}>
                Limpiar
              </Button>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" mb={2}>
            <Chip label={`Laterales: ${LABEL_DESC[(estadoLados || 'sin_signos') as EsteticaKey]?.label || '—'}`} variant="outlined" />
            <Chip label={`Trasera: ${LABEL_DESC[(estadoEspalda || 'sin_signos') as EsteticaKey]?.label || '—'}`} variant="outlined" />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
              gap: 2,
              justifyItems: 'stretch',
              alignItems: 'stretch',
            }}
          >
            {(['sin_signos','minimos','algunos','desgaste_visible','agrietado_roto'] as EsteticaKey[]).map((k) => {
              const src = catalog.demoEsteticaEspalda[k]
              const selectedL = estadoLados === k
              const selectedB = estadoEspalda === k

              return (
                <Paper
                  key={k}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: (t) => (selectedL || selectedB ? t.palette.primary.main : t.palette.divider),
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', bgcolor: '#000' }}>
                    <Image src={src} alt={LABEL_DESC[k].label} fill style={{ objectFit: 'cover', objectPosition: 'top center' }} draggable={false} />
                    <IconButton
                      size="small"
                      onClick={() => openDemo({ src, title: LABEL_DESC[k].label })}
                      sx={{ position: 'absolute', right: 8, bottom: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                    >
                      <ZoomInIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ p: 1, justifyContent: 'center' }}>
                    <ToggleButton
                      value="lados"
                      selected={selectedL}
                      onClick={() => setEstadoLados(k)}
                      size="small"
                      sx={{
                        flex: 1, minWidth: 0,
                        px: 1.5, py: 0.75, textTransform: 'none', whiteSpace: 'nowrap',
                        borderColor: selectedL ? 'primary.main' : 'divider',
                        '&.Mui-selected': { bgcolor: 'action.hover', color: 'primary.main' },
                      }}
                    >
                      <VerticalSplitIcon fontSize="small" sx={{ mr: 0.75 }} />
                      Laterales
                    </ToggleButton>

                    <ToggleButton
                      value="trasera"
                      selected={selectedB}
                      onClick={() => setEstadoEspalda(k)}
                      size="small"
                      sx={{
                        flex: 1, minWidth: 0,
                        px: 1.5, py: 0.75, textTransform: 'none', whiteSpace: 'nowrap',
                        borderColor: selectedB ? 'primary.main' : 'divider',
                        '&.Mui-selected': { bgcolor: 'action.hover', color: 'primary.main' },
                      }}
                    >
                      <FlipToBackIcon fontSize="small" sx={{ mr: 0.75 }} />
                      Trasera
                    </ToggleButton>
                  </Stack>

                  <Box sx={{ px: 1.25, pb: 1, textAlign: 'center' }}>
                    <Typography variant="body2" fontWeight={600} sx={{ minHeight: 24 }}>
                      {LABEL_DESC[k].label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        minHeight: 32,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {LABEL_DESC[k].desc}
                    </Typography>
                  </Box>
                </Paper>
              )
            })}
          </Box>

          <FormHelperText sx={{ mt: 2, textAlign: 'center' }}>
            Elige la opción para <strong>Laterales</strong> o <strong>Trasera</strong> en cada tarjeta.
          </FormHelperText>
        </Paper>
      )}
    </Box>
  )
}
