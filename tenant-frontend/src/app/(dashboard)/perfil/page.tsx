'use client'

import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
} from '@mui/material'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useUsuario } from '@/context/UsuarioContext'
import { toast } from 'react-toastify'
import api from '@/services/api'

export default function PaginaPerfil() {
  const usuario = useUsuario()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')

  // 1. Obtener nombre de tienda desde react-query
  type Tienda = { nombre?: string }
  const { data: tienda, isLoading: cargandoTienda } = useQuery<Tienda | null>({
    queryKey: ['tienda-detalle', usuario?.rol_actual?.tienda_id],
    enabled: !!usuario?.rol_actual?.tienda_id,
    queryFn: async () => {
      const res = await api.get(`/api/tiendas/${usuario?.rol_actual?.tienda_id}/`)
      return (res.data as Tienda) ?? null
    },
  })

  // 2. Mutation para cambiar contraseña
  const cambiarPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/cambiar-contraseña/', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      return res.data
    },
    onSuccess: (data: { detail?: string }) => {
      toast.success(data?.detail || 'Contraseña actualizada correctamente')
      setOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setRepeatPassword('')
    },
    onError: (err: unknown) => {
      let msg = 'Error al cambiar la contraseña'
      if (typeof err === 'object' && err !== null) {
        const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
        if (typeof detail === 'string' && detail) msg = detail
      }
      toast.error(msg)
    },
  })

  const handleCambiarPassword = () => {
    if (!currentPassword || !newPassword || !repeatPassword) {
      toast.error('Completa todos los campos')
      return
    }
    if (newPassword !== repeatPassword) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    cambiarPasswordMutation.mutate()
  }
  if (!usuario) return <p>Cargando...</p>

  return (
    <Box p={4} maxWidth="600px" margin="auto">
      <Typography variant="h4" gutterBottom>Mi Perfil</Typography>
      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Typography variant="body1"><strong>Nombre:</strong> {usuario.name}</Typography>
        <Typography variant="body1"><strong>Email:</strong> {usuario.email}</Typography>
        <Typography variant="body1"><strong>Rol:</strong> {usuario.rol_actual?.rol ?? '—'}</Typography>
        <Typography variant="body1"><strong>Tienda:</strong> {cargandoTienda ? 'Cargando...' : (tienda?.nombre || '—')}</Typography>
      </Paper>

      <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
        Restablecer contraseña
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Contraseña actual"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Repetir nueva contraseña"
            type="password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleCambiarPassword}
            disabled={cambiarPasswordMutation.isPending}
            variant="contained"
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
