'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'
import { useRouter } from 'next/navigation'

/**
 * Error Boundary para Clientes
 *
 * Captura errores en las rutas de clientes (CRM):
 * - /clientes - Lista de clientes
 * - /clientes/[id] - Detalle de cliente
 * - /clientes/oportunidades/[id] - Oportunidades de cliente
 *
 * Errores comunes:
 * - Cliente no encontrado (404)
 * - Errores de validación en formularios
 * - Errores de carga de datos
 */
export default function ClientesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Log del error con contexto de clientes
    console.error('💥 ERROR EN CLIENTES:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })
  }, [error])

  const isNotFoundError =
    error.message.includes('404') || error.message.includes('not found')

  const isValidationError =
    error.message.includes('validation') ||
    error.message.includes('invalid') ||
    error.message.includes('required')

  let customTitle = 'Error en clientes'
  let customDescription =
    'Ha ocurrido un error al gestionar los clientes. Por favor, intenta de nuevo.'

  if (isNotFoundError) {
    customTitle = 'Cliente no encontrado'
    customDescription =
      'El cliente que buscas no existe o ha sido eliminado. Vuelve a la lista de clientes.'
  } else if (isValidationError) {
    customTitle = 'Error de validación'
    customDescription =
      'Los datos ingresados no son válidos. Revisa los campos del formulario e intenta de nuevo.'
  }

  const handleGoToList = () => {
    router.push('/clientes')
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
