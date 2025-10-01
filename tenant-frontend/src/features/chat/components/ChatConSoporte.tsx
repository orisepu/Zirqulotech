// ChatConTenantsAdaptado.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/services/api'
import { getSecureItem } from '@/shared/lib/secureStorage'
import {
  Box, IconButton, Badge, Paper, Typography, TextField, Button, useTheme, Chip
} from '@mui/material'
import ChatIcon from '@mui/icons-material/Chat'
import CloseIcon from '@mui/icons-material/Close'
import Link from 'next/link'
import LinkIcon from '@mui/icons-material/Link'
import Tooltip from '@mui/material/Tooltip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import type { ReactNode } from 'react';
import { useWebSocketWithRetry } from '@/hooks/useWebSocketWithRetry';

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
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [noLeidos, setNoLeidos] = useState(0)
  const [wsUrl, setWsUrl] = useState<string>('')
  const [wsEnabled, setWsEnabled] = useState(true)
  const [tokenRefreshTrigger, setTokenRefreshTrigger] = useState(0)
  const tokenRefreshAttemptsRef = useRef(0)
  const MAX_TOKEN_REFRESH_ATTEMPTS = 3
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
  const { data: chatId, refetch: refetchChat } = useQuery({
    queryKey: ['chat-soporte', usuario?.id],
    queryFn: async () => {
      const res = await api.post('/api/chat/soporte/', { cliente_id: usuario?.id })
      const id = res.data?.id
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

  


  // Load chat history and construct WebSocket URL
  useEffect(() => {
    const setupChat = async () => {
      // IMPORTANTE: No construir URL si ya alcanzamos el límite
      if (tokenRefreshAttemptsRef.current >= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.warn('⚠️ No se construye URL: límite de intentos alcanzado')
        setWsUrl('')
        setWsEnabled(false)
        return
      }

      if (!chatId || !usuario) {
        setWsUrl('')
        return
      }

      // 1. Cargar historial PRIMERO
      try {
        const res = await api.get(`/api/chat/${chatId}/mensajes/`)
        setMensajes(res.data)
      } catch (error) {
        console.error('Error cargando historial:', error)
      }

      // 2. Construir WebSocket URL con token fresco
      const token = await getSecureItem('access')
      if (!token) {
        console.warn('⚠️ No se pudo obtener token para WebSocket')
        return
      }

      const schema = await getSecureItem("schema")
      const currentTenant = await getSecureItem("currentTenant")
      const tenant = schema || currentTenant || ""
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${window.location.host}/ws/chat/${chatId}/?token=${token}&tenant=${encodeURIComponent(tenant)}`

      console.log('🔄 Construyendo URL de WebSocket con token actualizado')
      setWsUrl(url)
    }

    setupChat()
  }, [chatId, usuario, tokenRefreshTrigger])

  // Use WebSocket hook with retry
  const { estado: estadoWs, enviar: enviarWs } = useWebSocketWithRetry({
    url: wsUrl,
    enabled: !!wsUrl && wsEnabled,
    maxRetries: 5,
    initialRetryDelay: 1000,
    maxRetryDelay: 30000,
    onMessage: (data) => {
      // Manejar cierre de chat
      if (data.type === 'chat_closed') {
        console.log('🔒 Chat cerrado por soporte:', data.mensaje)
        setAbierto(false)
        toast.info('El chat fue cerrado por soporte. Se creará uno nuevo cuando vuelvas a escribir.')

        // Invalidar query para forzar creación de nuevo chat
        queryClient.invalidateQueries({ queryKey: ['chat-soporte', usuario?.id] })
        return
      }

      // Mensaje normal
      const mensaje: Mensaje = data
      setMensajes(prev => [...prev, mensaje])
      if (mensaje.autor !== usuario?.name && !abierto) {
        playBeep()
        setNoLeidos(n => n + 1)
      }
    },
    onOpen: () => {
      console.log('✅ Chat WebSocket conectado')
      tokenRefreshAttemptsRef.current = 0
      setWsEnabled(true)
    },
    onClose: () => {
      console.warn('🔌 Chat WebSocket cerrado')

      const nuevoIntento = tokenRefreshAttemptsRef.current + 1
      console.log(`📊 Contador actual: ${tokenRefreshAttemptsRef.current}, nuevo: ${nuevoIntento}, máximo: ${MAX_TOKEN_REFRESH_ATTEMPTS}`)

      if (nuevoIntento <= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.log(`🔄 Solicitando URL con token actualizado (intento ${nuevoIntento}/${MAX_TOKEN_REFRESH_ATTEMPTS})...`)
        tokenRefreshAttemptsRef.current = nuevoIntento
        setTokenRefreshTrigger(prev => prev + 1)
      } else {
        console.error(`❌ LÍMITE ALCANZADO: ${nuevoIntento} > ${MAX_TOKEN_REFRESH_ATTEMPTS}. WebSocket DESHABILITADO permanentemente.`)
        tokenRefreshAttemptsRef.current = nuevoIntento
        setWsEnabled(false)
        setWsUrl('')
      }
    },
    onError: (error) => {
      console.error('❌ Error en WebSocket del chat:', error)
    },
  })

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
    const success = enviarWs({ texto: input })
    if (success) {
      setInput('')
    }
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
