'use client'
import { useTheme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
import api from '@/services/api'
import { getSecureItem } from '@/shared/lib/secureStorage'

// Exponential backoff helper (inspired by useWebSocketWithRetry)
const calcularRetryDelay = (intentos: number, initialDelay = 1000, maxDelay = 30000): number => {
  const delay = Math.min(initialDelay * Math.pow(2, intentos), maxDelay)
  const jitter = delay * 0.25 * Math.random()
  return delay + jitter
}
import {
  Box, Paper, Typography, Button, TextField, Tabs, Tab,
  Badge, IconButton, ListItemText, ListItemButton, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Divider, Tooltip
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from 'react-toastify'
import type { ReactNode } from 'react';
// Tipos

type ChatInfo = {
  id: number
  cliente_nombre: string
  ultimo_mensaje: string
  schema: string
}

type Mensaje = {
  autor: string
  texto: string
  oportunidad_id?: number
  tenant?: string
}

type User = {
  id: number
  name: string
  email: string
}

function _playBeep(frequency = 440, duration = 150) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close()
    }, duration)
  } catch (e) {
    console.warn('Beep error:', e)
  }
}

function lanzarNotificacion(titulo: string, cuerpo: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(titulo, { body: cuerpo, icon: '/favicon.ico' })
  }
}

