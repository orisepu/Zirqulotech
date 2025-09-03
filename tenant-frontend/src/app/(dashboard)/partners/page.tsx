'use client'

import { useRouter } from 'next/navigation'
import api from '@/services/api'
import {
  Typography, Box, Paper, Table, TableHead, TableRow, TextField, Snackbar, Alert,
  TableCell, TableBody, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, Toolbar, InputAdornment, IconButton, Chip, FormControl, InputLabel, Select, MenuItem,
  Divider, TableContainer, Skeleton, ButtonGroup, Tooltip
} from '@mui/material'
import { useQuery, useQueryClient,useMutation } from "@tanstack/react-query"
import { useState, useMemo } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import StoreIcon from '@mui/icons-material/Store'
import GroupIcon from '@mui/icons-material/Group'
import DashboardIcon from '@mui/icons-material/Dashboard'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import { formatoBonito } from '@/context/precios'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'

export default function PartnerListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [nuevoPartner, setNuevoPartner] = useState({
    name: "", schema: "", cif: "",
    direccion_calle: "", direccion_cp: "",
    direccion_poblacion: "", direccion_provincia: "", direccion_pais: "España",
    comision_pct: 10 as number, // % por defecto
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; mensaje: string; tipo?: 'success' | 'error' }>({
    open: false,
    mensaje: '',
    tipo: 'error',
  })
  const formatPct = (n?: number) => {
    if (n === null || n === undefined || Number.isNaN(n)) return '—'
    return `${Number(n).toFixed(1)} %`
  }
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo' | 'pendiente'>('todos')
  const [confirmDelete, setConfirmDelete] = useState<{open: boolean; id?: number; nombre?: string}>({ open: false })

  const { data: partners = [], isLoading, isError } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get('/api/tenants/')
      return res.data
    },
  })
  const filteredPartners = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (partners || [])
      .filter((p: any) => {
        const matchTerm = !term || `${p.nombre ?? ''} ${p.schema ?? ''}`.toLowerCase().includes(term)
        const matchEstado = filtroEstado === 'todos' ? true : (p.estado ?? '').toLowerCase() === filtroEstado
        return matchTerm && matchEstado
      })
  }, [partners, search, filtroEstado])



    const crearPartnerMutation = useMutation({
    mutationFn: async (payload: typeof nuevoPartner) => {
      return api.post("/api/crear-company/", payload)
    },
    onSuccess: async () => {
      setModalOpen(false)
      setNuevoPartner({
        name: "", schema: "", cif: "",
        direccion_calle: "", direccion_cp: "",
        direccion_poblacion: "", direccion_provincia: "", direccion_pais: "España",comision_pct: 10
      })
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setSnackbar({ open: true, mensaje: 'Partner creado correctamente.', tipo: 'success' })
    },
    onError: (err: any) => {
      setSnackbar({
        open: true,
        tipo: 'error',
        mensaje: "Error al crear partner: " + (err?.response?.data?.error || "Error desconocido"),
      })
    }
  })

  const toggleEstadoMutation = useMutation({
    mutationFn: async ({ id, next }: { id: number, next: 'activo' | 'inactivo' }) => {
      return api.patch(`/api/tenants/${id}/`, { estado: next })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: () => setSnackbar({ open: true, tipo: 'error', mensaje: 'No se pudo cambiar el estado.' })
  })

  const deletePartnerMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/tenants/${id}/`),
    onSuccess: async () => {
      setConfirmDelete({ open: false })
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setSnackbar({ open: true, tipo: 'success', mensaje: 'Partner eliminado.' })
    },
    onError: () => setSnackbar({ open: true, tipo: 'error', mensaje: 'No se pudo eliminar el partner.' })
  })

  function slugify(input: string) {
    return input
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 30)
  }

  const estadoChip = (estado?: string) => {
    const e = (estado ?? '').toLowerCase()
    if (e === 'activo') return <Chip size="small" color="success" variant="filled" icon={<CheckCircleOutlineIcon fontSize="small" />}label="Activo" />
    if (e === 'inactivo') return   <Chip size="small" color="default" variant="outlined" icon={<DoNotDisturbOnOutlinedIcon fontSize="small" />} label="Inactivo"/>
    if (e === 'default') return <Chip size="small"color="info"variant="outlined"icon={<StarBorderIcon fontSize="small" />}label="Predeterminado"/>
    if (e === 'autoadmin') return <Chip size="small"color="secondary"variant="outlined"icon={<ManageAccountsOutlinedIcon fontSize="small" />}label="Autogestionado"/>
    return <Chip size="small" color="warning" label={estado || 'Pendiente'} />
  }
  const handleCrearPartner = () => {
    if (!nuevoPartner.name || !nuevoPartner.schema || !nuevoPartner.cif) {
      setSnackbar({ open: true, tipo: 'error', mensaje: 'Nombre, Schema y CIF son obligatorios.' })
      return
    }
    const c = Number(nuevoPartner.comision_pct)
    if (Number.isNaN(c) || c < 0 || c > 100) {
      setSnackbar({ open: true, tipo: 'error', mensaje: 'La comisión debe estar entre 0 y 100.' })
      return
    }
    crearPartnerMutation.mutate(nuevoPartner)
  }

  if (isLoading) {
   return (
     <Stack spacing={2}>
       <Typography variant="h5">Listado de Partners</Typography>
       <Paper sx={{ p: 2 }}>
         <Stack spacing={1}>
           {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={48} />)}
         </Stack>
       </Paper>
     </Stack>
   )
}

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h5">Listado de Partners</Typography>
        <Button variant="contained" onClick={() => setModalOpen(true)}>+ Añadir Partner</Button>
      </Stack>

      <Paper variant="outlined" sx={{ mb: 1 }}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o schema…"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            }}
            sx={{ minWidth: 260 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              label="Estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="activo">Activo</MenuItem>
              <MenuItem value="inactivo">Inactivo</MenuItem>
              <MenuItem value="pendiente">Pendiente</MenuItem>
            </Select>
          </FormControl>
        </Toolbar>
        <Divider />
        <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small" aria-label="tabla-partners">


          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Schema</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Modo</TableCell>
              <TableCell align="right">Tiendas</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(filteredPartners || []).map((p: any) => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }}>
                <TableCell onClick={() => router.push(`/partners/${p.id}`)}>{p.nombre}</TableCell>
                <TableCell onClick={() => router.push(`/partners/${p.id}`)}>{p.schema}</TableCell>
                <TableCell>{estadoChip(p.estado)}</TableCell>
                <TableCell>{estadoChip(formatoBonito(p.modo))}</TableCell>
                <TableCell align="right">{p.tiendas ?? 0}</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                 <ButtonGroup size="small" variant="text">
                   <Tooltip title="Ver ficha">
                     <IconButton onClick={() => router.push(`/partners/${p.schema}`)}><VisibilityIcon fontSize="small" /></IconButton>
                   </Tooltip>
                   <Tooltip title="Tiendas">
                     <IconButton onClick={() => router.push(`/partners/${p.schema}/tiendas`)}><StoreIcon fontSize="small" /></IconButton>
                   </Tooltip>
                   <Tooltip title="Usuarios">
                     <IconButton onClick={() => router.push(`/partners/${p.schema}/usuarios`)}><GroupIcon fontSize="small" /></IconButton>
                   </Tooltip>
                   <Tooltip title="Dashboard">
                     <IconButton onClick={() => router.push(`/partners/${p.schema}/dashboard`)}><DashboardIcon fontSize="small" /></IconButton>
                   </Tooltip>
                   <Tooltip title={ (p.estado ?? '').toLowerCase() === 'activo' ? 'Desactivar' : 'Activar' }>
                     <IconButton
                       onClick={() => {
                         const next = ((p.estado ?? '').toLowerCase() === 'activo') ? 'inactivo' : 'activo'
                         toggleEstadoMutation.mutate({ id: p.id, next })
                       }}
                     >
                       <PowerSettingsNewIcon fontSize="small" />
                     </IconButton>
                   </Tooltip>
                   
                 </ButtonGroup>
               </TableCell>
              </TableRow>
            ))}
            {(!isLoading && filteredPartners.length === 0) && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Box py={4} textAlign="center">
                    <Typography variant="body2">No hay resultados con esos filtros.</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </Paper>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear nuevo Partner</DialogTitle>
        <DialogContent>
          <TextField label="Nombre *" fullWidth margin="dense"
            value={nuevoPartner.name}
            onChange={e => {
              const name = e.target.value
              setNuevoPartner(prev => ({ ...prev, name, schema: prev.schema || slugify(name) }))
            }}
          />
          <TextField label="Schema *" fullWidth margin="dense" helperText="Minúsculas, sin espacios ni acentos. Puedes editarlo."
            value={nuevoPartner.schema}
            onChange={e => setNuevoPartner({ ...nuevoPartner, schema: e.target.value })}
          />
          <TextField label="CIF *" fullWidth margin="dense"
            value={nuevoPartner.cif}
            onChange={e => setNuevoPartner({ ...nuevoPartner, cif: (e.target.value || '').toUpperCase() })}
          />
          <TextField label="Comisión (%)" type="number" inputProps={{ step: 0.1, min: 0, max: 100 }}
            fullWidth margin="dense"
            value={nuevoPartner.comision_pct}
            onChange={e => setNuevoPartner({ ...nuevoPartner, comision_pct: Number(e.target.value) })}
            helperText="Porcentaje aplicado a este partner. Ej.: 10 = 10%."
          />
          <TextField label="Calle" fullWidth margin="dense"
            value={nuevoPartner.direccion_calle}
            onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_calle: e.target.value })}
          />
          <TextField label="Código Postal" fullWidth margin="dense"
            value={nuevoPartner.direccion_cp}
            onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_cp: e.target.value })}
          />
          <TextField label="Población" fullWidth margin="dense"
            value={nuevoPartner.direccion_poblacion}
            onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_poblacion: e.target.value })}
          />
          <TextField label="Provincia" fullWidth margin="dense"
            value={nuevoPartner.direccion_provincia}
            onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_provincia: e.target.value })}
          />
          <TextField label="País" fullWidth margin="dense"
            value={nuevoPartner.direccion_pais}
            onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_pais: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleCrearPartner}
            disabled={crearPartnerMutation.isPending}
          >
            {crearPartnerMutation.isPending ? 'Creando…' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.tipo || 'error'}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.mensaje}
        </Alert>
      </Snackbar>
    </Box>
  )
}
