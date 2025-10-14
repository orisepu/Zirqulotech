import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';

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

  // Refs para evitar re-renders innecesarios
  const socketRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUrlRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Calcular delay con exponential backoff y jitter
  const calcularRetryDelay = useCallback((intentos: number): number => {
    const delay = Math.min(initialRetryDelay * Math.pow(2, intentos), maxRetryDelay);
    const jitter = delay * 0.25 * Math.random();
    return delay + jitter;
  }, [initialRetryDelay, maxRetryDelay]);

  // Limpiar timeout de retry
  const limpiarRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Cerrar socket actual si existe
  const cerrarSocketActual = useCallback(() => {
    if (socketRef.current) {
      // Remover handlers para evitar eventos durante el cierre
      const ws = socketRef.current;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      socketRef.current = null;
    }
  }, []);

  // Función principal de conexión
  const conectar = useCallback(() => {
    // Validaciones
    if (!enabled || !mountedRef.current) return;

    if (!url || url.trim() === '') {
      logger.warn('⚠️ useWebSocketWithRetry: URL vacía');
      return;
    }

    // Si ya hay una conexión ABIERTA con la misma URL, no hacer nada
    if (socketRef.current?.readyState === WebSocket.OPEN && currentUrlRef.current === url) {
      logger.log('✅ WebSocket ya conectado a esta URL, no se reconecta');
      return;
    }

    // Cerrar socket anterior si existe
    cerrarSocketActual();
    limpiarRetryTimeout();

    // Actualizar URL actual
    currentUrlRef.current = url;

    const esReintento = retryCountRef.current > 0;
    setEstado(esReintento ? 'reconectando' : 'conectando');

    try {
      logger.log(`🔌 Conectando WebSocket [intento ${retryCountRef.current + 1}/${maxRetries + 1}]: ${url.substring(0, 60)}...`);

      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        logger.log('✅ WebSocket conectado exitosamente');
        setEstado('conectado');
        retryCountRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(e.data);
          onMessage?.(data);
        } catch (error) {
          logger.error('❌ Error parseando mensaje WebSocket:', error);
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;

        logger.error('❌ Error en WebSocket:', {
          url: url.substring(0, 60) + '...',
          readyState: ws.readyState,
          retryCount: retryCountRef.current,
        });
        setEstado('error');
        onError?.(error);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        const isTokenExpired = event.code === 4401 || event.code === 4403;
        const isAbnormal = event.code === 1006;

        logger.warn('🔌 WebSocket cerrado:', {
          code: event.code,
          reason: event.reason || 'Sin razón',
          wasClean: event.wasClean,
          retryCount: retryCountRef.current,
          maxRetries,
          isTokenExpired,
        });

        setEstado('desconectado');

        // Si es por token expirado, notificar inmediatamente sin reintentos
        if (isTokenExpired) {
          logger.warn('🔐 Token expirado detectado (código 4401/4403), notificando al componente');
          retryCountRef.current = 0; // Reset para la próxima URL con token fresco
          onClose?.();
          return;
        }

        // Intentar reconexión automática
        if (retryCountRef.current < maxRetries) {
          const delay = calcularRetryDelay(retryCountRef.current);

          logger.log(`🔄 Programando reintento en ${Math.round(delay / 1000)}s...`);

          retryTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            conectar();
          }, delay);
        } else {
          // Alcanzado el límite de reintentos
          logger.error('❌ Límite de reintentos alcanzado');
          setEstado('error');
          onClose?.();
        }
      };

    } catch (error) {
      logger.error('❌ Error creando WebSocket:', error);
      setEstado('error');
    }
  }, [url, enabled, maxRetries, calcularRetryDelay, limpiarRetryTimeout, cerrarSocketActual, onMessage, onOpen, onError, onClose]);

  // Desconectar limpiamente
  const desconectar = useCallback(() => {
    logger.log('🛑 Desconectando WebSocket');
    limpiarRetryTimeout();
    cerrarSocketActual();
    setEstado('desconectado');
    retryCountRef.current = 0;
    currentUrlRef.current = '';
  }, [limpiarRetryTimeout, cerrarSocketActual]);

  // Enviar mensaje
  const enviar = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
      return true;
    }
    logger.warn('⚠️ No se puede enviar: WebSocket no está conectado');
    return false;
  }, []);

  // Effect principal: gestiona la conexión
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && url) {
      // Reset retry count cuando cambia la URL (probablemente un token nuevo)
      if (currentUrlRef.current !== url) {
        logger.log('🔄 URL cambió, reseteando contador de reintentos');
        retryCountRef.current = 0;
      }

      conectar();
    }

    // Cleanup: desconectar al desmontar o cuando cambie la URL
    return () => {
      mountedRef.current = false;
      desconectar();
    };
  }, [url, enabled]); // Solo depender de url y enabled

  return {
    estado,
    enviar,
    reconectar: conectar,
    desconectar,
    socket: socketRef.current,
  };
}