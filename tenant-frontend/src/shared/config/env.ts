/**
 * Configuración centralizada de URLs de entorno
 */

// API Base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// WebSocket Base URL (sin protocolo ws:// o wss://)
export const WS_BASE_HOST = process.env.NEXT_PUBLIC_WS_HOST ||
  (typeof window !== "undefined" ? window.location.host : "localhost");

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
  (typeof window !== "undefined" ? window.location.origin : "http://localhost");