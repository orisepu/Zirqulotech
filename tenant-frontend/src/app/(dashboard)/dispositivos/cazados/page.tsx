'use client'

import React, { useMemo, useState, useEffect } from 'react'
import {
  Grid, Paper, Stack, TextField, Button, Typography, Chip, Divider,
  Table, TableHead, TableRow, TableCell, TableBody, Alert, CircularProgress
} from '@mui/material'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

/** =========================
 * Tipos esperados (adaptables)
 * ========================= */
type MatchRow = {
  likewize_nombre: string
  bd_modelo: string
  bd_capacidad?: string | null
  capacidad_id?: number | null
}

type NoCazadoRow = {
  bd_modelo: string
  bd_capacidad?: string | null
  capacidad_id?: number | null
}

type TareaResultado = {
  tarea_uuid: string
  status: 'pending' | 'running' | 'done' | 'failed' | string
  stats: {
    total_likewize: number
    cazados: number
    no_cazados: number
    porcentaje_cazados: number
  }
  matches: MatchRow[]
  no_cazados_bd: NoCazadoRow[]
}

/** =========================
 * Normalizador flexible
 *  - Ajusta aquí si tu backend usa otras claves
 * ========================= */
function normalize(raw: any, uuid: string): TareaResultado {
  // Stats
  const total_likewize =
    Number(raw?.stats?.total_likewize ?? raw?.total_likewize ?? raw?.total ?? 0)
  const cazados =
    Number(raw?.stats?.cazados ?? raw?.matched ?? raw?.cazados ?? 0)
  const no_cazados =
    Number(raw?.stats?.no_cazados ?? raw?.unmatched ?? raw?.no_cazados ?? 0)

  const porcentaje_cazados =
    raw?.stats?.porcentaje_cazados ??
    (total_likewize > 0 ? (cazados / total_likewize) * 100 : 0)

  // Matches: admite distintas formas
  const matchesSrc: any[] =
    raw?.matches ??
    raw?.likewize_matched ??
    raw?.cazados ??
    []

  const matches: MatchRow[] = matchesSrc.map((r: any) => ({
    likewize_nombre:
      r?.likewize_nombre ?? r?.likewize_name ?? r?.nombre_likewize ?? '',
    bd_modelo:
      r?.bd_modelo ?? r?.modelo ?? r?.equipo_nombre ?? r?.nombre_equipo ?? '',
    bd_capacidad:
      r?.bd_capacidad ?? r?.capacidad ?? r?.equipo_capacidad ?? null,
    capacidad_id:
      r?.capacidad_id ?? r?.cap_id ?? null,
  }))

  // No cazados BD
  const noCazadosSrc: any[] =
    raw?.no_cazados_bd ?? raw?.db_unmatched ?? raw?.no_cazados ?? []

  const no_cazados_bd: NoCazadoRow[] = noCazadosSrc.map((r: any) => ({
    bd_modelo: r?.bd_modelo ?? r?.modelo ?? r?.equipo_nombre ?? '',
    bd_capacidad: r?.bd_capacidad ?? r?.capacidad ?? null,
    capacidad_id: r?.capacidad_id ?? r?.cap_id ?? null,
  }))

  return {
    tarea_uuid: raw?.tarea_uuid ?? uuid,
    status: raw?.status ?? raw?.estado ?? 'done',
    stats: {
      total_likewize,
      cazados,
      no_cazados,
      porcentaje_cazados: Number(porcentaje_cazados),
    },
    matches,
    no_cazados_bd,
  }
}

/** =========================
 * Fetcher
 * ========================= */
async function fetchTarea(uuid: string): Promise<TareaResultado> {
  // Ajusta esta ruta si tu backend expone otra URL
  const { data } = await api.get(`/api/likewize/tareas/${uuid}/resultado/`)
  return normalize(data, uuid)
}

/** =========================
 * Utils
 * ========================= */
const pct = (n: number) =>
  `${(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0).toFixed(1)}%`

/** =========================
 * Página
 * ========================= */
