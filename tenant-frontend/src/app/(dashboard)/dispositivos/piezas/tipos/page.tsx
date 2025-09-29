'use client'

import React, { useMemo, useState } from 'react'
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  MenuItem,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Divider,
  CircularProgress,
  Grid,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
  import RefreshIcon from '@mui/icons-material/Refresh'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import debounce from 'lodash.debounce'
import api from '@/services/api'

/* ==========================
 * Tipos (según backend)
 * ========================== */
export interface PiezaTipo {
  id: number
  nombre: string
  categoria: string
  activo: boolean
  [key: string]: any
}

type FormState = Omit<PiezaTipo, 'id'> & { id?: number }

/* ==========================
 * Constantes de categorías
 * (puedes ajustar la lista)
 * ========================== */
const CATEGORIAS = ['iPhone', 'iPad', 'Mac', 'Apple Watch', 'AirPods', 'Otros'] as const
type CategoriaOption = (typeof CATEGORIAS)[number] | ''

/* ==========================
 * API helpers
 * ========================== */
async function listarPiezasTipo(params: {
  q?: string
  categoria?: string
  activo?: '1' | '0'
  ordering?: string
}): Promise<PiezaTipo[]> {
  const { data } = await api.get('/api/admin/piezas-tipo/', {
    params: {
      ...(params.q ? { q: params.q } : {}),
      ...(params.categoria ? { categoria: params.categoria } : {}),
      ...(params.activo ? { activo: params.activo } : {}),
      ...(params.ordering ? { ordering: params.ordering } : {}),
    },
  })
  // Puede venir paginado o lista directa
  return Array.isArray(data) ? data : (data?.results ?? [])
}

async function crearPiezaTipo(payload: Omit<FormState, 'id'>): Promise<PiezaTipo> {
  const { data } = await api.post('/api/admin/piezas-tipo/', payload)
  return data
}

async function actualizarPiezaTipo(id: number, payload: Partial<FormState>): Promise<PiezaTipo> {
  const { data } = await api.patch(`/api/admin/piezas-tipo/${id}/`, payload)
  return data
}

async function borrarPiezaTipo(id: number): Promise<void> {
  await api.delete(`/api/admin/piezas-tipo/${id}/`)
}

/* ==========================
 * Diálogo Crear/Editar
 * ========================== */
