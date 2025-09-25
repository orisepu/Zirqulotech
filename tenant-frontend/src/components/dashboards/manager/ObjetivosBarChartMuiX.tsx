'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardHeader, CardContent, Box, CircularProgress, Typography, Stack } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'

/* ==========================
 * Constantes
 * ========================== */
const CARD_HEIGHT = 360
const CHART_HEIGHT = 220
const BAR_RADIUS = 15
const MAX_PCT = 130

/* ==========================
 * Tipos
 * ========================== */
export type ObjetivoUsuarioDetalle = {
  id: number
  nombre: string
  objetivoValor: number
  progresoValor: number
  objetivoOperaciones: number
  progresoOperaciones: number
}

export type ObjetivoRow = {
  id: number
  nombre: string
  objetivoValor: number
  progresoValor: number
  objetivoOperaciones: number
  progresoOperaciones: number
  porcentajeValor: number
  usuarios?: ObjetivoUsuarioDetalle[]
}

type Props = {
  title: string
  rows: ObjetivoRow[]
  loading: boolean
  enabled: boolean
  emptyMessage: string
}

type Segment = {
  key: string
  usuarioId: number
  nombre: string
  porcentaje: number
  valor: number
  objetivoValor: number
}

type ChartRow = {
  label: string
  porcentaje: number
  objetivoValor: number
  progresoValor: number
  objetivoOperaciones: number
  progresoOperaciones: number
  segments: Segment[]
}

/* ==========================
 * Utils
 * ========================== */
const clampPct = (n: number) => Math.max(0, Math.min(MAX_PCT, n))
const percentFormatter = (value: number | null) => `${Math.round(value ?? 0)}%`

function Fallback({ message, minHeight = CHART_HEIGHT }: { message: string; minHeight?: number }) {
  return (
    <Box
      sx={{
        minHeight,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        color: 'text.secondary',
        px: 2,
        flexGrow: 1,
      }}
    >
      <Typography variant="body2">{message}</Typography>
    </Box>
  )
}

/* ==========================
 * Componente
 * ========================== */
