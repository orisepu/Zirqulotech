"use client"

import { useMemo, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import {
  Box, Card, CardContent, Typography, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, TextField, Select, MenuItem, Chip, IconButton,
  Avatar, Stack, Alert, CircularProgress, CardHeader, CardActions
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/services/api"
import { toast } from 'react-toastify'

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
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState<Tienda | null>(null)
  const [mostrarTodosUsuarios, setMostrarTodosUsuarios] = useState(false)

  const [nuevaTienda, setNuevaTienda] = useState({
    nombre: "", direccion_calle: "", direccion_cp: "", direccion_poblacion: "",
    direccion_provincia: "", direccion_pais: "", responsable: "" as number | '' 
  })

  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioTenant | null>(null)
  const [contrasenaEditando, setContrasenaEditando] = useState("")

  // --- Queries ---
  const { data: tiendas = [], isLoading: loadingTiendas } = useQuery({
    queryKey: ["tiendas", schema],
    enabled: !!schema,
    queryFn: async () => {
      const { data } = await api.get<Tienda[]>("/api/tiendas/", { params: { schema } })
      return data
    },
  })

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
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

  const updateUserMutation = useMutation({
    // Patch rol/activo y, si hay contraseña, también la cambia
    mutationFn: async (payload: {
      user: UsuarioTenant,
      newPassword?: string
    }) => {
      const { user, newPassword } = payload
      const { id, is_active, rol_lectura } = user

      if (newPassword) {
        await api.post("/api/cambiar-password/", {
          user_id: id,
          new_password: newPassword,
        })
      }

      const patchData: { is_active: boolean; rol?: string } = { is_active }
      if (rol_lectura) patchData.rol = rol_lectura

      const { data } = await api.patch(`/api/usuarios-tenant/${id}/`, patchData, {
        params: { schema },
      })
      return data as UsuarioTenant
    },
    onMutate: async ({ user }) => {
      // Optimistic update en cache de usuarios
      await qc.cancelQueries({ queryKey: ["usuariosTenant", schema] })
      const prev = qc.getQueryData<UsuarioTenant[]>(["usuariosTenant", schema]) || []
      const updated = prev.map(u => (u.id === user.id ? { ...u, ...user } : u))
      qc.setQueryData(["usuariosTenant", schema], updated)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["usuariosTenant", schema], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["usuariosTenant", schema] })
    },
  })

  // --- Handlers ---
  const handleSeleccionarTienda = (tienda: Tienda) => {
    setTiendaSeleccionada(tienda)
    setMostrarTodosUsuarios(false)
  }

  const handleGuardarUsuario = async () => {
    if (!usuarioEditando) return
    try {
      await updateUserMutation.mutateAsync({
        user: usuarioEditando,
        newPassword: contrasenaEditando || undefined,
      })
      setUsuarioEditando(null)
      setContrasenaEditando("")
      toast.success('Usuario actualizado correctamente')
    } catch (e) {
      console.error(e)
      toast.error('Error al actualizar el usuario')
    }
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
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardHeader
                    avatar={
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <StoreIcon />
                      </Avatar>
                    }
                    title={tienda.nombre}
                    subheader={`${usuariosEnTienda.length} usuarios asignados`}
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
          Usuarios asignados: {tiendaSeleccionada?.nombre}
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
                    onClick={() => {
                      setUsuarioEditando(u)
                      setContrasenaEditando("")
                    }}
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
      <Dialog
        open={!!usuarioEditando}
        onClose={() => setUsuarioEditando(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Nombre"
            fullWidth
            margin="dense"
            value={usuarioEditando?.name || ""}
            onChange={(e) =>
              setUsuarioEditando((prev) => prev ? { ...prev, name: e.target.value } as UsuarioTenant : prev)
            }
          />
          <TextField label="Correo" fullWidth margin="dense" value={usuarioEditando?.email || ""} disabled />
          <TextField
            label="Nueva contraseña"
            fullWidth
            margin="dense"
            type="password"
            value={contrasenaEditando}
            onChange={(e) => setContrasenaEditando(e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <Select
              value={usuarioEditando?.rol_lectura || ""}
              onChange={(e) =>
                setUsuarioEditando((prev) =>
                  prev ? { ...prev, rol_lectura: e.target.value as UsuarioTenant['rol_lectura'] } : prev
                )
              }
            >
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="empleado">Empleado</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <Select
              value={usuarioEditando?.is_active ? "activo" : "inactivo"}
              onChange={(e) =>
                setUsuarioEditando((prev) =>
                  prev ? { ...prev, is_active: e.target.value === "activo" } as UsuarioTenant : prev
                )
              }
            >
              <MenuItem value="activo">Activo</MenuItem>
              <MenuItem value="inactivo">Inactivo</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsuarioEditando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!usuarioEditando || updateUserMutation.isPending}
            onClick={handleGuardarUsuario}
          >
            {updateUserMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
