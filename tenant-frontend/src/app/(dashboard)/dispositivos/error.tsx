'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'

/**
 * Error Boundary para Dispositivos
 *
 * Captura errores en las rutas de gestión de dispositivos:
 * - /dispositivos - Catálogo de dispositivos
 * - /dispositivos/actualizar - Actualización de precios
 * - /dispositivos/piezas - Gestión de piezas
 *
 * Errores comunes:
 * - Errores de carga de catálogo
 * - Errores de actualización de precios (Likewize, BackMarket)
 * - Errores de sincronización
 */
export default function DispositivosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error con contexto de dispositivos
    console.error('💥 ERROR EN DISPOSITIVOS:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    })
  }, [error])

  const isPriceUpdateError =
    error.message.includes('precio') ||
    error.message.includes('price') ||
    error.message.includes('Likewize') ||
    error.message.includes('BackMarket')

  const isSyncError =
    error.message.includes('sync') ||
    error.message.includes('actualizar') ||
    error.message.includes('update')

  let customTitle = 'Error en gestión de dispositivos'
  let customDescription =
    'Ha ocurrido un error al gestionar los dispositivos. Por favor, intenta de nuevo.'

  if (isPriceUpdateError) {
    customTitle = 'Error al actualizar precios'
    customDescription =
      'No se pudieron actualizar los precios desde el proveedor externo. Verifica la conexión e intenta de nuevo.'
  } else if (isSyncError) {
    customTitle = 'Error de sincronización'
    customDescription =
      'No se pudo sincronizar el catálogo de dispositivos. Los datos pueden estar desactualizados.'
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
