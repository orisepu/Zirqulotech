"use client"
import { useMemo, useState } from "react"
import api from "@/services/api"
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Avatar,
  Stack,
  Alert,
  CircularProgress
} from "@mui/material"
import SaveIcon from "@mui/icons-material/Save"
import PersonIcon from "@mui/icons-material/Person"
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings"
import StoreIcon from "@mui/icons-material/Store"
import AddIcon from "@mui/icons-material/Add"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CancelIcon from "@mui/icons-material/Cancel"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from 'react-toastify'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material'

type Usuario = {
  id: number
  name: string
  email: string
  rol_lectura?: "manager" | "empleado" | string
  rol?: "manager" | "empleado" | string
  tienda_id_lectura?: number | null
  tienda_id?: number | null
  is_active?: boolean
}

type Tienda = { id: number; nombre: string }

export default function UsuariosTenantPage() {
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

  const [contrasenas, setContrasenas] = useState<Record<number, string>>({})
  const [editandoEmail, setEditandoEmail] = useState<Record<number, string>>({})
  const [nuevoUsuario, setNuevoUsuario] = useState({
    name: "",
    email: "",
    password: "",
    rol: "empleado",
    tienda_id: "" as number | "" // mantener como string vacío cuando no hay selección
  })

  // --- Queries ---
  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ["usuariosTenant", schema],
    enabled: !!schema,
    queryFn: async () => {
      const { data } = await api.get<Usuario[]>("/api/usuarios-tenant/", { params: { schema } })
      return data
    },
  })

  const { data: tiendas = [], isLoading: loadingTiendas } = useQuery({
    queryKey: ["tiendas", schema],
    enabled: !!schema,
    queryFn: async () => {
      const { data } = await api.get<Tienda[]>("/api/tiendas/", { params: { schema } })
      return data
    },
  })

  // --- Mutations ---
  const cambiarTienda = useMutation({
    mutationFn: async ({ userId, tiendaId }: { userId: number; tiendaId: number }) => {
      const { data } = await api.patch(`/api/usuarios-tenant/${userId}/`, { tienda_id: tiendaId }, { params: { schema } })
      return data as Usuario
    },
    onMutate: async ({ userId, tiendaId }) => {
      await qc.cancelQueries({ queryKey: ["usuariosTenant", schema] })
      const prev = qc.getQueryData<Usuario[]>(["usuariosTenant", schema]) || []
      const next = prev.map(u => (u.id === userId ? { ...u, tienda_id: tiendaId, tienda_id_lectura: tiendaId } : u))
      qc.setQueryData(["usuariosTenant", schema], next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["usuariosTenant", schema], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["usuariosTenant", schema] })
    },
  })

  const cambiarRol = useMutation({
    mutationFn: async ({ userId, nuevoRol }: { userId: number; nuevoRol: string }) => {
      const { data } = await api.patch(`/api/usuarios-tenant/${userId}/`, { rol: nuevoRol }, { params: { schema } })
      return data as Usuario
    },
    onMutate: async ({ userId, nuevoRol }) => {
      await qc.cancelQueries({ queryKey: ["usuariosTenant", schema] })
      const prev = qc.getQueryData<Usuario[]>(["usuariosTenant", schema]) || []
      const next = prev.map(u => (u.id === userId ? { ...u, rol: nuevoRol, rol_lectura: nuevoRol } : u))
      qc.setQueryData(["usuariosTenant", schema], next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["usuariosTenant", schema], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["usuariosTenant", schema] })
    },
  })

  const cambiarPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      await api.post("/api/cambiar-password/", { user_id: userId, new_password: newPassword }, { params: { schema } })
      return true
    },
  })

  const cambiarEmail = useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: number; newEmail: string }) => {
      const { data } = await api.patch(`/api/usuarios-tenant/${userId}/`, { email: newEmail }, { params: { schema } })
      return data as Usuario
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["usuariosTenant", schema] })
      toast.success('Email actualizado correctamente')
      setEditandoEmail(prev => ({ ...prev, [variables.userId]: "" }))
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      const mensaje = err?.response?.data?.detail || 'Error al actualizar el email'
      toast.error(mensaje)
    },
  })

  const crearUsuario = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/usuarios-tenant/", nuevoUsuario, { params: { schema } })
      return data as Usuario
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuariosTenant", schema] })
      setNuevoUsuario({ name: "", email: "", password: "", rol: "empleado", tienda_id: "" })
    },
  })

  // --- Handlers ---
  const handleTiendaChange = (userId: number, tiendaId: number) => {
    cambiarTienda.mutate({ userId, tiendaId })
  }

  const handleRolChange = (userId: number, nuevoRol: string) => {
    cambiarRol.mutate({ userId, nuevoRol })
  }

  const handlePasswordChange = (userId: number) => {
    const nueva = contrasenas[userId]
    if (!nueva) return
    cambiarPassword.mutate({ userId, newPassword: nueva }, {
      onSuccess: () => {
        toast.success("Contraseña actualizada")
        setContrasenas(prev => ({ ...prev, [userId]: "" }))
      }
    })
  }

  const handleEmailChange = (userId: number) => {
    const nuevoEmail = editandoEmail[userId]
    if (!nuevoEmail || !nuevoEmail.includes('@')) {
      toast.error('Email inválido')
      return
    }
    cambiarEmail.mutate({ userId, newEmail: nuevoEmail })
  }

  const handleCrearUsuario = () => {
    if (!schema) return
    crearUsuario.mutate(undefined, {
      onError: () => toast.error("Error al crear el usuario")
    })
  }


  if (!schema) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Falta el schema en la URL: /partners/&lt;schema&gt;/usuarios
      </Alert>
    )
  }

  if (loadingUsuarios || loadingTiendas) {
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
              Usuarios del Partner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Schema: {schema}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Crear nuevo usuario */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Crear Nuevo Usuario"
          avatar={
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <AddIcon />
            </Avatar>
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Nombre"
                fullWidth
                value={nuevoUsuario.name}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Email"
                fullWidth
                type="email"
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                label="Contraseña"
                fullWidth
                type="password"
                value={nuevoUsuario.password}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={nuevoUsuario.rol}
                  label="Rol"
                  onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: String(e.target.value) })}
                >
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="empleado">Empleado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Tienda</InputLabel>
                <Select
                  value={nuevoUsuario.tienda_id}
                  label="Tienda"
                  onChange={(e) =>
                    setNuevoUsuario({ ...nuevoUsuario, tienda_id: e.target.value as number | "" })
                  }
                >
                  {tiendas.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 12 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCrearUsuario}
                disabled={crearUsuario.isPending || !nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password}
                size="large"
              >
                {crearUsuario.isPending ? "Creando…" : "Crear Usuario"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabla de usuarios */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Tienda Asignada</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Cambiar Email/Login</TableCell>
              <TableCell>Cambiar Contraseña</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuarios.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <PersonIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {user.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={user.rol_lectura ?? user.rol ?? ""}
                      onChange={(e) => handleRolChange(user.id, String(e.target.value))}
                      displayEmpty
                    >
                      <MenuItem value="manager">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AdminPanelSettingsIcon fontSize="small" />
                          <span>Manager</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="empleado">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PersonIcon fontSize="small" />
                          <span>Empleado</span>
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={user.tienda_id_lectura ?? user.tienda_id ?? ""}
                      onChange={(e) => handleTiendaChange(user.id, Number(e.target.value))}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>Sin tienda</em>
                      </MenuItem>
                      {tiendas.map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <StoreIcon fontSize="small" />
                            <span>{t.nombre}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  {user.is_active !== false ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleIcon fontSize="small" color="success" />
                      <Typography variant="body2" color="success.main">Activo</Typography>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CancelIcon fontSize="small" color="error" />
                      <Typography variant="body2" color="error.main">Inactivo</Typography>
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      type="email"
                      placeholder={user.email}
                      value={editandoEmail[user.id] || ""}
                      onChange={(e) =>
                        setEditandoEmail((prev) => ({ ...prev, [user.id]: e.target.value }))
                      }
                      sx={{ minWidth: 200 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleEmailChange(user.id)}
                      disabled={cambiarEmail.isPending || !editandoEmail[user.id]}
                      color="primary"
                    >
                      <SaveIcon />
                    </IconButton>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      type="password"
                      placeholder="Nueva contraseña"
                      value={contrasenas[user.id] || ""}
                      onChange={(e) =>
                        setContrasenas((prev) => ({ ...prev, [user.id]: e.target.value }))
                      }
                      sx={{ minWidth: 150 }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handlePasswordChange(user.id)}
                      disabled={cambiarPassword.isPending || !contrasenas[user.id]}
                      color="primary"
                    >
                      <SaveIcon />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
