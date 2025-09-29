'use client'

import { useMemo, useCallback } from 'react'
import { Card, CardHeader, CardContent, Box, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { LineChart as MuiLineChart } from '@mui/x-charts/LineChart'

type Serie = { periodo: string; valor: number }

type Props = {
  data: Serie[]
  granularidad?: 'dia' | 'semana' | 'mes'
  onGranularidadChange?: (value: 'dia' | 'semana' | 'mes') => void
}

function formatCurrency(value?: number | null) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0)
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(numeric)
}

export default function EvolucionChart({ data, granularidad = 'mes', onGranularidadChange }: Props) {
  const theme = useTheme()

  const handleGranularidad = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: 'dia' | 'semana' | 'mes' | null) => {
      if (!value || typeof onGranularidadChange !== 'function') return
      onGranularidadChange(value)
    },
    [onGranularidadChange]
  )

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return []

    if (granularidad === 'dia') {
      return [...data].sort((a, b) => new Date(a.periodo).getTime() - new Date(b.periodo).getTime())
    }

    type Bucket = { valor: number; sortKey: number }
    const buckets = new Map<string, Bucket>()

    for (const item of data) {
      const date = new Date(item.periodo)
      if (Number.isNaN(date.getTime())) continue
      const safeValor = Number(item.valor || 0)

      if (granularidad === 'semana') {
        const start = new Date(date)
        const day = start.getDay()
        const diff = (day + 6) % 7
        start.setDate(start.getDate() - diff)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        const label = `Semana ${start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`
        const existing = buckets.get(label)
        if (existing) existing.valor += safeValor
        else buckets.set(label, { valor: safeValor, sortKey: start.getTime() })
      } else {
        const start = new Date(date.getFullYear(), date.getMonth(), 1)
        const label = start.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
        const existing = buckets.get(label)
        if (existing) existing.valor += safeValor
        else buckets.set(label, { valor: safeValor, sortKey: start.getTime() })
      }
    }

    return Array.from(buckets.entries())
      .map(([periodo, bucket]) => ({ periodo, valor: bucket.valor, sortKey: bucket.sortKey }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ periodo, valor }) => ({ periodo, valor }))
  }, [data, granularidad])

  const chartHeight = 280

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)', height: '100%' }}>
      <CardHeader
        title="Evolución del valor de recompra"
        action={
          <ToggleButtonGroup
            size="small"
            value={granularidad}
            exclusive
            onChange={handleGranularidad}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.6 : 0.8),
              borderRadius: 5,
              p: 0.25,
              '& .MuiToggleButton-root': {
                px: 1.75,
              },
            }}
          >
            <ToggleButton value="dia">Día</ToggleButton>
            <ToggleButton value="semana">Semana</ToggleButton>
            <ToggleButton value="mes">Mes</ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{
          px: 3,
          py: 2,
          '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 },
          '& .MuiCardHeader-action': { alignSelf: 'center', m: 0 },
        }}
      />
      <CardContent sx={{ height: { xs: 260, md: 320 }, pt: 2, px: 3, '&:last-child': { pb: 3 } }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          {!chartData.length ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              Sin datos para este filtro
            </Box>
          ) : (
            <MuiLineChart
              dataset={chartData}
              xAxis={[{
                dataKey: 'periodo',
                scaleType: 'band',
                tickLabelStyle: { fontSize: 12 },
              }]}
              yAxis={[{
                tickLabelStyle: { fontSize: 12 },
                valueFormatter: (value: number) => formatCurrency(typeof value === 'number' ? value : Number(value ?? 0)),
              }]}
              series={[{
                id: 'valor',
                dataKey: 'valor',
                label: 'Valor',
                showMark: false,
                curve: 'monotoneX',
                color: theme.palette.primary.main,
                valueFormatter: (value) => formatCurrency(value),
              }]}
              height={chartHeight}
              margin={{ top: 24, right: 24, bottom: 24, left: 32 }}
              grid={{ vertical: false, horizontal: true }}
              hideLegend
              axisHighlight={{ x: 'line', y: 'none' }}
              slotProps={{
                tooltip: {
                  trigger: 'item',
                },
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
