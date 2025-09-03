'use client'

import React from 'react'
import { Box, Divider, Paper, Stack, Typography } from '@mui/material'
import DevicesIcon from '@mui/icons-material/Devices'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import MemoryIcon from '@mui/icons-material/Memory'
import NumbersIcon from '@mui/icons-material/Numbers'
import PsychologyIcon from '@mui/icons-material/Psychology'
import BrushIcon from '@mui/icons-material/Brush'
import BoltIcon from '@mui/icons-material/Bolt'
import EuroIcon from '@mui/icons-material/Euro'
import { CatalogoValoracion, FuncPantallaValue } from './tipos'

function Row({
  icon, label, value, clamp = false,
}: { icon: React.ReactNode, label: string, value: React.ReactNode, clamp?: boolean }) {
  return (
    <Box display="flex" alignItems="flex-start" gap={1}>
      <Box mt="4px">{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}:</Typography>
        <Typography
          variant="body2"
          sx={clamp ? {
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'normal',
            maxWidth: { xs: '100%', sm: 360 },
          } : undefined}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

export default function PasoValoracion({
  tipo, modeloObj, capacidadObj, cantidad,
  funcBasica, pantallaIssues,
  estadoPantalla, estadoLados, estadoEspalda,
  saludBateria, ciclosBateria,
  estadoTexto, precioCalculado,
  fmtEUR, formatoBonito,
  catalog,
}: {
  tipo: string
  modeloObj: any
  capacidadObj: any
  cantidad: number | string
  funcBasica: 'ok' | 'parcial' | ''
  pantallaIssues: FuncPantallaValue[]
  estadoPantalla: string
  estadoLados: string
  estadoEspalda: string
  saludBateria: number | ''
  ciclosBateria: number | ''
  estadoTexto: string
  precioCalculado: number | null
  fmtEUR: (n: number) => string
  formatoBonito: (s: string) => string
  catalog: CatalogoValoracion
}) {
  return (
    <Box sx={{ mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3, maxWidth: 980, mx: 'auto' }}>
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
          <Box flex={1}>
            <Stack spacing={1.2}>
              <Row icon={<DevicesIcon fontSize="small" />} label="Tipo" value={tipo || '-'} />
              <Row icon={<SmartphoneIcon fontSize="small" />} label="Modelo" value={modeloObj?.descripcion || '-'} clamp />
              <Row icon={<MemoryIcon fontSize="small" />} label="Capacidad" value={capacidadObj?.tamaño || '-'} />
              <Row icon={<NumbersIcon fontSize="small" />} label="Cantidad" value={`${typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad}`} />
              <Row
                icon={<PsychologyIcon fontSize="small" />}
                label="Funcionalidad"
                value={
                  funcBasica === 'ok'
                    ? 'Todo funciona'
                    : funcBasica === 'parcial'
                    ? `No totalmente funcional${
                        pantallaIssues.length
                          ? ' · ' + pantallaIssues
                              .map((v: FuncPantallaValue) =>
                                (catalog.funcPantalla.find(
                                  (i: (typeof catalog.funcPantalla)[number]) => i.value === v
                                )?.label ?? '')
                              )
                              .filter((s: string): s is string => s.length > 0)
                              .join(', ')
                          : ''
                      }`
                    : '—'
                }
              />
              <Row
                icon={<BrushIcon fontSize="small" />}
                label="Estética"
                value={`Pantalla: ${
                  catalog.esteticaPantalla.find(
                    (o: (typeof catalog.esteticaPantalla)[number]) => o.value === estadoPantalla
                  )?.label || '—'
                } · Lados: ${
                  catalog.esteticaLados.find(
                    (o: (typeof catalog.esteticaLados)[number]) => o.value === estadoLados
                  )?.label || '—'
                } · Trasera: ${
                  catalog.esteticaEspalda.find(
                    (o: (typeof catalog.esteticaEspalda)[number]) => o.value === estadoEspalda
                  )?.label || '—'
                }`}
              />
              <Row
                icon={<BoltIcon fontSize="small" />}
                label="Batería"
                value={`${saludBateria !== '' ? `${saludBateria}%` : '—'}${typeof ciclosBateria === 'number' ? ` · ${ciclosBateria} ciclos` : ''}`}
              />
            </Stack>
          </Box>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

          <Box flex={1} display="flex" flexDirection="column" gap={2}>
            <Box textAlign="center">
              <Typography variant="overline" color="text.secondary">Valoración</Typography>
              <Typography variant="h5" fontWeight={600}>{formatoBonito(estadoTexto)}</Typography>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: 'primary.light', bgcolor: 'action.hover' }}>
              <Typography variant="overline" color="text.secondary">Precio orientativo</Typography>
              <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                {precioCalculado == null ? '—' : fmtEUR(precioCalculado)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {precioCalculado == null ? 'Se valorará tras revisión técnica' : 'Estimación según estado'}
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
