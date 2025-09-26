'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Grid, Paper, Button, Typography, LinearProgress, Stack, Link as MuiLink,
  Alert, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete
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
  capacidad_id?: number | null
  marca?: string
  antes: string | null
  despues: string | null
  delta: number | null
}
type NoMap = {
  id: number
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number | null
  precio_b2b: number
  marca?: string
  likewize_model_code?: string | null
}
type EstadoTareaExt = EstadoTarea & { progreso?: number; subestado?: string }

const formatStorage = (gb?: number | null): string => {
  if (gb == null || Number.isNaN(gb)) return ''
  if (gb >= 1024 && gb % 1024 === 0) {
    const tb = gb / 1024
    const label = Number.isInteger(tb) ? String(tb) : tb.toString().replace(/\.0$/, '')
    return `${label}TB`
  }
  return `${gb} GB`
}

const parseStorageToGb = (input: string): number | undefined => {
  if (!input) return undefined
  const match = input.trim().match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|T|GB|G)?/i)
  if (!match) return undefined
  const amount = Number.parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const unit = (match[2] || 'GB').toUpperCase()
  const gb = unit.startsWith('T') ? amount * 1024 : amount
  return Math.round(gb)
}

const fetchMarcasModelo = async () => {
  const { data } = await api.get<string[]>('/api/marcas-modelo/')
  return data
}

