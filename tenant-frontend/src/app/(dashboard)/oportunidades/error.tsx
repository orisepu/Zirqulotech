'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'
import { useRouter } from 'next/navigation'

/**
 * Error Boundary para Oportunidades
 *
 * Captura errores en las rutas de oportunidades:
 * - /oportunidades - Lista de oportunidades
 * - /oportunidades/[id] - Detalle de oportunidad
 * - /oportunidades/global/[tenant]/[id] - Oportunidades globales
 *
 * Errores comunes:
 * - Oportunidad no encontrada (404)
 * - Permisos insuficientes (403)
 * - Errores de carga de datos
 * - Errores de mutación (crear/editar)
 */
export default function OportunidadesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log del error con contexto de oportunidades
    console.error('💥 ERROR EN OPORTUNIDADES:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })

    // Aquí podrías enviar a un servicio de monitoreo:
    // reportErrorToMonitoring({
    //   error,
    //   context: 'oportunidades',
    // })
  }, [error])

  // Detectar tipos de error específicos
  const isNotFoundError =
    error.message.includes('404') || error.message.includes('not found')

  const isPermissionError =
    error.message.includes('403') ||
    error.message.includes('Forbidden') ||
    error.message.includes('permission')

  const isDataError =
    error.message.includes('fetch') ||
    error.message.includes('query') ||
    error.message.includes('TanStack')

  let customTitle = 'Error en oportunidades'
  let customDescription =
    'Ha ocurrido un error al cargar las oportunidades. Por favor, intenta de nuevo.'

  if (isNotFoundError) {
    customTitle = 'Oportunidad no encontrada'
    customDescription =
      'La oportunidad que buscas no existe o ha sido eliminada. Vuelve a la lista de oportunidades.'
  } else if (isPermissionError) {
    customTitle = 'Acceso denegado'
    customDescription =
      'No tienes permisos para acceder a esta oportunidad. Contacta con tu administrador si crees que es un error.'
  } else if (isDataError) {
    customTitle = 'Error al cargar datos'
    customDescription =
      'No se pudieron cargar los datos de la oportunidad. Verifica tu conexión e intenta de nuevo.'
  }

  const handleGoToList = () => {
    router.push('/oportunidades')
  }

  return (
    <ErrorUI
      error={error}
      reset={isNotFoundError ? handleGoToList : reset}
      showHomeButton
      title={customTitle}
      description={customDescription}
    />
  )
}
