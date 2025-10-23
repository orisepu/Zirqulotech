/**
 * Configuración centralizada de URLs de entorno
 *
 * En desarrollo: Detecta automáticamente localhost o IP de red
 * En producción: Usa .env.production o default a https://zirqulotech.com
 */

// Función helper para obtener la URL base del API en desarrollo
function getDevApiUrl(): string {
  if (typeof window === 'undefined') {
    // En SSR, usar localhost por defecto
    return 'http://localhost:8000';
  }

  // En el navegador, detectar si estamos en localhost o IP de red
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  } else {
    // Si estamos en una IP de red, usar esa misma IP para el backend
    return `http://${hostname}:8000`;
  }
}

// API Base URL - Detecta automáticamente desarrollo vs producción
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development' ? getDevApiUrl() : 'https://zirqulotech.com');

// WebSocket Base URL (sin protocolo ws:// o wss://)
export const WS_BASE_HOST = process.env.NEXT_PUBLIC_WS_HOST ||
  (typeof window !== "undefined" ? window.location.host : "zirqulotech");

/**
 * Obtiene la URL completa del WebSocket con el protocolo correcto
 */
export function getWebSocketUrl(path: string): string {
  if (typeof window === "undefined") {
    return `wss://${WS_BASE_HOST}${path}`;
  }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${WS_BASE_HOST}${path}`;
}

/**
 * URL base pública para enlaces externos (sin /api)
 */
export const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://zirqulotech.com");