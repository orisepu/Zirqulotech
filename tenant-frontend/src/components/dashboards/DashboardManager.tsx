'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Grid, Stack, TextField, MenuItem, Button, Autocomplete } from '@mui/material'
import dayjs from 'dayjs'
import { fetchDashboardManager, DashboardManagerResponse, fetchObjetivosResumen, type ObjetivoResumenItem } from '@/services/api'
import KpiCard from '@/components/dashboards/manager/KpiCard'
import EvolucionChart from '@/components/dashboards/manager/EvolucionChart'
import PipelineChart from '@/components/dashboards/manager/PipelineChart'
import PieRanking from '@/components/dashboards/manager/PieRankinga'
import PieRankingComerciales from './manager/PieRankingComerciales'
import ObjetivosBarChart from '@/components/dashboards/manager/ObjetivosBarChartMuiX'
export default function ManagerDashboardPage() {
  // Filtros iniciales: mes actual
  const [fechaInicio, setFechaInicio] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [fechaFin, setFechaFin] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [granularidad, setGranularidad] = useState<'dia' | 'semana' | 'mes'>('mes')
  const [tiendaId, setTiendaId] = useState<number | undefined>(undefined)
  const [usuarioId, setUsuarioId] = useState<number | undefined>(undefined)
  const [periodPreset, setPeriodPreset] = useState<'custom' | 'ultimo_mes' | 'q1' | 'q2' | 'q3' | 'q4'>('custom')

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

  const objetivoParams = useMemo(() => {
    if (periodPreset === 'custom') return null
    const parsedInicio = fechaInicio ? dayjs(fechaInicio, 'YYYY-MM-DD', true) : null
    if (periodPreset === 'ultimo_mes') {
      const base = parsedInicio?.isValid() ? parsedInicio : dayjs().subtract(1, 'month').startOf('month')
      return { tipo: 'mes' as const, periodo: base.format('YYYY-MM') }
    }
    const match = periodPreset.match(/^q([1-4])$/)
    if (match) {
      const quarter = Number(match[1])
      const base = parsedInicio?.isValid() ? parsedInicio : dayjs().year(dayjs().year()).month((quarter - 1) * 3).startOf('month')
      return { tipo: 'trimestre' as const, periodo: `${base.year()}-Q${quarter}` }
    }
    return null
  }, [periodPreset, fechaInicio])

  type UsuarioDetalle = {
    id: number
    nombre: string
    objetivoValor: number
    progresoValor: number
    objetivoOperaciones: number
    progresoOperaciones: number
  }

  type ObjetivoDetalle = {
    id: number
    nombre: string
    objetivoValor: number
    progresoValor: number
    objetivoOperaciones: number
    progresoOperaciones: number
    porcentajeValor: number
    usuarios?: UsuarioDetalle[]
  }

  const { data: objetivosResumen, isFetching: objetivosLoading } = useQuery<
    { tiendas: ObjetivoDetalle[]; usuarios: ObjetivoDetalle[] } | null
  >({
    queryKey: ['dashboard-manager-objetivos', objetivoParams, tiendaId, usuarioId],
    enabled: Boolean(objetivoParams),
    staleTime: 60_000,
    queryFn: async () => {
      if (!objetivoParams) return null
      const { tipo, periodo } = objetivoParams
      const [tiendasResp, usuariosResp] = await Promise.all([
        fetchObjetivosResumen({ scope: 'tienda', periodo_tipo: tipo, periodo }),
        fetchObjetivosResumen({ scope: 'usuario', periodo_tipo: tipo, periodo }),
      ])

      const normalize = (items: ObjetivoResumenItem[], filterId?: number) => {
        const filtered = filterId != null ? items.filter((item) => item.target_id === filterId) : items

        return filtered
          .map<ObjetivoDetalle>((item) => {
            const objetivoValor = Number(item.objetivo_valor || 0)
            const progresoValor = Number(item.progreso_valor || 0)
            const objetivoOperaciones = Number(item.objetivo_operaciones || 0)
            const progresoOperaciones = Number(item.progreso_operaciones || 0)
            const porcentajeValor = objetivoValor > 0 ? (progresoValor / objetivoValor) * 100 : 0
            const usuarios: UsuarioDetalle[] | undefined = Array.isArray(item.usuarios)
              ? item.usuarios.map((usuario) => ({
                  id: usuario.usuario_id,
                  nombre: (usuario.nombre || '').toString().trim() || 'Sin asignar',
                  objetivoValor: Number(usuario.objetivo_valor || 0),
                  progresoValor: Number(usuario.progreso_valor || 0),
                  objetivoOperaciones: Number(usuario.objetivo_operaciones || 0),
                  progresoOperaciones: Number(usuario.progreso_operaciones || 0),
                }))
              : undefined
            return {
              id: item.target_id,
              nombre: (item.target_name || item.email || '').toString().trim() || 'Sin nombre',
              objetivoValor,
              progresoValor,
              objetivoOperaciones,
              progresoOperaciones,
              porcentajeValor,
              usuarios,
            }
          })
          .sort((a, b) => b.porcentajeValor - a.porcentajeValor)
      }

      return {
        tiendas: normalize(tiendasResp, tiendaId),
        usuarios: normalize(usuariosResp, usuarioId),
      }
    },
  })

  const objetivosDisponibles = objetivoParams !== null

  const handlePresetChange = (preset: typeof periodPreset) => {
    setPeriodPreset(preset)
    if (preset === 'custom') return
    const now = dayjs()
    if (preset === 'ultimo_mes') {
      const target = now.subtract(1, 'month')
      setFechaInicio(target.startOf('month').format('YYYY-MM-DD'))
      setFechaFin(target.endOf('month').format('YYYY-MM-DD'))
      return
    }

    const year = now.year()
    const quarterBounds: Record<'q1' | 'q2' | 'q3' | 'q4', { start: number; end: number }> = {
      q1: { start: 0, end: 2 },
      q2: { start: 3, end: 5 },
      q3: { start: 6, end: 8 },
      q4: { start: 9, end: 11 },
    }

    const bounds = quarterBounds[preset]
    if (!bounds) return

    const startDate = dayjs().year(year).month(bounds.start).startOf('month')
    const endDate = dayjs().year(year).month(bounds.end).endOf('month')
    setFechaInicio(startDate.format('YYYY-MM-DD'))
    setFechaFin(endDate.format('YYYY-MM-DD'))
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Filtros */}
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          label="Desde"
          type="date"
          size="small"
          value={fechaInicio}
          onChange={(e) => {
            setPeriodPreset('custom')
            setFechaInicio(e.target.value)
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={fechaFin}
          onChange={(e) => {
            setPeriodPreset('custom')
            setFechaFin(e.target.value)
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          label="Periodo"
          size="small"
          value={periodPreset}
          onChange={(e) => handlePresetChange(e.target.value as typeof periodPreset)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="custom">Personalizado</MenuItem>
          <MenuItem value="ultimo_mes">Último mes</MenuItem>
          <MenuItem value="q1">Q1</MenuItem>
          <MenuItem value="q2">Q2</MenuItem>
          <MenuItem value="q3">Q3</MenuItem>
          <MenuItem value="q4">Q4</MenuItem>
        </TextField>
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard title="Valor total (€)" value={resumen?.valor_total} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard title="Ticket medio (€)" value={resumen?.ticket_medio} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard title="Comisión total (€)" value={resumen?.comision_total} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><KpiCard title="Comisión media (€)" value={resumen?.comision_media} /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ObjetivosBarChart
            enabled={objetivosDisponibles}
            loading={objetivosLoading}
            rows={objetivosResumen?.tiendas ?? []}
            title="Objetivos por tienda"
            emptyMessage="Sin objetivos definidos para las tiendas en este periodo o filtro."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ObjetivosBarChart
            enabled={objetivosDisponibles}
            loading={objetivosLoading}
            rows={objetivosResumen?.usuarios ?? []}
            title="Objetivos por comercial"
            emptyMessage="Sin objetivos definidos para los usuarios en este periodo o filtro."
          />
        </Grid>
      </Grid>

      {/* Evolución */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }} >
          <EvolucionChart
            data={data?.evolucion || []}
            granularidad={granularidad}
            onGranularidadChange={setGranularidad}
          />
        </Grid>


      {/* Ranking: productos */}
      
      
        <Grid size={{ xs: 12, md: 6 }} >
          <PieRanking title="Top productos por valor" rows={rankings?.productos || []} legendMode="floating" legendCompact />
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }} >
        <PieRankingComerciales
          title="Comerciales operaciones y €"
          rowsOps={rowsOps} // [{ usuario, ops }]
          rowsValor={rowsValor}     // [{ usuario, valor }]
          mode="toggle"
        />
        </Grid>


        <Grid size={{ xs: 12, md: 6 }} >
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
