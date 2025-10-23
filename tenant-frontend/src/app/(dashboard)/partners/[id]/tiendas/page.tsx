"use client"

import { useMemo, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import {
  Box, Card, CardContent, Typography, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, TextField, Select, MenuItem, Chip, IconButton,
  Avatar, Stack, Alert, CircularProgress, CardHeader, CardActions,
  Menu, OutlinedInput, InputLabel
} from "@mui/material"
import StoreIcon from "@mui/icons-material/Store"
import PersonIcon from "@mui/icons-material/Person"
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings"
import LocationOnIcon from "@mui/icons-material/LocationOn"
import AddIcon from "@mui/icons-material/Add"
import EditIcon from "@mui/icons-material/Edit"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CancelIcon from "@mui/icons-material/Cancel"
import DeleteIcon from "@mui/icons-material/Delete"
import ToggleOffIcon from "@mui/icons-material/ToggleOff"
import ToggleOnIcon from "@mui/icons-material/ToggleOn"
import MoreVertIcon from "@mui/icons-material/MoreVert"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/services/api"
import { toast } from 'react-toastify'
import { UserEditDialog } from '@/features/users/components/UserEditDialog'
import { useCreateUser } from '@/features/users/hooks/useGlobalUsers'
import type { UserApiResponse } from '@/features/users/types'
import ValidatingTextField from '@/shared/components/forms/inputs/ValidatingTextField'

type Tienda = {
  id: number;
  nombre: string;
  direccion_calle?: string;
  direccion_cp?: string;
  direccion_poblacion?: string;
  direccion_provincia?: string;
  direccion_pais?: string;
  responsable?: number | '';
  responsable_nombre?: string;
  responsable_email?: string;
  is_active?: boolean;
};

type UsuarioTenant = {
  id: number;
  name: string;
  email: string;
  rol_lectura: 'manager' | 'empleado' | string;
  is_active: boolean;
  tienda_id_lectura?: number | null;
};

export default function TiendasPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawSchema = searchParams?.get("schema") || ""
  const schema = useMemo(() => {
    const trimmed = rawSchema?.trim()
    if (trimmed) return trimmed
    return params?.id || undefined
  }, [rawSchema, params?.id])
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalEditarTienda, setModalEditarTienda] = useState(false)
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState<Tienda | null>(null)
  const [mostrarTodosUsuarios, setMostrarTodosUsuarios] = useState(false)

  const [nuevaTienda, setNuevaTienda] = useState({
    nombre: "", direccion_calle: "", direccion_cp: "", direccion_poblacion: "",
    direccion_provincia: "", direccion_pais: "", responsable: "" as number | ''
  })

  const [tiendaEditando, setTiendaEditando] = useState({
    nombre: "", direccion_calle: "", direccion_cp: "", direccion_poblacion: "",
    direccion_provincia: "", direccion_pais: "", responsable: "" as number | ''
  })

  const [usuarioEditando, setUsuarioEditando] = useState<UserApiResponse | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({
    name: '',
    email: '',
    password: '',
    rol: 'comercial',
    tienda_id: null as number | null,
    managed_store_ids: [] as number[],
  })
  const [emailValido, setEmailValido] = useState(true)

  // Estados para confirmación de contraseña
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    open: boolean;
    action: 'delete' | 'disable' | 'enable' | null;
    tienda: Tienda | null;
  }>({ open: false, action: null, tienda: null })
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("")

  // Estado para menú contextual
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [tiendaMenuActual, setTiendaMenuActual] = useState<Tienda | null>(null)

  // --- Queries ---
  const { data: tiendas = [], isLoading: loadingTiendas } = useQuery({
    queryKey: ["tiendas", schema],
    enabled: !!schema,
    queryFn: async () => {
      const { data } = await api.get<Tienda[]>("/api/tiendas/", { params: { schema } })
      return data
    },
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuariosTenant", schema],
    enabled: !!schema,
    queryFn: async () => {
      const { data } = await api.get<UsuarioTenant[]>("/api/usuarios-tenant/", { params: { schema } })
      return data
    },
  })

  const tiendaId = tiendaSeleccionada?.id
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["tiendaKpis", schema, tiendaId],
    enabled: !!schema && !!tiendaId,
    queryFn: async () => {
      const { data } = await api.get(`/api/tiendas/${tiendaId}/kpis/`, { params: { schema } })
      return data
    },
  })

  const usuariosAsignados = (usuarios || []).filter(u => u.tienda_id_lectura === tiendaId)
  const usuariosVisibles = mostrarTodosUsuarios ? usuariosAsignados : usuariosAsignados.slice(0, 5)

  // --- Mutations ---
  const crearTiendaMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/tiendas/", nuevaTienda, { params: { schema } })
      return data as Tienda
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tiendas", schema] })
      setModalOpen(false)
      setNuevaTienda({
        nombre: "", direccion_calle: "", direccion_cp: "", direccion_poblacion: "",
        direccion_provincia: "", direccion_pais: "", responsable: ""
      })
      toast.success('Tienda creada correctamente')
    },
    onError: () => {
      toast.error('Error al crear la tienda')
    },
  })

  const editarTiendaMutation = useMutation({
    mutationFn: async () => {
      if (!tiendaSeleccionada) return
      const { data } = await api.patch(`/api/tiendas/${tiendaSeleccionada.id}/`, tiendaEditando, { params: { schema } })
      return data as Tienda
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tiendas", schema] })
      setModalEditarTienda(false)
      toast.success('Tienda actualizada correctamente')
    },
    onError: () => {
      toast.error('Error al actualizar la tienda')
    },
  })

  const createUserMutation = useCreateUser(schema)

  // Handler for edit user
  const handleEditUser = (user: UserApiResponse) => {
    setUsuarioEditando(user)
    setEditDialogOpen(true)
  }

  // Handler for close edit dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setUsuarioEditando(null)
  }

  // Handler for edit tienda
  const handleEditarTienda = () => {
    // Use tiendaMenuActual if available (from context menu), otherwise use tiendaSeleccionada
    const tienda = tiendaMenuActual || tiendaSeleccionada
    if (!tienda) return

    setTiendaSeleccionada(tienda)
    setTiendaEditando({
      nombre: tienda.nombre || '',
      direccion_calle: tienda.direccion_calle || '',
      direccion_cp: tienda.direccion_cp || '',
      direccion_poblacion: tienda.direccion_poblacion || '',
      direccion_provincia: tienda.direccion_provincia || '',
      direccion_pais: tienda.direccion_pais || '',
      responsable: tienda.responsable || '',
    })
    setModalEditarTienda(true)
  }

  // Handler for create user
  const handleCreateUser = () => {
    if (!emailValido || !nuevoUsuario.name.trim() || !nuevoUsuario.email.trim() || !nuevoUsuario.password.trim()) {
      return
    }

    // Set tienda_id to the current selected tienda (only for non-managers)
    const userData = {
      ...nuevoUsuario,
      tienda_id: nuevoUsuario.rol === 'manager' ? null : (tiendaSeleccionada?.id || null),
    }

    createUserMutation.mutate(userData, {
      onSuccess: () => {
        setCreateUserDialogOpen(false)
        setNuevoUsuario({
          name: '',
          email: '',
          password: '',
          rol: 'comercial',
          tienda_id: null,
          managed_store_ids: [],
        })
        setEmailValido(true)
      },
    })
  }

  const eliminarTiendaMutation = useMutation({
    mutationFn: async ({ tiendaId, password }: { tiendaId: number; password: string }) => {
      await api.delete(`/api/tiendas/${tiendaId}/`, {
        params: { schema },
        data: { password }
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tiendas", schema] })
      setModalConfirmacion({ open: false, action: null, tienda: null })
      setPasswordConfirmacion("")
      toast.success('Tienda eliminada correctamente')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string; message?: string; usuarios_asignados?: string[] } } }
      const data = err?.response?.data

      if (data?.usuarios_asignados && data.usuarios_asignados.length > 0) {
        // Mostrar mensaje detallado con lista de usuarios
        const usuariosList = data.usuarios_asignados.join('\n• ')
        toast.error(
          `${data.detail || 'No se puede eliminar la tienda'}\n\nUsuarios asignados:\n• ${usuariosList}`,
          { autoClose: 8000 }
        )
      } else {
        const mensaje = data?.detail || data?.message || 'Error al eliminar la tienda'
        toast.error(mensaje)
      }
    },
  })

  const toggleTiendaMutation = useMutation({
    mutationFn: async ({ tiendaId, isActive }: { tiendaId: number; isActive: boolean }) => {
      const { data } = await api.patch(`/api/tiendas/${tiendaId}/`, { is_active: isActive }, {
        params: { schema }
      })
      return data as Tienda
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tiendas", schema] })
      setModalConfirmacion({ open: false, action: null, tienda: null })
      setPasswordConfirmacion("")
      const accion = variables.isActive ? 'habilitada' : 'deshabilitada'
      toast.success(`Tienda ${accion} correctamente`)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      const mensaje = err?.response?.data?.detail || 'Error al cambiar estado de la tienda'
      toast.error(mensaje)
    },
  })

  // --- Handlers ---
  const handleSeleccionarTienda = (tienda: Tienda) => {
    setTiendaSeleccionada(tienda)
    setMostrarTodosUsuarios(false)
  }


  const handleConfirmarAccion = async () => {
    if (!modalConfirmacion.tienda) return

    if (modalConfirmacion.action === 'delete') {
      if (!passwordConfirmacion) {
        toast.error('Debe ingresar su contraseña')
        return
      }
      await eliminarTiendaMutation.mutateAsync({
        tiendaId: modalConfirmacion.tienda.id,
        password: passwordConfirmacion
      })
    } else if (modalConfirmacion.action === 'enable' || modalConfirmacion.action === 'disable') {
      await toggleTiendaMutation.mutateAsync({
        tiendaId: modalConfirmacion.tienda.id,
        isActive: modalConfirmacion.action === 'enable'
      })
    }
  }

  const handleAbrirMenu = (event: React.MouseEvent<HTMLElement>, tienda: Tienda) => {
    event.stopPropagation()
    setMenuAnchor(event.currentTarget)
    setTiendaMenuActual(tienda)
  }

  const handleCerrarMenu = () => {
    setMenuAnchor(null)
    setTiendaMenuActual(null)
  }

  const handleAccionMenu = (action: 'delete' | 'disable' | 'enable') => {
    if (!tiendaMenuActual) return
    setModalConfirmacion({ open: true, action, tienda: tiendaMenuActual })
    handleCerrarMenu()
  }

  if (!schema) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Falta el schema en la URL: /partners/&lt;schema&gt;/tiendas
      </Alert>
    )
  }

  if (loadingTiendas) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => router.back()}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" gutterBottom>
              Tiendas del Partner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Schema: {schema} • {tiendas.length} tiendas
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setModalOpen(true)}
          size="large"
        >
          Nueva Tienda
        </Button>
      </Box>

      {tiendas.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6 }}>
          <CardContent>
            <Avatar sx={{ bgcolor: 'grey.100', width: 80, height: 80, mx: 'auto', mb: 2 }}>
              <StoreIcon sx={{ fontSize: 40, color: 'grey.400' }} />
            </Avatar>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No hay tiendas registradas
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Crea la primera tienda para este partner
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setModalOpen(true)}
            >
              Crear Primera Tienda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {tiendas.map(tienda => {
            const usuariosEnTienda = usuarios.filter(u => u.tienda_id_lectura === tienda.id)
            return (
              <Grid key={tienda.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  onClick={() => handleSeleccionarTienda(tienda)}
                  sx={{
                    cursor: "pointer",
                    height: "100%",
                    transition: 'all 0.2s',
                    opacity: tienda.is_active === false ? 0.6 : 1,
                    filter: tienda.is_active === false ? 'grayscale(30%)' : 'none',
                    border: tienda.is_active === false ? '2px dashed' : '1px solid',
                    borderColor: tienda.is_active === false ? 'error.main' : 'divider',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                      opacity: tienda.is_active === false ? 0.8 : 1
                    }
                  }}
                >
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: tienda.is_active === false ? 'grey.400' : 'primary.main' }}>
                        <StoreIcon />
                      </Avatar>
                    }
                    title={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="h6"
                          sx={{
                            textDecoration: tienda.is_active === false ? 'line-through' : 'none',
                            color: tienda.is_active === false ? 'text.disabled' : 'text.primary'
                          }}
                        >
                          {tienda.nombre}
                        </Typography>
                        {tienda.is_active === false && (
                          <Chip
                            label="Inactiva"
                            size="small"
                            color="error"
                            variant="filled"
                            icon={<CancelIcon />}
                          />
                        )}
                      </Stack>
                    }
                    subheader={`${usuariosEnTienda.length} usuarios asignados`}
                    action={
                      <IconButton
                        onClick={(e) => handleAbrirMenu(e, tienda)}
                        aria-label="opciones"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    }
                  />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <LocationOnIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                          <Typography variant="body2" color="text.secondary">
                            {tienda.direccion_calle && `${tienda.direccion_calle}, `}
                            {tienda.direccion_cp && `${tienda.direccion_cp} `}
                            {tienda.direccion_poblacion}
                            {tienda.direccion_provincia && `, ${tienda.direccion_provincia}`}
                            {tienda.direccion_pais && `, ${tienda.direccion_pais}`}
                          </Typography>
                        </Stack>
                      </Box>

                      {tienda.responsable_nombre && (
                        <Box>
                          <Typography variant="subtitle2" color="primary" gutterBottom>
                            Responsable
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PersonIcon fontSize="small" color="action" />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {tienda.responsable_nombre}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {tienda.responsable_email}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button size="small" fullWidth>
                      Ver Usuarios ({usuariosEnTienda.length})
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Modal nueva tienda */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva tienda</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" fullWidth margin="dense" value={nuevaTienda.nombre}
            onChange={e => setNuevaTienda({ ...nuevaTienda, nombre: e.target.value })} />
          <TextField label="Calle" fullWidth margin="dense" value={nuevaTienda.direccion_calle}
            onChange={e => setNuevaTienda({ ...nuevaTienda, direccion_calle: e.target.value })} />
          <TextField label="Código Postal" fullWidth margin="dense" value={nuevaTienda.direccion_cp}
            onChange={e => setNuevaTienda({ ...nuevaTienda, direccion_cp: e.target.value })} />
          <TextField label="Población" fullWidth margin="dense" value={nuevaTienda.direccion_poblacion}
            onChange={e => setNuevaTienda({ ...nuevaTienda, direccion_poblacion: e.target.value })} />
          <TextField label="Provincia" fullWidth margin="dense" value={nuevaTienda.direccion_provincia}
            onChange={e => setNuevaTienda({ ...nuevaTienda, direccion_provincia: e.target.value })} />
          <TextField label="País" fullWidth margin="dense" value={nuevaTienda.direccion_pais}
            onChange={e => setNuevaTienda({ ...nuevaTienda, direccion_pais: e.target.value })} />
          <FormControl fullWidth margin="dense" size="small">
            <Select
              value={nuevaTienda.responsable}
              onChange={(e) => setNuevaTienda({ ...nuevaTienda, responsable: e.target.value as number | '' })}
              displayEmpty
            >
              <MenuItem value="">Sin responsable</MenuItem>
              {usuarios.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => crearTiendaMutation.mutate()}
            disabled={crearTiendaMutation.isPending || !schema || !nuevaTienda.nombre.trim()}
          >
            {crearTiendaMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de detalles de tienda */}
      <Dialog
        open={!!tiendaSeleccionada}
        onClose={() => {
          setTiendaSeleccionada(null)
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Usuarios asignados: {tiendaSeleccionada?.nombre}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateUserDialogOpen(true)}
            >
              Crear Usuario
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {/* KPIs opcionales */}
          {loadingKpis ? (
            <Typography variant="body2" color="text.secondary">Cargando KPIs…</Typography>
          ) : kpis ? (
            <Box mb={2}>
              {/* Render rápido; adáptalo a tus componentes de KPI */}
              <Typography variant="subtitle2">KPIs</Typography>
              <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(kpis, null, 2)}</pre>
            </Box>
          ) : null}

          {/* Toggle ver todos */}
          {usuariosAsignados.length > 5 && (
            <Box mb={1}>
              <Button size="small" onClick={() => setMostrarTodosUsuarios(v => !v)}>
                {mostrarTodosUsuarios ? "Ver menos" : `Ver todos (${usuariosAsignados.length})`}
              </Button>
            </Box>
          )}

          {usuariosVisibles.map((u) => (
            <Card
              key={u.id}
              variant="outlined"
              sx={{
                mb: 2,
                transition: "all 0.2s",
                "&:hover": { boxShadow: 2 }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: u.rol_lectura === 'manager' ? 'primary.main' : 'grey.400' }}>
                      {u.rol_lectura === 'manager' ? <AdminPanelSettingsIcon /> : <PersonIcon />}
                    </Avatar>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1" fontWeight={500}>{u.name}</Typography>
                        <Chip
                          size="small"
                          label={u.rol_lectura}
                          color={u.rol_lectura === "manager" ? "primary" : "default"}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          icon={u.is_active ? <CheckCircleIcon /> : <CancelIcon />}
                          label={u.is_active ? "Activo" : "Inactivo"}
                          color={u.is_active ? "success" : "error"}
                          variant="outlined"
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                    </Box>
                  </Stack>

                  <IconButton
                    onClick={() => handleEditUser(u as UserApiResponse)}
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTiendaSeleccionada(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal editar usuario */}
      <UserEditDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        user={usuarioEditando}
        tenantSlug={schema}
      />

      {/* Modal editar tienda */}
      <Dialog open={modalEditarTienda} onClose={() => setModalEditarTienda(false)} fullWidth maxWidth="sm">
        <DialogTitle>Editar tienda</DialogTitle>
        <DialogContent>
          <TextField label="Nombre" fullWidth margin="dense" value={tiendaEditando.nombre}
            onChange={e => setTiendaEditando({ ...tiendaEditando, nombre: e.target.value })} />
          <TextField label="Calle" fullWidth margin="dense" value={tiendaEditando.direccion_calle}
            onChange={e => setTiendaEditando({ ...tiendaEditando, direccion_calle: e.target.value })} />
          <TextField label="Código Postal" fullWidth margin="dense" value={tiendaEditando.direccion_cp}
            onChange={e => setTiendaEditando({ ...tiendaEditando, direccion_cp: e.target.value })} />
          <TextField label="Población" fullWidth margin="dense" value={tiendaEditando.direccion_poblacion}
            onChange={e => setTiendaEditando({ ...tiendaEditando, direccion_poblacion: e.target.value })} />
          <TextField label="Provincia" fullWidth margin="dense" value={tiendaEditando.direccion_provincia}
            onChange={e => setTiendaEditando({ ...tiendaEditando, direccion_provincia: e.target.value })} />
          <TextField label="País" fullWidth margin="dense" value={tiendaEditando.direccion_pais}
            onChange={e => setTiendaEditando({ ...tiendaEditando, direccion_pais: e.target.value })} />
          <FormControl fullWidth margin="dense" size="small">
            <Select
              value={tiendaEditando.responsable}
              onChange={(e) => setTiendaEditando({ ...tiendaEditando, responsable: e.target.value as number | '' })}
              displayEmpty
            >
              <MenuItem value="">Sin responsable</MenuItem>
              {usuarios.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalEditarTienda(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => editarTiendaMutation.mutate()}
            disabled={editarTiendaMutation.isPending || !schema || !tiendaEditando.nombre.trim()}
          >
            {editarTiendaMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal crear usuario */}
      <Dialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={nuevoUsuario.name}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, name: e.target.value })}
            size="small"
            fullWidth
          />
          <ValidatingTextField
            label="Email"
            value={nuevoUsuario.email}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
            kind="email"
            type="email"
            required
            size="small"
            fullWidth
            validateOnChange
            onValidChange={(isValid) => setEmailValido(isValid)}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="nuevo-rol-tienda">Rol</InputLabel>
            <Select
              labelId="nuevo-rol-tienda"
              label="Rol"
              value={nuevoUsuario.rol}
              onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
            >
              <MenuItem value="comercial">Comercial</MenuItem>
              <MenuItem value="store_manager">Store Manager</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </Select>
          </FormControl>

          {nuevoUsuario.rol === 'manager' && (
            <FormControl fullWidth size="small">
              <InputLabel id="nuevo-managed-stores-tienda">Tiendas gestionadas</InputLabel>
              <Select
                labelId="nuevo-managed-stores-tienda"
                label="Tiendas gestionadas"
                multiple
                value={nuevoUsuario.managed_store_ids}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, managed_store_ids: typeof e.target.value === 'string' ? [] : e.target.value })}
                input={<OutlinedInput label="Tiendas gestionadas" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((storeId) => {
                      const tienda = tiendas.find((t) => t.id === storeId)
                      return (
                        <Chip
                          key={storeId}
                          label={tienda?.nombre || `ID: ${storeId}`}
                          size="small"
                        />
                      )
                    })}
                  </Box>
                )}
              >
                {tiendas.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Contraseña"
            type="password"
            value={nuevoUsuario.password}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
            size="small"
            fullWidth
          />
          {nuevoUsuario.rol !== 'manager' && (
            <Alert severity="info">
              El usuario será asignado automáticamente a la tienda: <strong>{tiendaSeleccionada?.nombre}</strong>
            </Alert>
          )}
          {nuevoUsuario.rol === 'manager' && (
            <Alert severity="info">
              Los managers pueden gestionar múltiples tiendas. Selecciona las tiendas que gestionará este usuario.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={!nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password || !emailValido || createUserMutation.isPending}
          >
            {createUserMutation.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menú contextual de tienda */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCerrarMenu}
      >
        <MenuItem onClick={() => {
          handleEditarTienda()
          handleCerrarMenu()
        }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Editar tienda
        </MenuItem>
        {tiendaMenuActual?.is_active !== false ? (
          <MenuItem onClick={() => handleAccionMenu('disable')}>
            <ToggleOffIcon fontSize="small" sx={{ mr: 1 }} />
            Deshabilitar tienda
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleAccionMenu('enable')}>
            <ToggleOnIcon fontSize="small" sx={{ mr: 1 }} />
            Habilitar tienda
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAccionMenu('delete')} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Eliminar tienda
        </MenuItem>
      </Menu>

      {/* Modal de confirmación de contraseña */}
      <Dialog
        open={modalConfirmacion.open}
        onClose={() => {
          setModalConfirmacion({ open: false, action: null, tienda: null })
          setPasswordConfirmacion("")
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {modalConfirmacion.action === 'delete' && 'Confirmar eliminación'}
          {modalConfirmacion.action === 'disable' && 'Confirmar deshabilitación'}
          {modalConfirmacion.action === 'enable' && 'Confirmar habilitación'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {modalConfirmacion.action === 'delete' &&
              `¿Está seguro que desea eliminar la tienda "${modalConfirmacion.tienda?.nombre}"? Esta acción no se puede deshacer.`}
            {modalConfirmacion.action === 'disable' &&
              `¿Está seguro que desea deshabilitar la tienda "${modalConfirmacion.tienda?.nombre}"?`}
            {modalConfirmacion.action === 'enable' &&
              `¿Está seguro que desea habilitar la tienda "${modalConfirmacion.tienda?.nombre}"?`}
          </Typography>
          {modalConfirmacion.action === 'delete' && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Por seguridad, ingrese su contraseña para confirmar la eliminación.
              </Alert>
              <TextField
                label="Contraseña"
                type="password"
                fullWidth
                value={passwordConfirmacion}
                onChange={(e) => setPasswordConfirmacion(e.target.value)}
                autoFocus
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setModalConfirmacion({ open: false, action: null, tienda: null })
              setPasswordConfirmacion("")
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={modalConfirmacion.action === 'delete' ? 'error' : 'primary'}
            onClick={handleConfirmarAccion}
            disabled={
              eliminarTiendaMutation.isPending ||
              toggleTiendaMutation.isPending ||
              (modalConfirmacion.action === 'delete' && !passwordConfirmacion)
            }
          >
            {(eliminarTiendaMutation.isPending || toggleTiendaMutation.isPending) ? 'Procesando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
