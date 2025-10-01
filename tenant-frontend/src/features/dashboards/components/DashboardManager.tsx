'use client'

import { useMemo, useState, useCallback,useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Grid, Stack, TextField, MenuItem, Autocomplete } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import {
  fetchDashboardManager,
  type DashboardManagerResponse,
  fetchObjetivosResumen,
  type ObjetivoResumenItem,
} from '@/services/api'

import KpiCard from '@/features/dashboards/components/manager/KpiCard'
import EvolucionChart from '@/features/dashboards/components/manager/EvolucionChart'
import PipelineChart from '@/features/dashboards/components/manager/PipelineChart'
import PieRanking from '@/features/dashboards/components/manager/PieRankinga'
import PieRankingComerciales from './manager/PieRankingComerciales'
import ObjetivosBarChart from '@/features/dashboards/components/manager/ObjetivosBarChartMuiX'

/* ==========================
 * Tipos y utilidades
 * ========================== */
type Granularidad = 'dia' | 'semana' | 'mes'
type PeriodPreset = 'custom' | 'ultimo_mes' | 'q1' | 'q2' | 'q3' | 'q4'
type Option = { label: string; value: number }
type Filters = {
  fechaInicio: string
  fechaFin: string
  granularidad: Granularidad
  tiendaId?: number
  usuarioId?: number
  periodPreset: PeriodPreset
}

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

function startOfMonthISO(d = dayjs()) {
  return d.startOf('month').format('YYYY-MM-DD')
}
function endOfMonthISO(d = dayjs()) {
  return d.endOf('month').format('YYYY-MM-DD')
}

function getCurrentQuarterPreset(): 'q1' | 'q2' | 'q3' | 'q4' {
  const month = dayjs().month();
  const q = Math.floor(month / 3) + 1;
  return (`q${q}`) as 'q1' | 'q2' | 'q3' | 'q4';
}

function deriveQuarterBounds(preset: Exclude<PeriodPreset, 'custom' | 'ultimo_mes'>) {
  const year = dayjs().year()
  const bounds: Record<'q1' | 'q2' | 'q3' | 'q4', { start: number; end: number }> = {
    q1: { start: 0, end: 2 },
    q2: { start: 3, end: 5 },
    q3: { start: 6, end: 8 },
    q4: { start: 9, end: 11 },
  }
  const { start, end } = bounds[preset]
  const startDate = dayjs().year(year).month(start).startOf('month')
  const endDate = dayjs().year(year).month(end).endOf('month')
  return { fechaInicio: startDate.format('YYYY-MM-DD'), fechaFin: endDate.format('YYYY-MM-DD') }
}

function deriveObjetivoParams(periodPreset: PeriodPreset, fechaInicio: string | undefined) {
  if (periodPreset === 'custom') return null
  const parsedInicio = fechaInicio ? dayjs(fechaInicio, 'YYYY-MM-DD', true) : null

  if (periodPreset === 'ultimo_mes') {
    const base = parsedInicio?.isValid() ? parsedInicio : dayjs().subtract(1, 'month').startOf('month')
    return { tipo: 'mes' as const, periodo: base.format('YYYY-MM') }
  }

  const q = Number(periodPreset.slice(1)) // 'q2' -> 2
  const base =
    parsedInicio?.isValid()
      ? parsedInicio
      : dayjs().year(dayjs().year()).month((q - 1) * 3).startOf('month')
  return { tipo: 'trimestre' as const, periodo: `${base.year()}-Q${q}` }
}

function uniqueOptionsFromRankings(
  rankings: DashboardManagerResponse['rankings'] | undefined,
  idKey: 'tienda_id' | 'usuario_id',
  nameKeyA: 'nombre' | 'usuario' | 'tienda',
  nameKeyB: 'usuario' | 'tienda'
): Option[] {
  const map = new Map<number, string>()
  const add = (id?: number, name?: string | null) => {
    if (typeof id !== 'number' || Number.isNaN(id)) return
    const label = (name ?? '').toString().trim() || 'Sin asignar'
    if (!map.has(id)) map.set(id, label)
  }

  for (const r of rankings?.tiendas_por_valor || []) {
    // @ts-expect-error – índices dinámicos
    add(r[idKey], r[nameKeyA] ?? r[nameKeyB])
  }
  for (const r of rankings?.tiendas_por_operaciones || []) {
    // @ts-expect-error – índices dinámicos
    add(r[idKey], r[nameKeyA] ?? r[nameKeyB])
  }
  for (const r of rankings?.usuarios_por_valor || []) {
    // @ts-expect-error – índices dinámicos
    add(r[idKey], r[nameKeyA] ?? r[nameKeyB])
  }
  for (const r of rankings?.usuarios_por_operaciones || []) {
    // @ts-expect-error – índices dinámicos
    add(r[idKey], r[nameKeyA] ?? r[nameKeyB])
  }

  return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
}

