"use client";

import {
  Box,
  IconButton,
  Paper,
  Typography,
  TextField,
  Button,
  Tooltip,
  Badge,
  Chip,
} from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import ChatIcon from "@mui/icons-material/Chat";
import LinkIcon from "@mui/icons-material/Link";
import api from "@/services/api";
import { getSecureItem } from "@/shared/lib/secureStorage";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUsuario } from "@/context/UsuarioContext";
import { toast } from 'react-toastify';
import type { ReactNode } from 'react';
import { useWebSocketWithRetry } from "@/hooks/useWebSocketWithRetry";
interface Mensaje {
  autor: string;
  texto: string;
  oportunidad_id?: string | number;
  tenant?: string;
}

export default function ChatConSoporteContextual() {
  const usuario = useUsuario();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [noLeidos, setNoLeidos] = useState(0);
  type OportunidadMin = { cliente?: { razon_social?: string } } | null;
  const [oportunidad, setOportunidad] = useState<OportunidadMin>(null);
  const [wsUrl, setWsUrl] = useState<string>('');
  const [wsEnabled, setWsEnabled] = useState(true);
  const tokenRefreshAttemptsRef = useRef(0);
  const MAX_TOKEN_REFRESH_ATTEMPTS = 3;

  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Extraer oportunidadId de la ruta
  const oportunidadRef = (() => {
    const match = pathname.match(/\/oportunidades\/([\w-]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  })();

  // Query para obtener o crear chatId (POST /api/chat/soporte/)
  const { data: chatId } = useQuery({
    queryKey: ["chat-soporte", usuario?.id],
    queryFn: async () => {
      const res = await api.post("/api/chat/soporte/", { cliente_id: usuario?.id });
      return res.data.id;
    },
    enabled: !!usuario?.id,
    staleTime: Infinity,
  });

  // Query para obtener mensajes iniciales
  const { data: mensajesIniciales } = useQuery({
    queryKey: ["mensajes-chat", chatId],
    queryFn: async () => {
      const res = await api.get(`/api/chat/${chatId}/mensajes/`);
      return res.data;
    },
    enabled: !!chatId,
  });

  // Query para obtener datos de la oportunidad
  const { data: oportunidadData } = useQuery({
    queryKey: ["oportunidad", String(oportunidadRef)],
    queryFn: async () => {
      const res = await api.get(`/api/oportunidades/${oportunidadRef}/`);
      return res.data;
    },
    enabled: !!oportunidadRef,
  });

  // Actualizar estado mensajes cuando cambian los mensajes iniciales
  useEffect(() => {
    if (mensajesIniciales) {
      setMensajes(mensajesIniciales);
    }
  }, [mensajesIniciales]);

  // Actualizar oportunidad local
  useEffect(() => {
    if (oportunidadData) {
      setOportunidad(oportunidadData);
    }
  }, [oportunidadData]);

  // Construct WebSocket URL when chatId is available
  const [tokenRefreshTrigger, setTokenRefreshTrigger] = useState(0);

  useEffect(() => {
    const buildWsUrl = async () => {
      // IMPORTANTE: No construir URL si ya alcanzamos el límite
      if (tokenRefreshAttemptsRef.current >= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.warn('⚠️ No se construye URL: límite de intentos alcanzado');
        setWsUrl('');
        setWsEnabled(false);
        return;
      }

      if (!chatId || !usuario) {
        setWsUrl('');
        return;
      }

      const token = await getSecureItem('access');
      if (!token) {
        console.warn('⚠️ No se pudo obtener token para WebSocket');
        return;
      }

      const schema = await getSecureItem("schema");
      const currentTenant = await getSecureItem("currentTenant");
      const tenant = schema || currentTenant || "";

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/ws/chat/${encodeURIComponent(
        String(chatId)
      )}/?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenant)}`;

      console.log('🔄 Construyendo URL de WebSocket con token actualizado');
      setWsUrl(url);
    };

    buildWsUrl();
  }, [chatId, usuario, tokenRefreshTrigger]);

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
        console.log('🔒 Chat cerrado por soporte:', data.mensaje);
        setAbierto(false);
        toast.info('El chat fue cerrado por soporte. Se creará uno nuevo cuando vuelvas a escribir.');

        // Invalidar query para forzar creación de nuevo chat
        queryClient.invalidateQueries({ queryKey: ['chat-soporte', usuario?.id] });
        return;
      }

      // Mensaje normal
      const mensaje: Mensaje = data;
      const ahora = Date.now();

      setMensajes((prev) => {
        // Verificar duplicados solo en los últimos 10 mensajes
        const recientes = prev.slice(-10);
        const yaExiste = recientes.some(
          (m) =>
            m.texto === mensaje.texto &&
            m.oportunidad_id === mensaje.oportunidad_id &&
            m.autor === mensaje.autor
        );

        if (yaExiste) {
          return prev; // Ignorar duplicado
        }

        // Añadir mensaje con timestamp local
        return [...prev, { ...mensaje, _timestamp: ahora }];
      });

      if (!abierto && mensaje.autor !== usuario?.name) {
        setNoLeidos((prev) => prev + 1);
      }
    },
    onOpen: () => {
      console.log('✅ Chat WebSocket conectado');
      // Reset contador y reactivar en conexión exitosa
      tokenRefreshAttemptsRef.current = 0;
      setWsEnabled(true);
    },
    onClose: () => {
      console.warn('🔌 Chat WebSocket cerrado');

      // Incrementar ANTES de verificar
      const nuevoIntento = tokenRefreshAttemptsRef.current + 1;
      console.log(`📊 Contador actual: ${tokenRefreshAttemptsRef.current}, nuevo: ${nuevoIntento}, máximo: ${MAX_TOKEN_REFRESH_ATTEMPTS}`);

      // Verificar límite ANTES de hacer cambios
      if (nuevoIntento <= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.log(`🔄 Solicitando URL con token actualizado (intento ${nuevoIntento}/${MAX_TOKEN_REFRESH_ATTEMPTS})...`);
        tokenRefreshAttemptsRef.current = nuevoIntento;
        setTokenRefreshTrigger(prev => prev + 1);
      } else {
        console.error(`❌ LÍMITE ALCANZADO: ${nuevoIntento} > ${MAX_TOKEN_REFRESH_ATTEMPTS}. WebSocket DESHABILITADO permanentemente.`);
        tokenRefreshAttemptsRef.current = nuevoIntento;
        setWsEnabled(false); // Deshabilitar completamente
        setWsUrl(''); // Limpiar URL para asegurar que no se reconecte
      }
    },
    onError: (error) => {
      console.error('❌ Error en WebSocket del chat:', error);
      // No incrementar token refresh en error, solo en close después de reintentos
    },
  });

  // Scroll automático al final al cambiar mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  // Reset contador no leídos cuando se abre el chat
  useEffect(() => {
    if (abierto) setNoLeidos(0);
  }, [abierto]);

  // Cerrar al hacer clic fuera del panel flotante
  useEffect(() => {
    if (!abierto) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setAbierto(false);
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
    };
  }, [abierto]);

  // Función para enviar mensaje via websocket
  const enviar = () => {
    if (!input.trim()) return;
    const success = enviarWs({
      texto: input,
      oportunidad_id: oportunidadRef,
    });
    if (success) {
      setInput("");
    }
  };

  // Insertar referencia de oportunidad en input
  const insertarReferencia = () => {
    if (oportunidadRef) {
      const cliente = oportunidad?.cliente?.razon_social || "???";
      setInput((prev) => (prev + ` [Oportunidad #${oportunidadRef} - ${cliente}]`).trim());
    }
  };

  // Renderizar mensaje con posible link a oportunidad
  const renderMensaje = (msg: Mensaje): ReactNode => {
    const partes: ReactNode[] = [msg.texto];
    if (msg.oportunidad_id && msg.tenant) {
      partes.push(" ");
      partes.push(
        <Link
          key="link"
          href={`/clientes/oportunidades/${msg.oportunidad_id}`}
          style={{ textDecoration: "underline" }}
        >
          Ver oportunidad #{String(msg.oportunidad_id)}
        </Link>
      );
    }
    return partes;
  };

  return (
    <>
      <IconButton
        ref={toggleRef}
        onClick={() => setAbierto(!abierto)}
        sx={{ position: "fixed", bottom: 20, right: 20, zIndex: 1300 }}
        color="primary"
      >
        <Badge badgeContent={noLeidos} color="error">
          <ChatIcon fontSize="large" />
        </Badge>
      </IconButton>

      {abierto && (
        <Paper
          ref={panelRef}
          elevation={4}
          sx={{
            position: "fixed",
            bottom: 80,
            right: 20,
            width: 320,
            height: 500,
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="h6">Chat con Soporte</Typography>
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

          <Box
            ref={scrollRef}
            sx={{ flex: 1, overflowY: "auto", px: 2, py: 1 }}
          >
            {mensajes.map((msg, i) => {
              const soyYo = msg.autor === usuario?.name;
              return (
                <Box
                  key={i}
                  display="flex"
                  justifyContent={soyYo ? "flex-end" : "flex-start"}
                  mb={1}
                >
                  <Paper
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: soyYo ? "primary.main" : "grey.300",
                      color: soyYo ? "primary.contrastText" : "black",
                      maxWidth: "75%",
                    }}
                  >
                    {!soyYo && (
                      <Typography variant="subtitle2" fontWeight="bold">
                        {msg.autor}
                      </Typography>
                    )}
                    <Typography variant="body2">{renderMensaje(msg)}</Typography>
                  </Paper>
                </Box>
              );
            })}
          </Box>

          <Box display="flex" alignItems="center" gap={1} p={1}>
            <Tooltip title="Referenciar oportunidad">
              <IconButton onClick={insertarReferencia}>
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
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              disabled={estadoWs !== 'conectado'}
            />
            <Button onClick={enviar} variant="contained" disabled={!input.trim() || estadoWs !== 'conectado'}>
              Enviar
            </Button>
          </Box>
        </Paper>
      )}
    </>
  );
}
