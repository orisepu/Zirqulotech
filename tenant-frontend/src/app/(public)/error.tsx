'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'

/**
 * Error Boundary para Rutas Públicas
 *
 * Captura errores en rutas públicas como:
 * - /kyc-upload/[token] - Verificación KYC
 * - Otras rutas accesibles sin autenticación
 *
 * Diferencias con el error boundary del dashboard:
 * - No intenta limpiar tokens de autenticación
 * - Mensajes más genéricos (no expone info de sesiones)
 * - Enfocado en errores de validación de tokens públicos
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error con contexto de ruta pública
    console.error('💥 ERROR EN RUTA PÚBLICA:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })

    // Aquí podrías enviar a un servicio de monitoreo:
    // reportErrorToMonitoring({
    //   error,
    //   context: 'public-route',
    // })
  }, [error])

  // Detectar errores comunes en rutas públicas
  const isTokenError =
    error.message.includes('token') ||
    error.message.includes('404') ||
    error.message.includes('410') ||
    error.message.includes('expirado')

  const isNetworkError =
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED')

  let customTitle = 'Error al cargar la página'
  let customDescription =
    'Ha ocurrido un error inesperado. Por favor, intenta recargar la página.'

  if (isTokenError) {
    customTitle = 'Enlace no válido o expirado'
    customDescription =
      'Este enlace no es válido o ha expirado. Por favor, solicita un nuevo enlace o contacta con soporte.'
  } else if (isNetworkError) {
    customTitle = 'Error de conexión'
    customDescription =
      'No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.'
  }

  return (
    <ErrorUI
      error={error}
      reset={reset}
      showHomeButton
      title={customTitle}
      description={customDescription}
    />
  )
}
