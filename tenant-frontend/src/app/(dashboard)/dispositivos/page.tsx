'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Grid, Paper, Stack, TextField, Select, MenuItem, Tooltip, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, FormControl, Typography, Alert, Snackbar, Autocomplete } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api, { getAccessToken } from '@/services/api'
import TablaReactiva from '@/components/TablaReactiva2'
import type { CapacidadRow, ModeloMini } from '@/components/TablaColumnas2'
import { columnasCapacidadesAdmin } from '@/components/TablaColumnas2'

// ===== API helpers =====
export type CapacidadesParams = {
  q?: string
  modelo_id?: string | number
  tipo?: string
  marca?: string
  fecha?: string // ISO
  ordering?: string
  page?: number | string
  page_size?: number | string
  activo?: string
}

async function fetchCapacidades(params: CapacidadesParams) {
  const { data } = await api.get('/api/admin/capacidades/', { params })
  return data as { results: CapacidadRow[]; count: number } | CapacidadRow[]
}

async function postSetPrecio(body: { capacidad_id: number; canal: 'B2B' | 'B2C'; precio_neto: string; effective_at?: string }) {
  const { data } = await api.post('/api/admin/precios/set/', body)
  return data
}

async function fetchTiposModelo() {
  const { data } = await api.get<string[]>('/api/tipos-modelo/')
  return data
}

async function fetchMarcasModelo() {
  const { data } = await api.get<string[]>('/api/marcas-modelo/')
  return data
}

async function patchModelo(id: number, body: { descripcion: string; tipo: string; marca: string }) {
  const { data } = await api.patch(`/api/modelos/${id}/`, body)
  return data as ModeloMini
}

async function patchCapacidad(id: number, body: Partial<{ tamaño: string; activo: boolean }>) {
  const { data } = await api.patch(`/api/admin/capacidades/${id}/`, body)
  return data as CapacidadRow
}

