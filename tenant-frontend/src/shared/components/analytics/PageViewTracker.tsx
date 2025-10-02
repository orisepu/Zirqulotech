'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageview } from '@/shared/lib/analytics';

/**
 * PageViewTracker - Componente para tracking automático de navegación
 *
 * Detecta cambios de ruta en Next.js App Router y envía pageviews a GA4.
 * Incluye automáticamente el contexto del tenant actual.
 *
 * @usage
 * Incluir en el root layout o layout principal del dashboard:
 * ```tsx
 * <PageViewTracker />
 * ```
 *
 * @note
 * Solo funciona en producción. En desarrollo no envía eventos.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Solo track en producción y si GA está configurado
    if (process.env.NODE_ENV !== 'production') return;
    if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;

    // Construir URL completa con query params
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Enviar pageview (analytics.ts obtiene el tenant automáticamente)
    pageview(url);
  }, [pathname, searchParams]);

  // Este componente no renderiza nada
  return null;
}
