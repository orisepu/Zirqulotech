// app/usuarios/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Switch,
  InputAdornment,
  IconButton,
  Chip,
} from "@mui/material";
import { Search, Clear } from "@mui/icons-material";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import ValidatingTextField from "@/components/inputs/ValidatingTextField";
import TablaReactiva from "@/components/TablaReactiva2";

type UsuarioAPI = {
  id: number;
  name: string;
  email: string;
  rol_lectura: string | null;
  tienda_id_lectura: number | null;
  is_active: boolean;
  uuid: string;
};
type Tienda = { id: number; nombre: string };

export default function GestionarUsuariosPage() {
  const queryClient = useQueryClient();
  const [contrasenas, setContrasenas] = useState<{ [key: number]: string }>({});

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  const [crearOpen, setCrearOpen] = useState(false);
  const [nuevo, setNuevo] = useState<{
    name: string;
    email: string;
    rol: string;
    tienda_id: number | "";
    password: string;
  }>({ name: "", email: "", rol: "empleado", tienda_id: "", password: "" });
  const [emailValido, setEmailValido] = useState(true);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const { data: usuarios = [] } = useQuery<UsuarioAPI[]>({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const res = await api.get("/api/usuarios-tenant/");
      const arr: UsuarioAPI[] = Array.isArray(res.data) ? res.data : [];
      // si quieres mantener campos 'rol' y 'tienda_id' locales:
      return arr.map(u => ({ ...u, rol_lectura: u.rol_lectura, tienda_id_lectura: u.tienda_id_lectura }));
    },
  });

  const { data: tiendas = [] } = useQuery<Tienda[]>({
    queryKey: ["tiendas"],
    queryFn: async () => {
      const res = await api.get("/api/tiendas/");
      return res.data;
    },
  });

  const asignarTienda = useMutation({
    mutationFn: ({ userId, tiendaId }: { userId: number; tiendaId: number }) =>
      api.patch(`/api/usuarios-tenant/${userId}/`, { tienda_id: tiendaId }),
    onSuccess: (_, { userId, tiendaId }) => {
      // Actualiza el campo que usa la UI
      queryClient.setQueryData<any[]>(["usuarios"], (prev = []) =>
        prev.map((u) => (u.id === userId ? { ...u, tienda_id_lectura: tiendaId } : u))
      );
    },
  });

  const cambiarPassword = useMutation({
    mutationFn: ({
      userId,
      nueva,
    }: {
      userId: number;
      nueva: string;
    }) =>
      api.post("/api/cambiar-password/", {
        user_id: userId,
        new_password: nueva,
      }),
    onSuccess: () => {
      setSnackbar({ open: true, message: "Contraseña actualizada", severity: "success" });
      setContrasenas({});
    },
  });

  const cambiarRol = useMutation({
    mutationFn: ({ userId, rol }: { userId: number; rol: string }) =>
      api.patch(`/api/usuarios-tenant/${userId}/`, { rol }),
    onSuccess: (_, { userId, rol }) => {
      // Actualiza el campo que usa la UI
      queryClient.setQueryData<any[]>(["usuarios"], (prev = []) =>
        prev.map((u) => (u.id === userId ? { ...u, rol_lectura: rol } : u))
      );
    },
  });

  // Crear usuario
  const crearUsuario = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: nuevo.name,
        email: nuevo.email,
        password: nuevo.password,
        rol: nuevo.rol,
      };
      if (nuevo.tienda_id !== "") payload.tienda_id = nuevo.tienda_id;
      const res = await api.post("/api/usuarios-tenant/", payload);
      return res.data;
    },
    onSuccess: () => {
      setSnackbar({ open: true, message: "Usuario creado correctamente", severity: "success" });
      setCrearOpen(false);
      setNuevo({ name: "", email: "", rol: "empleado", tienda_id: "", password: "" });
      setEmailValido(true);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "Error al crear el usuario";
      setSnackbar({ open: true, message: msg, severity: "error" });
    },
  });

  // Activar / desactivar usuario
  const toggleActivo = useMutation({
    mutationFn: ({ userId, is_active }: { userId: number; is_active: boolean }) =>
      api.patch(`/api/usuarios-tenant/${userId}/`, { is_active }),
    onSuccess: (_, { userId, is_active }) => {
      queryClient.setQueryData<any[]>(["usuarios"], (prev = []) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active } : u))
      );
      setSnackbar({
        open: true,
        message: is_active ? "Usuario activado" : "Usuario desactivado",
        severity: "success",
      });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        "No se pudo cambiar el estado";
      setSnackbar({ open: true, message: msg, severity: "error" });
    },
  });

  const handleTiendaChange = (userId: number, tiendaId: number) => {
    asignarTienda.mutate({ userId, tiendaId });
  };

  const handlePasswordChange = (userId: number) => {
    const nueva = contrasenas[userId];
    if (!nueva) return;
    cambiarPassword.mutate({ userId, nueva });
  };

  const handleRolChange = (userId: number, nuevoRol: string) => {
    cambiarRol.mutate({ userId, rol: nuevoRol });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  // Filter users based on search term
  const filteredUsuarios = usuarios.filter(usuario =>
    usuario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<UsuarioAPI>[]>(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Nombre',
      meta: {
        label: 'Nombre',
        minWidth: 150,
      },
    },
    {
      id: 'email',
      accessorKey: 'email',
      header: 'Email',
      meta: {
        label: 'Email',
        minWidth: 200,
        ellipsis: true,
        ellipsisMaxWidth: 250,
      },
    },
    {
      id: 'tienda',
      accessorFn: (row) => {
        const tienda = tiendas.find(t => t.id === row.tienda_id_lectura);
        return tienda?.nombre || 'Sin asignar';
      },
      header: 'Tienda',
      cell: ({ row }) => (
        <Select
          value={row.original.tienda_id_lectura || ""}
          onChange={(e) =>
            handleTiendaChange(row.original.id, e.target.value as number)
          }
          size="small"
          displayEmpty
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="">
            <em>Sin asignar</em>
          </MenuItem>
          {tiendas.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.nombre}
            </MenuItem>
          ))}
        </Select>
      ),
      meta: {
        label: 'Tienda',
        minWidth: 140,
      },
    },
    {
      id: 'rol',
      accessorKey: 'rol_lectura',
      header: 'Rol',
      cell: ({ row }) => (
        <Select
          value={row.original.rol_lectura || "empleado"}
          onChange={(e) =>
            handleRolChange(row.original.id, e.target.value as string)
          }
          size="small"
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="empleado">Empleado</MenuItem>
          <MenuItem value="manager">Manager</MenuItem>
        </Select>
      ),
      meta: {
        label: 'Rol',
        minWidth: 120,
      },
    },
    {
      id: 'estado',
      accessorKey: 'is_active',
      header: 'Estado',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Switch
            checked={!!row.original.is_active}
            onChange={(e) => {
              const next = e.target.checked;
              toggleActivo.mutate({ userId: row.original.id, is_active: next });
            }}
            color="primary"
            size="small"
            slotProps={{ input: { "aria-label": "Activar/Desactivar usuario" } }}
          />
          <Chip
            label={row.original.is_active ? 'Activo' : 'Inactivo'}
            color={row.original.is_active ? 'success' : 'default'}
            size="small"
          />
        </Box>
      ),
      meta: {
        label: 'Estado',
        minWidth: 140,
        align: 'center' as const,
      },
    },
    {
      id: 'password',
      header: 'Nueva contraseña',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            size="small"
            type="password"
            placeholder="Nueva contraseña"
            value={contrasenas[row.original.id] || ""}
            onChange={(e) =>
              setContrasenas({
                ...contrasenas,
                [row.original.id]: e.target.value,
              })
            }
            sx={{ minWidth: 140 }}
          />
          <Button
            onClick={() => handlePasswordChange(row.original.id)}
            variant="contained"
            size="small"
            disabled={!contrasenas[row.original.id]}
          >
            Cambiar
          </Button>
        </Box>
      ),
      meta: {
        label: 'Nueva contraseña',
        minWidth: 280,
      },
    },
  ], [tiendas, contrasenas, handlePasswordChange, handleRolChange, handleTiendaChange, toggleActivo.mutate]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">Gestión de Usuarios</Typography>
        <Button variant="contained" onClick={() => setCrearOpen(true)}>
          Crear usuario
        </Button>
      </Box>

      {/* Search bar */}
      <Box mb={2}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ minWidth: 300 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="clear search"
                    onClick={clearSearch}
                    edge="end"
                    size="small"
                  >
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            }
          }}
        />
      </Box>

      {/* Tabla con TablaReactiva2 */}
      <TablaReactiva
        oportunidades={filteredUsuarios}
        columnas={columns}
        loading={false}
        usuarioId="usuarios"
        hideColumnSelector={true}
        hideExport={true}
      />

      {/* Diálogo Crear Usuario */}
      <Dialog open={crearOpen} onClose={() => setCrearOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={nuevo.name}
            onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
            size="small"
            fullWidth
          />
          <ValidatingTextField
            label="Email"
            value={nuevo.email}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
            kind="email"
            type="email"
            required
            size="small"
            fullWidth
            validateOnChange
            onValidChange={(isValid) => setEmailValido(isValid)}
          />

          <FormControl fullWidth>
            <InputLabel id="nuevo-rol">Rol</InputLabel>
            <Select
              labelId="nuevo-rol"
              label="Rol"
              value={nuevo.rol}
              onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as string })}
              size="small"
            >
              <MenuItem value="empleado">Empleado</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth variant="outlined">
            <InputLabel id="nuevo-tienda" shrink>
              Tienda
            </InputLabel>
            <Select
              labelId="nuevo-tienda"
              label="Tienda"
              value={nuevo.tienda_id}
              onChange={(e) =>
                setNuevo({ ...nuevo, tienda_id: (e.target.value as number) ?? "" })
              }
              size="small"
              displayEmpty
              renderValue={(val) => {
                const v = val as number | "";
                if (v === "") return <span style={{ color: "#888" }}>Sin tienda</span>;
                const idNum = typeof v === "number" ? v : Number(v);
                const t = tiendas.find((x: Tienda) => x.id === idNum);
                return t ? t.nombre : String(v);
              }}
            >
              <MenuItem value="">
                <em>Sin tienda</em>
              </MenuItem>
              {tiendas.map((t: any) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Contraseña"
            type="password"
            value={nuevo.password}
            onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCrearOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => crearUsuario.mutate()}
            variant="contained"
            disabled={!nuevo.name || !nuevo.email || !nuevo.password || !emailValido}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}