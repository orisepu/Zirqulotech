"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Grid, Stack, TextField, MenuItem, Button } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import { fetchDashboardAdmin, DashboardManagerResponse } from '@/services/api'
import KpiCard from '@/components/dashboards/manager/KpiCard'
import EvolucionChart from '@/components/dashboards/manager/EvolucionChart'
import PipelineChart from '@/components/dashboards/manager/PipelineChart'
import PieRanking from '@/components/dashboards/manager/PieRankinga'
import PieRankingComerciales from '@/components/dashboards/manager/PieRankingComerciales'

// Dashboard interno con la misma estética del Manager
export default function DashboardInternoPage() {
  const [fechaInicio, setFechaInicio] = useState<Dayjs>(dayjs().startOf('month'))
  const [fechaFin, setFechaFin] = useState<Dayjs>(dayjs().endOf('month'))
  const [granularidad, setGranularidad] = useState<'dia' | 'semana' | 'mes'>('mes')
  const [tiendaId, setTiendaId] = useState<string | number | undefined>(undefined)
  const [usuarioId, setUsuarioId] = useState<string | number | undefined>(undefined)
  const [partnerSchema, setPartnerSchema] = useState<string | undefined>(undefined)

  // Reutilizamos el endpoint/shape del manager hasta tener uno específico de admin
  const { data: partners = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => (await fetch('/api/tenants/')).json().catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading: _isLoading, refetch } = useQuery<DashboardManagerResponse>({
    queryKey: ['dashboard-interno', { fechaInicio: fechaInicio.format('YYYY-MM-DD'), fechaFin: fechaFin.format('YYYY-MM-DD'), tiendaId, usuarioId, partnerSchema }],
    queryFn: () => fetchDashboardAdmin({
      fecha_inicio: fechaInicio.format('YYYY-MM-DD'),
      fecha_fin: fechaFin.format('YYYY-MM-DD'),
      granularidad,
      tienda_id: tiendaId,
      usuario_id: usuarioId,
      tenant: partnerSchema,
      comparar: false,
    }),
    staleTime: 60_000,
  })

  const resumen = data?.resumen
  const pipeline = data?.pipeline
  const rankings = data?.rankings

  const tiendasOps = (rankings?.tiendas_por_operaciones || []).map((r) => ({ usuario: r.tienda ?? '—', ops: Number(r.ops || 0) }))
  const tiendasValor = (rankings?.tiendas_por_valor || []).map((r) => ({ usuario: r.tienda ?? '—', valor: Number(r.valor || 0) }))
  const rowsOps = (rankings?.usuarios_por_operaciones || []).map((r) => ({ usuario: r.usuario ?? '—', ops: Number(r.ops || 0) }))
  const rowsValor = (rankings?.usuarios_por_valor || []).map((r) => ({ usuario: r.usuario ?? '—', valor: Number(r.valor || 0) }))

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Filtros */}
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <DatePicker
          label="Desde"
          value={fechaInicio}
          onChange={(newValue) => setFechaInicio(newValue || dayjs().startOf('month'))}
          slotProps={{ textField: { size: 'small' } }}
        />
        <DatePicker
          label="Hasta"
          value={fechaFin}
          onChange={(newValue) => setFechaFin(newValue || dayjs().endOf('month'))}
          slotProps={{ textField: { size: 'small' } }}
        />
        <TextField label="Tienda" size="small" value={tiendaId ?? ''} onChange={(e) => setTiendaId(e.target.value || undefined)} placeholder="Todas" sx={{ minWidth: 170 }} />
        <TextField label="Usuario" size="small" value={usuarioId ?? ''} onChange={(e) => setUsuarioId(e.target.value || undefined)} placeholder="Todos" sx={{ minWidth: 120 }} />
        <TextField select label="Partner" size="small" value={partnerSchema ?? ''} onChange={(e) => setPartnerSchema((e.target.value as string) || undefined)} sx={{ minWidth: 150 }} placeholder="Todos">
          <MenuItem value="">Todos</MenuItem>
          {(Array.isArray(partners) ? partners : []).map((p: any) => (
            <MenuItem key={p.schema ?? p.id} value={p.schema}>{p.nombre ?? p.schema}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={() => refetch()}>Aplicar</Button>
      </Stack>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Valor total (€)" value={resumen?.valor_total} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Ticket medio (€)" value={resumen?.ticket_medio} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Margen medio (€)" value={resumen?.margen_medio ?? '—'} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard title="Comisión total (€)" value={resumen?.comision_total} /></Grid>
      </Grid>

      {/* Evolución + Top productos */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <EvolucionChart
            data={data?.evolucion || []}
            granularidad={granularidad}
            onGranularidadChange={setGranularidad}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <PieRanking title="Top productos por valor" rows={rankings?.productos || []} legendMode="floating" legendCompact />
        </Grid>
      </Grid>

      {/* Rankings por Usuarios/Tiendas */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieRankingComerciales title="Usuarios: operaciones y €" rowsOps={rowsOps} rowsValor={rowsValor} mode="toggle" />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieRankingComerciales title="Tiendas: operaciones y €" rowsOps={tiendasOps} rowsValor={tiendasValor} mode="toggle" />
        </Grid>
      </Grid>

      {/* Pipeline */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <PipelineChart data={pipeline?.por_estado || []} />
        </Grid>
      </Grid>
      </Box>
    </LocalizationProvider>
  )
}
