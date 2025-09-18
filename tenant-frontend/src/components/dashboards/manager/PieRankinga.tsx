'use client'

import React, { type CSSProperties } from 'react'
import { Card, CardHeader, CardContent, Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type LegendProps,
  type PieLabelRenderProps,
} from 'recharts'

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

  type ValueType = number | string | Array<number | string>
  type NameType = string | number
  type PayloadItem = { payload?: { name?: string } }
  const tooltipFormatter = (value: ValueType, _name: NameType, entry: PayloadItem) => {
    const v = Number((Array.isArray(value) ? value[0] : value) ?? 0)
    const pct = total ? ` (${Math.round((v / total) * 100)}%)` : ''
    return [(valueIsOps ? `${formatINT(v)} ops` : formatEUR(v)) + pct, entry?.payload?.name]
  }

  const legendText = (value: string) => {
    const item = data.find(d => d.name === value)
    if (!item) return value
    if (legendCompact || isNarrow) return value
    return valueIsOps ? `${value} — ${formatINT(item.value)} ops` : `${value} — ${formatEUR(item.value)}`
  }

  // Props de leyenda según modo (tipado explícito)
  const baseLegend: Partial<LegendProps> = { formatter: (value: string | number) => legendText(String(value)) }

  let legendProps: Partial<LegendProps> = baseLegend

  if (resolvedMode === 'bottom') {
    legendProps = {
      ...baseLegend,
      verticalAlign: 'bottom',
      align: 'center',
      layout: 'horizontal',
      wrapperStyle: {
        paddingTop: 8,
        fontSize: 12,
        lineHeight: '18px',
      } as CSSProperties,
    }
  } else if (resolvedMode === 'floating') {
    legendProps = {
      ...baseLegend,
      verticalAlign: 'top',
      align: 'right',
      layout: 'vertical',
      wrapperStyle: {
        position: 'absolute' as CSSProperties['position'],
        right: 8,
        top: 8,
        fontSize: 12,
        lineHeight: '18px',
      },
    }
  } else if (resolvedMode === 'right') {
    legendProps = {
      ...baseLegend,
      verticalAlign: 'middle',
      align: 'right',
      layout: 'vertical',
      wrapperStyle: {
        paddingLeft: 8,
        fontSize: 12,
        lineHeight: '18px',
      } as CSSProperties,
    }
  }
  // 'none' => no pasamos Legend

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 ,boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)'}}>
      <CardHeader title={title} sx={{ p: 1.5, '& .MuiCardHeader-title': { fontSize: 16 } }} />
      <CardContent sx={{ height }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          {!data.length ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              Sin datos para este filtro
            </Box>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={90}
                  cornerRadius={5}
                  paddingAngle={5}
                  labelLine={false}
                  label={(props: PieLabelRenderProps) => {
                    const percentRaw = props?.percent
                    const percent = typeof percentRaw === 'number' ? percentRaw : 0
                    return percent > 0.04 ? `${Math.round(percent * 100)}%` : ''
                  }}
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={`slice-${idx}`}
                      fill={colors[idx]}
                      stroke={alpha(colors[idx], 0.6)}
                    />
                  ))}
                </Pie>

                <Tooltip formatter={tooltipFormatter} />

                {showLegend && resolvedMode !== 'none' && <Legend {...legendProps} />}
              </PieChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
