'use client'

import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  Typography,
  CircularProgress,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { useState, useEffect } from 'react'
import api from '@/services/api'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient,useMutation } from "@tanstack/react-query";

interface Notificacion {
  id: number
  mensaje: string
  tipo: string
  leida: boolean
  url_relacionada?: string
  creada: string
}

export default function NotificacionesBell({ socket }: { socket: WebSocket }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const queryClient = useQueryClient();
  const router = useRouter()
  
  const [snackbar, setSnackbar] = useState<{ open: boolean; mensaje: string; url: string }>({
    open: false,
    mensaje: '',
    url: '',
  })

  
  const {
    data: notificaciones = [],
    isLoading: loading,
  } = useQuery<Notificacion[]>({
    queryKey: ["notificaciones"],
    queryFn: async () => {
      const res = await api.get("api/notificaciones/");
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });
  


  const marcarComoLeidasMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await api.post("api/notificaciones/", { ids });
      return ids;
    },
    onSuccess: (ids) => {
      // Actualiza cache manualmente
      queryClient.setQueryData<Notificacion[]>(["notificaciones"], (prev = []) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, leida: true } : n))
      );
    },
  });



  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'nueva_notificacion') {
          const nueva: Notificacion = {
            id: data.id,
            mensaje: data.mensaje,
            tipo: data.tipo,
            url_relacionada: data.url || '',
            leida: false,
            creada: data.creada || new Date().toISOString(),
          }

          queryClient.setQueryData<Notificacion[]>(["notificaciones"], (prev = []) => {
            const yaExiste = prev.some((n) => n.id === nueva.id);
            return yaExiste ? prev : [nueva, ...prev];
          });

          setSnackbar({ open: true, mensaje: data.mensaje, url: data.url || '' })
        }
      } catch (err) {
        console.error('❌ Error al recibir notificación:', err)
      }
    }
  }, [socket, queryClient])

  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSeleccion = async (n: Notificacion) => {
    handleClose()
    if (!n.leida) {
      await marcarComoLeidasMutation.mutateAsync([n.id]);
    }
    if (n.url_relacionada) {
      router.push(n.url_relacionada)
    }
  }

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={notificacionesNoLeidas.length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <Typography px={2} pt={1} variant="subtitle2" fontWeight="bold">
          Notificaciones
        </Typography>
        <Divider />
        {loading ? (
          <MenuItem>
            <CircularProgress size={20} />
          </MenuItem>
        ) : notificaciones.length === 0 ? (
          <MenuItem>
            <ListItemText primary="Sin notificaciones" />
          </MenuItem>
        ) : (
          notificaciones.slice(0, 6).map((n) => (
            <MenuItem
              key={`noti-${n.id}`}
              onClick={() => handleSeleccion(n)}
              sx={{
                backgroundColor: !n.leida ? 'action.selected' : 'transparent',
              }}
            >
              <ListItemText
                primary={n.mensaje}
                secondary={new Date(n.creada).toLocaleString()}
              />
            </MenuItem>
          ))
        )}
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClick={() => {
            if (snackbar.url) window.location.href = snackbar.url
          }}
          severity="info"
          sx={{ cursor: snackbar.url ? 'pointer' : 'default' }}
        >
          {snackbar.mensaje}
        </Alert>
      </Snackbar>
    </>
  )
}
