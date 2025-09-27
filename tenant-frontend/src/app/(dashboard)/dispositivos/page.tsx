'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Grid,
  Paper,
  Stack,
  TextField,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputLabel,
  FormControl,
  Typography,
  Alert,
  Snackbar,
  Autocomplete,
  Box,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress
} from '@mui/material'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import RefreshIcon from '@mui/icons-material/Refresh'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import UpdateIcon from '@mui/icons-material/Update'
import BusinessIcon from '@mui/icons-material/Business'
import PersonIcon from '@mui/icons-material/Person'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Dayjs } from 'dayjs'
import { useRouter } from 'next/navigation'
import api, { getAccessToken } from '@/services/api'
import TablaReactiva from '@/components/TablaReactiva2'
import type { CapacidadRow, ModeloMini } from '@/components/TablaColumnas2'
import { columnasCapacidadesAdmin } from '@/components/TablaColumnas2'

// ===== TYPES =====
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

type SetPrecioBody = {
  capacidad_id: number
  canal: 'B2B' | 'B2C'
  precio_neto: string
  effective_at?: string
}

type SnackState = {
  open: boolean
  msg: string
  sev: 'success' | 'error'
}

// ===== API FUNCTIONS =====
async function fetchCapacidades(params: CapacidadesParams) {
  const { data } = await api.get('/api/admin/capacidades/', { params })
  return data as { results: CapacidadRow[]; count: number } | CapacidadRow[]
}

async function fetchModelosSinCapacidades(params: { q?: string; tipo?: string; marca?: string }) {
  const { data } = await api.get('/api/admin/modelos/sin-capacidades/', { params })
  return data as ModeloMini[]
}

