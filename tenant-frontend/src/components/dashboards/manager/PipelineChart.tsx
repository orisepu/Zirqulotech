'use client'
import { Card, CardHeader, CardContent, Box, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { BarChart as MuiBarChart } from '@mui/x-charts/BarChart'
import { useMemo, useState, useCallback } from 'react'

type Row = { estado: string; count: number; valor: number }

function formatEuro(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n || 0))
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
    (label: number | null) => {
      const n = typeof label === 'number' && Number.isFinite(label) ? label : Number(label ?? 0)
      return metric === 'valor' ? formatEuro(n) : formatInt(n)
    },
    [metric]
  )
  const yTickFormatter = useCallback(
    (v: number) => (metric === 'valor'
      ? new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
      : formatInt(v)
    ),
    [metric]
  )
  const showLabels = (sorted?.length ?? 0) <= 10

  const valueFormatter = useCallback(
    (value: number | null) => {
      const numeric = typeof value === 'number' ? value : Number(value ?? 0)
      if (!Number.isFinite(numeric)) return metric === 'valor' ? formatEuro(0) : `${formatInt(0)} ops`
      return metric === 'valor' ? formatEuro(numeric) : `${formatInt(numeric)} ops`
    },
    [metric]
  )

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
            <MuiBarChart
              dataset={sorted}
              xAxis={[{
                scaleType: 'band',
                dataKey: 'estado',
                tickLabelStyle: { fontSize: 12 },
                slotProps: {
                  axisTickLabel: {
                    angle: -15,
                    textAnchor: 'end',
                    dx: -6,
                    dy: 8,
                  },
                },
              }]}
              yAxis={[{
                tickLabelStyle: { fontSize: 12 },
                valueFormatter: (value) => yTickFormatter(typeof value === 'number' ? value : Number(value ?? 0)),
              }]}
              series={[{
                id: metric,
                dataKey: metric,
                color: alpha(theme.palette.primary.main, 0.85),
                highlightScope: { faded: 'global', highlighted: 'item' },
                valueFormatter,
                barLabel: showLabels
                  ? (params) => {
                      const numeric = typeof params.value === 'number' ? params.value : Number(params.value ?? 0)
                      return labelFormatter(numeric)
                    }
                  : undefined,
              }]}
              height={320}
              margin={{ top: 16, right: 24, bottom: 40, left: 24 }}
              grid={{ horizontal: true, vertical: false }}
              borderRadius={6}
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
