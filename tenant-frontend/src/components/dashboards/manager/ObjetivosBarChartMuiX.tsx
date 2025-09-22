'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardHeader, CardContent, Box, CircularProgress, Typography, Stack } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'

const CARD_HEIGHT = 360
const CHART_HEIGHT = 220
const BAR_RADIUS = 15

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

const percentFormatter = (value: number | null) => `${Math.round(value ?? 0)}%`

export default function ObjetivosBarChartMuiX({ title, rows, loading, enabled, emptyMessage }: Props) {
  const theme = useTheme()

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
      const porcentaje = Math.max(0, Math.min(130, item.porcentajeValor))
      const segments: Segment[] = Array.isArray(item.usuarios)
        ? item.usuarios
            .filter((usuario) => usuario && typeof usuario.id === 'number')
            .map((usuario) => {
              const valor = Number(usuario.progresoValor || 0)
              const objetivo = Number(item.objetivoValor || 0)
              const porcentajeSegmento = objetivo > 0 ? (valor / objetivo) * 100 : 0
              const key = `usuario_${usuario.id}`
              labels.set(key, usuario.nombre)
              return {
                key,
                usuarioId: usuario.id,
                nombre: usuario.nombre,
                porcentaje: Math.max(0, Math.min(130, porcentajeSegmento)),
                valor,
                objetivoValor: Number(usuario.objetivoValor || 0),
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
    for (const row of chartRows) {
      for (const segment of row.segments) {
        segmentKeySet.add(segment.key)
      }
    }

    const maxPercentage = chartRows.reduce((acc, row) => Math.max(acc, row.porcentaje), 0)
    const upperDomain = maxPercentage > 100 ? Math.min(130, Math.ceil(maxPercentage / 5) * 5) : 100

    return {
      chartData: chartRows,
      segmentKeys: Array.from(segmentKeySet),
      segmentLabels: labels,
      upperDomain,
    }
  }, [rows])

  const colorPalette = useMemo(() => {
    const base = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.accent?.main ?? theme.palette.warning.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.error.main,
    ]
    return base.map((color) => alpha(color, theme.palette.mode === 'dark' ? 0.85 : 0.9))
  }, [theme])

  const colorForIndex = useCallback((index: number) => colorPalette[index % colorPalette.length], [colorPalette])

  const colorByKey = useMemo(() => {
    const map = new Map<string, string>()
    segmentKeys.forEach((key, index) => {
      map.set(key, colorForIndex(index))
    })
    return map
  }, [segmentKeys, colorForIndex])

  const isStacked = segmentKeys.length > 0

  const categories = useMemo(() => chartData.map((row) => row.label), [chartData])

  const series = useMemo(() => {
    if (chartData.length === 0) return []

    if (isStacked) {
      return segmentKeys.map((key, index) => {
        const label = segmentLabels.get(key) ?? `Segmento ${index + 1}`
        return {
          id: key,
          label,
          stack: 'usuarios',
          color: colorByKey.get(key) ?? colorForIndex(index),
          valueFormatter: percentFormatter,
          data: chartData.map((row) => {
            const segment = row.segments.find((seg) => seg.key === key)
            return segment ? Number(segment.porcentaje) : 0
          }),
        }
      })
    }

    return [
      {
        id: 'porcentaje_total',
        label: 'Porcentaje alcanzado',
        color: colorForIndex(0),
        valueFormatter: percentFormatter,
        data: chartData.map((row) => Number(row.porcentaje)),
      },
    ]
  }, [chartData, isStacked, segmentKeys, segmentLabels, colorByKey, colorForIndex])

  const chartHeight = CHART_HEIGHT

  const renderFallback = (message: string) => (
    <Box sx={{
      minHeight: chartHeight,
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center',
      color: 'text.secondary',
      px: 2,
      flexGrow: 1,
    }}>
      <Typography variant="body2">{message}</Typography>
    </Box>
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
          renderFallback('Selecciona un periodo mensual o trimestral para visualizar los objetivos.')
        ) : loading ? (
          <Box sx={{ minHeight: chartHeight, display: 'grid', placeItems: 'center', color: 'text.secondary', flexGrow: 1 }}>
            <Stack spacing={1} alignItems="center">
              <CircularProgress size={28} thickness={4} />
              <Typography variant="body2">Cargando objetivos…</Typography>
            </Stack>
          </Box>
        ) : chartData.length === 0 ? (
          renderFallback(emptyMessage)
        ) : (
          <Box sx={{ width: '100%', height: chartHeight, flexGrow: 1 }}>
            <BarChart
              series={series}
              xAxis={[{
                id: 'tiendas',
                data: categories,
                scaleType: 'band',
                tickLabelStyle: { fontSize: 12, fontWeight: 600 },
                tickLabelInterval: 0,
                slotProps: {
                  axisTickLabel: {
                    angle: -20,
                    textAnchor: 'end',
                    dominantBaseline: 'middle',
                    dx: -8,
                  },
                },
              }]}
              yAxis={[{
                id: 'porcentaje',
                min: 0,
                max: upperDomain,
                tickLabelStyle: { fontSize: 12 },
                valueFormatter: percentFormatter,
              }]}
              height={chartHeight}
              borderRadius={BAR_RADIUS}
              barLabel={isStacked ? undefined : ({ value }) => (value != null ? percentFormatter(value) : null)}
              margin={{ top: 24, right: 16, bottom: 44, left: 36 }}
              grid={{ horizontal: true, vertical: false }}
              hideLegend={!isStacked}
              slotProps={{
                tooltip: {
                  trigger: 'item',
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
