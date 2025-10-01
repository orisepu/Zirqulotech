'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'

/**
 * Error Boundary para Login
 *
 * Captura errores específicos de la página de login:
 * - Errores de conexión con el backend
 * - Errores de validación
 * - Errores de carga de la página
 */
export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error de login
    console.error('💥 ERROR EN LOGIN:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })

    // Aquí podrías enviar a un servicio de monitoreo:
    // reportErrorToMonitoring({
    //   error,
    //   context: 'login-page',
    // })
  }, [error])

  const isNetworkError =
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('API')

  let customTitle = 'Error al cargar el login'
  let customDescription =
    'Ha ocurrido un error al cargar la página de inicio de sesión. Por favor, recarga la página.'

  if (isNetworkError) {
    customTitle = 'Error de conexión'
    customDescription =
      'No se pudo conectar con el servidor de autenticación. Verifica tu conexión a internet e intenta de nuevo.'
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
