/**
 * Logger utility que respeta NODE_ENV para evitar logs en producción
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/shared/lib/logger';
 *
 * logger.log('Debug info');        // Solo en development
 * logger.warn('Warning');          // Solo en development
 * logger.error('Error');           // Siempre se muestra
 * logger.info('Info');             // Solo en development
 * logger.debug('Debug');           // Solo en development
 * ```
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log general - solo en development
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Warnings - solo en development
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Errores - SIEMPRE se muestran (críticos para debugging en producción)
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },

  /**
   * Info - solo en development
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Debug - solo en development
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
};

/**
 * Helper para logs condicionales basados en flags personalizados
 *
 * @example
 * ```typescript
 * const debugWS = createConditionalLogger('NEXT_PUBLIC_DEBUG_WEBSOCKET');
 * debugWS.log('WebSocket event'); // Solo si NEXT_PUBLIC_DEBUG_WEBSOCKET=true
 * ```
 */
export function createConditionalLogger(envFlag: string) {
  const isEnabled = isDev || process.env[envFlag] === 'true';

  return {
    log: (...args: unknown[]) => isEnabled && console.log(...args),
    warn: (...args: unknown[]) => isEnabled && console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
    info: (...args: unknown[]) => isEnabled && console.info(...args),
    debug: (...args: unknown[]) => isEnabled && console.debug(...args),
  };
}