/* ==========================
 * Hook de filtros
 * ========================== */
function useDashboardFilters(): [Filters, {
  setFechaInicio: (v: string) => void
  setFechaFin: (v: string) => void
  setGranularidad: (g: Granularidad) => void
  setTiendaId: (id?: number) => void
  setUsuarioId: (id?: number) => void
  applyPreset: (preset: PeriodPreset) => void
}] {
  const initialPreset: PeriodPreset = 'ultimo_mes';
  const initialMonth = {
    fechaInicio: startOfMonthISO(),
    fechaFin: endOfMonthISO()
  };
  const [filters, setFilters] = useState<Filters>({
    fechaInicio: initialMonth.fechaInicio,
    fechaFin: initialMonth.fechaFin,
    granularidad: 'mes',
    tiendaId: undefined,
    usuarioId: undefined,
    periodPreset: initialPreset,
  })

  const setFechaInicio = useCallback((v: string) => {
    setFilters(f => ({ ...f, periodPreset: 'custom', fechaInicio: v }))
  }, [])
  const setFechaFin = useCallback((v: string) => {
    setFilters(f => ({ ...f, periodPreset: 'custom', fechaFin: v }))
  }, [])
  const setGranularidad = useCallback((g: Granularidad) => {
    setFilters(f => ({ ...f, granularidad: g }))
  }, [])
  const setTiendaId = useCallback((id?: number) => {
    setFilters(f => ({ ...f, tiendaId: id }))
  }, [])
  const setUsuarioId = useCallback((id?: number) => {
    setFilters(f => ({ ...f, usuarioId: id }))
  }, [])
  const applyPreset = useCallback((preset: PeriodPreset) => {
    if (preset === 'custom') {
      setFilters(f => ({ ...f, periodPreset: 'custom' }))
      return
    }
    if (preset === 'ultimo_mes') {
      const target = dayjs().subtract(1, 'month')
      setFilters(f => ({
        ...f,
        periodPreset: 'ultimo_mes',
        fechaInicio: startOfMonthISO(target),
        fechaFin: endOfMonthISO(target),
      }))
      return
    }
    const { fechaInicio, fechaFin } = deriveQuarterBounds(preset)
    setFilters(f => ({ ...f, periodPreset: preset, fechaInicio, fechaFin }))
  }, [])

  return [filters, { setFechaInicio, setFechaFin, setGranularidad, setTiendaId, setUsuarioId, applyPreset }]
}

/* ==========================
 * Queries
 * ========================== */