export default function CazadorLikewizePage() {
  const search = useSearchParams()
  const router = useRouter()
  const initialUuid = search.get('uuid') ?? ''
  const [uuid, setUuid] = useState(initialUuid)

  // Sincroniza input si cambian los search params externamente
  useEffect(() => {
    setUuid(initialUuid)
  }, [initialUuid])

  const { data, isFetching, isError, error, refetch, isSuccess } = useQuery({
    queryKey: ['likewize-cazador', uuid],
    queryFn: () => fetchTarea(uuid!),
    enabled: !!uuid, // solo cuando hay uuid
    refetchOnWindowFocus: false,
  })

  const stats = data?.stats

  const onBuscar = () => {
    const q = new URLSearchParams()
    if (uuid) q.set('uuid', uuid)
    router.push(`/likewize/cazador?${q.toString()}`)
    // Si ya está en la URL, fuerza refetch
    if (uuid) refetch()
  }

  const onLimpiar = () => {
    setUuid('')
    router.push('/likewize/cazador')
  }

  return (
    <Grid container spacing={2}>
      {/* Header */}
      <Grid item xs={12}>
        <Typography variant="h5" fontWeight={700}>
          Cazador Likewize — Resultados por tarea
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Escribe el <strong>UUID</strong> de la tarea para ver el nivel de cazados,
          los matches con tu BD y las capacidades no cazadas.
        </Typography>
      </Grid>

      {/* Buscador */}
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="UUID de la tarea"
              value={uuid}
              onChange={(e) => setUuid(e.target.value.trim())}
              fullWidth
              placeholder="e.g. 91c174cf-c7e3-49d0-9018-142fd5a0db25"
              size="small"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={onBuscar} disabled={!uuid || isFetching}>
                Ver resultados
              </Button>
              <Button variant="outlined" onClick={onLimpiar}>
                Limpiar
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Grid>

      {/* Estado de carga / error */}
      {isFetching && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Paper>
        </Grid>
      )}

      {isError && (
        <Grid item xs={12}>
          <Alert severity="error">
            No se pudo cargar la tarea {uuid}. {(error as any)?.message ?? 'Revisa el UUID o el endpoint.'}
          </Alert>
        </Grid>
      )}

      {/* KPIs */}
      {isSuccess && stats && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Stack>
                  <Typography variant="overline" color="text.secondary">Total Likewize</Typography>
                  <Typography variant="h6">{stats.total_likewize}</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Stack>
                  <Typography variant="overline" color="text.secondary">Cazados</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6">{stats.cazados}</Typography>
                    <Chip
                      size="small"
                      label={pct(stats.porcentaje_cazados)}
                      color={stats.porcentaje_cazados >= 95 ? 'success' : stats.porcentaje_cazados >= 85 ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </Stack>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Stack>
                  <Typography variant="overline" color="text.secondary">No cazados (Likewize)</Typography>
                  <Typography variant="h6">
                    {Math.max(0, stats.total_likewize - stats.cazados)}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Stack>
                  <Typography variant="overline" color="text.secondary">No cazados en BD</Typography>
                  <Typography variant="h6">
                    {data?.no_cazados_bd?.length ?? 0}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      )}

      {/* Tabla: Likewize cazados */}
      {isSuccess && (data?.matches?.length ?? 0) > 0 && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Likewize cazados</Typography>
            <Divider sx={{ mb: 2 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>#</TableCell>
                  <TableCell>Nombre Likewize</TableCell>
                  <TableCell>Equipo BD</TableCell>
                  <TableCell>Capacidad</TableCell>
                  <TableCell align="right">capacidad_id</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data!.matches.map((row, idx) => (
                  <TableRow key={`${row.likewize_nombre}-${idx}`}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{row.likewize_nombre}</TableCell>
                    <TableCell>{row.bd_modelo}</TableCell>
                    <TableCell>{row.bd_capacidad ?? '—'}</TableCell>
                    <TableCell align="right">{row.capacidad_id ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      )}

      {/* Tabla: BD no cazados */}
      {isSuccess && (
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>BD no cazados</Typography>
            <Divider sx={{ mb: 2 }} />
            {data!.no_cazados_bd.length === 0 ? (
              <Alert severity="success">¡Genial! No hay capacidades sin match en la BD.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>#</TableCell>
                    <TableCell>Equipo BD</TableCell>
                    <TableCell>Capacidad</TableCell>
                    <TableCell align="right">capacidad_id</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data!.no_cazados_bd.map((row, idx) => (
                    <TableRow key={`${row.capacidad_id}-${idx}`}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{row.bd_modelo}</TableCell>
                      <TableCell>{row.bd_capacidad ?? '—'}</TableCell>
                      <TableCell align="right">{row.capacidad_id ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      )}
    </Grid>
  )
}
