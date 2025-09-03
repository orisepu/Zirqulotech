'use client'

import { useState } from 'react'
import {
  Grid, Paper, Button, Typography, LinearProgress, Stack, Link as MuiLink,
  Alert, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, Chip
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/services/api'

type EstadoTarea = {
  id: string
  estado: 'PENDING'|'RUNNING'|'SUCCESS'|'ERROR'
  log_url?: string
  error_message?: string
}

type Cambio = {
  id: string
  kind: 'INSERT'|'UPDATE'|'DELETE'
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number
  antes: string | null
  despues: string | null
  delta: number | null
}
function LiveLog({ tareaId, enabled }: { tareaId: string; enabled: boolean }) {
  const log = useQuery({
    queryKey: ['likewize_log', tareaId],
    queryFn: async () => {
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/log/`, { params: { n: 120 } })
      return data as { lines: string[] }
    },
    enabled,
    refetchInterval: enabled ? 1000 : false,
  })

  if (!enabled) return null
  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default', maxHeight: 240, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
      {(log.data?.lines || []).map((ln, i) => (
        <div key={i}>{ln}</div>
      ))}
    </Paper>
  )
}
export default function LikewizeB2BPage() {
  const [tareaId, setTareaId] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const lanzar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/precios/likewize/actualizar/', {})
      return data as { tarea_id: string }
    },
    onSuccess: (data) => setTareaId(data.tarea_id),
  })

  const estado = useQuery({
    queryKey: ['likewize_tarea', tareaId],
    queryFn: async () => {
      if (!tareaId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/`)
      return data as EstadoTarea
    },
    enabled: !!tareaId,
    refetchInterval: (q) => {
      const s = (q.state.data as EstadoTarea | null)?.estado
      return s && (s === 'SUCCESS' || s === 'ERROR') ? false : 1500
    },
  })

  const diff = useQuery({
    queryKey: ['likewize_diff', tareaId],
    queryFn: async () => {
      if (!tareaId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/diff/`)
      return data as { summary: { inserts:number, updates:number, deletes:number, total:number }, changes: Cambio[] }
    },
    enabled: !!tareaId && estado.data?.estado === 'SUCCESS',
  })

  const aplicar = useMutation({
    mutationFn: async () => {
      if (!tareaId) throw new Error('No tarea')
      const ids = Array.from(seleccion)
      const { data } = await api.post(`/api/precios/likewize/tareas/${tareaId}/aplicar/`, { ids })
      return data
    },
    onSuccess: () => {
      setSeleccion(new Set())
      diff.refetch()
    }
  })

  const running = estado.data?.estado === 'RUNNING' || estado.data?.estado === 'PENDING'

  const toggle = (id: string) => {
    setSeleccion(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (!diff.data) return
    setSeleccion(new Set(diff.data.changes.map(c => c.id)))
  }

  const clearAll = () => setSeleccion(new Set())

  const badge = (k: Cambio['kind']) =>
    k === 'INSERT' ? <Chip size="small" color="success" label="ALTA" /> :
    k === 'UPDATE' ? <Chip size="small" color="warning" label="CAMBIO" /> :
                     <Chip size="small" color="default" label="BAJA" />

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <Grid size={{ xs: 12, md: 10 }}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h5">Actualizar precios B2B (Likewize)</Typography>
            <Typography variant="body2" color="text.secondary">
              Paso 1: descarga a staging. Paso 2: revisa los cambios y aplica solo los seleccionados.
            </Typography>

            {!running && estado.data?.estado !== 'SUCCESS' && (
              <Button variant="contained" onClick={() => lanzar.mutate()} disabled={lanzar.isPending}>
                {lanzar.isPending ? 'Lanzando…' : 'Actualizar ahora'}
              </Button>
            )}

            {running && (
            <>
                <LinearProgress
                variant={typeof (estado.data as any)?.progreso === 'number' ? 'determinate' : 'indeterminate'}
                value={(estado.data as any)?.progreso ?? 0}
                />
                <Typography>
                {(estado.data as any)?.subestado || 'Procesando…'}
                </Typography>

                {/* Log en vivo */}
                <LiveLog tareaId={tareaId!} enabled={running} />
            </>
            )}

            {estado.data?.estado === 'ERROR' && (
              <Alert severity="error">
                Falló la actualización: {estado.data.error_message || 'Error desconocido'}{' '}
                {estado.data.log_url && (
                  <MuiLink href={estado.data.log_url} target="_blank" rel="noopener">Ver log</MuiLink>
                )}
              </Alert>
            )}

            {estado.data?.estado === 'SUCCESS' && (
              <>
                <Alert severity="success">Staging listo. Revisa cambios antes de aplicar.</Alert>

                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={selectAll}>Seleccionar todo</Button>
                  <Button size="small" variant="outlined" onClick={clearAll}>Limpiar selección</Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={seleccion.size === 0 || aplicar.isPending}
                    onClick={() => aplicar.mutate()}
                  >
                    {aplicar.isPending ? 'Aplicando…' : `Aplicar seleccionados (${seleccion.size})`}
                  </Button>
                </Stack>

                {diff.isLoading && <LinearProgress />}

                {diff.data && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Cambios propuestos: {diff.data.summary.total}
                      {' · Altas: '}{diff.data.summary.inserts}
                      {' · Cambios: '}{diff.data.summary.updates}
                      {' · Bajas: '}{diff.data.summary.deletes}
                    </Typography>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell />
                          <TableCell>Tipo</TableCell>
                          <TableCell>Modelo</TableCell>
                          <TableCell align="right">Cap.</TableCell>
                          <TableCell>Tipo cambio</TableCell>
                          <TableCell align="right">Antes</TableCell>
                          <TableCell align="right">Después</TableCell>
                          <TableCell align="right">Δ</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {diff.data.changes.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell padding="checkbox">
                              <Checkbox checked={seleccion.has(c.id)} onChange={() => toggle(c.id)} />
                            </TableCell>
                            <TableCell>{c.tipo}</TableCell>
                            <TableCell>{c.modelo_norm}</TableCell>
                            <TableCell align="right">{c.almacenamiento_gb || '-'}</TableCell>
                            <TableCell>{badge(c.kind)}</TableCell>
                            <TableCell align="right">{c.antes ?? '-'}</TableCell>
                            <TableCell align="right">{c.despues ?? '-'}</TableCell>
                            <TableCell align="right">
                              {typeof c.delta === 'number' ? c.delta.toFixed(2) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {diff.data?.no_mapeados?.length ? (
                        <>
                            <Typography variant="h6" sx={{ mt: 2 }}>No mapeados a capacidad</Typography>
                            <Table size="small">
                            <TableHead>
                                <TableRow>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Modelo</TableCell>
                                <TableCell align="right">Cap.</TableCell>
                                <TableCell align="right">Precio B2B</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {diff.data.no_mapeados.map((r: any, i: number) => (
                                <TableRow key={i}>
                                    <TableCell>{r.tipo}</TableCell>
                                    <TableCell>{r.modelo_norm}</TableCell>
                                    <TableCell align="right">{r.almacenamiento_gb ?? '-'}</TableCell>
                                    <TableCell align="right">{r.precio_b2b}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </>
                        ) : null}

                  </>
                )}
              </>
            )}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  )
}