function useDashboardData(f: Filters) {
  return useQuery<DashboardManagerResponse>({
    queryKey: ['dashboard-manager', f],
    queryFn: () =>
      fetchDashboardManager({
        fecha_inicio: f.fechaInicio,
        fecha_fin: f.fechaFin,
        granularidad: f.granularidad,
        tienda_id: f.tiendaId,
        usuario_id: f.usuarioId,
        comparar: false,
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
}

function useObjetivosResumenQuery(objetivoParams: ReturnType<typeof deriveObjetivoParams>, tiendaId?: number, usuarioId?: number) {
  return useQuery<{ tiendas: ObjetivoDetalle[]; usuarios: ObjetivoDetalle[] } | null>({
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
}

/* ==========================
 * Página
 * ========================== */
export default function ManagerDashboardPage() {
  const [filters, actions] = useDashboardFilters()
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 250)
    return () => clearTimeout(t)
  }, [filters])
  const { data } = useDashboardData(debouncedFilters)

  const resumen = data?.resumen
  const pipeline = data?.pipeline
  const operativa = data?.operativa
  const rankings = data?.rankings

  const rowsOps = useMemo(
    () => (rankings?.usuarios_por_operaciones || []).map((r) => ({
      usuario: (r.nombre ?? r.usuario ?? '').toString().trim() || '—',
      ops: Number(r.ops || 0),
    })),
    [rankings]
  )
  const rowsValor = useMemo(
    () => (rankings?.usuarios_por_valor || []).map((r) => ({
      usuario: (r.nombre ?? r.usuario ?? '').toString().trim() || '—',
      valor: Number(r.valor || 0),
    })),
    [rankings]
  )
  const tiendasOps = useMemo(
    () => (rankings?.tiendas_por_operaciones || []).map((r) => ({
      usuario: (r.nombre ?? r.tienda ?? '').toString().trim() || '—',
      ops: Number(r.ops || 0),
    })),
    [rankings]
  )
  const tiendasValor = useMemo(
    () => (rankings?.tiendas_por_valor || []).map((r) => ({
      usuario: (r.nombre ?? r.tienda ?? '').toString().trim() || '—',
      valor: Number(r.valor || 0),
    })),
    [rankings]
  )

  const tiendaOptions = useMemo(
    () => uniqueOptionsFromRankings(rankings, 'tienda_id', 'nombre', 'tienda'),
    [rankings]
  )
  const usuarioOptions = useMemo(
    () => uniqueOptionsFromRankings(rankings, 'usuario_id', 'nombre', 'usuario'),
    [rankings]
  )

  const selectedTienda = useMemo(
    () => tiendaOptions.find((opt) => opt.value === filters.tiendaId) ?? null,
    [tiendaOptions, filters.tiendaId]
  )
  const selectedUsuario = useMemo(
    () => usuarioOptions.find((opt) => opt.value === filters.usuarioId) ?? null,
    [usuarioOptions, filters.usuarioId]
  )

  const objetivoParams = useMemo(
    () => deriveObjetivoParams(debouncedFilters.periodPreset, debouncedFilters.fechaInicio),
    [debouncedFilters.periodPreset, debouncedFilters.fechaInicio]
  )
  const { data: objetivosResumen, isFetching: objetivosLoading } = useObjetivosResumenQuery(
    objetivoParams,
    debouncedFilters.tiendaId,
    debouncedFilters.usuarioId
  )
  const objetivosDisponibles = objetivoParams !== null

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Filtros */}
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <DatePicker
          label="Desde"
          value={dayjs(filters.fechaInicio)}
          onChange={(newValue) => {
            if (newValue) {
              actions.setFechaInicio(newValue.format('YYYY-MM-DD'));
            }
          }}
          slotProps={{
            textField: {
              size: "small",
              sx: { minWidth: 140 }
            },
          }}
        />
        <DatePicker
          label="Hasta"
          value={dayjs(filters.fechaFin)}
          onChange={(newValue) => {
            if (newValue) {
              actions.setFechaFin(newValue.format('YYYY-MM-DD'));
            }
          }}
          slotProps={{
            textField: {
              size: "small",
              sx: { minWidth: 140 }
            },
          }}
        />
        <TextField
          select
          label="Periodo"
          size="small"
          value={filters.periodPreset}
          onChange={(e) => actions.applyPreset(e.target.value as PeriodPreset)}
          sx={{ minWidth: 170, '& .MuiInputBase-root': { height: '40px' } }}
        >
          <MenuItem value="custom">Personalizado</MenuItem>
          <MenuItem value="ultimo_mes">Último mes</MenuItem>
          <MenuItem value="q1">Q1</MenuItem>
          <MenuItem value="q2">Q2</MenuItem>
          <MenuItem value="q3">Q3</MenuItem>
          <MenuItem value="q4">Q4</MenuItem>
        </TextField>

        {/* Selects por nombre, almacenando id */}
        <Autocomplete<Option, false, false, false>
          size="small"
          options={tiendaOptions}
          value={selectedTienda}
          onChange={(_, option) => actions.setTiendaId(option?.value)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value?.value}
          noOptionsText="Sin tiendas"
          sx={{ minWidth: 220 }}
          renderInput={(params) => <TextField {...params} label="Tienda" placeholder="Todas" size="small" />}
          clearOnEscape
        />
        <Autocomplete<Option, false, false, false>
          size="small"
          options={usuarioOptions}
          value={selectedUsuario}
          onChange={(_, option) => actions.setUsuarioId(option?.value)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value?.value}
          noOptionsText="Sin comerciales"
          sx={{ minWidth: 220 }}
          renderInput={(params) => <TextField {...params} label="Comercial" placeholder="Todos" size="small" />}
          clearOnEscape
        />

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

      {/* Evolución + Ranking productos */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <EvolucionChart
            data={data?.evolucion || []}
            granularidad={filters.granularidad}
            onGranularidadChange={actions.setGranularidad}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieRanking
            title="Top productos por valor"
            rows={rankings?.productos || []}
            legendMode="floating"
            legendCompact
          />
        </Grid>
      </Grid>

      {/* Ranking comerciales / tiendas */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieRankingComerciales
            title="Comerciales operaciones y €"
            rowsOps={rowsOps}
            rowsValor={rowsValor}
            mode="toggle"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <PieRankingComerciales
            title="Tiendas operaciones y €"
            rowsOps={tiendasOps}
            rowsValor={tiendasValor}
            mode="toggle"
          />
        </Grid>
      </Grid>

      {/* Pipeline */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <PipelineChart data={pipeline?.por_estado || []} />
        </Grid>
      </Grid>

      {/* Operativa */}
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
