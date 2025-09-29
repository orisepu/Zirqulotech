'use client'
import { Card, CardHeader, CardContent, Box, ToggleButtonGroup, ToggleButton, Stack, Typography } from '@mui/material'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme, alpha } from '@mui/material/styles'
import { PieChart as MuiPieChart } from '@mui/x-charts/PieChart'
import { useMemo, useState, useCallback } from 'react'

type RowOps = { usuario: string; ops: number }
type RowVal = { usuario: string; valor: number }

type PieRankingComercialesProps = {
  title: string
  rowsOps: RowOps[]
  rowsValor: RowVal[]
  mode?: 'toggle' | 'dual'     // toggle = alternar; dual = 2 aros simultáneos
  height?: number
  maxSlices?: number           // agrupa el resto en "Otros"
  showTotal?: boolean
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
const formatINT = (n: number) => new Intl.NumberFormat('es-ES').format(Math.round(n || 0))

export default function PieRankingComerciales({
  title,
  rowsOps = [],
  rowsValor = [],
  mode = 'toggle',
  height = 320,
  maxSlices = 8,
  showTotal = true,
}: PieRankingComercialesProps) {
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))
  const [metric, setMetric] = useState<'ops' | 'valor'>('ops')
  const fallbackName = 'Sin asignar'

  // Une datasets por usuario, poniendo 0 cuando falte alguna métrica
  const merged = useMemo(() => {
    const byUser: Record<string, { usuario: string; ops: number; valor: number }> = {}
    for (const r of rowsOps || []) {
      const u = r.usuario && r.usuario.trim() ? r.usuario : fallbackName
      if (!byUser[u]) byUser[u] = { usuario: u, ops: 0, valor: 0 }
      byUser[u].ops += Number(r.ops || 0)
    }
    for (const r of rowsValor || []) {
      const u = r.usuario && r.usuario.trim() ? r.usuario : fallbackName
      if (!byUser[u]) byUser[u] = { usuario: u, ops: 0, valor: 0 }
      byUser[u].valor += Number(r.valor || 0)
    }
    return Object.values(byUser)
  }, [rowsOps, rowsValor])

  // Construye data para el pie; ordena, filtra >0 y agrupa "Otros"
  const buildData = useCallback((key: 'ops' | 'valor') => {
    const sorted = [...merged]
      .map((d) => ({ name: d.usuario, value: Number(d[key] || 0) }))
      .sort((a, b) => b.value - a.value)
    if (sorted.length <= maxSlices) return sorted
    const head = sorted.slice(0, maxSlices - 1)
    const tailSum = sorted.slice(maxSlices - 1).reduce((acc, d) => acc + d.value, 0)
    return [...head, { name: 'Otros', value: tailSum }]
  }, [merged, maxSlices])

  const dataOps = useMemo(() => buildData('ops'), [buildData])
  const dataVal = useMemo(() => buildData('valor'), [buildData])

  const totalOps = dataOps.reduce((a, d) => a + d.value, 0)
  const totalVal = dataVal.reduce((a, d) => a + d.value, 0)

  // Mismo color por usuario en ambos aros
  const palette = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.secondary.main,
  ]
  const order = useMemo(
    () => Array.from(new Set([...dataOps.map(d => d.name), ...dataVal.map(d => d.name)])),
    [dataOps, dataVal]
  )
  const colorByName = (name: string) => {
    const idx = Math.max(0, order.indexOf(name))
    const base = palette[idx % palette.length]
    return { fill: alpha(base, 0.9) }
  }

  const pieDataOps = dataOps.map((slice, index) => {
    const { fill } = colorByName(slice.name)
    return {
      id: `ops-${slice.name}-${index}`,
      value: slice.value,
      label: slice.name,
      color: fill,
    }
  })

  const pieDataVal = dataVal.map((slice, index) => {
    const { fill } = colorByName(slice.name)
    return {
      id: `valor-${slice.name}-${index}`,
      value: slice.value,
      label: slice.name,
      color: fill,
    }
  })

  const resolveNumeric = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
      const candidate = (value as { value?: unknown }).value
      const numeric = typeof candidate === 'number' ? candidate : Number(candidate ?? 0)
      return Number.isFinite(numeric) ? numeric : 0
    }
    const numeric = Number(value ?? 0)
    return Number.isFinite(numeric) ? numeric : 0
  }

  const opsValueFormatter = useCallback((value: unknown, context?: { dataIndex: number }) => {
    let numeric = resolveNumeric(value)
    if ((!numeric || Number.isNaN(numeric)) && context) {
      const fallback = pieDataOps[context.dataIndex]?.value
      if (typeof fallback === 'number') numeric = fallback
    }
    const pct = totalOps ? Math.round((numeric / totalOps) * 100) : 0
    const base = `${formatINT(numeric)} ops`
    return pct ? `${base} (${pct}%)` : base
  }, [pieDataOps, totalOps])

  const valorValueFormatter = useCallback((value: unknown, context?: { dataIndex: number }) => {
    let numeric = resolveNumeric(value)
    if ((!numeric || Number.isNaN(numeric)) && context) {
      const fallback = pieDataVal[context.dataIndex]?.value
      if (typeof fallback === 'number') numeric = fallback
    }
    const pct = totalVal ? Math.round((numeric / totalVal) * 100) : 0
    const base = formatEUR(numeric)
    return pct ? `${base} (${pct}%)` : base
  }, [pieDataVal, totalVal])

  const currentPieData = metric === 'ops' ? pieDataOps : pieDataVal
  const totalCurrent = metric === 'ops' ? totalOps : totalVal

  const pieSeries = useMemo(() => {
    if (mode === 'dual') {
      return [
        {
          id: 'ops',
          data: pieDataOps,
          innerRadius: 20,
          outerRadius: 100,
          paddingAngle: 5,
          cornerRadius: 5,
          faded: { additionalRadius: -12 },
          valueFormatter: opsValueFormatter,
        },
        {
          id: 'valor',
          data: pieDataVal,
          innerRadius: 20,
          outerRadius: 100,
          paddingAngle: 5,
          cornerRadius: 5,
          faded: { additionalRadius: -12 },
          valueFormatter: valorValueFormatter,
          arcLabel: (item: { value: number }) => {
            const percent = totalVal ? item.value / totalVal : 0
            return percent > 0.05 ? `${Math.round(percent * 100)}%` : ''
          },
          arcLabelMinAngle: 12,
        },
      ]
    }

    return [
      {
        id: metric,
        data: currentPieData,
        innerRadius: 20,
        outerRadius: 100,
        paddingAngle: 5,
        cornerRadius: 5,
        faded: { additionalRadius: -16 },
        valueFormatter: metric === 'ops' ? opsValueFormatter : valorValueFormatter,
        
      },
    ]
  }, [mode, metric, pieDataOps, pieDataVal, currentPieData, totalCurrent, totalVal, opsValueFormatter, valorValueFormatter])

  const legendEntries = useMemo(() => {
    return order.map((name) => {
      const ops = dataOps.find((d) => d.name === name)?.value ?? 0
      const valor = dataVal.find((d) => d.name === name)?.value ?? 0
      const { fill } = colorByName(name)
      return { name, ops, valor, color: fill }
    })
  }, [order, dataOps, dataVal])

  const legendEnabled = legendEntries.length > 0
  const useSideLegend = legendEnabled && !isMdDown
  const chartHeight = useSideLegend ? height : Math.min(height, 260)
  const renderLegendItem = (entry: { name: string; ops: number; valor: number; color: string }) => {
    const label = mode === 'dual'
      ? `${entry.name} — ${formatINT(entry.ops)} ops · ${formatEUR(entry.valor)}`
      : metric === 'ops'
        ? `${entry.name} — ${formatINT(entry.ops)} ops`
        : `${entry.name} — ${formatEUR(entry.valor)}`
    return (
      <Stack key={entry.name} direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: 1,
            bgcolor: entry.color,
            boxShadow: `inset 0 0 0 1px ${alpha('#000', 0.08)}`,
            flexShrink: 0,
          }}
        />
        <Typography variant="body2" sx={{ fontSize: 12.5, lineHeight: 1.4 }}>
          {label}
        </Typography>
      </Stack>
    )
  }

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)', height: '100%' }}
    >
      <CardHeader
        title={title}
        action={
          mode === 'toggle' && (
            <ToggleButtonGroup
              size="small"
              value={metric}
              exclusive
              onChange={(_, v) => v && setMetric(v)}
              sx={{
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.6 : 0.8),
                borderRadius: 5,
                p: 0.25,
                '& .MuiToggleButton-root': {
                  px: 1.6,
                },
              }}
            >
              <ToggleButton value="ops">Operaciones</ToggleButton>
              <ToggleButton value="valor">Euros €</ToggleButton>
            </ToggleButtonGroup>
          )
        }
        sx={{
          px: 3,
          py: 2,
          '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 },
          '& .MuiCardHeader-action': { alignSelf: 'center', m: 0 },
        }}
      />
      <CardContent sx={{ height: { xs: 260, md: height }, position: 'relative', px: 3, py: 2.5 }}>
        {/* Totales centrados */}
        {showTotal && (
          <>
            {mode === 'dual' && (dataOps.length || dataVal.length) && (
              <Box
                sx={{
                  position: 'absolute',
                  left: useSideLegend ? '45%' : '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Total</Box>
                <Box sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{formatINT(totalOps)} ops</Box>
                <Box sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{formatEUR(totalVal)}</Box>
              </Box>
            )}
            {mode === 'toggle' && (dataOps.length || dataVal.length) && (
              <Box
                sx={{
                  position: 'absolute',
                  left: useSideLegend ? '45%' : '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                
              </Box>
            )}
          </>
        )}

        {/* Chart */}
        {!dataOps.length && !dataVal.length ? (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
            Sin datos para este filtro
          </Box>
        ) : (
          <Stack
            direction={useSideLegend ? 'row' : 'column'}
            spacing={useSideLegend ? 2.5 : 2}
            justifyContent="center"
            alignItems={useSideLegend ? 'center' : 'stretch'}
            sx={{ height: '100%', flexWrap: useSideLegend ? 'nowrap' : 'wrap' }}
          >
            <Box sx={{ flex: useSideLegend ? '1 1 0' : 'unset', minWidth: 0 }}>
              <MuiPieChart
                series={pieSeries}
                height={chartHeight}
                margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                hideLegend
                slotProps={{
                  tooltip: {
                    trigger: 'item',
                  },
                }}
              />
            </Box>
            {legendEnabled ? (
              <Stack
                spacing={1.25}
                sx={{
                  minWidth: useSideLegend ? 220 : '100%',
                  maxHeight: useSideLegend ? '100%' : 'auto',
                  overflowY: useSideLegend ? 'auto' : 'visible',
                }}
              >
                {legendEntries.map(renderLegendItem)}
              </Stack>
            ) : null}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
