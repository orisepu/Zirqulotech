import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketWithRetryOptions {
  url: string;
  enabled?: boolean;
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
}

type ConnectionState = 'desconectado' | 'conectando' | 'conectado' | 'error' | 'reconectando';

export function useWebSocketWithRetry({
  url,
  enabled = true,
  maxRetries = 5,
  initialRetryDelay = 1000,
  maxRetryDelay = 30000,
  onMessage,
  onOpen,
  onError,
  onClose,
}: UseWebSocketWithRetryOptions) {
  const [estado, setEstado] = useState<ConnectionState>('desconectado');
  const socketRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const calcularRetryDelay = useCallback((intentos: number): number => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(initialRetryDelay * Math.pow(2, intentos), maxRetryDelay);
    // Añadir jitter aleatorio del 0-25% para evitar thundering herd
    const jitter = delay * 0.25 * Math.random();
    return delay + jitter;
  }, [initialRetryDelay, maxRetryDelay]);

  const limpiarRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const conectar = useCallback(() => {
    if (!enabled || socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    limpiarRetryTimeout();

    const esReintento = retryCountRef.current > 0;
    setEstado(esReintento ? 'reconectando' : 'conectando');

    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setEstado('conectado');
        retryCountRef.current = 0; // Reset retry count on successful connection
        onOpen?.();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          onMessage?.(data);
        } catch (error) {
          console.error('Error parseando mensaje WebSocket:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        setEstado('error');
        onError?.(error);
      };

      ws.onclose = () => {
        setEstado('desconectado');
        onClose?.();

        // Intentar reconexión si está habilitado y no hemos excedido max retries
        if (shouldReconnectRef.current && retryCountRef.current < maxRetries) {
          const delay = calcularRetryDelay(retryCountRef.current);
          console.log(`🔄 Reintentando conexión WebSocket en ${Math.round(delay / 1000)}s (intento ${retryCountRef.current + 1}/${maxRetries})`);

          retryTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            conectar();
          }, delay);
        } else if (retryCountRef.current >= maxRetries) {
          console.error('❌ Se alcanzó el máximo de reintentos WebSocket');
          setEstado('error');
        }
      };
    } catch (error) {
      console.error('Error creando WebSocket:', error);
      setEstado('error');
    }
  }, [url, enabled, maxRetries, calcularRetryDelay, limpiarRetryTimeout, onMessage, onOpen, onError, onClose]);

  const desconectar = useCallback(() => {
    shouldReconnectRef.current = false;
    limpiarRetryTimeout();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setEstado('desconectado');
  }, [limpiarRetryTimeout]);

  const enviar = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('⚠️ WebSocket no está conectado, no se puede enviar mensaje');
    return false;
  }, []);

  useEffect(() => {
    if (enabled) {
      shouldReconnectRef.current = true;
      conectar();
    }

    return () => {
      desconectar();
    };
  }, [url, enabled, conectar, desconectar]);

  return {
    estado,
    enviar,
    reconectar: conectar,
    desconectar,
    socket: socketRef.current,
  };
}
