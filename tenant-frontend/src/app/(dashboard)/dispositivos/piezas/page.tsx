'use client'

import React, { useMemo, useState, useEffect, type ChangeEvent } from 'react'
import {
  Grid, Paper, Stack, TextField, Select, MenuItem, Tooltip, IconButton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, FormControl,
  Typography, Alert, Snackbar, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Chip,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import TablaReactiva from '@/shared/components/TablaReactiva2'
import type { ColumnDef } from '@tanstack/react-table'

/* ==========================
 * Tipos
 * ========================== */
export type ModelosParams = {
  search?: string
  tipo?: string
  ordering?: string
  page?: number | string
  page_size?: number | string
}

export interface ModeloRow {
  id: number
  descripcion: string
  tipo: string
  pantalla?: string | null
  año?: number | null
  procesador?: string | null
}

export type PiezaOption = { value: number; label: string }
type ManoObraOption = { value: number; label: string; tarifa_h?: string | null }

type CostoPiezaRow = {
  id?: number
  modelo_id: number
  pieza_tipo_id: number | undefined
  mano_obra_tipo_id: number | null
  horas: number | null
  coste_neto: string
  mano_obra_fija_neta?: string | null
  proveedor?: string | null
}
type CoverageRow = {
  modelo_id: number
  total_filas: number
  piezas_unicas: number
  mano_obra_distinta: number
  total_piezas_disponibles: number
}

/* ==========================
 * API helpers
 * ========================== */
async function fetchModelos(params: ModelosParams) {
  const { data } = await api.get('/api/modelos/', { params })
  return data as { results: ModeloRow[]; count: number } | ModeloRow[]
}
async function fetchCoverage(modeloIds: number[], extra?: { search?: string; tipo?: string }) {
  if (!modeloIds.length) return [] as CoverageRow[]

  const modelo_ids = modeloIds
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x))
    .join(',')

  const { data } = await api.get('/api/admin/costos-pieza/coverage/', {
    params: {
      modelo_ids, // ✅ nombre que exige tu backend
      ...(extra?.search ? { search: extra.search } : {}),
      ...(extra?.tipo ? { tipo: extra.tipo } : {}),
    },
  })

  // ✅ NUEVO: { by_model: { "1": { piezas:[...], count:n }, ... }, total_piezas_disponibles? }
  if (data && typeof data === 'object' && data.by_model && typeof data.by_model === 'object') {
    const totalPiezasDisponibles = Number(data.total_piezas_disponibles ?? 0)
    return Object.entries(
      data.by_model as Record<string, { piezas?: string[]; count?: number }>
    ).map(([k, v]) => {
      const count = Number(
        v?.count ?? (Array.isArray(v?.piezas) ? v.piezas.length : 0)
      )
      return {
        modelo_id: Number(k),
        total_filas: count,
        piezas_unicas: count,
        mano_obra_distinta: 0, // no viene en este endpoint
        total_piezas_disponibles: totalPiezasDisponibles, // 0 si el backend no lo envía
      } as CoverageRow
    })
  }

  // Fallbacks por si en algún momento el backend cambia
  if (Array.isArray(data)) return data as CoverageRow[]
  if (data && Array.isArray((data as any).results)) return (data as any).results as CoverageRow[]
  if (data && typeof data === 'object') {
    // Diccionario plano { "<id>": {...} }
    return Object.entries(data as Record<string, any>).map(([k, v]) => ({
      modelo_id: Number(k),
      total_filas: Number(v.total_filas ?? v.total ?? 0),
      piezas_unicas: Number(v.piezas_unicas ?? v.piezas ?? 0),
      mano_obra_distinta: Number(v.mano_obra_distinta ?? v.mo ?? 0),
      total_piezas_disponibles: Number(v.total_piezas_disponibles ?? v.total_piezas ?? 0),
    }))
  }

  return [] as CoverageRow[]
}


async function fetchOpcionesReparacion() {
  const { data } = await api.get('/api/admin/reparacion/opciones/')
  return data as { piezas: PiezaOption[]; mano_obra: ManoObraOption[] }
}
async function fetchCostosPieza(modelo_id: number) {
  const { data } = await api.get('/api/admin/costos-pieza/', { params: { modelo_id } })
  return data as CostoPiezaRow[]
}
async function upsertCostoPieza(payload: CostoPiezaRow) {
  const { data } = await api.post('/api/admin/costos-pieza/set/', payload)
  return data as CostoPiezaRow
}
async function deleteCostoPieza(id: number) {
  await api.delete(`/api/admin/costos-pieza/${id}/`)
  return { ok: true }
}

