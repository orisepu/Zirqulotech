'use client'

import React, { useMemo, useState, type ChangeEvent } from 'react'
import { Grid, Paper, Stack, TextField, Select, MenuItem, Tooltip, IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, InputLabel, FormControl, Typography, Alert, Snackbar } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import api, { getAccessToken } from '@/services/api'
import TablaReactiva from '@/components/TablaReactiva2'
import type { CapacidadRow } from '@/components/TablaColumnas2'
import { columnasCapacidadesAdmin } from '@/components/TablaColumnas2'

// ===== API helpers =====
export type CapacidadesParams = {
  q?: string
  modelo_id?: string | number
  tipo?: string
  fecha?: string // ISO
  ordering?: string
  page?: number | string
  page_size?: number | string
}

async function fetchCapacidades(params: CapacidadesParams) {
  const { data } = await api.get('/api/admin/capacidades/', { params })
  return data as { results: CapacidadRow[]; count: number } | CapacidadRow[]
}

async function postSetPrecio(body: { capacidad_id: number; canal: 'B2B' | 'B2C'; precio_neto: string; effective_at?: string }) {
  const { data } = await api.post('/api/admin/precios/set/', body)
  return data
}

export default function AdminCapacidadesTablaReactiva() {
  // Filtros
  const [q, setQ] = useState('')
  const [modeloId, setModeloId] = useState('')
  const [tipo, setTipo] = useState('')
  const [fecha, setFecha] = useState('') // datetime-local

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
  }), [q, modeloId, tipo, fechaISO, ordering, pageIndex, pageSize])

  const canFetch = typeof window !== 'undefined' && !!getAccessToken()

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-capacidades', params],
    queryFn: () => fetchCapacidades(params),
    placeholderData: keepPreviousData,
    enabled: canFetch,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })

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

  // Normaliza payload
  const rows: CapacidadRow[] = useMemo(() => Array.isArray(data) ? data : (data?.results ?? []), [data])
  const totalCount: number | undefined = useMemo(() => Array.isArray(data) ? undefined : data?.count, [data])

  // Set precio dialog
  const [openSetPrice, setOpenSetPrice] = useState(false)
  const [target, setTarget] = useState<CapacidadRow | null>(null)
  const [canal, setCanal] = useState<'B2B' | 'B2C'>('B2B')
  const [precio, setPrecio] = useState('')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const onClickSetPrice = (row: CapacidadRow, canalDefault: 'B2B' | 'B2C') => {
    setTarget(row)
    setCanal(canalDefault)
    setPrecio('')
    setEffectiveAt('')
    setOpenSetPrice(true)
  }

  // Extiende las columnas añadiendo acciones
  const columnas = useMemo(() => {
    const base = [...columnasCapacidadesAdmin]
    base.push({
      id: 'acciones',
      header: 'Acciones',
      meta: { minWidth: 180, align: 'right', alignHeader: 'center', label: 'Acciones' },
      cell: ({ row }) => (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" variant="outlined" startIcon={<PriceChangeIcon />} onClick={() => onClickSetPrice(row.original, 'B2B')}>Set B2B</Button>
          <Button size="small" variant="outlined" startIcon={<PriceChangeIcon />} onClick={() => onClickSetPrice(row.original, 'B2C')}>Set B2C</Button>
        </Stack>
      )
    })
    return base
  }, [])

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
            <Select size="small" value={tipo} onChange={(e) => setTipo(e.target.value)} displayEmpty>
              <MenuItem value=""><em>Tipo (todos)</em></MenuItem>
              <MenuItem value="iPhone">iPhone</MenuItem>
              <MenuItem value="iPad">iPad</MenuItem>
              <MenuItem value="iMac">iMac</MenuItem>
              <MenuItem value="MacBook Air">MacBook Air</MenuItem>
              <MenuItem value="MacBook Pro">MacBook Pro</MenuItem>
              <MenuItem value="Mac Pro">Mac Pro</MenuItem>
              <MenuItem value="Mac Studio">Mac Studio</MenuItem>
              <MenuItem value="Mac mini">Mac Mini</MenuItem>

            </Select>
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

          {isError && (<Alert severity="error" sx={{ mt: 1 }}>{(error as Error)?.message || 'Error cargando datos'}</Alert>)}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 12 }}>
        <Paper style={{ padding: 16 }}>
          <Typography variant="h6" gutterBottom>Consejos</Typography>
          <Typography variant="body2" paragraph>
            • Filtra por modelo/tipo y ajusta la fecha para ver vigencias.
            <br />• Usa “Set B2B/B2C” para cambios inmediatos o programados.
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
              <Select labelId="canal-lbl" label="Canal" value={canal} onChange={(e) => setCanal(e.target.value as 'B2B' | 'B2C')}>
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
  slotProps={{ inputLabel: { shrink: true } }}   // 👈 evita solape
/>          </Stack>
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

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Grid>
  )
}
