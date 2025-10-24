'use client';

/**
 * Dashboard para empleados (Comercial, Store Manager, etc.)
 *
 * FILTRADO POR ROL:
 * - Comercial: Solo ve sus propios datos (filtrado por usuario_id)
 * - Store Manager / Manager: Ven todos los datos de su tienda/ámbito
 *
 * IMPORTANTE: Todos los endpoints reciben el parámetro 'usuario' o 'usuario_id'
 * para filtrar los datos según el rol. El filtrado se aplica explícitamente
 * mediante la variable usuarioIdFiltro calculada en base a isComercial.
 */

import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  Grid,
  CardHeader,
  CardContent,
  Typography,
  CircularProgress,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
  Link as MUILink,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DevicesIcon from '@mui/icons-material/Devices';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import NextLink from 'next/link';
import { chipColorToCss } from '@/shared/utils/theme'
import api from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ESTADOS_META } from '@/context/estados';
import { useUsuario } from '@/context/UsuarioContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';

import { PipelinePie } from './pipelineQueso';
import { TopProductosChart } from './TopProductosChart';

/* ---------------- Utils ---------------- */
function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function eur(n: number) {
  if (n === 0) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function num(n: number) {
  if (n === 0) return '—';
  return n.toLocaleString('es-ES');
}
const safeNumber = (x: unknown) => (typeof x === 'number' ? x : Number(x ?? 0)) || 0;

/* ---------------- Sparkline ---------------- */
function Sparkline({ data, height = 40 }: { data: number[]; height?: number }) {
  const width = 160;
  if (!data?.length) return <Box sx={{ height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pad = 4;
  const step = (width - pad * 2) / Math.max(data.length - 1, 1);
  const scaleY = (v: number) => {
    if (max === min) return height / 2;
    const t = (v - min) / (max - min);
    return height - pad - t * (height - pad * 2);
  };
  const points = data.map((v, i) => `${pad + i * step},${scaleY(v)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" strokeWidth="2" stroke="currentColor" opacity={0.8} />
    </svg>
  );
}

/* ---------------- Helper para limpiar parámetros null/undefined ---------------- */
/**
 * Elimina valores null y undefined de un objeto de parámetros antes de enviarlo a la API.
 * Esto previene problemas de serialización inconsistente en axios donde null puede
 * convertirse en "null" (string) o "" (empty string).
 */
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/* ---------------- API fetchers + tipos ---------------- */
type TasaConversion = { total: number; finalizadas: number; tasa_conversion: number };
async function fetchTasaConversion(params: { fecha_inicio: string; fecha_fin: string; tienda?: string | null; usuario?: number | null }) {
  const { data } = await api.get('/api/dashboard/tasa-conversion/', { params: cleanParams(params) });
  return data as TasaConversion;
}

type PipelineRow = { estado: string; count?: number; valor?: number } & Record<string, unknown>;
async function fetchPipelineEstados(params: { fecha_inicio: string; fecha_fin: string; tienda?: string | null; usuario?: number | null }) {
  const { data } = await api.get('/api/dashboard/estado-pipeline/', { params: cleanParams(params) });
  return (Array.isArray(data) ? data : []) as PipelineRow[];
}

type RankingItem = {
  modelo__descripcion?: string;
  nombre?: string;
  modelo?: string;
  producto?: string;
  total_valor?: number;
  total?: number;
  valor?: number;
  cantidad?: number;
};
async function fetchRankingProductos(params: { fecha_inicio: string; fecha_fin: string; tienda?: string | null; usuario?: number | null }) {
  const { data } = await api.get('/api/dashboard/ranking-productos/', { params: cleanParams(params) });
  return (Array.isArray(data) ? data : []) as RankingItem[];
}

type TiempoEntreEstados = {
  estado_inicio: string;
  estado_fin: string;
  tiempo_medio_segundos: number;
  tiempo_medio_horas: number;
};
async function fetchTiempoEntreEstados(params: {
  fecha_inicio: string;
  fecha_fin: string;
  tienda?: string | null;
  estado_inicio?: string;
  estado_fin?: string;
  usuario?: number | null;
}) {
  const { data } = await api.get('/api/dashboard/tiempo-entre-estados/', { params: cleanParams(params) });
  return data as TiempoEntreEstados;
}

type TotalPagado = { total_pagado?: number; total?: number };
async function fetchTotalPagado(params: { fecha_inicio: string; fecha_fin: string; tienda_id?: string | null; usuario_id?: number | null }) {
  const { data } = await api.get('/api/dashboard/total-pagado/', { params: cleanParams(params) });
  return data as TotalPagado;
}

type KPISeriePoint = { label: string; valor: number };
type KPIs = {
  total_valor: number;
  total_dispositivos: number;
  total_oportunidades: number;
  serie: KPISeriePoint[];
};
async function fetchValorPorTiendaTransform({
  fecha_inicio,
  fecha_fin,
  tiendaId,
  tiendaNombre,
  granularidad = 'mes',
  estado_minimo = 'Oferta confirmada',
  usuario,
}: {
  fecha_inicio: string;
  fecha_fin: string;
  tiendaId?: string | null;
  tiendaNombre?: string | null;
  granularidad?: 'dia' | 'semana' | 'mes';
  estado_minimo?: string;
  usuario?: number | null;
}): Promise<KPIs> {
  const params: Record<string, string | number | null | undefined> = { fecha_inicio, fecha_fin, granularidad, estado_minimo };
  if (tiendaId) params.tienda = tiendaId;
  if (usuario) params.usuario = usuario;

  const { data } = await api.get('/api/dashboard/valor-por-tienda/', { params: cleanParams(params) });
  if (!Array.isArray(data)) {
    return { total_valor: 0, total_oportunidades: 0, total_dispositivos: 0, serie: [] };
  }

  if (tiendaNombre) {
    const colValor = tiendaNombre;
    const colDisp = `${tiendaNombre}__n_dispositivos`;
    const colOpps = `${tiendaNombre}__n_oportunidades`;

    const serie: KPISeriePoint[] = data.map((row: Record<string, unknown>) => ({
      label: String((row as Record<string, unknown>).mes ?? (row as Record<string, unknown>).fecha ?? ''),
      valor: safeNumber((row as Record<string, unknown>)[colValor]),
    }));

    const total_valor = serie.reduce((a: number, p: KPISeriePoint) => a + safeNumber(p.valor), 0);
    const total_dispositivos = data.reduce((a: number, r: Record<string, unknown>) => a + safeNumber(r[colDisp as string]), 0);
    const total_oportunidades = data.reduce((a: number, r: Record<string, unknown>) => a + safeNumber(r[colOpps as string]), 0);

    return { total_valor, total_dispositivos, total_oportunidades, serie };
  }

  const getValorCols = (row: Record<string, unknown>) =>
    Object.keys(row).filter((k) => k !== 'mes' && k !== 'fecha' && !k.includes('__'));

  const serie: KPISeriePoint[] = data.map((row: Record<string, unknown>) => {
    const sumaFila = getValorCols(row).reduce((acc, k) => acc + safeNumber((row as Record<string, unknown>)[k]), 0);
    const label = String((row as Record<string, unknown>).mes ?? (row as Record<string, unknown>).fecha ?? '');
    return { label, valor: sumaFila };
  });

  const total_valor = serie.reduce((a, p) => a + safeNumber(p.valor), 0);
  const total_dispositivos = data.reduce((acc: number, row: Record<string, unknown>) => {
    const sum = Object.keys(row)
      .filter((k) => k.endsWith('__n_dispositivos'))
      .reduce((s, k) => s + safeNumber((row as Record<string, unknown>)[k]), 0);
    return acc + sum;
  }, 0);
  const total_oportunidades = data.reduce((acc: number, row: Record<string, unknown>) => {
    const sum = Object.keys(row)
      .filter((k) => k.endsWith('__n_oportunidades'))
      .reduce((s, k) => s + safeNumber((row as Record<string, unknown>)[k]), 0);
    return acc + sum;
  }, 0);

  return { total_valor, total_dispositivos, total_oportunidades, serie };
}

type OportunidadRow = {
  uuid?: string;
  id?: string | number;
  nombre?: string;
  estado?: string;
  cliente?: { razon_social?: string } | null;
  cliente_nombre?: string | null;
  valor_total_final?: number | string | null;
  fecha_creacion?: string;
  tienda_nombre?: string | null;
};

async function fetchOportunidadesRecientes(params: {
  fecha_inicio: string;
  fecha_fin: string;
  tienda?: string | null;
  limit?: number;
  usuario?: number | null;
}) {
  const size = Math.max(1, params.limit ?? 5);
  const q: Record<string, unknown> = {
    ...cleanParams(params),
    ordering: '-fecha_creacion',
    pageIndex: 0,
    pageSize: size,
    page_size: size,
  };
  const { data } = await api.get('/api/oportunidades/', { params: q });
  const rows = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
      ? data
      : [];
  return (rows as OportunidadRow[]).slice(0, size);
}


/* ---------------- Página ---------------- */
export default function TenantDashboardPage() {
  // Filtros por defecto: mes en curso
  const [fechaInicio, setFechaInicio] = useState(fechaISO(startOfMonth()));
  const [fechaFin, setFechaFin] = useState(fechaISO(endOfToday()));
  const [granularidad, setGranularidad] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [estadoMinimo, setEstadoMinimo] = useState<string>('Oferta confirmada');

  const _queryClient = useQueryClient();
  const usuario = useUsuario() as { tienda_id?: number | string; tienda_nombre?: string; id?: number } | null; // acceso laxo con tipo mínimo
  const { isComercial } = useUserPermissions();
  const tiendaIdEfectiva = usuario?.tienda_id ? String(usuario.tienda_id) : '';
  const tiendaNombre = usuario?.tienda_nombre ?? null;

  // FILTRADO POR USUARIO: Comerciales solo ven sus datos, otros roles ven todo de su tienda
  // Solo aplicar filtro si isComercial Y hay un ID válido
  const usuarioIdFiltro = (isComercial && usuario?.id) ? usuario.id : null;

  // KPIs base
  const {
    data: kpis = { total_valor: 0, total_dispositivos: 0, total_oportunidades: 0, serie: [] },
    isLoading: cargandoKpis,
    isFetching: refrescandoKpis,
    refetch: refetchKpis,
  } = useQuery<KPIs>({
    queryKey: ['kpis-tenant', fechaInicio, fechaFin, tiendaIdEfectiva || null, tiendaNombre || null, granularidad, estadoMinimo, usuarioIdFiltro],
    queryFn: () =>
      fetchValorPorTiendaTransform({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tiendaId: tiendaIdEfectiva || null,
        tiendaNombre,
        granularidad,
        estado_minimo: estadoMinimo,
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  // Oportunidades recientes
  const {
    data: recientes = [],
    isLoading: cargandoRecientes,
    isFetching: refrescandoRecientes,
    refetch: refetchRecientes,
  } = useQuery<OportunidadRow[]>({
    queryKey: ['oportunidades-recientes', fechaInicio, fechaFin, tiendaIdEfectiva || null, usuarioIdFiltro],
    queryFn: () =>
      fetchOportunidadesRecientes({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda: tiendaIdEfectiva || null,
        limit: 5,
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  // Otras queries
  const {
    data: tasa = { total: 0, finalizadas: 0, tasa_conversion: 0 },
    isLoading: cargandoTasa,
  } = useQuery<TasaConversion>({
    queryKey: ['tasa-conversion', fechaInicio, fechaFin, tiendaIdEfectiva || null, usuarioIdFiltro],
    queryFn: () =>
      fetchTasaConversion({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda: tiendaIdEfectiva || null,
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  const { data: pipeline = [], isLoading: cargandoPipeline } = useQuery<PipelineRow[]>({
    queryKey: ['pipeline-estados', fechaInicio, fechaFin, tiendaIdEfectiva || null, usuarioIdFiltro],
    queryFn: () =>
      fetchPipelineEstados({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda: tiendaIdEfectiva || null,
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  const { data: rankingProductos = [], isLoading: cargandoRanking } = useQuery<RankingItem[]>({
    queryKey: ['ranking-productos', fechaInicio, fechaFin, tiendaIdEfectiva || null, usuarioIdFiltro],
    queryFn: () =>
      fetchRankingProductos({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda: tiendaIdEfectiva || null,
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  const {
    data: tiempo = {
      tiempo_medio_horas: 0,
      tiempo_medio_segundos: 0,
      estado_inicio: 'Recibido',
      estado_fin: 'Pagado',
    },
    isLoading: cargandoTiempo,
  } = useQuery<TiempoEntreEstados>({
    queryKey: ['tiempo-entre-estados', fechaInicio, fechaFin, tiendaIdEfectiva || null, 'Recibido', 'Pagado', usuarioIdFiltro],
    queryFn: () =>
      fetchTiempoEntreEstados({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda: tiendaIdEfectiva || null,
        estado_inicio: 'Recibido',
        estado_fin: 'Pagado',
        usuario: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente
      }),
  });

  const { data: totalPagado = { total_pagado: 0 }, isLoading: cargandoTotalPagado } = useQuery<TotalPagado>({
    queryKey: ['total-pagado', fechaInicio, fechaFin, tiendaIdEfectiva || null, usuarioIdFiltro],
    queryFn: () =>
      fetchTotalPagado({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tienda_id: tiendaIdEfectiva || null,
        usuario_id: usuarioIdFiltro, // Aplicar filtro de usuario explícitamente (nota: este endpoint usa usuario_id)
      }),
  });

  /* -------- Derivados -------- */
  const serie = useMemo<number[]>(
    () => (kpis?.serie || []).map((p: KPISeriePoint) => Number(p?.valor || 0)),
    [kpis],
  );

  const productos = useMemo(() => {
    const data = Array.isArray(rankingProductos) ? rankingProductos : [];
    return data
      .map((item) => ({
        nombre:
          item.modelo__descripcion ||
          item.nombre ||
          item.modelo ||
          item.producto ||
          '—',
        valor: Number(item.total_valor ?? item.total ?? item.valor ?? 0),
        cantidad: Number(item.total ?? item.cantidad ?? 0),
      }))
      .filter((p) => (p.valor ?? 0) > 0 || (p.cantidad ?? 0) > 0);
  }, [rankingProductos]);

  const totalPagadoNumber = Number(totalPagado?.total_pagado ?? totalPagado?.total ?? 0);

  const handleRefreshAll = () => {
    refetchKpis();
    refetchRecientes();
    // queryClient.invalidateQueries({ queryKey: ['ranking-productos'] });
    // queryClient.invalidateQueries({ queryKey: ['pipeline-estados'] });
  };

  const _tiendaNombreDe = (o: OportunidadRow) => o?.tienda_nombre || tiendaNombre || '—';

  /* -------- Render -------- */
  return (
    <Box sx={{ px: { xs: 2, md: 3 },  }}>
      {/* Filtros */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          pb: 0,
          mb: 2,
          background: (t) =>
            `linear-gradient(180deg, ${t.palette.background.default} 60%, transparent)`,
        }}
      >
        <Card variant="outlined" sx={{ backdropFilter: 'saturate(120%) blur(4px)' }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid>
                <TextField
                  fullWidth
                  label="Desde"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              <Grid>
                <TextField
                  fullWidth
                  label="Hasta"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              <Grid>
                <TextField
                  select
                  fullWidth
                  label="Granularidad"
                  value={granularidad}
                  onChange={(e) => setGranularidad(e.target.value as 'dia' | 'semana' | 'mes')}
                  size="small"
                >
                  <MenuItem value="dia">Día</MenuItem>
                  <MenuItem value="semana">Semana</MenuItem>
                  <MenuItem value="mes">Mes</MenuItem>
                </TextField>
              </Grid>
              <Grid>
                <TextField
                  select
                  fullWidth
                  label="Estado mínimo"
                  value={estadoMinimo}
                  onChange={(e) => setEstadoMinimo(e.target.value)}
                  size="small"
                >
                  {[
                    'Pendiente', 'Aceptado', 'Cancelado', 'Recogida generada', 'En tránsito', 'Recibido',
                    'En revisión', 'Oferta confirmada', 'Pendiente factura', 'Factura recibida',
                    'Pendiente de pago', 'Pagado', 'Nueva oferta enviada', 'Rechazada',
                    'Devolución iniciada', 'Equipo enviado', 'Recibido por el cliente',
                    'Nueva oferta confirmada', 'Nuevo contrato', 'Contrato',
                  ].map((est, idx) => (
                    <MenuItem key={`${est}-${idx}`} value={est}>{est}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid>
                <Tooltip title="Refrescar">
                  <IconButton
                    onClick={handleRefreshAll}
                    disabled={refrescandoKpis || refrescandoRecientes}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* ===== GRID PRINCIPAL ===== */}
      <Grid container spacing={2} alignItems="stretch">
        {/* Tendencia de valor — size=6 */}
        <Grid size={6}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title="Tendencia de valor"
              subheader={granularidad.charAt(0).toUpperCase() + granularidad.slice(1)}
              sx={{
                py: 0.5,
                '& .MuiCardHeader-title': { fontSize: 14 },
                '& .MuiCardHeader-subheader': { fontSize: 12 },
              }}
            />
            <CardContent sx={{ py: 0.5, pt: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              {cargandoKpis ? (
                <CircularProgress size={20} />
              ) : serie?.length ? (
                <>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Sparkline data={serie} height={36} />
                  </Box>
                  <Box sx={{ display: 'grid', gap: 0.25, color: 'text.secondary' }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <TrendingUpIcon fontSize="small" color="primary" />
                      <Typography variant="caption">Pico: {eur(Math.max(...serie))}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ShowChartIcon fontSize="small" color="success" />
                      <Typography variant="caption">
                        Media: {eur(serie.reduce((a, b) => a + b, 0) / Math.max(serie.length, 1))}
                      </Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No hay datos en el rango.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Valor generado — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Valor generado</Typography>
                <Typography variant="h6">{eur(Number(kpis?.total_valor || 0))}</Typography>
              </Box>
              <TrendingUpIcon />
            </CardContent>
          </Card>
        </Grid>

        {/* Oportunidades — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Oportunidades</Typography>
                <Typography variant="h6">{num(Number(kpis?.total_oportunidades || 0))}</Typography>
                <Typography variant="caption" color="text.secondary">En el rango seleccionado</Typography>
              </Box>
              <Inventory2Icon />
            </CardContent>
          </Card>
        </Grid>

        {/* Dispositivos — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Dispositivos</Typography>
                <Typography variant="h6">{num(Number(kpis?.total_dispositivos || 0))}</Typography>
                <Typography variant="caption" color="text.secondary">Acumulado del periodo</Typography>
              </Box>
              <DevicesIcon />
            </CardContent>
          </Card>
        </Grid>

        {/* Total pagado — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Total pagado</Typography>
              {cargandoTotalPagado ? (
                <CircularProgress size={20} />
              ) : (
                <Typography variant="h6">{eur(totalPagadoNumber)}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tasa de conversión — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Tasa de conversión</Typography>
              {cargandoTasa ? (
                <CircularProgress size={20} />
              ) : (
                <>
                  <Typography variant="h6">{Number(tasa?.tasa_conversion ?? 0).toFixed(2)}%</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(tasa?.finalizadas ?? 0)} de {(tasa?.total ?? 0)}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tiempo medio — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">Tiempo medio (Recibido → Pagado)</Typography>
              {cargandoTiempo ? (
                <CircularProgress size={20} />
              ) : (
                <>
                  <Typography variant="h6">{Number(tiempo?.tiempo_medio_horas ?? 0).toFixed(2)} h</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Number(tiempo?.tiempo_medio_segundos ?? 0).toLocaleString()} s
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pipeline por estado — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Pipeline por estado" subheader={tiendaNombre || undefined} />
            <CardContent sx={{ flex: 1 }}>
              {cargandoPipeline ? (
                <CircularProgress size={24} />
              ) : pipeline.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Sin datos.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <PipelinePie pipeline={pipeline} num={num} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top productos — size=3 */}
        <Grid size={3}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title="Top productos" />
            <CardContent>
              {cargandoRanking ? (
                <CircularProgress size={20} />
              ) : productos.length ? (
                <TopProductosChart productos={productos} eur={eur} num={num} />
              ) : (
                <Typography variant="body2" color="text.secondary">Sin datos.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Oportunidades recientes — size=6 */}
        <Grid size={6}>
          <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title="Oportunidades recientes"
              action={refrescandoRecientes || cargandoRecientes ? <CircularProgress size={20} /> : null}
            />
            <CardContent sx={{ flex: 1 }}>
              {cargandoRecientes ? (
                <CircularProgress size={24} />
              ) : !recientes.length ? (
                <Typography variant="body2" color="text.secondary">No hay oportunidades en el rango.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {recientes.map((o: OportunidadRow) => {
                    const meta = o?.estado ? ESTADOS_META[o.estado] : null;
                    const Icono = meta?.icon;
                    return (
                      <MUILink
                        component={NextLink}
                        key={o.uuid || o.id}
                        href={`/clientes/oportunidades/${o.uuid}`}
                        underline="none"
                        color="inherit"
                      >
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto auto',
                            gap: 1,
                            alignItems: 'center',
                            p: 1,
                            borderRadius: 1,
                            border: (t) => `1px solid ${t.palette.divider}`,
                            '&:hover': { bgcolor: 'action.hover' },
                            borderLeft: (t) =>
                              `4px solid ${chipColorToCss(t, meta?.color)}`,
                          }}
                        >
                          <Box minWidth={0}>
                            <Typography
                              variant="subtitle2"
                              noWrap
                              title={o?.cliente?.razon_social || o?.cliente_nombre || '—'}
                            >
                              {o?.cliente?.razon_social || o?.cliente_nombre || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap title={o.nombre}>
                              {o.nombre}
                            </Typography>
                          </Box>
                          <Box textAlign="right">
                            <Chip
                              size="small"
                              label={o?.estado || '—'}
                              color={meta?.color || 'default'}
                              icon={Icono ? <Icono /> : undefined}
                              variant="outlined"
                            />
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="body2">{eur(Number(o?.valor_total_final || 0))}</Typography>
                          </Box>
                          <Box textAlign="right">
                            <Typography variant="caption" color="text.secondary">
                              {o?.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-ES') : '—'}
                            </Typography>
                          </Box>
                        </Box>
                      </MUILink>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