const fetchLikewizePresets = async () => {
  const { data } = await api.get<{ apple: string[]; others: string[] }>('/api/precios/likewize/presets/')
  return data
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
  const [openCrearDialog, setOpenCrearDialog] = useState(false)
  const [noMapTarget, setNoMapTarget] = useState<NoMap | null>(null)
  const [formTipo, setFormTipo] = useState('')
  const [formModelo, setFormModelo] = useState('')
  const [formCapacidad, setFormCapacidad] = useState('')
  const [formMarca, setFormMarca] = useState('Apple')
  const [formLikewizeCode, setFormLikewizeCode] = useState('')
  const [toggleMessage, setToggleMessage] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [capStatus, setCapStatus] = useState<Record<number, boolean>>({})
  const [capMarcaLookup, setCapMarcaLookup] = useState<Record<number, string>>({})
  const [selectedOtherBrands, setSelectedOtherBrands] = useState<string[]>([])
  const [pendingMode, setPendingMode] = useState<'apple' | 'others' | null>(null)

  useEffect(() => {
    setCapStatus({})
    setCapMarcaLookup({})
  }, [tareaId])

  const {
    mutate: lanzarActualizacionMutate,
    isPending: lanzarActualizacionPending,
  } = useMutation({
    mutationFn: async ({ mode, brands }: { mode: 'apple' | 'others'; brands?: string[] }) => {
      const payload: Record<string, unknown> = { mode }
      if (brands && brands.length) {
        payload.brands = brands
      }
      const { data } = await api.post('/api/precios/likewize/actualizar/', payload)
      return data as { tarea_id: string }
    },
    onSuccess: (data) => setTareaId(data.tarea_id),
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error && 'response' in error && (error as any).response?.data?.detail)
          ? (error as any).response.data.detail
          : 'No se pudo lanzar la actualización.'
      setToggleMessage({ msg: String(message || 'No se pudo lanzar la actualización.'), sev: 'error' })
    },
  })

  const lanzarTarea = useCallback((mode: 'apple' | 'others', brands: string[]) => {
    const cleaned = Array.from(new Set(brands.map((b) => (b || '').trim()).filter(Boolean)))
    setPendingMode(mode)
    lanzarActualizacionMutate(
      { mode, brands: cleaned },
      {
        onSettled: () => setPendingMode(null),
      }
    )
  }, [lanzarActualizacionMutate])

  const cargarUltima = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/api/precios/likewize/ultima/')
      return data as { tarea_id: string }
    },
    onSuccess: (data) => setTareaId(data.tarea_id),
  })

  // B2C se gestiona en otra vista; eliminado para evitar variable no usada

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
      return data as { summary: { inserts:number, updates:number, deletes:number, total:number }, changes: Cambio[], no_mapeados?: NoMap[] }
    },
    enabled: !!tareaId && estado.data?.estado === 'SUCCESS',
  })

  const { data: likewizePresets } = useQuery({
    queryKey: ['likewize-presets'],
    queryFn: fetchLikewizePresets,
    staleTime: 300_000,
  })

  const otherBrandOptions = useMemo(() => likewizePresets?.others ?? [], [likewizePresets])
  const appleBrandDefaults = useMemo(() => (
    (likewizePresets?.apple?.length ? likewizePresets.apple : ['Apple'])
  ), [likewizePresets])

  useEffect(() => {
    if (!otherBrandOptions.length) {
      return
    }
    setSelectedOtherBrands((prev) => {
      const filtered = prev.filter((brand) => otherBrandOptions.includes(brand))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [otherBrandOptions])

  const { data: marcasModelo } = useQuery({
    queryKey: ['marcas-modelo'],
    queryFn: fetchMarcasModelo,
    staleTime: 60_000,
  })

  useEffect(() => {
    const data = diff.data
    if (!data || !data.changes) return
    setCapMarcaLookup((prev) => {
      const next = { ...prev }
      data.changes.forEach((c) => {
        if (c.capacidad_id && c.marca) {
          next[c.capacidad_id] = c.marca
        }
      })
      return next
    })
  }, [diff.data])

  useEffect(() => {
    if (!diff.data) return
    const ids = Array.from(new Set(
      diff.data.changes
        .map((c) => c.capacidad_id)
        .filter((id): id is number => typeof id === 'number')
    ))
    if (!ids.length) return
    let cancelled = false
    ;(async () => {
      try {
        const responses = await Promise.all(ids.map(async (id) => {
          try {
            const { data } = await api.get(`/api/admin/capacidades/${id}/`)
            return {
              id,
              activo: Boolean(data?.activo),
              marca: data?.modelo?.marca ?? 'Apple',
            }
          } catch {
            return null
          }
        }))
        if (!cancelled) {
          setCapStatus((prev) => {
            const next = { ...prev }
            for (const entry of responses) {
              if (entry) {
                next[entry.id] = entry.activo
              }
            }
            return next
          })
          setCapMarcaLookup((prev) => {
            const next = { ...prev }
            for (const entry of responses) {
              if (entry) {
                next[entry.id] = entry.marca
              }
            }
            return next
          })
        }
      } catch {
        /* noop */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [diff.data])

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

  const crearCapacidad = useMutation({
    mutationFn: async (payload: { staging_id: number; tipo: string; marca: string; modelo: string; capacidad: string; almacenamiento_gb?: number; likewize_model_code?: string }) => {
      if (!tareaId) throw new Error('No tarea')
      const { data } = await api.post(`/api/precios/likewize/tareas/${tareaId}/crear-capacidad/`, payload)
      return data as { capacidad_id: number; marca?: string }
    },
    onSuccess: (data) => {
      if (data?.capacidad_id && data?.marca) {
        setCapMarcaLookup(prev => ({ ...prev, [data.capacidad_id]: data.marca! }))
      }
      diff.refetch()
      closeCrearDialog()
    }
  })

  const submitCrearCapacidad = () => {
    if (!noMapTarget) return
    const tipo = formTipo.trim()
    const modelo = formModelo.trim()
    const capacidad = formCapacidad.trim()
    const marca = formMarca.trim() || 'Apple'
    const likewizeModelCode = formLikewizeCode.trim().toUpperCase()
    if (!tipo || !modelo || !capacidad || !marca.trim()) return
    const almacenamiento_gb = parseStorageToGb(capacidad)
    crearCapacidad.mutate({
      staging_id: noMapTarget.id,
      tipo,
      marca,
      modelo,
      capacidad,
      ...(almacenamiento_gb ? { almacenamiento_gb } : {}),
      ...(likewizeModelCode ? { likewize_model_code: likewizeModelCode } : {}),
    })
  }

  const toggleCapacidad = useMutation({
    mutationFn: async ({ capacidadId, activo }: { capacidadId: number; activo: boolean }) => {
      setTogglingId(capacidadId)
      const { data } = await api.patch(`/api/admin/capacidades/${capacidadId}/`, { activo })
      return data as { id: number; activo: boolean; modelo?: { marca?: string } }
    },
    onSuccess: (data) => {
      setCapStatus(prev => ({ ...prev, [data.id]: data.activo }))
      setCapMarcaLookup(prev => ({ ...prev, [data.id]: data?.modelo?.marca ?? prev[data.id] ?? 'Apple' }))
      setToggleMessage({ msg: data.activo ? 'Capacidad activada' : 'Capacidad marcada como baja', sev: 'success' })
      diff.refetch()
    },
    onError: (error: unknown) => {
      setToggleMessage({
        msg: error instanceof Error ? error.message : 'No se pudo actualizar la capacidad',
        sev: 'error',
      })
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  const bulkDeactivateTargets = useMemo(() => {
    if (!diff.data) return []
    const ids = diff.data.changes
      .filter((c) => seleccion.has(c.id) && c.kind === 'DELETE' && c.capacidad_id)
      .map((c) => c.capacidad_id!)
    return Array.from(new Set(ids))
  }, [diff.data, seleccion])

  function closeCrearDialog() {
    setOpenCrearDialog(false)
    setNoMapTarget(null)
    setFormTipo('')
    setFormModelo('')
    setFormCapacidad('')
    setFormMarca('Apple')
    setFormLikewizeCode('')
    crearCapacidad.reset()
  }

  function openCrearDesdeRow(row: NoMap) {
    crearCapacidad.reset()
    setNoMapTarget(row)
    setFormTipo(row.tipo)
    setFormModelo(row.modelo_norm)
    setFormCapacidad(formatStorage(row.almacenamiento_gb))
    setFormMarca(row.marca ?? 'Apple')
    setFormLikewizeCode((row.likewize_model_code ?? '').toUpperCase())
    setOpenCrearDialog(true)
  }

  const running = estado.data?.estado === 'RUNNING' || estado.data?.estado === 'PENDING'

  const toggle = (id: string) => {
    setSeleccion(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
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
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  size="small"
                  options={otherBrandOptions}
                  value={selectedOtherBrands}
                  onChange={(_, newValue) => setSelectedOtherBrands(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Marcas (otros)"
                      placeholder="Selecciona marcas"
                    />
                  )}
                  sx={{ minWidth: 260, maxWidth: 320 }}
                  disabled={lanzarActualizacionPending}
                />
                <Button
                  variant="contained"
                  onClick={() => lanzarTarea('apple', appleBrandDefaults)}
                  disabled={lanzarActualizacionPending}
                >
                  {pendingMode === 'apple' && lanzarActualizacionPending ? 'Lanzando…' : 'Actualizar Apple'}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => {
                    if (!selectedOtherBrands.length) {
                      setToggleMessage({ msg: 'Selecciona al menos una marca para sincronizar.', sev: 'error' })
                      return
                    }
                    lanzarTarea('others', selectedOtherBrands)
                  }}
                  disabled={lanzarActualizacionPending || selectedOtherBrands.length === 0}
                >
                  {pendingMode === 'others' && lanzarActualizacionPending ? 'Lanzando…' : 'Actualizar otros'}
                </Button>
                <Button variant="outlined" onClick={() => cargarUltima.mutate()} disabled={cargarUltima.isPending}>
                  {cargarUltima.isPending ? 'Cargando…' : 'Ver último descargado'}
                </Button>
                <Button variant="outlined" color="secondary" onClick={() => { window.location.href = '/dispositivos/actualizar-b2c' }}>
                  Actualizar precios B2C
                </Button>
                <Button variant="outlined" color="secondary" onClick={() => { window.location.href = '/dispositivos/actualizar-b2c-backmarket' }}>
                  Actualizar B2C (Back Market)
                </Button>
              </Stack>
            )}

            {running && (
            <>
                <LinearProgress
                  variant={typeof (estado.data as EstadoTareaExt | undefined)?.progreso === 'number' ? 'determinate' : 'indeterminate'}
                  value={(estado.data as EstadoTareaExt | undefined)?.progreso ?? 0}
                />
                <Typography>
                  {(estado.data as EstadoTareaExt | undefined)?.subestado || 'Procesando…'}
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

            {/* Mensajería B2C no necesaria aquí; se maneja en la página B2C */}

            {toggleMessage && (
              <Alert
                severity={toggleMessage.sev}
                onClose={() => setToggleMessage(null)}
              >
                {toggleMessage.msg}
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
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    disabled={bulkDeactivateTargets.length === 0 || toggleCapacidad.isPending}
                    onClick={async () => {
                      if (bulkDeactivateTargets.length === 0) {
                        setToggleMessage({ msg: 'Selecciona filas de tipo baja para desactivar.', sev: 'error' })
                        return
                      }
                      try {
                        for (const capId of bulkDeactivateTargets) {
                          await toggleCapacidad.mutateAsync({ capacidadId: capId, activo: false })
                        }
                        setToggleMessage({ msg: `Capacidades marcadas como baja (${bulkDeactivateTargets.length})`, sev: 'success' })
                      } catch (err) {
                        setToggleMessage({ msg: err instanceof Error ? err.message : 'Error desactivando capacidades', sev: 'error' })
                      }
                    }}
                  >
                    Marcar seleccionados como baja
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
                          <TableCell align="center">Acción</TableCell>
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
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                              {c.capacidad_id && capMarcaLookup[c.capacidad_id] && (
                                <Chip size="small" variant="outlined" label={capMarcaLookup[c.capacidad_id]} />
                              )}
                              <Typography variant="body2">{c.modelo_norm}</Typography>
                            </Stack>
                          </TableCell>
                            <TableCell align="right">{c.almacenamiento_gb || '-'}</TableCell>
                            <TableCell align="center">
                              {c.kind === 'DELETE' && c.capacidad_id ? (
                                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                                  <Button
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    onClick={() => toggleCapacidad.mutate(
                                      { capacidadId: c.capacidad_id!, activo: false },
                                      {
                                        onSuccess: (data) => setToggleMessage({
                                          msg: data.activo ? 'Capacidad activada' : 'Capacidad marcada como baja',
                                          sev: 'success',
                                        })
                                      }
                                    )}
                                    disabled={
                                      (toggleCapacidad.isPending && togglingId === c.capacidad_id) ||
                                      capStatus[c.capacidad_id!] === false
                                    }
                                  >
                                    {toggleCapacidad.isPending && togglingId === c.capacidad_id
                                      ? 'Marcando…'
                                      : capStatus[c.capacidad_id!] === false
                                        ? 'Ya en baja'
                                        : 'Marcar baja'}
                                  </Button>
                                  {capStatus[c.capacidad_id!] === false && (
                                    <Chip size="small" label="Baja" color="default" variant="outlined" />
                                  )}
                                </Stack>
                              ) : '—'}
                            </TableCell>
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
                                <TableCell />
                                <TableCell>Tipo</TableCell>
                                <TableCell>Modelo</TableCell>
                                <TableCell>Código</TableCell>
                                <TableCell>Marca</TableCell>
                                <TableCell align="right">Cap.</TableCell>
                                <TableCell align="right">Precio B2B</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {diff.data.no_mapeados.map((r: NoMap, i: number) => (
                                <TableRow key={i}>
                                    <TableCell>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => openCrearDesdeRow(r)}
                                        disabled={crearCapacidad.isPending}
                                      >
                                        {crearCapacidad.isPending && noMapTarget?.id === r.id ? 'Creando…' : 'Revisar y crear'}
                                      </Button>
                                    </TableCell>
                                    <TableCell>{r.tipo}</TableCell>
                                    <TableCell>{r.modelo_norm}</TableCell>
                                    <TableCell>{r.likewize_model_code ?? '—'}</TableCell>
                                    <TableCell>{r.marca ?? '—'}</TableCell>
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

      <Dialog open={openCrearDialog} onClose={closeCrearDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Crear capacidad a partir de staging</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {crearCapacidad.isError && (
              <Alert severity="error">
                {crearCapacidad.error instanceof Error ? crearCapacidad.error.message : 'No se pudo crear la capacidad.'}
              </Alert>
            )}
            <TextField
              size="small"
              label="Tipo"
              value={formTipo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormTipo(e.target.value)}
              autoFocus
            />
            <TextField
              size="small"
              label="Modelo"
              value={formModelo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormModelo(e.target.value)}
            />
            <TextField
              size="small"
              label="Código Likewize"
              value={formLikewizeCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormLikewizeCode(e.target.value.toUpperCase())}
              helperText="Ej: GB7N6"
            />
            <Autocomplete
              freeSolo
              options={Array.from(new Set(marcasModelo ?? []))}
              value={formMarca}
              onChange={(_, newValue) => setFormMarca(newValue ?? '')}
              onInputChange={(_, newValue) => setFormMarca(newValue ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Marca"
                  size="small"
                  helperText="Ejemplo: Apple, Samsung, Google"
                />
              )}
            />
            <TextField
              size="small"
              label="Capacidad"
              value={formCapacidad}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCapacidad(e.target.value)}
              helperText="Ejemplo: 256 GB, 1TB"
            />
            {noMapTarget && (
              <Typography variant="body2" color="text.secondary">
                Precio B2B detectado: {noMapTarget.precio_b2b}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCrearDialog} disabled={crearCapacidad.isPending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitCrearCapacidad}
            disabled={crearCapacidad.isPending || !noMapTarget || !formTipo.trim() || !formModelo.trim() || !formCapacidad.trim() || !formMarca.trim()}
          >
            {crearCapacidad.isPending ? 'Creando…' : 'Guardar y crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
