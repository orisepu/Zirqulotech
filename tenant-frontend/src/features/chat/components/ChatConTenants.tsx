'use client'
import { useTheme } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'
import api, { getAccessToken } from '@/services/api'
import { getWebSocketUrl } from '@/shared/config/env'
import {
  Box, Paper, Typography, Button, TextField, Tabs, Tab,
  Badge, IconButton, ListItemText, ListItemButton
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useQuery } from "@tanstack/react-query";
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
  const [usuarios, _setUsuarios] = useState<User[]>([])
  const [filtroChats, setFiltroChats] = useState('')
  const [filtroUsuarios, setFiltroUsuarios] = useState('')
  const [chatActivo, setChatActivo] = useState<number | null>(null)
  const [mensajesPorChat, setMensajesPorChat] = useState<Record<number, Mensaje[]>>({})
  const [input, setInput] = useState('')
  const [noLeidos, setNoLeidos] = useState<Record<number, number>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsConexiones = useRef<Record<number, WebSocket>>({})
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
  useEffect(() => {
    Notification.requestPermission()
  }, [])

  const { data: chats = [] } = useQuery<ChatInfo[]>({
    queryKey: ["chats-abiertos"],
    queryFn: async () => {
      const res = await api.get<ChatInfo[]>("/api/chats/abiertos/");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });
  useEffect(() => {
    const token = getAccessToken();

    chats.forEach((chat: ChatInfo) => {
      if (!wsConexiones.current[chat.id]) {
        const ws = new WebSocket(getWebSocketUrl(`/ws/chat/${chat.id}/?token=${token}&schema=${chat.schema}`));

        ws.onmessage = (e) => {
          const data: Mensaje = JSON.parse(e.data);

          setMensajesPorChat((prev) => {
            const anteriores = prev[chat.id] || [];
            return {
              ...prev,
              [chat.id]: [...anteriores, data],
            };
          });

          if (data.autor !== usuarioRef.current && chat.id !== chatActivo) {
            lanzarNotificacion(`Nuevo mensaje de ${data.autor}`, data.texto);
            setNoLeidos((prev) => ({
              ...prev,
              [chat.id]: (prev[chat.id] || 0) + 1,
            }));
          }
        };

        ws.onclose = () => delete wsConexiones.current[chat.id];
        wsConexiones.current[chat.id] = ws;
      }
    });
  }, [chats, chatActivo]);

  useEffect(() => {
    if (chatActivo && !mensajesPorChat[chatActivo]) {
      api.get(`/api/chat/${chatActivo}/mensajes/`)
        .then(res => {
          setMensajesPorChat((prev) => ({
            ...prev,
            [chatActivo]: res.data,
          }));
        })
        .catch(console.error);
    }
  }, [chatActivo, mensajesPorChat]);


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

  const seleccionarUsuario = async (user: User) => {
    const res = await api.post('/api/chat/soporte/', { cliente_id: user.id })
    setChatActivo(res.data.id)
    setTab('chats')
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
                    {chats
                      .filter(chat =>
                        chat.cliente_nombre.toLowerCase().includes(filtroChats.toLowerCase())
                      )
                      .map(chat => (
                        <ListItemButton
                          key={`chat-${chat.schema}-${chat.id}`}
                          
                          onClick={() => setChatActivo(chat.id)}
                          selected={chat.id === chatActivo}
                        >
                          <ListItemText
                            primary={chat.cliente_nombre}
                            secondary={chat.ultimo_mensaje}
                          />
                          {noLeidos[chat.id] > 0 && (
                            <Badge color="error" badgeContent={noLeidos[chat.id]} />
                          )}
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
                    {usuarios.map(user => (
                      <ListItemButton
                        key={`usuario-${user.id}`}
                        
                        onClick={() => seleccionarUsuario(user)}
                      >
                        <ListItemText primary={user.name} secondary={user.email} />
                      </ListItemButton>
                    ))}
                  </Box>
                </>
              )}
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                <IconButton onClick={() => setChatActivo(null)}>
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" sx={{ ml: 1 }}>Conversación</Typography>
              </Box>
              <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 2 }}>
                {mensajes.map((msg, i) => {
                  const soyYo = msg.autor === usuario
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        justifyContent: soyYo ? 'flex-end' : 'flex-start',
                        mb: 1,
                      }}
                    >
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
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        maxWidth: '75%',
                    }}
                    >
                        {!soyYo && <Typography variant="subtitle2">{msg.autor}</Typography>}
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
    </>
  )
}
