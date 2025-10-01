'use client'

import { useEffect } from 'react'
import ErrorUI from '@/shared/components/errors/ErrorUI'

/**
 * Error Boundary Global
 *
 * Captura errores a nivel de toda la aplicación, incluyendo errores
 * en el layout raíz (app/layout.tsx).
 *
 * IMPORTANTE: Debe replicar las etiquetas <html> y <body> porque
 * reemplaza completamente el layout raíz cuando hay un error.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#global-errorjs
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log del error a servicio de monitoreo (ej. Sentry, LogRocket)
    console.error('💥 ERROR GLOBAL:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })

    // Aquí podrías enviar a un servicio de monitoreo:
    // reportErrorToMonitoring(error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <ErrorUI
          error={error}
          reset={reset}
          showHomeButton
          title="Error crítico"
          description="La aplicación ha encontrado un error crítico. Por favor, recarga la página o vuelve al inicio."
        />
      </body>
    </html>
  )
}