export default function AdminCapacidadesTablaReactiva() {
  // Filtros
  const [q, setQ] = useState('')
  const [modeloId, setModeloId] = useState('')
  const [tipo, setTipo] = useState('')
  const [marcaFilter, setMarcaFilter] = useState('')
  const [fecha, setFecha] = useState('') // datetime-local
  const [activoFilter, setActivoFilter] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  // Server pagination
  const [pageIndex, setPageIndex] = useState(0) // 0-based
  const [pageSize, setPageSize] = useState(10)

  // Ordering (opcional: usa backend). Si no lo usas, deja cadena vacía.
  const [ordering] = useState('modelo__descripcion,tamaño')

  // Query params
  const fechaISO = useMemo(() => {
    if (!fecha) return undefined
    const d = new Date(fecha)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }, [fecha])

  const params = useMemo<CapacidadesParams>(() => ({
    q: q || undefined,
    modelo_id: modeloId || undefined,
    tipo: tipo || undefined,
    fecha: fechaISO,
    ordering: ordering || undefined,
    page: pageIndex + 1, // DRF es 1-based
    page_size: pageSize,
    marca: marcaFilter || undefined,
    activo: activoFilter === 'todos' ? undefined : activoFilter === 'activos' ? 'true' : 'false',
  }), [q, modeloId, tipo, marcaFilter, fechaISO, ordering, pageIndex, pageSize, activoFilter])

  const canFetch = typeof window !== 'undefined' && !!getAccessToken()

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-capacidades', params],
    queryFn: () => fetchCapacidades(params),
    placeholderData: keepPreviousData,
    enabled: canFetch,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const { data: tiposModelo = [], isLoading: isLoadingTipos, isError: tiposError, error: tiposFetchError } = useQuery({
    queryKey: ['tipos-modelo'],
    queryFn: fetchTiposModelo,
    enabled: canFetch,
    staleTime: 60_000,
  })

  const { data: marcasModelo } = useQuery({
    queryKey: ['marcas-modelo'],
    queryFn: fetchMarcasModelo,
    enabled: canFetch,
    staleTime: 60_000,
  })

  // Normaliza payload
  const rows: CapacidadRow[] = useMemo(() => Array.isArray(data) ? data : (data?.results ?? []), [data])
  const totalCount: number | undefined = useMemo(() => Array.isArray(data) ? undefined : data?.count, [data])

  const prevFiltersRef = useRef<{ q: string; modeloId: string; tipo: string; marca: string; fechaISO: string | undefined; ordering: string; pageSize: number; activoFilter: string }>({
    q,
    modeloId,
    tipo,
    marca: marcaFilter,
    fechaISO,
    ordering,
    pageSize,
    activoFilter,
  })

  useEffect(() => {
    const prev = prevFiltersRef.current
    const filtersChanged =
      prev.q !== q ||
      prev.modeloId !== modeloId ||
      prev.tipo !== tipo ||
      prev.marca !== marcaFilter ||
      prev.fechaISO !== fechaISO ||
      prev.ordering !== ordering ||
      prev.pageSize !== pageSize ||
      prev.activoFilter !== activoFilter

    if (filtersChanged && pageIndex !== 0) {
      setPageIndex(0)
    }

    if (filtersChanged) {
      prevFiltersRef.current = { q, modeloId, tipo, marca: marcaFilter, fechaISO, ordering, pageSize, activoFilter }
    }
  }, [q, modeloId, tipo, marcaFilter, fechaISO, ordering, pageSize, activoFilter, pageIndex])

  // Set precio dialog
  const [openSetPrice, setOpenSetPrice] = useState(false)
  const [target, setTarget] = useState<CapacidadRow | null>(null)
  const [canal, setCanal] = useState<'B2B' | 'B2C'>('B2B')
  const [lastCanal, setLastCanal] = useState<'B2B' | 'B2C'>('B2B')
  const [precio, setPrecio] = useState('')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const [openEditDatos, setOpenEditDatos] = useState(false)
  const [rowTarget, setRowTarget] = useState<CapacidadRow | null>(null)
  const [modelTarget, setModelTarget] = useState<ModeloMini | null>(null)
  const [modelName, setModelName] = useState('')
  const [modelTipo, setModelTipo] = useState('')
  const [modelMarca, setModelMarca] = useState('Apple')
  const [capacidadNombre, setCapacidadNombre] = useState('')

  const queryClient = useQueryClient()

  const setPrecioMutation = useMutation({
    mutationFn: postSetPrecio,
    onSuccess: async () => {
      setOpenSetPrice(false)
      setSnack({ open: true, msg: 'Precio guardado', sev: 'success' })
      await queryClient.invalidateQueries({ queryKey: ['admin-capacidades'] })
    },
    onError: (e: any) => {
      setSnack({ open: true, msg: e?.message || 'Error guardando', sev: 'error' })
    },
  })

  const saveEdicionMutation = useMutation({
    mutationFn: async () => {
      if (!rowTarget) throw new Error('Capacidad no válida')

      const tareas: Promise<unknown>[] = []

      const capacidadTrim = capacidadNombre.trim()
      const capacidadOriginal = rowTarget.tamaño ?? ''
      if (!capacidadTrim) {
        throw new Error('La capacidad no puede estar vacía')
      }
      if (capacidadTrim !== capacidadOriginal) {
        tareas.push(patchCapacidad(rowTarget.id, { tamaño: capacidadTrim }))
      }

      if (modelTarget) {
        const nombreTrim = modelName.trim()
        const tipoTrim = modelTipo.trim()
        const marcaTrim = (modelMarca.trim() || 'Apple')

        if (!nombreTrim || !tipoTrim || !marcaTrim) {
          throw new Error('Completa los datos del modelo')
        }

        const nombreOrig = modelTarget.descripcion ?? ''
        const tipoOrig = modelTarget.tipo ?? ''
        const marcaOrig = modelTarget.marca ?? 'Apple'

        const hayCambiosModelo =
          nombreTrim !== nombreOrig ||
          tipoTrim !== tipoOrig ||
          marcaTrim !== marcaOrig

        if (hayCambiosModelo) {
          tareas.push(patchModelo(modelTarget.id, { descripcion: nombreTrim, tipo: tipoTrim, marca: marcaTrim }))
        }
      }

      if (!tareas.length) {
        return { mensaje: 'Sin cambios' }
      }

      await Promise.all(tareas)
      return { mensaje: 'Actualizado' }
    },
    onSuccess: async (resultado) => {
      const msg = resultado?.mensaje === 'Sin cambios' ? 'Sin cambios por guardar' : 'Datos actualizados'
      setSnack({ open: true, msg, sev: 'success' })
      closeEditDatos()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-capacidades'] }),
        queryClient.invalidateQueries({ queryKey: ['tipos-modelo'] }),
        queryClient.invalidateQueries({ queryKey: ['marcas-modelo'] }),
      ])
    },
    onError: (e: any) => {
      setSnack({ open: true, msg: e?.message || 'Error guardando cambios', sev: 'error' })
    },
  })

  const {
    mutate: toggleCapacidad,
    isPending: toggleCapacidadPending,
  } = useMutation({
    mutationFn: async ({ id, nextActivo }: { id: number; nextActivo: boolean }) => {
      return patchCapacidad(id, { activo: nextActivo })
    },
    onSuccess: async (_, variables) => {
      setSnack({ open: true, msg: variables.nextActivo ? 'Capacidad activada' : 'Capacidad desactivada', sev: 'success' })
      await queryClient.invalidateQueries({ queryKey: ['admin-capacidades'] })
    },
    onError: (e: any) => {
      setSnack({ open: true, msg: e?.message || 'Error cambiando estado', sev: 'error' })
    },
  })

  const onClickSetPrice = useCallback((row: CapacidadRow) => {
    setTarget(row)
    setCanal(lastCanal)
    setPrecio('')
    setEffectiveAt('')
    setOpenSetPrice(true)
  }, [lastCanal])

  const onClickEditar = useCallback((row: CapacidadRow | null) => {
    if (!row) return
    const modelo = row.modelo ?? null
    setRowTarget(row)
    setModelTarget(modelo)
    setModelName(modelo?.descripcion ?? '')
    setModelTipo(modelo?.tipo ?? '')
    setModelMarca(modelo ? (modelo.marca ?? 'Apple') : 'Apple')
    setCapacidadNombre(row.tamaño ?? '')
    setOpenEditDatos(true)
  }, [])

  const closeEditDatos = () => {
    setOpenEditDatos(false)
    setRowTarget(null)
    setModelTarget(null)
    setModelName('')
    setModelTipo('')
    setModelMarca('Apple')
    setCapacidadNombre('')
  }

  const onToggleActivo = useCallback((row: CapacidadRow) => {
    toggleCapacidad({ id: row.id, nextActivo: !row.activo })
  }, [toggleCapacidad])

  // Extiende las columnas añadiendo acciones
  const columnas = useMemo(() => {
    const base = [...columnasCapacidadesAdmin]
    base.push({
      id: 'acciones',
      header: 'Acciones',
      meta: { minWidth: 220, align: 'right', alignHeader: 'center', label: 'Acciones' },
      cell: ({ row }) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexWrap: 'wrap' }}>
          <Button size="small" variant="text" onClick={() => onClickEditar(row.original)}>Editar</Button>
          <Button
            size="small"
            variant="outlined"
            color={row.original.activo ? 'warning' : 'success'}
            onClick={() => onToggleActivo(row.original)}
            disabled={toggleCapacidadPending}
          >
            {row.original.activo ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size="small" variant="outlined" startIcon={<PriceChangeIcon />} onClick={() => onClickSetPrice(row.original)}>Precios</Button>
        </Stack>
      )
    })
    return base
  }, [onClickEditar, onClickSetPrice, onToggleActivo, toggleCapacidadPending])

  if (!canFetch) {
    return (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper style={{ padding: 16 }}>
            <Typography>Debes iniciar sesión para ver esta página.</Typography>
          </Paper>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 12 }}>
        <Paper style={{ padding: 16 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField size="small" label="Buscar" placeholder="Modelo, capacidad, procesador…" value={q} onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} />
            <TextField size="small" label="Modelo ID" type="number" value={modeloId} onChange={(e: ChangeEvent<HTMLInputElement>) => setModeloId(e.target.value)} />
            <Select
              size="small"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              displayEmpty
              disabled={isLoadingTipos && !tiposModelo?.length}
            >
              <MenuItem value=""><em>Tipo (todos)</em></MenuItem>
              {tiposModelo?.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
              {!isLoadingTipos && !tiposModelo?.length && (
                <MenuItem value="" disabled>Sin opciones disponibles</MenuItem>
              )}
            </Select>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="marca-filter">Marca</InputLabel>
              <Select
                labelId="marca-filter"
                value={marcaFilter}
                label="Marca"
                onChange={(e) => setMarcaFilter(e.target.value)}
              >
                <MenuItem value=""><em>Marca (todas)</em></MenuItem>
                {marcasModelo?.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="activo-filter">Estado</InputLabel>
              <Select
                labelId="activo-filter"
                value={activoFilter}
                label="Estado"
                onChange={(e) => setActivoFilter(e.target.value as typeof activoFilter)}
              >
                <MenuItem value="activos">Activos</MenuItem>
                <MenuItem value="inactivos">Inactivos</MenuItem>
                <MenuItem value="todos">Todos</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="Fecha" type="datetime-local" value={fecha} onChange={(e: ChangeEvent<HTMLInputElement>) => setFecha(e.target.value)} slotProps={{ inputLabel: { shrink: true } }}/>
            <Tooltip title="Recargar">
              <IconButton onClick={() => refetch()}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>

          <TablaReactiva<CapacidadRow>
            oportunidades={rows}
            columnas={columnas}
            loading={isFetching}
            serverPagination
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />

          {tiposError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {tiposFetchError instanceof Error ? tiposFetchError.message : 'No se pudieron cargar los tipos'}
            </Alert>
          )}

          {isError && (<Alert severity="error" sx={{ mt: 1 }}>{(error as Error)?.message || 'Error cargando datos'}</Alert>)}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 12 }}>
        <Paper style={{ padding: 16 }}>
          <Typography variant="h6" gutterBottom>Consejos</Typography>
          <Typography variant="body2" paragraph>
            • Filtra por modelo/tipo y ajusta la fecha para ver vigencias.
            <br />• Usa “Precios” para cambios inmediatos o programados.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Mostrando precios netos (sin IVA). Vigencias en rango semiabierto [inicio, fin).
          </Typography>
        </Paper>
      </Grid>

      {/* Diálogo Set Precio */}
      <Dialog open={openSetPrice} onClose={() => setOpenSetPrice(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Fijar precio de recompra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <b>Modelo:</b> {target?.modelo?.descripcion ?? '—'} — <b>{target?.tamaño ?? '—'}</b>
            </Typography>
            <FormControl size="small">
              <InputLabel id="canal-lbl">Canal</InputLabel>
              <Select
                labelId="canal-lbl"
                label="Canal"
                value={canal}
                onChange={(e) => {
                  const value = e.target.value as 'B2B' | 'B2C'
                  setCanal(value)
                  setLastCanal(value)
                }}
              >
                <MenuItem value="B2B">B2B</MenuItem>
                <MenuItem value="B2C">B2C</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" label="Precio neto (€)" type="number" value={precio} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrecio(e.target.value)} />
            <TextField
              size="small"
              label="Fecha de efecto (opcional)"
              type="datetime-local"
              value={effectiveAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEffectiveAt(e.target.value)}
              helperText="Si se deja vacío, aplica ahora"
              slotProps={{ inputLabel: { shrink: true } }} // 👈 evita solape
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSetPrice(false)} disabled={setPrecioMutation.isPending}>Cancelar</Button>
          <Button variant="contained" onClick={() => {
            if (!target) return
            const body: Parameters<typeof postSetPrecio>[0] = { capacidad_id: target.id, canal, precio_neto: String(precio) }
            if (effectiveAt) {
              const d = new Date(effectiveAt)
              if (!Number.isNaN(d.getTime())) body.effective_at = d.toISOString()
            }
            setPrecioMutation.mutate(body)
          }} disabled={setPrecioMutation.isPending || !precio} startIcon={<PriceChangeIcon />}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditDatos} onClose={closeEditDatos} maxWidth="sm" fullWidth>
        <DialogTitle>Editar datos</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Capacidad"
              value={capacidadNombre}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCapacidadNombre(e.target.value)}
              autoFocus
            />
            {modelTarget ? (
              <>
                <TextField
                  size="small"
                  label="Nombre del modelo"
                  value={modelName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setModelName(e.target.value)}
                />
                <Autocomplete
                  freeSolo
                  options={Array.from(new Set(tiposModelo ?? []))}
                  value={modelTipo}
                  onChange={(_, newValue) => setModelTipo(newValue ?? '')}
                  onInputChange={(_, newValue) => setModelTipo(newValue ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tipo"
                      size="small"
                      helperText="Introduce un tipo nuevo o selecciona uno existente"
                    />
                  )}
                />
                <Autocomplete
                  freeSolo
                  options={Array.from(new Set(marcasModelo ?? []))}
                  value={modelMarca}
                  onChange={(_, newValue) => setModelMarca(newValue ?? '')}
                  onInputChange={(_, newValue) => setModelMarca(newValue ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Marca"
                      size="small"
                      helperText="Introduce una marca nueva o selecciona una existente"
                    />
                  )}
                />
              </>
            ) : (
              <Alert severity="info">Este registro no tiene modelo asociado; solo se actualizará la capacidad.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDatos} disabled={saveEdicionMutation.isPending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => saveEdicionMutation.mutate()}
            disabled={
              saveEdicionMutation.isPending ||
              !rowTarget ||
              !capacidadNombre.trim() ||
              (modelTarget ? (!modelName.trim() || !modelTipo.trim() || !modelMarca.trim()) : false)
            }
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Grid>
  )
}