function DialogoPiezaTipo({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean
  onClose: () => void
  initial: FormState
  onSave: (draft: FormState) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState<FormState>(initial)

  React.useEffect(() => {
    setDraft(initial)
  }, [initial])

  const handleChange = (field: keyof FormState, value: any) => {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{draft?.id ? 'Editar tipo de pieza' : 'Nuevo tipo de pieza'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} mt={0.5}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Nombre"
              value={draft.nombre ?? ''}
              onChange={(e) => handleChange('nombre', e.target.value)}
              required
              fullWidth
              autoFocus
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              select
              label="Categoría (familia)"
              value={draft.categoria ?? ''}
              onChange={(e) => handleChange('categoria', e.target.value || '')}
              fullWidth
              helperText="Usa la familia del dispositivo (iPhone, iPad, Mac, Apple Watch, AirPods, Otros)"
            >
              <MenuItem value="">(sin categoría)</MenuItem>
              {CATEGORIAS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!draft.activo}
                  onChange={(e) => handleChange('activo', e.target.checked)}
                />
              }
              label="Activo"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button startIcon={<CloseIcon />} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          startIcon={<SaveIcon />}
          onClick={() =>
            onSave({
              id: draft.id,
              nombre: (draft.nombre || '').trim(),
              categoria: draft.categoria || '',
              activo: !!draft.activo,
            })
          }
          variant="contained"
          disabled={saving || !draft?.nombre?.trim()}
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/* ==========================
 * Principal
 * ========================== */
export default function AdminPiezasTipo() {
  const qc = useQueryClient()

  // filtros
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<CategoriaOption>('')
  const [activoFilter, setActivoFilter] = useState<'all' | '1' | '0'>('all')

  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({
    open: false,
    msg: '',
    sev: 'success',
  })

  const debounced = useMemo(
    () =>
      debounce((val: string) => {
        setInnerSearch(val)
      }, 300),
    []
  )

  const [innerSearch, setInnerSearch] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['piezas-tipo', innerSearch, categoria, activoFilter],
    queryFn: () =>
      listarPiezasTipo({
        q: innerSearch || undefined,
        categoria: categoria || undefined,
        activo: activoFilter === 'all' ? undefined : activoFilter,
        ordering: 'nombre',
      }),
    placeholderData: keepPreviousData,
  })

  const rows = data ?? []

  /* Crear / Editar */
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FormState | null>(null)

  const crearMut = useMutation({
    mutationFn: (payload: Omit<FormState, 'id'>) => crearPiezaTipo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piezas-tipo'] })
      setSnack({ open: true, msg: 'Tipo de pieza creado', sev: 'success' })
      setDialogOpen(false)
    },
    onError: (e: any) =>
      setSnack({
        open: true,
        msg: e?.response?.data?.detail || e?.message || 'Error al crear',
        sev: 'error',
      }),
  })

  const actualizarMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<FormState> }) =>
      actualizarPiezaTipo(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piezas-tipo'] })
      setSnack({ open: true, msg: 'Tipo de pieza actualizado', sev: 'success' })
      setDialogOpen(false)
    },
    onError: (e: any) =>
      setSnack({
        open: true,
        msg: e?.response?.data?.detail || e?.message || 'Error al actualizar',
        sev: 'error',
      }),
  })

  const borrarMut = useMutation({
    mutationFn: (id: number) => borrarPiezaTipo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piezas-tipo'] })
      setSnack({ open: true, msg: 'Tipo de pieza eliminado', sev: 'success' })
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 409
          ? 'No se puede borrar: este tipo de pieza está en uso por costes.'
          : e?.response?.data?.detail || e?.message || 'Error al eliminar'
      setSnack({ open: true, msg, sev: 'error' })
    },
  })

  const toggleActivoMut = useMutation({
    mutationFn: ({ id, next }: { id: number; next: boolean }) =>
      actualizarPiezaTipo(id, { activo: next }),
    // Update optimista
    onMutate: async ({ id, next }) => {
      await qc.cancelQueries({ queryKey: ['piezas-tipo'] })
      const prev = qc.getQueryData<PiezaTipo[]>(['piezas-tipo', innerSearch, categoria, activoFilter])
      if (prev) {
        qc.setQueryData<PiezaTipo[]>(
          ['piezas-tipo', innerSearch, categoria, activoFilter],
          prev.map((t) => (t.id === id ? { ...t, activo: next } : t))
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['piezas-tipo', innerSearch, categoria, activoFilter], ctx.prev)
      setSnack({ open: true, msg: 'No se pudo cambiar el estado', sev: 'error' })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['piezas-tipo'] })
    },
  })

  const baseNuevo: FormState = {
    nombre: '',
    categoria: '',
    activo: true,
  }

  return (
    <Box>
      {/* Encabezado */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={2}>
        <Typography variant="h5">Tipos de pieza</Typography>
        <Stack direction="row" gap={1}>
          <Tooltip title="Refrescar">
            <span>
              <IconButton onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <CircularProgress size={22} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(baseNuevo)
              setDialogOpen(true)
            }}
          >
            Nuevo
          </Button>
        </Stack>
      </Stack>

      {/* Filtros */}
      <Paper variant="outlined">
        <Box p={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Buscar"
                placeholder="Nombre o categoría…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  debounced(e.target.value)
                }}
                fullWidth
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Categoría"
                value={categoria}
                onChange={(e) => setCategoria((e.target.value as CategoriaOption) || '')}
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {CATEGORIAS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Estado"
                value={activoFilter}
                onChange={(e) => setActivoFilter(e.target.value as 'all' | '1' | '0')}
                fullWidth
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="1">Activos</MenuItem>
                <MenuItem value="0">Inactivos</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Tabla */}
        <Box p={2} sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell align="center">Activo</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{t.nombre}</Typography>
                  </TableCell>
                  <TableCell>
                    {t.categoria ? <Chip size="small" label={t.categoria} /> : <em>-</em>}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={!!t.activo}
                      onChange={(e) => toggleActivoMut.mutate({ id: t.id, next: e.target.checked })}
                      inputProps={{ 'aria-label': 'Activo' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditing({
                              id: t.id,
                              nombre: t.nombre,
                              categoria: t.categoria ?? '',
                              activo: !!t.activo,
                            })
                            setDialogOpen(true)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (confirm(`¿Eliminar "${t.nombre}"?`)) {
                              borrarMut.mutate(t.id)
                            }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {(!rows || rows.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary" align="center" py={3}>
                      No hay tipos de pieza {innerSearch ? `para “${innerSearch}”` : ''}.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Diálogo */}
      {dialogOpen && (
        <DialogoPiezaTipo
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initial={editing ?? baseNuevo}
          saving={crearMut.isPending || actualizarMut.isPending}
          onSave={(draft) => {
            const payload: FormState = {
              nombre: (draft.nombre || '').trim(),
              categoria: draft.categoria || '',
              activo: !!draft.activo,
            }
            if (draft.id) {
              actualizarMut.mutate({ id: draft.id, payload })
            } else {
              crearMut.mutate(payload)
            }
          }}
        />
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.sev}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
