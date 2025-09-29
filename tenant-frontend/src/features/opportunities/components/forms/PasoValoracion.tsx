'use client'

import React from 'react'
import { Box, Grid, Paper, Stack, Typography } from '@mui/material'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import MemoryIcon from '@mui/icons-material/Memory'
import NumbersIcon from '@mui/icons-material/Numbers'
import PsychologyIcon from '@mui/icons-material/Psychology'
import BrushIcon from '@mui/icons-material/Brush'
import BoltIcon from '@mui/icons-material/Bolt'
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

type ModeloObj = { descripcion?: string }
type CapacidadObj = { tamaño?: string }

export default function PasoValoracion({
  tipo, modeloObj, capacidadObj, cantidad,
  funcBasica, pantallaIssues,
  estadoPantalla, estadoLados, estadoEspalda,
  saludBateria, ciclosBateria,
  estadoTexto, precioCalculado: _precioCalculado,
  precioMaximo,
  fmtEUR, formatoBonito,
  catalog,
  mostrarDetalles = true,
  otrosPrecios,
}: {
  tipo: string
  modeloObj: ModeloObj
  capacidadObj: CapacidadObj
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
  precioMaximo: number | null
  fmtEUR: (n: number) => string
  formatoBonito: (s: string) => string
  catalog: CatalogoValoracion
  mostrarDetalles?: boolean
  otrosPrecios?: Array<{ etiqueta: string; valor: number | null }>
}) {
  const cantidadNum = typeof cantidad === 'string' ? parseInt(cantidad, 10) || 1 : cantidad
  const estadoLabel = formatoBonito(estadoTexto) || '—'
  const descripcionBase = [modeloObj?.descripcion, capacidadObj?.tamaño]
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .join(' ')
  const cantidadTexto = `${cantidadNum} ${cantidadNum === 1 ? 'unidad' : 'unidades'}`
  const modeloResumen = descripcionBase
    ? `${descripcionBase} - ${cantidadTexto}`
    : cantidadTexto

  const funcionalidadTexto =
    funcBasica === 'ok'
      ? 'Todo funciona'
      : funcBasica === 'parcial'
        ? `Incidencias: ${
            pantallaIssues.length
              ? pantallaIssues
                  .map((v: FuncPantallaValue) =>
                    (catalog.funcPantalla.find(
                      (i: (typeof catalog.funcPantalla)[number]) => i.value === v
                    )?.label ?? '')
                  )
                  .filter((s: string): s is string => s.length > 0)
                  .join(', ')
              : 'detalle no especificado'
          }`
        : 'Sin información'

  const esteticaTexto = `Pantalla: ${
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
  }`

  const bateriaTexto = `${saludBateria !== '' ? `${saludBateria}%` : '—'}${
    typeof ciclosBateria === 'number' ? ` · ${ciclosBateria} ciclos` : ''
  }`

  const mapEtiqueta = (raw: string) => {
    const normalized = raw.trim().toUpperCase()
    if (normalized === 'A' || normalized === 'A+') return 'Muy bueno'
    if (normalized === 'B') return 'Bueno'
    if (normalized === 'C') return 'Correcto'
    return formatoBonito(raw)
  }

  const fmtEURSinDecimales = (valor: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)

  const detailCards = mostrarDetalles
    ? [
        {
          icon: <SmartphoneIcon fontSize="small" />, label: 'Modelo', value: modeloObj?.descripcion || '—', clamp: true,
        },
        {
          icon: <MemoryIcon fontSize="small" />, label: 'Capacidad', value: capacidadObj?.tamaño || '—',
        },
        {
          icon: <NumbersIcon fontSize="small" />, label: 'Cantidad', value: `${cantidadNum}`,
        },
        {
          icon: <PsychologyIcon fontSize="small" />, label: 'Funcionalidad', value: funcionalidadTexto,
        },
        {
          icon: <BrushIcon fontSize="small" />, label: 'Estética', value: esteticaTexto,
        },
        {
          icon: <BoltIcon fontSize="small" />, label: 'Batería', value: bateriaTexto,
        },
      ]
    : []

  return (
    <Box sx={{ mt: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          maxWidth: 980,
          mx: 'auto',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(22,27,34,0.9) 0%, rgba(30,60,52,0.65) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(222,236,230,0.75) 100%)',
        }}
      >
        <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="overline" color="text.secondary">Resumen</Typography>
          <Typography variant="h6" fontWeight={700}>
            {modeloResumen || '-'}
          </Typography>
          
        </Stack>

          {mostrarDetalles && (
            <Grid container spacing={2}>
              {detailCards.map((card, idx) => (
                <Grid key={idx} size={{ xs: 12, sm: 6 }}>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.5,
                      height: '100%',
                      backgroundColor: 'background.paper',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}
                  >
                    <Row {...card} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          <Grid container spacing={2} alignItems="stretch">
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  borderRadius: 2,
                  p: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(33,150,83,0.22) 0%, rgba(38,166,154,0.18) 100%)'
                      : 'linear-gradient(135deg, rgba(214,242,228,0.9) 0%, rgba(214,239,255,0.6) 100%)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="overline" color="text.secondary">Valoración máxima</Typography>
                <Typography variant="h4" fontWeight={700}>
                  {precioMaximo == null ? '—' : fmtEURSinDecimales(precioMaximo)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Estimado para un dispositivo en estado excelente. Se ajustará tras la auditoría.
                </Typography>
              </Box>
            </Grid>

            {Array.isArray(otrosPrecios) && otrosPrecios.length > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  sx={{
                    borderRadius: 2,
                    p: 2,
                    height: '100%',
                    border: '1px dashed',
                    borderColor: 'divider',
                    backgroundColor: (theme) => theme.palette.action.hover,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="overline" color="text.secondary">Comparativa de estados</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Valores orientativos del mismo modelo en cada nivel de conservación.
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    {[{ etiqueta: 'Excelente', valor: precioMaximo }, ...otrosPrecios.map((p) => ({
                      etiqueta: mapEtiqueta(p.etiqueta),
                      valor: p.valor,
                    }))].map((item, idx) => (
                      <Box
                        key={`${item.etiqueta}-${idx}`}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          p: 1.25,
                          backgroundColor: (theme) => theme.palette.background.paper,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2" fontWeight={600} color="text.primary">
                          {item.etiqueta}
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {item.valor == null ? '—' : fmtEURSinDecimales(item.valor)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>

          <Typography variant="caption" color="text.secondary">
            Valores sujetos a auditoría técnica (diagnóstico, bloqueos, piezas). FMI/Activation Lock debe estar desactivado.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}
