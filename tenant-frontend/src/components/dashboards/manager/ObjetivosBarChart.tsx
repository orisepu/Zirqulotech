'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardHeader, CardContent, Box, CircularProgress, Typography, Stack } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts'
import type { TooltipProps } from 'recharts'

const CARD_HEIGHT = 360
const CHART_HEIGHT = 220
const BAR_RADIUS: [number, number, number, number] = [15, 15, 0, 0]

export type ObjetivoUsuarioDetalle = {
  id: number
  nombre: string
  objetivoValor: number
  progresoValor: number
  objetivoOperaciones: number
  progresoOperaciones: number
}

type RowInput = {
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
  rows: RowInput[]
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

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

function formatOps(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0'
  return new Intl.NumberFormat('es-ES').format(Math.round(value))
}

export default function ObjetivosBarChart({ title, rows, loading, enabled, emptyMessage }: Props) {
  const theme = useTheme()

  const { chartData, segmentKeys, upperDomain, originalRows } = useMemo(() => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { chartData: [], segmentKeys: [] as string[], upperDomain: 100, originalRows: [] as RowInput[] }
    }

    const chartRows: ChartRow[] = rows.map((item) => {
      const porcentaje = Math.max(0, Math.min(130, item.porcentajeValor))
      const segments: Segment[] = Array.isArray(item.usuarios)
        ? item.usuarios
            .filter((usuario) => usuario && typeof usuario.id === 'number')
            .map((usuario) => {
              const valor = Number(usuario.progresoValor || 0)
              const objetivo = Number(item.objetivoValor || 0)
              const porcentajeSegmento = objetivo > 0 ? (valor / objetivo) * 100 : 0
              return {
                key: `usuario_${usuario.id}`,
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
        objetivoValor: item.objetivoValor,
        progresoValor: item.progresoValor,
        objetivoOperaciones: item.objetivoOperaciones,
        progresoOperaciones: item.progresoOperaciones,
        segments,
      }
    })

    const segmentKeys = new Set<string>()
    for (const row of chartRows) {
      for (const segment of row.segments) {
        segmentKeys.add(segment.key)
      }
    }

    const maxPercentage = chartRows.reduce((acc, row) => Math.max(acc, row.porcentaje), 0)
    const upperDomain = maxPercentage > 100 ? Math.min(130, Math.ceil(maxPercentage / 5) * 5) : 100

    return {
      chartData: chartRows,
      segmentKeys: Array.from(segmentKeys),
      upperDomain,
      originalRows: rows,
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

  const stackedGradients = useMemo(
    () =>
      segmentKeys.map((key, index) => {
        const base = colorByKey.get(key) ?? colorForIndex(index)
        return {
          id: `grad-${key}`,
          color: base,
        }
      }),
    [segmentKeys, colorByKey, colorForIndex]
  )

  const tooltipRenderer = useCallback((props: TooltipProps<number, string>) => {
    const { active } = props
    const payload = (props as unknown as { payload?: Array<{ value?: number | string; dataKey?: string; payload?: ChartRow }> }).payload
    const label = (props as unknown as { label?: string }).label
    if (!active || !payload?.length) return null
    const baseRow = payload[0]?.payload as ChartRow | undefined
    if (!baseRow) return null

    const segments = baseRow.segments ?? []
    return (
      <Box sx={{
        p: 1.25,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        boxShadow: 3,
        minWidth: 230,
      }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
        <Typography variant="body2" sx={{ mb: segments.length ? 0.75 : 0 }}>
          {`Valor: ${formatCurrency(baseRow.progresoValor)} / ${formatCurrency(baseRow.objetivoValor)}`}
        </Typography>
        <Typography variant="body2" sx={{ mb: segments.length ? 0.75 : 0 }}>
          {`Operaciones: ${formatOps(baseRow.progresoOperaciones)} / ${formatOps(baseRow.objetivoOperaciones)}`}
        </Typography>
        {segments.length ? (
          <Stack spacing={0.4}>
            {(payload as Array<{ value?: number | string; dataKey?: string }> )
              .filter((item) => item.value != null && Number(item.value) > 0)
              .map((item) => {
                const segment = segments.find((seg) => seg.key === item.dataKey)
                if (!segment) return null
                const percent = Math.round(Number(item.value))
                return (
                  <Typography key={segment.key} variant="caption" sx={{ color: colorByKey.get(segment.key) || 'text.secondary' }}>
                    {`${segment.nombre}: ${formatCurrency(segment.valor)} · ${percent}%`}
                  </Typography>
                )
              })}
          </Stack>
        ) : null}
      </Box>
    )
  }, [colorByKey])

  const chartPayload = useMemo(() => {
    return chartData.map((row) => {
      const entry: Record<string, unknown> = {
        label: row.label,
        porcentaje: row.porcentaje,
        porcentajeTotal: row.porcentaje,
        objetivoValor: row.objetivoValor,
        progresoValor: row.progresoValor,
        objetivoOperaciones: row.objetivoOperaciones,
        progresoOperaciones: row.progresoOperaciones,
        segments: row.segments,
      }
      row.segments.forEach((segment) => {
        entry[segment.key] = segment.porcentaje
      })
      return entry
    })
  }, [chartData])

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
          <>
            <Box sx={{ width: '100%', height: chartHeight, flexGrow: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartPayload}
                  margin={{ top: 16, right: 16, bottom: 32, left: 8 }}
                  barSize={40}
                >
                  {!isStacked ? (
                    <defs>
                      <linearGradient id="objetivosGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={alpha(theme.palette.primary.main, 0.9)} />
                        <stop offset="100%" stopColor={alpha(theme.palette.primary.main, 0.55)} />
                      </linearGradient>
                    </defs>
                  ) : null}
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={58}
                  />
                  <YAxis
                    type="number"
                    domain={[0, upperDomain]}
                    tickFormatter={(value) => `${Math.round(value)}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={tooltipRenderer} />
                  {isStacked ? (
                    <>
                      <defs>
                        {stackedGradients.map((gradient) => (
                          <linearGradient key={gradient.id} id={gradient.id} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={alpha(gradient.color, 0.95)} />
                            <stop offset="100%" stopColor={alpha(gradient.color, 0.65)} />
                          </linearGradient>
                        ))}
                      </defs>
                      {segmentKeys.map((key, index) => {
                        const isTopSegment = index === segmentKeys.length - 1
                        return (
                          <Bar
                            key={key}
                            dataKey={key}
                            stackId="usuarios"
                            fill={`url(#grad-${key})`}
                            radius={isTopSegment ? BAR_RADIUS : [0, 0, 0, 0]}
                          />
                        )
                      })}
                      <Bar dataKey="porcentajeTotal" barSize={0} isAnimationActive={false}>
                        <LabelList
                          dataKey="porcentajeTotal"
                          position="top"
                          formatter={(value: unknown) => {
                            const numeric = typeof value === 'number' ? value : Number(value ?? 0)
                            return `${Math.round(numeric)}%`
                          }}
                          style={{ fontSize: 12, fontWeight: 600 }}
                        />
                      </Bar>
                    </>
                  ) : (
                    <Bar
                      dataKey="porcentaje"
                      fill="url(#objetivosGradient)"
                      radius={BAR_RADIUS}
                      background={{ fill: alpha(theme.palette.primary.main, 0.08) }}
                    >
                      <LabelList
                        dataKey="porcentaje"
                        position="top"
                        formatter={(value: unknown) => {
                          const numeric = typeof value === 'number' ? value : Number(value ?? 0)
                          return `${Math.round(numeric)}%`
                        }}
                        style={{ fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </Box>
            
          </>
        )}
      </CardContent>
    </Card>
  )
}
