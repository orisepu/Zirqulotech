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
} from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import ChatIcon from "@mui/icons-material/Chat";
import LinkIcon from "@mui/icons-material/Link";
import api, { getAccessToken } from "@/services/api";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useUsuario } from "@/context/UsuarioContext";
import type { ReactNode } from 'react';
interface Mensaje {
  autor: string;
  texto: string;
  oportunidad_id?: string | number;
  tenant?: string;
  es_local?: boolean;
}

export default function ChatConSoporteContextual() {
  const usuario = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [socketListo, setSocketListo] = useState(false);
  type OportunidadMin = { cliente?: { razon_social?: string } } | null;
  const [oportunidad, setOportunidad] = useState<OportunidadMin>(null);

  const socketRef = useRef<WebSocket | null>(null);
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

  // Configurar websocket cuando haya chatId y usuario
  useEffect(() => {
    if (!chatId || !usuario) return;

    const token = getAccessToken();
    const tenant =
      (typeof window !== "undefined" && (localStorage.getItem("schema") || localStorage.getItem("currentTenant"))) || "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws/chat/${encodeURIComponent(
      String(chatId)
    )}/?token=${encodeURIComponent(token || "")}&tenant=${encodeURIComponent(tenant)}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setSocketListo(true);
      socketRef.current = ws;
    };

    ws.onmessage = (e) => {
      const data: Mensaje = JSON.parse(e.data);

      setMensajes((prev) => {
        const yaExiste = prev.some(
          (m) =>
            m.texto === data.texto &&
            m.oportunidad_id === data.oportunidad_id &&
            m.autor === data.autor
        );
        return yaExiste ? prev : [...prev, data];
      });

      if (!abierto && data.autor !== usuario?.name) {
        setNoLeidos((prev) => prev + 1);
      }
    };

    ws.onclose = () => {
      setSocketListo(false);
      socketRef.current = null;
    };

    return () => {
      ws.close();
      setSocketListo(false);
    };
  }, [chatId, usuario, abierto]);

  // Scroll automático al final al cambiar mensajes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  const [noLeidos, setNoLeidos] = useState(0);

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
    if (!input.trim() || !socketRef.current) return;
    if (socketRef.current.readyState === WebSocket.OPEN) {
      const nuevo: Mensaje = {
        autor: usuario?.name || "Yo",
        texto: input,
        oportunidad_id: oportunidadRef ?? undefined,
        es_local: true,
      };
      socketRef.current.send(
        JSON.stringify({
          texto: input,
          oportunidad_id: oportunidadRef,
        })
      );
      setInput("");
      setMensajes((prev) => [...prev, nuevo]);
    } else {
      console.warn("⛔ WebSocket aún no está listo para enviar");
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
            sx={{ px: 2, py: 1, bgcolor: "primary.main", color: "primary.contrastText" }}
          >
            <Typography variant="h6">Chat con Soporte</Typography>
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
              disabled={!socketListo}
            />
            <Button onClick={enviar} variant="contained" disabled={!input.trim() || !socketListo}>
              Enviar
            </Button>
          </Box>
        </Paper>
      )}
    </>
  );
}
