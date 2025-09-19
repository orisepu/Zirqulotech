'use client'
import { Card, CardHeader, CardContent, Box, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts'
import { useMemo, useState,useCallback } from 'react'

type Row = { estado: string; count: number; valor: number }

function formatEuro(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n || 0))
}

type TooltipPayloadItem = { value: number }
function CustomTooltip({ active, payload, label, metric }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string; metric: 'count'|'valor' }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <Box sx={{ p: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, boxShadow: 1 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div>{metric === 'valor' ? formatEuro(v) : `${formatInt(v)} ops`}</div>
    </Box>
  )
}

export default function PipelineChart({ data }: { data: Row[] }) {
  const theme = useTheme()
  const [metric, setMetric] = useState<'count' | 'valor'>('valor')

  const normalized = useMemo(() => {
    const acc = new Map<string, Row>()
    for (const item of data || []) {
      const estado = (item?.estado ?? '').toString() || 'Sin estado'
      const existing = acc.get(estado)
      const count = Number(item?.count || 0)
      const valor = Number(item?.valor || 0)
      if (existing) {
        existing.count += count
        existing.valor += valor
      } else {
        acc.set(estado, { estado, count, valor })
      }
    }
    return Array.from(acc.values())
  }, [data])

  // Orden opcional de estados (ajústalo a tu pipeline real)
  const sorted = useMemo(() => {
    const ORDER = [
      'Pendiente',
      'Aceptado',
      'Recogida solicitada',
      'Recogida generada',
      'En tránsito',
      'Check in OK',
      'Recibido',
      'En revisión',
      'Nueva oferta',
      'Nueva oferta enviada',
      'Nueva oferta confirmada',
      'Oferta confirmada',
      'Pendiente factura',
      'Factura recibida',
    ] as const
    if (!normalized.length) return []
    const byOrder = new Map<string, number>(ORDER.map((e, i) => [e, i]))
    return [...normalized].sort((a, b) => (byOrder.get(a.estado) ?? 999) - (byOrder.get(b.estado) ?? 999))
  }, [normalized])
  const labelFormatter = useCallback(
    (label: React.ReactNode) => {
      const n = typeof label === 'number' ? label : Number(label ?? 0)
      return metric === 'valor' ? formatEuro(n) : formatInt(n)
    },
    [metric]
  )
  const yTickFormatter = (v: number) => (metric === 'valor' ? new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : formatInt(v))
  const showLabels = (sorted?.length ?? 0) <= 10

  return (
    <Card variant="outlined" sx={{ borderRadius: 3,boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)' }}>
      <CardHeader
        title="Pipeline por estado"
        action={
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
                px: 1.75,
              },
            }}
          >
            <ToggleButton value="count">Operaciones</ToggleButton>
            <ToggleButton value="valor">Euros €</ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{ px: 3, py: 2, '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 } }}
      />
      <CardContent sx={{ height: 320, px: 3, py: 2.5 }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          {sorted.length === 0 ? (
            <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
              Sin datos para este filtro
            </Box>
          ) : (
            <ResponsiveContainer>
              <BarChart
                data={sorted}
                margin={{ top: 8, right: 16, left: 8, bottom: 24 }}
                barCategoryGap={18}
                barGap={4}
              >
                {/* Gradiente ligado al tema */}
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={alpha(theme.palette.primary.main, 0.85)} />
                    <stop offset="100%" stopColor={alpha(theme.palette.primary.main, 0.55)} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="estado" tick={{ fontSize: 12 }} interval={0} angle={-15} dy={10} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={yTickFormatter} />
                <Tooltip content={<CustomTooltip metric={metric} />} />

                <Bar
                  dataKey={metric}
                  fill="url(#barGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  background={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                >
                  {showLabels && (
                    <LabelList
                      dataKey={metric}
                      position="top"
                      formatter={labelFormatter}
                      style={{ fontSize: 11 }}
                    />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
