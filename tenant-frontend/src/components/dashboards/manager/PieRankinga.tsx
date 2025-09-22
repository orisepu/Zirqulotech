'use client'

import { Card, CardHeader, CardContent, Box, Stack, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { PieChart as MuiPieChart } from '@mui/x-charts/PieChart'

type PieRankingProps = {
  title: string
  rows: Array<Record<string, unknown>>
  valueKey?: string
  nameKey?: string
  valueIsOps?: boolean
  height?: number
  maxSlices?: number
  showLegend?: boolean
  legendMode?: 'auto' | 'right' | 'bottom' | 'floating' | 'none'
  legendCompact?: boolean
}

function formatEUR(v: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v || 0)
}
function formatINT(v: number) {
  return new Intl.NumberFormat('es-ES').format(Math.round(v || 0))
}

export default function PieRanking({
  title,
  rows,
  valueKey = 'valor',
  nameKey = 'nombre',
  valueIsOps = false,
  height = 320,
  maxSlices = 8,
  showLegend = true,
  legendMode = 'auto',
  legendCompact = false,
}: PieRankingProps) {
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const resolvedMode = legendMode === 'auto' ? (isNarrow ? 'bottom' : 'right') : legendMode

  // Normaliza datos
  const mapped = (rows ?? [])
    .map((r) => ({ name: String(r?.[nameKey] ?? '—'), value: Number(r?.[valueKey] ?? 0) }))
    .filter(d => Number.isFinite(d.value) && d.value > 0)
    .sort((a, b) => b.value - a.value)

  let data = mapped
  if (mapped.length > maxSlices) {
    const head = mapped.slice(0, maxSlices - 1)
    const tailSum = mapped.slice(maxSlices - 1).reduce((acc, d) => acc + d.value, 0)
    data = [...head, { name: 'Otros', value: tailSum }]
  }

  const total = data.reduce((acc, d) => acc + d.value, 0)

  // Colores
  const base = [
    theme.palette.primary.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.secondary.main,
  ]
  const colors = data.map((_, i) => {
    const c = base[i % base.length]
    const a = 0.9 - Math.floor(i / base.length) * 0.2
    return alpha(c, Math.max(0.4, a))
  })

  const legendLabel = (name: string, value: number) => {
    if (legendCompact || isNarrow) return name
    return valueIsOps ? `${name} — ${formatINT(value)} ops` : `${name} — ${formatEUR(value)}`
  }

  const pieData = data.map((item, index) => ({
    id: `${item.name}-${index}`,
    value: item.value,
    label: legendLabel(item.name, item.value),
    color: colors[index],
  }))

  const chartHeight = isNarrow ? 260 : height

  const resolveNumeric = (input: unknown) => {
    if (typeof input === 'number') return Number.isFinite(input) ? input : 0
    if (input && typeof input === 'object' && 'value' in (input as Record<string, unknown>)) {
      const candidate = (input as { value?: unknown }).value
      const numeric = typeof candidate === 'number' ? candidate : Number(candidate ?? 0)
      return Number.isFinite(numeric) ? numeric : 0
    }
    const numeric = Number(input ?? 0)
    return Number.isFinite(numeric) ? numeric : 0
  }

  const valueFormatter = (value: unknown) => {
    const numeric = resolveNumeric(value)
    const pct = total ? Math.round((numeric / total) * 100) : 0
    const base = valueIsOps ? `${formatINT(numeric)} ops` : formatEUR(numeric)
    return total ? `${base} (${pct}%)` : base
  }

  const legendEnabled = showLegend && legendMode !== 'none' && pieData.length > 0
  const useCustomLegend = legendEnabled && !isNarrow && resolvedMode !== 'bottom'

  const builtInLegendProps = (() => {
    if (!legendEnabled || useCustomLegend) return undefined
    return {
      direction: 'row' as const,
      position: { vertical: 'bottom' as const, horizontal: 'center' as const },
    }
  })()

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)', height: '100%' }}
    >
      <CardHeader
        title={title}
        sx={{
          px: 3,
          py: 2,
          '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 },
        }}
      />
      <CardContent sx={{ height: { xs: 260, md: height }, px: 3, py: 2.5 }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: useCustomLegend ? 'flex' : 'block',
            alignItems: useCustomLegend ? 'center' : undefined,
            justifyContent: useCustomLegend ? 'space-between' : undefined,
            columnGap: useCustomLegend ? 3 : undefined,
          }}
        >
          {!pieData.length ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              Sin datos para este filtro
            </Box>
          ) : (
            <>
              <Box sx={{ flex: useCustomLegend ? '1 1 0' : undefined, minWidth: 0 }}>
                <MuiPieChart
                  series={[{
                    id: 'ranking',
                    data: pieData,
                    innerRadius: 40,
                    outerRadius: 90,
                    cornerRadius: 5,
                    paddingAngle: 5,
                    highlightScope: { faded: 'global', highlighted: 'item' },
                    faded: { innerRadius: 40, additionalRadius: -20 },
                    valueFormatter,
                    arcLabel: (item) => {
                      const percent = total ? item.value / total : 0
                      return percent > 0.04 ? `${Math.round(percent * 100)}%` : ''
                    },
                    arcLabelMinAngle: 10,
                  }]}
                  height={chartHeight}
                  margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                  hideLegend={!builtInLegendProps}
                  slotProps={{
                    legend: builtInLegendProps,
                    tooltip: {
                      trigger: 'item',
                    },
                  }}
                />
              </Box>
              {useCustomLegend ? (
                <Stack spacing={1} sx={{ minWidth: 180, pr: 1 }}>
                  {pieData.map((slice) => (
                    <Stack key={slice.id} direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: 1,
                          bgcolor: slice.color,
                          boxShadow: `inset 0 0 0 1px ${alpha('#000', 0.08)}`,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ fontSize: 12.5, lineHeight: 1.4 }}>
                        {slice.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
