'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'
import { secureTokens } from '@/shared/lib/secureStorage'

/**
 * Error Boundary del Dashboard
 *
 * Captura errores en todas las páginas del dashboard privado.
 * - Registra errores para debugging
 * - Permite recuperación con botón reset
 * - Opción de volver al dashboard home
 *
 * Errores comunes que captura:
 * - Errores de red (API calls)
 * - Errores de autenticación
 * - Errores de renderizado de componentes
 * - Errores de queries de TanStack Query
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error con contexto del dashboard
    console.error('💥 ERROR EN DASHBOARD:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })

    // Verificar si es un error de autenticación
    const isAuthError =
      error.message.includes('401') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('token')

    if (isAuthError) {
      console.warn('⚠️ Error de autenticación detectado. Limpiando tokens...')
      // Limpiar tokens si es un error de auth
      secureTokens.removeAllTokens()

      // Redirigir al login después de un breve delay
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    }

    // Aquí podrías enviar a un servicio de monitoreo:
    // reportErrorToMonitoring({
    //   error,
    //   context: 'dashboard',
    //   userId: currentUser?.id,
    // })
  }, [error])

  // Detectar tipo de error para mensaje personalizado
  const isAuthError =
    error.message.includes('401') ||
    error.message.includes('Unauthorized') ||
    error.message.includes('token')

  const isNetworkError =
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED')

  let customTitle = 'Error en el dashboard'
  let customDescription = 'Ha ocurrido un error inesperado. Por favor, intenta recargar.'

  if (isAuthError) {
    customTitle = 'Sesión expirada'
    customDescription =
      'Tu sesión ha expirado. Serás redirigido al login en unos momentos...'
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