async function postSetPrecio(body: SetPrecioBody) {
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


// ===== MAIN COMPONENT =====
export default function AdminCapacidadesTablaReactiva() {
  // ===== FILTER STATE =====
  const [q, setQ] = useState('')
  const [modeloId, setModeloId] = useState('')
  const [tipo, setTipo] = useState('')
  const [marcaFilter, setMarcaFilter] = useState('')
  const [fechaValue, setFechaValue] = useState<Dayjs | null>(null)
  const [activoFilter, setActivoFilter] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  // ===== PAGINATION STATE =====
  const [pageIndex, setPageIndex] = useState(0) // 0-based
  const [pageSize, setPageSize] = useState(10)

  // ===== ORDERING =====
  const [ordering] = useState('modelo__descripcion,tamaño')

  // ===== DIALOG STATE =====
  const [openSetPrice, setOpenSetPrice] = useState(false)
  const [target, setTarget] = useState<CapacidadRow | null>(null)
  const [canal, setCanal] = useState<'B2B' | 'B2C'>('B2B')
  const [lastCanal, setLastCanal] = useState<'B2B' | 'B2C'>('B2B')
  const [precio, setPrecio] = useState('')
  const [effectiveAt, setEffectiveAt] = useState<Dayjs | null>(null)
  const [snack, setSnack] = useState<SnackState>({ open: false, msg: '', sev: 'success' })

  // B2C selection modal
  const [openB2CModal, setOpenB2CModal] = useState(false)

  const [openEditDatos, setOpenEditDatos] = useState(false)
  const [rowTarget, setRowTarget] = useState<CapacidadRow | null>(null)
  const [modelTarget, setModelTarget] = useState<ModeloMini | null>(null)
  const [modelName, setModelName] = useState('')
  const [modelTipo, setModelTipo] = useState('')
  const [modelMarca, setModelMarca] = useState('Apple')
  const [capacidadNombre, setCapacidadNombre] = useState('')
  const [showSinCapacidades, setShowSinCapacidades] = useState(false)

  // ===== ROUTER & QUERY CLIENT =====
  const router = useRouter()
  const queryClient = useQueryClient()

  // ===== QUERY PARAMS =====
  const fechaISO = useMemo(() => {
    if (!fechaValue) return undefined
    return fechaValue.toISOString()
  }, [fechaValue])

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

  const sinCapParams = useMemo(() => ({
    q: q || undefined,
    tipo: tipo || undefined,
    marca: marcaFilter || undefined,
  }), [q, tipo, marcaFilter])

  // ===== QUERIES =====
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

  const modelosSinCapQuery = useQuery({
    queryKey: ['modelos-sin-capacidades', sinCapParams],
    queryFn: () => fetchModelosSinCapacidades(sinCapParams),
    enabled: canFetch && showSinCapacidades,
    staleTime: 60_000,
  })

  // ===== DATA NORMALIZATION =====
  const rows: CapacidadRow[] = useMemo(() => Array.isArray(data) ? data : (data?.results ?? []), [data])
  const totalCount: number | undefined = useMemo(() => Array.isArray(data) ? undefined : data?.count, [data])

  // ===== FILTER RESET LOGIC =====
  const prevFiltersRef = useRef<{
    q: string;
    modeloId: string;
    tipo: string;
    marca: string;
    fechaISO: string | undefined;
    ordering: string;
    pageSize: number;
    activoFilter: string
  }>({
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

  // ===== MUTATIONS =====
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

  const { mutate: toggleCapacidad, isPending: toggleCapacidadPending } = useMutation({
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

  // Event handlers for B2C navigation
  const handleBackMarketClick = () => {
    setOpenB2CModal(false)
    router.push('/dispositivos/actualizar-b2c-backmarket')
  }

  const handleSwappieClick = () => {
    setOpenB2CModal(false)
    router.push('/dispositivos/actualizar-b2c')
  }

  // ===== EVENT HANDLERS =====
  const onClickSetPrice = useCallback((row: CapacidadRow) => {
    setTarget(row)
    setCanal(lastCanal)
    setPrecio('')
    setEffectiveAt(null)
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

  const handleSetPrecio = () => {
    if (!target) return
    const body: SetPrecioBody = {
      capacidad_id: target.id,
      canal,
      precio_neto: String(precio)
    }
    if (effectiveAt) {
      body.effective_at = effectiveAt.toISOString()
    }
    setPrecioMutation.mutate(body)
  }

  // ===== COLUMN DEFINITIONS =====
  const columnas = useMemo(() => {
    const base = [...columnasCapacidadesAdmin]
    base.push({
      id: 'acciones',
      header: 'Acciones',
      meta: { minWidth: 220, align: 'right', alignHeader: 'center', label: 'Acciones' },
      cell: ({ row }) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexWrap: 'wrap' }}>
          <Button size="small" variant="text" onClick={() => onClickEditar(row.original)}>
            Editar
          </Button>
          <Button
            size="small"
            variant="outlined"
            color={row.original.activo ? 'warning' : 'success'}
            onClick={() => onToggleActivo(row.original)}
            disabled={toggleCapacidadPending}
          >
            {row.original.activo ? 'Desactivar' : 'Activar'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PriceChangeIcon />}
            onClick={() => onClickSetPrice(row.original)}
          >
            Precios
          </Button>
        </Stack>
      )
    })
    return base
  }, [onClickEditar, onClickSetPrice, onToggleActivo, toggleCapacidadPending])

  // ===== RENDER =====
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
      <Grid size={{ xs: 12 }}>
        <Paper sx={{ p: 2 }}>
          {/* Header with update buttons */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5">Gestión de Dispositivos</Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={<BusinessIcon />}
                onClick={() => router.push('/dispositivos/actualizar')}
                color="primary"
              >
                Actualizar B2B
              </Button>
              <Button
                variant="contained"
                startIcon={<PersonIcon />}
                onClick={() => setOpenB2CModal(true)}
                color="secondary"
              >
                Actualizar B2C
              </Button>
            </Box>
          </Box>

          {/* Filters */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <TextField
              size="small"
              label="Buscar"
              placeholder="Modelo, capacidad, procesador…"
              value={q}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
              sx={{ minWidth: 200 }}
            />
            <TextField
              size="small"
              label="Modelo ID"
              type="number"
              value={modeloId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setModeloId(e.target.value)}
              sx={{ minWidth: 120 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={tipo}
                label="Tipo"
                onChange={(e) => setTipo(e.target.value)}
                disabled={isLoadingTipos && !tiposModelo?.length}
              >
                <MenuItem value=""><em>Todos</em></MenuItem>
                {tiposModelo?.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
                {!isLoadingTipos && !tiposModelo?.length && (
                  <MenuItem value="" disabled>Sin opciones disponibles</MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Marca</InputLabel>
              <Select
                value={marcaFilter}
                label="Marca"
                onChange={(e) => setMarcaFilter(e.target.value)}
              >
                <MenuItem value=""><em>Todas</em></MenuItem>
                {marcasModelo?.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={activoFilter}
                label="Estado"
                onChange={(e) => setActivoFilter(e.target.value as typeof activoFilter)}
              >
                <MenuItem value="activos">Activos</MenuItem>
                <MenuItem value="inactivos">Inactivos</MenuItem>
                <MenuItem value="todos">Todos</MenuItem>
              </Select>
            </FormControl>
            <DateTimePicker
              label="Fecha"
              value={fechaValue}
              onChange={(newValue) => setFechaValue(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  sx: { minWidth: 180 }
                },
              }}
            />
            <Tooltip title="Recargar">
              <IconButton onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Modelos sin capacidades</Typography>
              <Button
                size="small"
                variant={showSinCapacidades ? 'contained' : 'outlined'}
                onClick={() => setShowSinCapacidades((prev) => !prev)}
              >
                {showSinCapacidades ? 'Ocultar' : 'Mostrar'}
              </Button>
            </Stack>
            {showSinCapacidades && (
              <Box>
                {modelosSinCapQuery.isLoading ? (
                  <LinearProgress />
                ) : modelosSinCapQuery.isError ? (
                  <Alert severity="error">No se pudieron cargar los modelos sin capacidades.</Alert>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Total: {modelosSinCapQuery.data?.length ?? 0}
                    </Typography>
                    {(modelosSinCapQuery.data?.length ?? 0) === 0 ? (
                      <Typography variant="body2">Todos los modelos tienen al menos una capacidad asociada.</Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Descripción</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Marca</TableCell>
                            <TableCell>Pantalla</TableCell>
                            <TableCell>Año</TableCell>
                            <TableCell>Procesador</TableCell>
                            <TableCell>Likewize</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {modelosSinCapQuery.data?.map((modelo) => (
                            <TableRow key={modelo.id}>
                              <TableCell>{modelo.descripcion}</TableCell>
                              <TableCell>{modelo.tipo || '—'}</TableCell>
                              <TableCell>{modelo.marca || '—'}</TableCell>
                              <TableCell>{modelo.pantalla || '—'}</TableCell>
                              <TableCell>{modelo['año'] ?? '—'}</TableCell>
                              <TableCell>{modelo.procesador || '—'}</TableCell>
                              <TableCell>{modelo.likewize_modelo || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </Box>
            )}
          </Paper>

          {/* Table */}
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
            usuarioId="dispositivos"
          />

          {/* Error alerts */}
          {tiposError && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {tiposFetchError instanceof Error ? tiposFetchError.message : 'No se pudieron cargar los tipos'}
            </Alert>
          )}

          {isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {(error as Error)?.message || 'Error cargando datos'}
            </Alert>
          )}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Consejos</Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            • Filtra por modelo/tipo y ajusta la fecha para ver vigencias.
            <br />• Usa "Precios" para cambios inmediatos o programados.
            <br />• "Actualizar B2B" lleva a la página de actualización masiva.
            <br />• "Actualizar B2C" permite elegir entre BackMarket y Swappie.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Mostrando precios netos (sin IVA). Vigencias en rango semiabierto [inicio, fin).
          </Typography>
        </Paper>
      </Grid>

      {/* Set Price Dialog */}
      <Dialog open={openSetPrice} onClose={() => setOpenSetPrice(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Fijar precio de recompra</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <b>Modelo:</b> {target?.modelo?.descripcion ?? '—'} — <b>{target?.tamaño ?? '—'}</b>
            </Typography>
            <FormControl size="small">
              <InputLabel>Canal</InputLabel>
              <Select
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
            <TextField
              size="small"
              label="Precio neto (€)"
              type="number"
              value={precio}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrecio(e.target.value)}
            />
            <DateTimePicker
              label="Fecha de efecto (opcional)"
              value={effectiveAt}
              onChange={(newValue) => setEffectiveAt(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                  helperText: "Si se deja vacío, aplica ahora"
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSetPrice(false)} disabled={setPrecioMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSetPrecio}
            disabled={setPrecioMutation.isPending || !precio}
            startIcon={<PriceChangeIcon />}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Data Dialog */}
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
          <Button onClick={closeEditDatos} disabled={saveEdicionMutation.isPending}>
            Cancelar
          </Button>
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

      {/* B2C Selection Modal */}
      <Dialog open={openB2CModal} onClose={() => setOpenB2CModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Seleccionar proveedor B2C</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Elige el proveedor del que deseas actualizar los precios B2C:
          </Typography>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={handleBackMarketClick}
            >
              BackMarket
            </Button>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              onClick={handleSwappieClick}
            >
              Swappie
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenB2CModal(false)}
          >
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Grid>
  )
}
