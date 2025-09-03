"use client"
import { useState } from "react"
import api from "@/services/api"
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button
} from "@mui/material"
import SaveIcon from "@mui/icons-material/Save"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

type Usuario = {
  id: number
  name: string
  email: string
  rol_lectura?: "manager" | "empleado" | string
  rol?: "manager" | "empleado" | string
  tienda_id_lectura?: number | null
  tienda_id?: number | null
}

type Tienda = { id: number; nombre: string }

export default function UsuariosTenantPage() {
  const params = useParams<{ id: string }>()
  const schema = params?.id || undefined
  const qc = useQueryClient()

  const [contrasenas, setContrasenas] = useState<Record<number, string>>({})
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
        alert("Contraseña actualizada")
        setContrasenas(prev => ({ ...prev, [userId]: "" }))
      }
    })
  }

  const handleCrearUsuario = () => {
    if (!schema) return
    crearUsuario.mutate(undefined, {
      onError: () => alert("Error al crear el usuario")
    })
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Usuarios del partner</Typography>

      {!schema ? (
        <Typography variant="body2" color="text.secondary">Falta el schema en la URL: /partners/&lt;schema&gt;/usuarios</Typography>
      ) : (
        <>
          {(loadingUsuarios || loadingTiendas) ? (
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Rol</TableCell>
                    <TableCell>Tienda</TableCell>
                    <TableCell>Contraseña nueva</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usuarios.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>

                      {/* Rol */}
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={user.rol_lectura ?? user.rol ?? ""}
                            onChange={(e) => handleRolChange(user.id, String(e.target.value))}
                          >
                            <MenuItem value="manager">Manager</MenuItem>
                            <MenuItem value="empleado">Empleado</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>

                      {/* Tienda */}
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={user.tienda_id_lectura ?? user.tienda_id ?? ""}
                            onChange={(e) => handleTiendaChange(user.id, Number(e.target.value))}
                          >
                            {tiendas.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.nombre}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>

                      {/* Contraseña nueva */}
                      <TableCell>
                        <TextField
                          size="small"
                          type="password"
                          value={contrasenas[user.id] || ""}
                          onChange={(e) =>
                            setContrasenas((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                        />
                      </TableCell>

                      {/* Guardar contraseña */}
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handlePasswordChange(user.id)}
                          disabled={cambiarPassword.isPending}
                        >
                          <SaveIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Crear nuevo usuario */}
          <Box component={Paper} sx={{ p: 2, mb: 3, mt: 2 }}>
            <Typography variant="h6" gutterBottom>Crear nuevo usuario</Typography>
            <Box display="flex" flexWrap="wrap" gap={2}>
              <TextField
                label="Nombre"
                size="small"
                value={nuevoUsuario.name}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, name: e.target.value })}
              />
              <TextField
                label="Email"
                size="small"
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
              />
              <TextField
                label="Contraseña"
                size="small"
                type="password"
                value={nuevoUsuario.password}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
              <FormControl size="small" sx={{ minWidth: 120 }}>
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
              <Button
                variant="contained"
                onClick={handleCrearUsuario}
                disabled={crearUsuario.isPending || !nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password}
              >
                {crearUsuario.isPending ? "Creando…" : "Crear"}
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Box>
  )
}
