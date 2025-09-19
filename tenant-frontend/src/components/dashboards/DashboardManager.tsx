'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Grid, Stack, TextField, Button, Autocomplete } from '@mui/material'
import dayjs from 'dayjs'
import { fetchDashboardManager, DashboardManagerResponse } from '@/services/api'
import KpiCard from '@/components/dashboards/manager/KpiCard'
import EvolucionChart from '@/components/dashboards/manager/EvolucionChart'
import PipelineChart from '@/components/dashboards/manager/PipelineChart'
import PieRanking from '@/components/dashboards/manager/PieRankinga'
import PieRankingComerciales from './manager/PieRankingComerciales'
export default function ManagerDashboardPage() {
  // Filtros iniciales: mes actual
  const [fechaInicio, setFechaInicio] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [fechaFin, setFechaFin] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [granularidad, setGranularidad] = useState<'dia' | 'semana' | 'mes'>('mes')
  const [tiendaId, setTiendaId] = useState<number | undefined>(undefined)
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined)

  const { data, isLoading: _isLoading, refetch } = useQuery<DashboardManagerResponse>({
    queryKey: ['dashboard-manager', { fechaInicio, fechaFin, granularidad, tiendaId, usuarioId }],
    queryFn: () =>
      fetchDashboardManager({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        granularidad,
        tienda_id: tiendaId,
        usuario_id: usuarioId,
        comparar: false,
      }),
    staleTime: 60_000,
  })

  const resumen = data?.resumen
  const pipeline = data?.pipeline
  const operativa = data?.operativa
  const rankings = data?.rankings
  const rowsOps = (rankings?.usuarios_por_operaciones || []).map((r) => ({
    usuario: (r.nombre ?? r.usuario ?? '').toString().trim() || '—',
    ops: Number(r.ops || 0),
  }))
  const rowsValor = (rankings?.usuarios_por_valor || []).map((r) => ({
    usuario: (r.nombre ?? r.usuario ?? '').toString().trim() || '—',
    valor: Number(r.valor || 0),
  }))
  const tiendasOps = (rankings?.tiendas_por_operaciones || []).map((r) => ({
    usuario: (r.nombre ?? r.tienda ?? '').toString().trim() || '—',
    ops: Number(r.ops || 0),
  }))
  const tiendasValor = (rankings?.tiendas_por_valor || []).map((r) => ({
    usuario: (r.nombre ?? r.tienda ?? '').toString().trim() || '—',
    valor: Number(r.valor || 0),
  }))

  type Option = { label: string; value: number }

  const tiendaOptions: Option[] = useMemo(() => {
    const map = new Map<number, string>()
    const add = (id?: number, name?: string | null) => {
      if (typeof id !== 'number' || Number.isNaN(id)) return
      const label = (name ?? '').toString().trim() || 'Sin asignar'
      if (!map.has(id)) map.set(id, label)
    }
    for (const r of rankings?.tiendas_por_valor || []) add(r.tienda_id, r.nombre ?? r.tienda)
    for (const r of rankings?.tiendas_por_operaciones || []) add(r.tienda_id, r.nombre ?? r.tienda)
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rankings])

  const usuarioOptions: Option[] = useMemo(() => {
    const map = new Map<number, string>()
    const add = (id?: number, name?: string | null) => {
      if (typeof id !== 'number' || Number.isNaN(id)) return
      const label = (name ?? '').toString().trim() || 'Sin asignar'
      if (!map.has(id)) map.set(id, label)
    }
    for (const r of rankings?.usuarios_por_valor || []) add(r.usuario_id, r.nombre ?? r.usuario)
    for (const r of rankings?.usuarios_por_operaciones || []) add(r.usuario_id, r.nombre ?? r.usuario)
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rankings])

  const selectedTienda = useMemo(
    () => tiendaOptions.find((opt) => opt.value === tiendaId) ?? null,
    [tiendaOptions, tiendaId]
  )

  const selectedUsuario = useMemo(
    () => usuarioOptions.find((opt) => opt.value === usuarioId) ?? null,
    [usuarioOptions, usuarioId]
  )
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Filtros */}
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        {/* Selección por nombre, guardando internamente el id numérico */}
        <Autocomplete<Option, false, false, false>
          size="small"
          options={tiendaOptions}
          value={selectedTienda}
          onChange={(_, option) => setTiendaId(option?.value)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value?.value}
          noOptionsText="Sin tiendas"
          sx={{ minWidth: 220 }}
          renderInput={(params) => <TextField {...params} label="Tienda" placeholder="Todas" />}
          clearOnEscape
        />
        <Autocomplete<Option, false, false, false>
          size="small"
          options={usuarioOptions}
          value={selectedUsuario}
          onChange={(_, option) => setUsuarioId(option?.value)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value?.value}
          noOptionsText="Sin comerciales"
          sx={{ minWidth: 220 }}
          renderInput={(params) => <TextField {...params} label="Comercial" placeholder="Todos" />}
          clearOnEscape
        />

        <Button variant="contained" onClick={() => refetch()}>Aplicar</Button>
      </Stack>

      {/* KPIs – fila superior */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6,  md: 3 }}><KpiCard title="Valor total (€)" value={resumen?.valor_total} /></Grid>
        <Grid size={{ xs: 6,  md: 3 }}><KpiCard title="Ticket medio (€)" value={resumen?.ticket_medio} /></Grid>
        <Grid size={{ xs: 6,  md: 3 }}><KpiCard title="Comisión total (€)" value={resumen?.comision_total} /></Grid>
        <Grid size={{ xs: 6,  md: 3 }}><KpiCard title="Comisión media (€)" value={resumen?.comision_media} /></Grid>
        
      </Grid>

      {/* Evolución */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6 }}>
          <EvolucionChart
            data={data?.evolucion || []}
            granularidad={granularidad}
            onGranularidadChange={setGranularidad}
          />
        </Grid>
      

      {/* Ranking: productos */}
      
      
        <Grid size={{ xs: 6 }}>
          <PieRanking title="Top productos por valor" rows={rankings?.productos || []} legendMode="floating" legendCompact />
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6 }}>
        <PieRankingComerciales
          title="Comerciales operaciones y €"
          rowsOps={rowsOps} // [{ usuario, ops }]
          rowsValor={rowsValor}     // [{ usuario, valor }]
          mode="toggle"
        />
        </Grid>
      
    
        <Grid size={{ xs: 6 }}>
        <PieRankingComerciales
          title="Tiendas operaciones y €"
          rowsOps={tiendasOps}
          rowsValor={tiendasValor}
          mode="toggle"   // o "toggle"
        />
        </Grid>
      </Grid>

     
      {/* Pipeline */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <PipelineChart data={pipeline?.por_estado || []} />
        </Grid>
      </Grid>

      {/* Operativa – tarjetas simples */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="Solicitudes recibidas" value={operativa?.recibidas} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="Solicitudes completadas" value={operativa?.completadas} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="Conversión (%)" value={operativa?.conversion_pct} suffix=" %" /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="Rechazos" value={operativa?.rechazos?.total} /></Grid>

        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="Abandono (%)" value={operativa?.abandono_pct} suffix=" %" /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="T. respuesta (h)" value={operativa?.tmed_respuesta_h ?? '—'} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="T. recogida (h)" value={operativa?.tmed_recogida_h ?? '—'} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><KpiCard title="T. cierre (h)" value={operativa?.tmed_cierre_h ?? '—'} /></Grid>
      </Grid>
    </Box>
  )
}
