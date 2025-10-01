// ChatConTenantsAdaptado.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import api, { getAccessToken } from '@/services/api'
import { getWebSocketUrl } from '@/shared/config/env'
import {
  Box, IconButton, Badge, Paper, Typography, TextField, Button, useTheme, Chip
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close'
import Link from 'next/link'
import LinkIcon from '@mui/icons-material/Link'
import Tooltip from '@mui/material/Tooltip'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import type { ReactNode } from 'react';

type Mensaje = {
  autor: string
  texto: string
  oportunidad_id?: number
  tenant?: string
}
type ChatConTenantsAdaptadoProps = {
  oportunidad?: { id: number; tenant: string; cliente?: { razon_social?: string } }
}
function playBeep(frequency = 440, duration = 150) {
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

export default function ChatConTenantsAdaptado({ oportunidad }: ChatConTenantsAdaptadoProps) {
  const theme = useTheme()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [noLeidos, setNoLeidos] = useState(0)
  const [estadoWs, setEstadoWs] = useState<'desconectado' | 'conectando' | 'conectado' | 'error'>('desconectado')
  const socketRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Query para obtener usuario actual
  const { data: usuario } = useQuery({
    queryKey: ['usuario-actual'],
    queryFn: async () => {
      const res = await api.get('/api/yo/')
      return { id: res.data.id, name: res.data.username }
    },
    staleTime: 1000 * 60 * 5,
  })

  // Query para obtener o crear chat
  const { data: chatId } = useQuery({
    queryKey: ['chat-soporte', usuario?.id],
    queryFn: async () => {
      const guardado = localStorage.getItem('chat_id')
      if (guardado) {
        return parseInt(guardado)
      }
      const res = await api.post('/api/chat/soporte/', { cliente_id: usuario?.id })
      const id = res.data?.id
      if (id) {
        localStorage.setItem('chat_id', id.toString())
      }
      return id
    },
    enabled: !!usuario,
    staleTime: Infinity,
  })
  const renderMensaje = (msg: Mensaje): ReactNode => {
    const partes: ReactNode[] = [msg.texto];   
    if (msg.oportunidad_id && msg.tenant) {
      partes.push(' ');
      partes.push(
        <Link
          key="link"
          href={`/oportunidades/global/${msg.tenant}/${msg.oportunidad_id}`}
          style={{ textDecoration: 'underline' }}
        >
          Ver oportunidad #{msg.oportunidad_id}
        </Link>
      );
    }
    return <>{partes}</>; 
  };

  


  useEffect(() => {
    if (!chatId || !usuario) return

    const conectar = async () => {
      setEstadoWs('conectando')
      const token = getAccessToken()
      if (!token) {
        setEstadoWs('error')
        return
      }

<<<<<<< HEAD
      const wsUrl = getWebSocketUrl(`/ws/chat/${chatId}/?token=${token}`)
      const socket = new WebSocket(wsUrl)
=======
      // 1. Cargar historial PRIMERO
      try {
        const res = await api.get(`/api/chat/${chatId}/mensajes/`)
        setMensajes(res.data)
      } catch (error) {
        console.error('Error cargando historial:', error)
      }

      // 2. LUEGO conectar WebSocket
      const tenant = localStorage.getItem("schema") || localStorage.getItem("currentTenant") || ""
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socket = new WebSocket(
        `${proto}://${window.location.host}/ws/chat/${chatId}/?token=${token}&tenant=${encodeURIComponent(tenant)}`
      )
>>>>>>> 0b3dae74 (feat: improve responsive design and WebSocket reliability)
      socketRef.current = socket

      socket.onopen = () => {
        setEstadoWs('conectado')
      }

      socket.onmessage = (e) => {
        const data = JSON.parse(e.data)

        // Manejar cierre de chat
        if (data.type === 'chat_closed') {
          console.log('🔒 Chat cerrado por soporte:', data.mensaje)
          setEstadoWs('desconectado')
          socket.close()
          setAbierto(false)
          // Mostrar notificación
          toast.info(data.mensaje || 'El chat ha sido cerrado por el equipo de soporte')
          return
        }

        // Mensaje normal
        const mensaje: Mensaje = data
        setMensajes(prev => [...prev, mensaje])
        if (mensaje.autor !== usuario?.name && !abierto) {
          playBeep()
          setNoLeidos(n => n + 1)
        }
      }

      socket.onerror = (error) => {
        console.error('❌ Error en WebSocket del chat:', error)
        setEstadoWs('error')
      }

      socket.onclose = () => {
        console.warn('🔌 WebSocket cerrado')
        setEstadoWs('desconectado')
      }
    }

    conectar()
    return () => {
      socketRef.current?.close()
      setEstadoWs('desconectado')
    }
  }, [chatId, usuario])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mensajes])

  useEffect(() => {
    if (abierto) setNoLeidos(0)
  }, [abierto])

  const enviar = () => {
    if (!input.trim()) return
    socketRef.current?.send(JSON.stringify({ texto: input }))
    setInput('')
  }

  return (
    <>
      <IconButton
        onClick={() => setAbierto(!abierto)}
        sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1300 }}
        color="primary"
      >
        <Badge badgeContent={noLeidos} color="error">
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
            width: 320,
            height: 420,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300,
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} py={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1">Chat con Soporte</Typography>
              <Chip
                size="small"
                label={
                  estadoWs === 'conectado' ? 'Conectado' :
                  estadoWs === 'conectando' ? 'Conectando...' :
                  estadoWs === 'error' ? 'Error' : 'Desconectado'
                }
                color={
                  estadoWs === 'conectado' ? 'success' :
                  estadoWs === 'conectando' ? 'info' :
                  estadoWs === 'error' ? 'error' : 'default'
                }
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
            <IconButton onClick={() => setAbierto(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 2 }}>
            {mensajes.map((msg, i) => {
              const soyYo = msg.autor === usuario?.name
              return (
                <Box key={i} display="flex" justifyContent={soyYo ? 'flex-end' : 'flex-start'} mb={1}>
                  <Paper
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: soyYo ? 'primary.main' : theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300',
                      color: soyYo ? 'primary.contrastText' : theme.palette.text.primary,
                      maxWidth: '75%',
                    }}
                  >
                    {!soyYo && (
                      <Typography variant="subtitle2" fontWeight="bold">{msg.autor}</Typography>
                    )}
                    <Typography variant="body2">{renderMensaje(msg)}</Typography>
                  </Paper>
                </Box>
              )
            })}
          </Box>

          <Box display="flex" alignItems="center" gap={1} p={1}>
            <Tooltip title="Referenciar oportunidad">
              <IconButton
                onClick={() => {
                  if (oportunidad)
                    setInput(prev =>
                      (prev + ` [Oportunidad #${oportunidad.id} - ${oportunidad.cliente?.razon_social ?? ''}]`).trim()
                    )
                }}
                size="small"
              >
                <LinkIcon />
              </IconButton>
            </Tooltip>


            <TextField
              fullWidth
              size="small"
              placeholder="Escribe algo..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
            />
            <Button onClick={enviar} variant="contained" disabled={!input.trim()}>
              Enviar
            </Button>
          </Box>

        </Paper>
      )}
    </>
  )
}
