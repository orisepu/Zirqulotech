'use client'
import { Card, CardHeader, CardContent, Box, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
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
  height = 340,
  maxSlices = 8,
  showTotal = true,
}: PieRankingComercialesProps) {
  const theme = useTheme()
  const [metric, setMetric] = useState<'ops' | 'valor'>('ops')
  const tooltipBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.95)
    : alpha('#FFFFFF', 0.95)
  const tooltipBorder = theme.palette.mode === 'dark'
    ? '1px solid rgba(255,255,255,0.08)'
    : `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
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
      .map(d => ({ name: d.usuario, value: Number(d[key] || 0) }))
      .filter(d => d.value > 0)
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
    return { fill: alpha(base, 0.9), stroke: alpha(base, 0.6) }
  }

  const current = metric === 'ops' ? dataOps : dataVal
  const totalCurrent = metric === 'ops' ? totalOps : totalVal

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 ,boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)'}}>
      <CardHeader
        title={title}
        action={
          mode === 'toggle' && (
            <ToggleButtonGroup size="small" value={metric} exclusive onChange={(_, v) => v && setMetric(v)}>
              <ToggleButton value="ops">Ops</ToggleButton>
              <ToggleButton value="valor">€</ToggleButton>
            </ToggleButtonGroup>
          )
        }
        sx={{ p: 1.5, '& .MuiCardHeader-title': { fontSize: 16 } }}
      />
      <CardContent sx={{ height, position: 'relative' }}>
        {/* Totales centrados */}
        {showTotal && (
          <>
            {mode === 'dual' && (dataOps.length || dataVal.length) && (
              <Box
                sx={{
                  position: 'absolute',
                  left: '60%',
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
                  left: '60%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Box sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                  {metric === 'ops' ? `${formatINT(totalOps)} ops` : formatEUR(totalVal)}
                </Box>
                <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Total</Box>
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
          <ResponsiveContainer>
            <PieChart>
              {mode === 'toggle' && (
                <Pie
                  data={current}
                  dataKey="value"
                  nameKey="name"
                  cx="45%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={90}
                  paddingAngle={5}
                  cornerRadius={5}
                  labelLine={false}
                  label={(props: PieLabelRenderProps) => {
                    const percentRaw = props?.percent
                    const percent = typeof percentRaw === 'number' ? percentRaw : 0
                    return percent > 0.05 ? `${Math.round(percent * 100)}%` : ''
                  }}
                >
                  {current.map((entry, idx) => {
                    const { fill, stroke } = colorByName(entry.name)
                    return <Cell key={`c-${entry.name}-${idx}`} fill={fill} stroke={stroke} />
                  })}
                </Pie>
              )}

              {mode === 'dual' && (
                <>
                  <Pie
                    data={dataOps}
                    dataKey="value"
                    nameKey="name"
                    cx="42%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {dataOps.map((entry, idx) => {
                      const { fill, stroke } = colorByName(entry.name)
                      return <Cell key={`ops-${entry.name}-${idx}`} fill={alpha(fill, 0.85)} stroke={stroke} />
                    })}
                  </Pie>
                  <Pie
                    data={dataVal}
                    dataKey="value"
                    nameKey="name"
                    cx="42%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={108}
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {dataVal.map((entry, idx) => {
                      const { fill, stroke } = colorByName(entry.name)
                      return <Cell key={`eur-${entry.name}-${idx}`} fill={alpha(fill, 0.6)} stroke={stroke} />
                    })}
                  </Pie>
                </>
              )}

              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: 12,
                  border: tooltipBorder,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 12px 32px rgba(0,0,0,0.35)'
                    : '0 10px 28px rgba(31,41,55,0.1)',
                  color: theme.palette.text.primary,
                }}
                labelStyle={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                itemStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                cursor={false}
                formatter={(value: number, _n: string, entry: { payload?: { name?: string } }) => {
                  const name = entry?.payload?.name || ''
                  if (mode === 'dual') {
                    const vOps = dataOps.find(d => d.name === name)?.value || 0
                    const vVal = dataVal.find(d => d.name === name)?.value || 0
                    const pctOps = totalOps ? ` (${Math.round((vOps / totalOps) * 100)}%)` : ''
                    const pctVal = totalVal ? ` (${Math.round((vVal / totalVal) * 100)}%)` : ''
                    return [`${formatINT(vOps)} ops${pctOps} · ${formatEUR(vVal)}${pctVal}`, name]
                  } else {
                    const v = Number(value || 0)
                    const pct = totalCurrent ? ` (${Math.round((v / totalCurrent) * 100)}%)` : ''
                    return [metric === 'ops' ? `${formatINT(v)} ops${pct}` : `${formatEUR(v)}${pct}`, name]
                  }
                }}
              />
              <Legend
                verticalAlign="middle"
                align="right"
                layout="vertical"
                wrapperStyle={{ paddingLeft: 8 }}
                formatter={(value: string) => {
                  const ops = dataOps.find(d => d.name === value)?.value || 0
                  const eur = dataVal.find(d => d.name === value)?.value || 0
                  return mode === 'dual'
                    ? `${value} — ${formatINT(ops)} ops · ${formatEUR(eur)}`
                    : metric === 'ops'
                      ? `${value} — ${formatINT(ops)} ops`
                      : `${value} — ${formatEUR(eur)}`
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