export default function ChatConTenants() {
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState<'chats' | 'usuarios'>('chats')
  const [filtroChats, setFiltroChats] = useState('')
  const [filtroUsuarios, setFiltroUsuarios] = useState('')
  const [chatActivo, setChatActivo] = useState<number | null>(null)
  const [mensajesPorChat, setMensajesPorChat] = useState<Record<number, Mensaje[]>>({})
  const [input, setInput] = useState('')
  const [noLeidos, setNoLeidos] = useState<Record<number, number>>({})
  const [dialogCerrar, setDialogCerrar] = useState<number | null>(null)
  const [estadosWs, setEstadosWs] = useState<Record<number, 'desconectado' | 'conectando' | 'conectado' | 'error' | 'reconectando'>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsConexiones = useRef<Record<number, WebSocket>>({})
  const retryCounters = useRef<Record<number, number>>({}) // Track retry attempts per chat
  const queryClient = useQueryClient()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const renderMensaje = (msg: Mensaje): ReactNode => {
    const partes: ReactNode[] = [msg.texto];
      if (msg.oportunidad_id && msg.tenant) {
        partes.push(' ');
        partes.push(
          <a key="link" href={`/oportunidades/global/${msg.tenant}/${msg.oportunidad_id}`} style={{ textDecoration: 'underline' }}>
            Ver oportunidad #{msg.oportunidad_id}
          </a>
        );
      }
      return partes;
    };

  const { data: usuarioData } = useQuery({
    queryKey: ["usuario-actual"],
    queryFn: async () => {
      const res = await api.get("/api/yo/");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  const usuario = usuarioData?.name || null;
  const usuarioRef = useRef<string | null>(usuario);
  const chatActivoRef = useRef<number | null>(chatActivo);

  // Mantener los refs sincronizados
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  useEffect(() => {
    chatActivoRef.current = chatActivo;
  }, [chatActivo]);

  useEffect(() => {
    Notification.requestPermission()
  }, [])

  const { data: chats = [], isLoading, isError } = useQuery<ChatInfo[]>({
    queryKey: ["chats-abiertos"],
    queryFn: async () => {
      const res = await api.get<ChatInfo[]>("/api/chats/abiertos/");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 10000, // Poll cada 10 segundos para detectar nuevos chats
  });

  // Query para buscar TODOS los usuarios (no solo managers/empleados)
  const { data: usuarios = [], isLoading: isLoadingUsuarios, error: errorUsuarios } = useQuery<User[]>({
    queryKey: ["usuarios-todos"],
    queryFn: async () => {
      const res = await api.get<User[]>("/api/usuarios/");
      return res.data;
    },
    enabled: tab === 'usuarios', // Solo cargar cuando estamos en el tab de usuarios
    staleTime: 1000 * 60 * 2, // Cache 2 minutos
    retry: false,
  });
  useEffect(() => {
    const conectarChats = async () => {
      const token = await getSecureItem('access');
      if (!token) return;

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const chatIds = new Set(chats.map(c => c.id));

      // Conectar WebSockets para chats nuevos
      chats.forEach((chat: ChatInfo) => {
        if (!wsConexiones.current[chat.id]) {
          console.log(`🔌 Conectando WebSocket para chat ${chat.id} (${chat.schema})`);
          retryCounters.current[chat.id] = 0; // Initialize retry counter
          setEstadosWs((prev) => ({ ...prev, [chat.id]: 'conectando' }));
          const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat/${chat.id}/?token=${token}&schema=${chat.schema}`);

        ws.onopen = () => {
          console.log(`✅ WebSocket conectado para chat ${chat.id}`);
          retryCounters.current[chat.id] = 0; // Reset on successful connection
          setEstadosWs((prev) => ({ ...prev, [chat.id]: 'conectado' }));
        };

        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);

          // Manejar cierre de chat
          if (data.type === 'chat_closed') {
            console.log(`🔒 Chat ${chat.id} cerrado:`, data.mensaje);
            setEstadosWs((prev) => ({ ...prev, [chat.id]: 'desconectado' }));
            ws.close();
            delete wsConexiones.current[chat.id];

            // Si es el chat activo, volver a la lista
            if (chat.id === chatActivoRef.current) {
              setChatActivo(null);
              toast.info(data.mensaje || 'El chat ha sido cerrado por el equipo de soporte');
            }

            // Refrescar lista de chats
            queryClient.invalidateQueries({ queryKey: ['chats-abiertos'] });
            return;
          }

          // Mensaje normal
          const mensaje: Mensaje = data;

          setMensajesPorChat((prev) => {
            const anteriores = prev[chat.id] || [];
            return {
              ...prev,
              [chat.id]: [...anteriores, mensaje],
            };
          });

          // Usar refs para evitar problemas de closure
          const esDelOtroUsuario = mensaje.autor !== usuarioRef.current;
          const chatNoEstaActivo = chat.id !== chatActivoRef.current;

          if (esDelOtroUsuario && chatNoEstaActivo) {
            console.log(`🔔 Incrementando contador de no leídos para chat ${chat.id}`);
            lanzarNotificacion(`Nuevo mensaje de ${mensaje.autor}`, mensaje.texto);
            setNoLeidos((prev) => ({
              ...prev,
              [chat.id]: (prev[chat.id] || 0) + 1,
            }));
          }
        };

        ws.onerror = () => {
          console.error(`❌ Error en WebSocket del chat ${chat.id} (${chat.schema})`);
          setEstadosWs((prev) => ({ ...prev, [chat.id]: 'error' }));
        };

        ws.onclose = () => {
          console.log(`🔌 WebSocket cerrado para chat ${chat.id}`);
          setEstadosWs((prev) => ({ ...prev, [chat.id]: 'desconectado' }));
          delete wsConexiones.current[chat.id];

          // Auto-reconnect with exponential backoff
          const currentRetries = retryCounters.current[chat.id] || 0;
          const maxRetries = 5;

          if (currentRetries < maxRetries) {
            const delay = calcularRetryDelay(currentRetries);
            console.log(`⏳ Reintentando conexión en ${Math.round(delay / 1000)}s para chat ${chat.id}...`);
            retryCounters.current[chat.id] = currentRetries + 1;

            setTimeout(() => {
              reconectarChat(chat.id, false);
            }, delay);
          }
        };
        wsConexiones.current[chat.id] = ws;
      }
      });

      // Cleanup: SOLO cerrar WebSockets de chats que ya no están en la lista
      return () => {
        Object.entries(wsConexiones.current).forEach(([chatIdStr, ws]) => {
          const chatId = parseInt(chatIdStr);
          if (!chatIds.has(chatId)) {
            console.log(`🗑️ Cerrando WebSocket de chat removido ${chatId}`);
            ws.close();
            delete wsConexiones.current[chatId];
          }
        });
      };
    };

    conectarChats();
  }, [chats]); // ✅ SOLO depender de 'chats', NO de 'chatActivo'

  useEffect(() => {
    if (chatActivo && !mensajesPorChat[chatActivo]) {
      const chatInfo = chats.find(c => c.id === chatActivo)
      if (chatInfo) {
        // Pasar el schema como query param para que el backend busque en el tenant correcto
        api.get(`/api/chat/${chatActivo}/mensajes/?schema=${chatInfo.schema}`)
          .then(res => {
            setMensajesPorChat((prev) => ({
              ...prev,
              [chatActivo]: res.data,
            }));
          })
          .catch(console.error);
      } else {
        console.warn(`⚠️ No se encontró info del chat ${chatActivo} en la lista`)
      }
    }
  }, [chatActivo, mensajesPorChat, chats]);


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajesPorChat, chatActivo])

  const enviar = () => {
    if (!input.trim() || !chatActivo) return
    const socket = wsConexiones.current[chatActivo]
    socket?.send(JSON.stringify({ texto: input }))
    setInput('')
  }

  const cerrarChat = async (chatId: number) => {
    try {
      await api.post(`/api/chat/${chatId}/cerrar/`)
      // Desconectar WebSocket
      wsConexiones.current[chatId]?.close()
      delete wsConexiones.current[chatId]
      // Limpiar mensajes del chat cerrado
      setMensajesPorChat((prev) => {
        const nuevo = { ...prev }
        delete nuevo[chatId]
        return nuevo
      })
      // Limpiar contador de no leídos
      setNoLeidos((prev) => {
        const nuevo = { ...prev }
        delete nuevo[chatId]
        return nuevo
      })
      // Refetch chats para actualizar lista
      queryClient.invalidateQueries({ queryKey: ['chats-abiertos'] })
      // Volver a lista
      setChatActivo(null)
      setDialogCerrar(null)
    } catch (error) {
      console.error('Error cerrando chat:', error)
    }
  }

  const getIniciales = (nombre: string | undefined | null) => {
    if (!nombre) return '??'
    const nombreTrim = nombre.trim()
    if (!nombreTrim) return '??'
    const partes = nombreTrim.split(' ')
    if (partes.length >= 2 && partes[0] && partes[1]) {
      return (partes[0][0] + partes[1][0]).toUpperCase()
    }
    return nombreTrim.slice(0, 2).toUpperCase()
  }

  const reconectarChat = async (chatId: number, manualRetry = true) => {
    let chat = chats.find(c => c.id === chatId)

    // Si no está en el array, intentar obtenerlo del backend
    if (!chat) {
      console.warn(`⚠️ Chat ${chatId} no está en el array local, intentando obtener del backend...`)
      try {
        const res = await api.get(`/api/chat/${chatId}/`)
        chat = {
          id: res.data.id,
          cliente_nombre: res.data.cliente_nombre || 'Usuario',
          ultimo_mensaje: '',
          schema: res.data.schema || 'public'
        }
        console.log(`✅ Chat ${chatId} obtenido del backend:`, chat)

        // Agregarlo al estado
        queryClient.setQueryData<ChatInfo[]>(['chats-abiertos'], (old = []) => {
          if (old.some(c => c.id === chat!.id)) return old
          return [...old, chat!]
        })
      } catch (error) {
        console.error(`❌ No se encontró el chat ${chatId} en backend:`, error)
        toast.error(`No se pudo encontrar el chat ${chatId}`)
        return
      }
    }

    const maxRetries = 5
    const currentRetries = retryCounters.current[chatId] || 0

    if (!manualRetry && currentRetries >= maxRetries) {
      console.error(`❌ Se alcanzó el máximo de reintentos (${maxRetries}) para chat ${chatId}`)
      setEstadosWs((prev) => ({ ...prev, [chatId]: 'error' }))
      return
    }

    if (manualRetry) {
      // Reset retry counter on manual reconnect
      retryCounters.current[chatId] = 0
    }

    console.log(`🔄 Reconectando chat ${chatId} (${chat.schema})... Intento ${currentRetries + 1}/${maxRetries}`)

    // Cerrar WebSocket existente si lo hay
    if (wsConexiones.current[chatId]) {
      wsConexiones.current[chatId].close()
      delete wsConexiones.current[chatId]
    }

    // Crear nueva conexión
    const token = await getSecureItem('access')
    if (!token) {
      console.error('❌ No se pudo obtener el token de acceso')
      return
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws"
    const esReintento = currentRetries > 0

    setEstadosWs((prev) => ({ ...prev, [chatId]: esReintento ? 'reconectando' : 'conectando' }))

    const ws = new WebSocket(`${proto}://${window.location.host}/ws/chat/${chatId}/?token=${token}&schema=${chat.schema}`)

    ws.onopen = () => {
      console.log(`✅ WebSocket reconectado para chat ${chatId}`)
      retryCounters.current[chatId] = 0 // Reset counter on successful connection
      setEstadosWs((prev) => ({ ...prev, [chatId]: 'conectado' }))
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)

      // Manejar cierre de chat
      if (data.type === 'chat_closed') {
        console.log(`🔒 Chat ${chatId} cerrado:`, data.mensaje)
        setEstadosWs((prev) => ({ ...prev, [chatId]: 'desconectado' }))
        ws.close()
        delete wsConexiones.current[chatId]

        if (chatId === chatActivoRef.current) {
          setChatActivo(null)
          toast.info(data.mensaje || 'El chat ha sido cerrado por el equipo de soporte')
        }

        queryClient.invalidateQueries({ queryKey: ['chats-abiertos'] })
        return
      }

      // Mensaje normal
      const mensaje: Mensaje = data

      setMensajesPorChat((prev) => {
        const anteriores = prev[chatId] || []
        return {
          ...prev,
          [chatId]: [...anteriores, mensaje],
        }
      })

      const esDelOtroUsuario = mensaje.autor !== usuarioRef.current
      const chatNoEstaActivo = chatId !== chatActivoRef.current

      if (esDelOtroUsuario && chatNoEstaActivo) {
        console.log(`🔔 Incrementando contador de no leídos para chat ${chatId}`)
        lanzarNotificacion(`Nuevo mensaje de ${mensaje.autor}`, mensaje.texto)
        setNoLeidos((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || 0) + 1,
        }))
      }
    }

    ws.onerror = () => {
      console.error(`❌ Error en WebSocket del chat ${chatId} (${chat.schema})`)
      setEstadosWs((prev) => ({ ...prev, [chatId]: 'error' }))
    }

    ws.onclose = () => {
      console.log(`🔌 WebSocket cerrado para chat ${chatId}`)
      setEstadosWs((prev) => ({ ...prev, [chatId]: 'desconectado' }))
      delete wsConexiones.current[chatId]

      // Auto-reconnect with exponential backoff (unless manually closed or max retries reached)
      if (!manualRetry && currentRetries < maxRetries) {
        const delay = calcularRetryDelay(currentRetries)
        console.log(`⏳ Reintentando reconexión automática en ${Math.round(delay / 1000)}s...`)
        retryCounters.current[chatId] = currentRetries + 1

        setTimeout(() => {
          reconectarChat(chatId, false)
        }, delay)
      }
    }

    wsConexiones.current[chatId] = ws
  }

  const seleccionarUsuario = async (user: User) => {
    try {
      const res = await api.post('/api/chat/soporte/', { cliente_id: user.id })
      console.log('✅ Chat creado/obtenido:', res.data)

      const nuevoChat: ChatInfo = {
        id: res.data.id,
        cliente_nombre: user.name,
        ultimo_mensaje: '',
        schema: res.data.schema || 'public'
      }

      // Agregar chat al estado inmediatamente (optimistic update)
      queryClient.setQueryData<ChatInfo[]>(['chats-abiertos'], (old = []) => {
        // Evitar duplicados
        if (old.some(c => c.id === nuevoChat.id)) {
          return old
        }
        return [...old, nuevoChat]
      })

      // Refrescar lista de chats en segundo plano
      queryClient.invalidateQueries({ queryKey: ['chats-abiertos'] })

      // Cambiar al tab de chats
      setTab('chats')

      // Activar el chat inmediatamente (el useEffect lo conectará)
      setChatActivo(res.data.id)

    } catch (error: any) {
      console.error('❌ Error creando chat:', error)
      const errorMsg = error?.response?.data?.error || 'Error al crear el chat'
      toast.error(`Error: ${errorMsg}`)
    }
  }

  const totalNoLeidos = Object.values(noLeidos).reduce((a, b) => a + b, 0)

  useEffect(() => {
    if (chatActivo) {
      setNoLeidos(prev => ({ ...prev, [chatActivo]: 0 }))
    }
  }, [chatActivo])

  useEffect(() => {
    const connsOnMount = wsConexiones.current;
    return () => {
      Object.values(connsOnMount).forEach(ws => ws.close())
    }
  }, [])

  const mensajes = chatActivo ? (mensajesPorChat[chatActivo] || []) : [];

  return (
    <>
      <IconButton
        color="primary"
        sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1300 }}
        onClick={() => setAbierto(!abierto)}
      >
        <Badge badgeContent={totalNoLeidos} color="error">
          <ChatIcon fontSize="large" />
        </Badge>
      </IconButton>

      {abierto && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 20,
            width: { xs: '95vw', sm: 360 },
            height: { xs: '80vh', sm: 500 },
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary
          }}
        >
          {!chatActivo ? (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 2,
                  py: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText'
                }}
              >
                <Typography variant="h6">Chat de Soporte</Typography>
                <IconButton onClick={() => setAbierto(false)} size="small" sx={{ color: 'inherit' }}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                <Tab label="Chats Abiertos" value="chats" />
                <Tab label="Buscar Usuarios" value="usuarios" />
              </Tabs>

              {tab === 'chats' && (
                <>
                  <Box p={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Buscar chats..."
                      value={filtroChats}
                      onChange={e => setFiltroChats(e.target.value)}
                    />
                  </Box>
                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {isLoading && (
                      <Box p={2} textAlign="center">
                        <Typography>Cargando chats...</Typography>
                      </Box>
                    )}
                    {isError && (
                      <Box p={2} textAlign="center">
                        <Typography color="error">Error al cargar chats</Typography>
                      </Box>
                    )}
                    {!isLoading && !isError && chats.length === 0 && (
                      <Box p={2} textAlign="center">
                        <Typography color="text.secondary">No hay chats abiertos</Typography>
                      </Box>
                    )}
                    {!isLoading && !isError && chats
                      .filter(chat =>
                        chat.cliente_nombre.toLowerCase().includes(filtroChats.toLowerCase())
                      )
                      .map(chat => (
                        <ListItemButton
                          key={`chat-${chat.schema}-${chat.id}`}
                          onClick={() => setChatActivo(chat.id)}
                          selected={chat.id === chatActivo}
                        >
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                            {getIniciales(chat.cliente_nombre)}
                          </Avatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                  {chat.cliente_nombre}
                                </Typography>
                                {noLeidos[chat.id] > 0 && (
                                  <Chip
                                    size="small"
                                    color="error"
                                    label={noLeidos[chat.id]}
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Typography variant="body2" noWrap sx={{ maxWidth: '200px' }}>
                                {chat.ultimo_mensaje}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      ))}
                  </Box>
                </>
              )}

              {tab === 'usuarios' && (
                <>
                  <Box p={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Buscar usuarios..."
                      value={filtroUsuarios}
                      onChange={e => setFiltroUsuarios(e.target.value)}
                    />
                  </Box>
                  <Box sx={{ flex: 1, overflowY: 'auto' }}>
                    {isLoadingUsuarios && (
                      <Box p={2} textAlign="center">
                        <Typography>Cargando usuarios...</Typography>
                      </Box>
                    )}
                    {errorUsuarios && (
                      <Box p={2} textAlign="center">
                        <Typography color="error" gutterBottom>
                          Error al cargar usuarios
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Intenta recargar la página
                        </Typography>
                      </Box>
                    )}
                    {!isLoadingUsuarios && !errorUsuarios && usuarios.length === 0 && (
                      <Box p={2} textAlign="center">
                        <Typography color="text.secondary" gutterBottom>
                          No hay usuarios registrados
                        </Typography>
                      </Box>
                    )}
                    {!isLoadingUsuarios && !errorUsuarios && usuarios
                      .filter(user =>
                        user.name.toLowerCase().includes(filtroUsuarios.toLowerCase()) ||
                        user.email.toLowerCase().includes(filtroUsuarios.toLowerCase())
                      )
                      .map(user => (
                        <ListItemButton
                          key={`usuario-${user.id}`}
                          onClick={() => seleccionarUsuario(user)}
                        >
                          <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                            {getIniciales(user.name)}
                          </Avatar>
                          <ListItemText primary={user.name} secondary={user.email} />
                        </ListItemButton>
                      ))}
                  </Box>
                </>
              )}
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton onClick={() => setChatActivo(null)} size="small" sx={{ color: 'inherit' }}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6">
                    {chats.find(c => c.id === chatActivo)?.cliente_nombre || 'Conversación'}
                  </Typography>
                  {chatActivo && (
                    <Chip
                      size="small"
                      label={
                        estadosWs[chatActivo] === 'conectado' ? 'Conectado' :
                        estadosWs[chatActivo] === 'conectando' ? 'Conectando...' :
                        estadosWs[chatActivo] === 'reconectando' ? 'Reconectando...' :
                        estadosWs[chatActivo] === 'error' ? 'Error' : 'Desconectado'
                      }
                      color={
                        estadosWs[chatActivo] === 'conectado' ? 'success' :
                        estadosWs[chatActivo] === 'conectando' ? 'info' :
                        estadosWs[chatActivo] === 'reconectando' ? 'warning' :
                        estadosWs[chatActivo] === 'error' ? 'error' : 'default'
                      }
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                  {chatActivo && estadosWs[chatActivo] !== 'conectado' && (
                    <Tooltip title="Reconectar">
                      <IconButton
                        onClick={() => reconectarChat(chatActivo)}
                        size="small"
                        disabled={estadosWs[chatActivo] === 'conectando'}
                        sx={{ color: 'inherit', ml: 0.5 }}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <IconButton
                  onClick={() => setDialogCerrar(chatActivo)}
                  size="small"
                  sx={{ color: 'inherit' }}
                  title="Cerrar chat"
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Box>
              <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1 }}>
                {mensajes.map((msg, i) => {
                  const soyYo = msg.autor === usuario
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        justifyContent: soyYo ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        mb: 1.5,
                        gap: 1,
                      }}
                    >
                      {!soyYo && (
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'primary.main',
                            fontSize: '0.75rem',
                          }}
                        >
                          {getIniciales(msg.autor)}
                        </Avatar>
                      )}
                      <Paper
                        sx={{
                          bgcolor: soyYo
                            ? theme.palette.primary.main
                            : isDark
                            ? theme.palette.grey[800]
                            : theme.palette.grey[300],
                          color: soyYo
                            ? theme.palette.primary.contrastText
                            : theme.palette.text.primary,
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          maxWidth: '70%',
                        }}
                      >
                        {!soyYo && (
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
                            {msg.autor}
                          </Typography>
                        )}
                        <Typography variant="body2">{renderMensaje(msg)}</Typography>
                      </Paper>
                    </Box>
                  )
                })}
              </Box>
              <Box sx={{ display: 'flex', p: 2, gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      enviar()
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                />
                <Button onClick={enviar} variant="contained" disabled={!input.trim()}>
                  Enviar
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      {/* Dialog de confirmación para cerrar chat */}
      <Dialog
        open={dialogCerrar !== null}
        onClose={() => setDialogCerrar(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>¿Cerrar este chat?</DialogTitle>
        <DialogContent>
          <Typography>
            Esta acción marcará el chat como cerrado. El cliente ya no podrá enviar mensajes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogCerrar(null)}>Cancelar</Button>
          <Button
            onClick={() => dialogCerrar && cerrarChat(dialogCerrar)}
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineIcon />}
          >
            Cerrar chat
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}