export default function ObjetivosBarChartMuiX({ title, rows, loading, enabled, emptyMessage }: Props) {
  const theme = useTheme()

  // Paleta base -> alpha según modo (oscuro/claro)
  const basePalette = useMemo(() => {
    const base = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.accent?.main ?? theme.palette.warning.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.error.main,
    ]
    const a = theme.palette.mode === 'dark' ? 0.85 : 0.9
    return base.map((c) => alpha(c, a))
  }, [theme])

  // Color estable por usuarioId
  const colorForUser = useCallback(
    (usuarioId: number) => {
      const idx = Math.abs(usuarioId) % basePalette.length
      return basePalette[idx]
    },
    [basePalette]
  )

  // Normalización de datos -> filas del chart, claves de segmentos, etiquetas y dominio superior
  const { chartData, segmentKeys, segmentLabels, upperDomain } = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        chartData: [] as ChartRow[],
        segmentKeys: [] as string[],
        segmentLabels: new Map<string, string>(),
        upperDomain: 100,
      }
    }

    const labels = new Map<string, string>()

    const chartRows: ChartRow[] = rows.map((item) => {
      const porcentaje = clampPct(Number(item.porcentajeValor || 0))

      const segments: Segment[] = Array.isArray(item.usuarios)
        ? item.usuarios
            .filter((u) => u && typeof u.id === 'number')
            .map((u) => {
              const valor = Number(u.progresoValor || 0)
              const objetivoItem = Number(item.objetivoValor || 0) // objetivo del contenedor (tienda)
              const pct = objetivoItem > 0 ? clampPct((valor / objetivoItem) * 100) : 0
              const key = `usuario_${u.id}`
              labels.set(key, u.nombre)
              return {
                key,
                usuarioId: u.id,
                nombre: u.nombre,
                porcentaje: pct,
                valor,
                objetivoValor: Number(u.objetivoValor || 0), // por si en el futuro se muestra
              }
            })
        : []

      return {
        label: item.nombre,
        porcentaje,
        objetivoValor: Number(item.objetivoValor || 0),
        progresoValor: Number(item.progresoValor || 0),
        objetivoOperaciones: Number(item.objetivoOperaciones || 0),
        progresoOperaciones: Number(item.progresoOperaciones || 0),
        segments,
      }
    })

    const segmentKeySet = new Set<string>()
    for (const row of chartRows) for (const seg of row.segments) segmentKeySet.add(seg.key)

    const maxPercentage = chartRows.reduce((acc, row) => Math.max(acc, row.porcentaje), 0)
    const upper = maxPercentage > 100 ? Math.min(MAX_PCT, Math.ceil(maxPercentage / 5) * 5) : 100

    return {
      chartData: chartRows,
      segmentKeys: Array.from(segmentKeySet),
      segmentLabels: labels,
      upperDomain: upper,
    }
  }, [rows])

  const isStacked = segmentKeys.length > 0
  const categories = useMemo(() => chartData.map((row) => row.label), [chartData])

  // Series para x-charts (stack de usuarios o única serie total)
  const series = useMemo(() => {
    if (chartData.length === 0) return []

    if (isStacked) {
      return segmentKeys.map((key, index) => {
        const label = segmentLabels.get(key) ?? `Segmento ${index + 1}`
        // Encuentra el usuarioId en cualquier fila (todas comparten el mismo key pattern)
        const sampleSeg = chartData.find((r) => r.segments.some((s) => s.key === key))?.segments.find((s) => s.key === key)
        const color = sampleSeg ? colorForUser(sampleSeg.usuarioId) : undefined

        return {
          id: key,
          label,
          stack: 'usuarios',
          color,
          valueFormatter: percentFormatter,
          data: chartData.map((row) => {
            const seg = row.segments.find((s) => s.key === key)
            return seg ? Number(seg.porcentaje) : 0
          }),
        }
      })
    }

    return [
      {
        id: 'porcentaje_total',
        label: 'Porcentaje alcanzado',
        color: colorForUser(0),
        valueFormatter: percentFormatter,
        data: chartData.map((row) => Number(row.porcentaje)),
      },
    ]
  }, [chartData, isStacked, segmentKeys, segmentLabels, colorForUser])

  // Helpers de configuración del chart
  const mkXAxis = useCallback(
    () => [
      {
        id: 'tiendas',
        data: categories,
        scaleType: 'band' as const,
        tickLabelStyle: { fontSize: 12, fontWeight: 600 },
        tickLabelInterval: 'auto' as const,
        slotProps: {
          axisTickLabel: {
            textAnchor: 'end' as const,
            dx: -8,
          },
        },
      },
    ],
    [categories]
  )

  const mkYAxis = useCallback(
    () => [
      {
        id: 'porcentaje',
        min: 0,
        max: upperDomain,
        tickLabelStyle: { fontSize: 12 },
        valueFormatter: percentFormatter,
      },
    ],
    [upperDomain]
  )

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)',
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardHeader
        title={title}
        subheader={enabled ? 'Porcentaje alcanzado sobre el objetivo económico' : undefined}
        sx={{ px: 3, py: 2, '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 } }}
      />
      <CardContent sx={{ px: 3, pt: 1.5, pb: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {!enabled ? (
          <Fallback message="Selecciona un periodo mensual o trimestral para visualizar los objetivos." />
        ) : loading ? (
          <Box sx={{ minHeight: CHART_HEIGHT, display: 'grid', placeItems: 'center', color: 'text.secondary', flexGrow: 1 }}>
            <Stack spacing={1} alignItems="center">
              <CircularProgress size={28} thickness={4} />
              <Typography variant="body2">Cargando objetivos…</Typography>
            </Stack>
          </Box>
        ) : chartData.length === 0 ? (
          <Fallback message={emptyMessage} />
        ) : (
          <Box sx={{ width: '100%', height: CHART_HEIGHT, flexGrow: 1 }}>
            <BarChart
              series={series}
              xAxis={mkXAxis()}
              yAxis={mkYAxis()}
              height={CHART_HEIGHT}
              borderRadius={BAR_RADIUS}
              barLabel={isStacked ? undefined : ({ value }) => (value != null ? percentFormatter(value) : null)}
              margin={{ top: 24, right: 16, bottom: 44, left: 36 }}
              grid={{ horizontal: true, vertical: false }}
              hideLegend={!isStacked}
              slotProps={{ tooltip: { trigger: 'item' } }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