/* ==========================
 * Componente
 * ========================== */
export default function AdminCostesReparacionPorModelo() {
  // Panel izquierdo (modelos)
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [ordering] = useState('descripcion')

  const params = useMemo<ModelosParams>(() => ({
    search: q || undefined,
    tipo: tipo || undefined,
    ordering,
    page: pageIndex + 1,
    page_size: pageSize,
  }), [q, tipo, ordering, pageIndex, pageSize])

  const { data: modelosData, isFetching: modelosLoading, error: modelosError, refetch: refetchModelos } = useQuery({
    queryKey: ['admin-modelos', params],
    queryFn: () => fetchModelos(params),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

  const modelos: ModeloRow[] = useMemo(
    () => Array.isArray(modelosData) ? modelosData : (modelosData?.results ?? []),
    [modelosData]
  )

  // coverage para esta página
  const modeloIds = useMemo(() => modelos.map(m => m.id), [modelos])

  const { data: coverage = [], isFetching: coverageLoading, refetch: refetchCoverage } = useQuery({
  queryKey: ['admin-costos-pieza-coverage', modeloIds.join(','), q, tipo],
  queryFn: () => fetchCoverage(modeloIds, { search: q || undefined, tipo: tipo || undefined }),
  enabled: modeloIds.length > 0,
  staleTime: 30_000,})

  const coverageArr = useMemo<CoverageRow[]>(
  () => (Array.isArray(coverage) ? (coverage as CoverageRow[]) : []),
  [coverage]
)

const coverageMap = useMemo(() => {
  const map = new Map<number, CoverageRow>()
  coverageArr.forEach((r) => map.set(r.modelo_id, r))
  return map
}, [coverageArr])

  // ⬇️ MOVIDO AQUÍ: columnas con acceso a coverageMap/coverageLoading
  const columnasModelosLocal: ColumnDef<ModeloRow>[] = [
    { id: 'descripcion', header: 'Modelo', accessorKey: 'descripcion', meta: { minWidth: 200, align: 'left', alignHeader: 'center', label: 'Modelo' } },
    { id: 'tipo', header: 'Tipo', accessorKey: 'tipo', meta: { minWidth: 120, align: 'center', alignHeader: 'center', label: 'Tipo' } },
    { id: 'pantalla', header: 'Pantalla', accessorKey: 'pantalla', meta: { minWidth: 120, align: 'center', alignHeader: 'center', label: 'Pantalla' } },
    { id: 'año', header: 'Año', accessorKey: 'año', meta: { minWidth: 80, align: 'center', alignHeader: 'center', label: 'Año' } },
    { id: 'procesador', header: 'CPU', accessorKey: 'procesador', meta: { minWidth: 140, align: 'center', alignHeader: 'center', label: 'CPU', ellipsis: true, ellipsisMaxWidth: 220 } },
    {
      id: 'reparaciones',
      header: 'Reparaciones',
      accessorKey: 'id',
      meta: { minWidth: 160, align: 'center', alignHeader: 'center', label: 'Reparaciones' },
      cell: ({ row }) => {
        const id = row.original.id
        const cov = coverageMap.get(id)
        if (!cov) return coverageLoading ? '...' : '—'
        const done = cov.piezas_unicas ?? 0
        const total = cov.total_piezas_disponibles || Math.max(done, 1)
        const pct = Math.round((done / total) * 100)
        return (
          <Stack alignItems="center" spacing={0.5}>
            <Chip size="small" label={`${done} / ${total}`} />
            <div style={{ width: 90, height: 6, background: 'var(--mui-palette-action-hover)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%' }} />
            </div>
          </Stack>
        )
      },
    },
  ]

  const totalCount: number | undefined = useMemo(
    () => Array.isArray(modelosData) ? undefined : modelosData?.count,
    [modelosData]
  )
  const isPaginated = typeof totalCount === 'number'

  // Panel derecho (costes por modelo seleccionado)
  const [selected, setSelected] = useState<ModeloRow | null>(null)

  const { data: opciones, isFetching: opcionesLoading } = useQuery({
    queryKey: ['admin-reparacion-opciones'],
    queryFn: fetchOpcionesReparacion,
    staleTime: 3600_000,
  })

  const { data: costes, isFetching: costesLoading, error: costesError, refetch: refetchCostes } = useQuery({
    queryKey: ['admin-costos-pieza-modelo', selected?.id],
    queryFn: () => fetchCostosPieza(selected!.id),
    enabled: !!selected?.id,
    refetchOnWindowFocus: false,
  })

  const queryClient = useQueryClient()
  const saveMutation = useMutation({
    mutationFn: upsertCostoPieza,
     onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-costos-pieza-modelo', selected?.id] })
    await queryClient.invalidateQueries({ queryKey: ['admin-costos-pieza-coverage'], exact: false }) // ← refresca cobertura/progreso
    setSnack({ open: true, msg: 'Guardado', sev: 'success' })
  },
    onError: (e: any) => setSnack({ open: true, msg: e?.message || 'Error guardando', sev: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCostoPieza,
    onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-costos-pieza-modelo', selected?.id] })
    await queryClient.invalidateQueries({ queryKey: ['admin-costos-pieza-coverage'], exact: false }) // ← refresca cobertura/progreso
    setSnack({ open: true, msg: 'Eliminado', sev: 'success' })
  },
    onError: (e: any) => setSnack({ open: true, msg: e?.message || 'Error eliminando', sev: 'error' }),
  })

  // UI state
  const [editRows, setEditRows] = useState<CostoPiezaRow[]>([])
  const [openAdd, setOpenAdd] = useState(false)
  const [nuevo, setNuevo] = useState<CostoPiezaRow | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({
    open: false, msg: '', sev: 'success'
  })

  useEffect(() => {
    if (selected?.id && Array.isArray(costes)) setEditRows(costes)
    else setEditRows([])
  }, [selected?.id, costes])

  const onAddRow = () => {
    if (!selected) return
    setNuevo({
      modelo_id: selected.id,
      pieza_tipo_id: opciones?.piezas?.[0]?.value,
      mano_obra_tipo_id: opciones?.mano_obra?.[0]?.value ?? null,
      horas: null,
      coste_neto: '',
      mano_obra_fija_neta: '',
      proveedor: '',
    })
    setOpenAdd(true)
  }

  const onSaveNueva = async () => {
    if (!nuevo || !selected) return
    await saveMutation.mutateAsync({ ...nuevo, modelo_id: selected.id })
    setOpenAdd(false)
    setNuevo(null)
    refetchCostes()
  }

  const onSaveEdit = async (row: CostoPiezaRow) => {
    if (!selected) return
    await saveMutation.mutateAsync({ ...row, modelo_id: selected.id })
    refetchCostes()
  }

  const onDeleteRow = async (row: CostoPiezaRow) => {
    if (!row.id) return
    await deleteMutation.mutateAsync(row.id)
    refetchCostes()
  }

  return (
    <Grid container spacing={2}>
      {/* Left: modelos */}
      <Grid size={{ xs: 12, md: 12 }}>
        <Paper style={{ padding: 16 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              size="small"
              label="Buscar"
              placeholder="Modelo, CPU…"
              value={q}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            />
            <Select size="small" value={tipo} onChange={(e) => setTipo(e.target.value as string)} displayEmpty>
              <MenuItem value=""><em>Tipo (todos)</em></MenuItem>
              {['iPhone','iPad','iMac','MacBook Air','MacBook Pro','Mac Pro','Mac Studio','Mac mini'].map(t =>
                <MenuItem key={t} value={t}>{t}</MenuItem>
              )}
            </Select>
            <Tooltip title="Recargar"><IconButton onClick={() => refetchModelos()}><RefreshIcon /></IconButton></Tooltip>
          </Stack>

          <TablaReactiva<ModeloRow>
            oportunidades={modelos}
            columnas={columnasModelosLocal}
            loading={modelosLoading || coverageLoading}
            serverPagination={isPaginated}
            totalCount={totalCount}
            pageIndex={isPaginated ? pageIndex : undefined}
            pageSize={isPaginated ? pageSize : undefined}
            onPageChange={isPaginated ? setPageIndex : undefined}
            onPageSizeChange={isPaginated ? setPageSize : undefined}
            onRowClick={(row) => setSelected(row)}
          />

          {modelosError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {(modelosError as Error)?.message || 'Error cargando modelos'}
            </Alert>
          )}
        </Paper>
      </Grid>

      {/* Right: edición de costes por modelo */}
      <Grid size={{ xs: 12, md: 12 }}>
        <Paper style={{ padding: 16 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Costes de reparación</Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={onAddRow}
              disabled={!selected || opcionesLoading}
            >
              Añadir
            </Button>
          </Stack>

          {!selected ? (
            <Alert severity="info">Selecciona un <b>modelo</b> a la izquierda para editar sus costes.</Alert>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <b>Modelo:</b> {selected.descripcion} ({selected.año ?? '—'}) • {selected.procesador ?? '—'}
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pieza</TableCell>
                    <TableCell>Mano de obra</TableCell>
                    <TableCell align="center">Horas</TableCell>
                    <TableCell align="right">Coste neto pieza (€)</TableCell>
                    <TableCell align="right">MO fija neta (€)</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(editRows || []).map((r, idx) => {
                    const moTarifa = opciones?.mano_obra?.find(m => m.value === r.mano_obra_tipo_id)?.tarifa_h
                    return (
                      <TableRow key={r.id ?? `new-${idx}`} hover>
                        <TableCell>
                          <Select
                            size="small"
                            value={r.pieza_tipo_id !== undefined ? String(r.pieza_tipo_id) : ''}  // <- SIEMPRE string
                            onChange={(e: SelectChangeEvent) => {
                              const v = e.target.value; // string
                              setEditRows(rows =>
                                rows.map((x,i) => i === idx ? ({ ...x, pieza_tipo_id: v === '' ? undefined : Number(v) }) : x)
                              )
                            }}
                            sx={{ minWidth: 180 }}
                          >
                            {opciones?.piezas?.map((p) => (
                              <MenuItem key={p.value} value={String(p.value)}>{p.label}</MenuItem>   
                            ))}
                          </Select>
                        </TableCell>

                        <TableCell>
                          <Stack direction="row" gap={1} alignItems="center">
                            <Select
                              size="small"
                              value={
                                r.mano_obra_tipo_id !== null && r.mano_obra_tipo_id !== undefined
                                  ? String(r.mano_obra_tipo_id)
                                  : ''
                              }                                   
                              displayEmpty
                              onChange={(e: SelectChangeEvent) => {
                                const v = e.target.value;          // string
                                const next = v === '' ? null : Number(v)
                                setEditRows(rows => rows.map((x, i) => (i === idx ? { ...x, mano_obra_tipo_id: next } : x)))
                              }}
                              sx={{ minWidth: 220 }}
                            >
                              <MenuItem value=""><em>—</em></MenuItem>
                              {opciones?.mano_obra?.map((m) => (
                                <MenuItem key={m.value} value={String(m.value)}>{m.label}</MenuItem> 
                              ))}
                            </Select>
                            {moTarifa ? <Chip size="small" variant="outlined" label={`Tarifa: ${moTarifa} €/h`} /> : null}
                          </Stack>
                        </TableCell>

                        <TableCell align="center" style={{ width: 120 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={r.horas ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value)
                              setEditRows((rows) => rows.map((x, i) => (i === idx ? { ...x, horas: v } : x)))
                            }}
                            inputProps={{ step: '0.1', min: '0' }}
                          />
                        </TableCell>

                        <TableCell align="right" style={{ width: 160 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={r.coste_neto ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditRows((rows) => rows.map((x, i) => (i === idx ? { ...x, coste_neto: v } : x)))
                            }}
                            inputProps={{ step: '0.01', min: '0' }}
                          />
                        </TableCell>

                        <TableCell align="right" style={{ width: 160 }}>
                          <TextField
                            size="small"
                            type="number"
                            value={r.mano_obra_fija_neta ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditRows((rows) => rows.map((x, i) => (i === idx ? { ...x, mano_obra_fija_neta: v } : x)))
                            }}
                            inputProps={{ step: '0.01', min: '0' }}
                          />
                        </TableCell>

                        <TableCell style={{ minWidth: 160 }}>
                          <TextField
                            size="small"
                            placeholder="Proveedor"
                            value={r.proveedor ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              setEditRows((rows) => rows.map((x, i) => (i === idx ? { ...x, proveedor: v } : x)))
                            }}
                          />
                        </TableCell>

                        <TableCell align="right" style={{ width: 210 }}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<SaveIcon />}
                              onClick={() => onSaveEdit(r)}
                              disabled={
                                saveMutation.isPending ||
                                !r.pieza_tipo_id ||
                                !r.mano_obra_tipo_id ||
                                r.coste_neto === '' // vacío
                              }
                            >
                              Guardar
                            </Button>
                            {r.id && (
                              <IconButton
                                onClick={() => onDeleteRow(r)}
                                color="error"
                                size="small"
                                disabled={deleteMutation.isPending}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {Array.isArray(costes) && costes.length === 0 && !costesLoading && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">Sin filas, añade una nueva.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {costesLoading && (
                <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Cargando costes…</Typography>
                </Stack>
              )}

              {costesError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {(costesError as Error)?.message || 'Error cargando costes'}
                </Alert>
              )}
            </>
          )}
        </Paper>
      </Grid>

      {/* Diálogo añadir */}
      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Añadir coste de pieza</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <b>Modelo:</b> {selected?.descripcion} ({selected?.año ?? '—'}) • {selected?.procesador ?? '—'}
            </Typography>

            <FormControl size="small">
              <InputLabel id="pieza-lbl">Pieza</InputLabel>
              <Select
                labelId="pieza-lbl"
                label="Pieza"
                value={nuevo?.pieza_tipo_id !== undefined ? String(nuevo.pieza_tipo_id) : ''} 
                onChange={(e: SelectChangeEvent) => {
                  const v = e.target.value; // string
                  setNuevo(n => ({ ...(n as CostoPiezaRow), pieza_tipo_id: v === '' ? undefined : Number(v) }))
                }}
              >
                {opciones?.piezas?.map((p) => (
                  <MenuItem key={p.value} value={String(p.value)}>{p.label}</MenuItem>     
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel id="mo-lbl">Mano de obra</InputLabel>
              <Select
                labelId="mo-lbl"
                label="Mano de obra"
                value={
                  nuevo?.mano_obra_tipo_id !== null && nuevo?.mano_obra_tipo_id !== undefined
                    ? String(nuevo.mano_obra_tipo_id)
                    : ''
                }                                                
                displayEmpty
                onChange={(e: SelectChangeEvent) =>
                  setNuevo((n) => ({
                    ...(n as CostoPiezaRow),
                    mano_obra_tipo_id: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              >
                <MenuItem value=""><em>—</em></MenuItem>
                {opciones?.mano_obra?.map((m) => (
                  <MenuItem key={m.value} value={String(m.value)}>{m.label}</MenuItem>  
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="Horas (si MO por horas)"
              type="number"
              value={nuevo?.horas ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...(n as CostoPiezaRow), horas: e.target.value === '' ? null : Number(e.target.value) }))}
              inputProps={{ step: '0.1', min: '0' }}
            />

            <TextField
              size="small"
              label="Coste neto pieza (€)"
              type="number"
              value={nuevo?.coste_neto ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...(n as CostoPiezaRow), coste_neto: e.target.value }))}
              inputProps={{ step: '0.01', min: '0' }}
            />

            <TextField
              size="small"
              label="MO fija neta (€)"
              type="number"
              value={nuevo?.mano_obra_fija_neta ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...(n as CostoPiezaRow), mano_obra_fija_neta: e.target.value }))}
              inputProps={{ step: '0.01', min: '0' }}
            />

            <TextField
              size="small"
              label="Proveedor (opcional)"
              value={nuevo?.proveedor ?? ''}
              onChange={(e) => setNuevo((n) => ({ ...(n as CostoPiezaRow), proveedor: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAdd(false)}>Cancelar</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onSaveNueva}
            disabled={!nuevo?.pieza_tipo_id || !nuevo?.mano_obra_tipo_id || saveMutation.isPending}
          >
            Añadir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
      >
        <Alert
          onClose={() => setSnack({ ...snack, open: false })}
          severity={snack.sev}
          variant="filled"
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Grid>
  )
}
