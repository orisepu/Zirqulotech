'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageview, setUserProperties } from '@/shared/lib/analytics';
import useUsuarioActual from '@/shared/hooks/useUsuarioActual';

/**
 * PageViewTracker - Componente para tracking automático de navegación
 *
 * Detecta cambios de ruta en Next.js App Router y envía pageviews a GA4.
 * Incluye automáticamente el contexto del tenant y usuario actual.
 * Actualiza el título de la página con el nombre del tenant.
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
  const usuario = useUsuarioActual();

  // Configurar user properties cuando el usuario esté disponible
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
    if (!usuario) return;

    setUserProperties(
      usuario.id,
      usuario.rol_actual || undefined,
      usuario.tenant?.schema || undefined,
      usuario.tenant?.name || undefined,
      usuario.tenant?.es_demo
    );
  }, [usuario]);

  // Actualizar título de la página con el nombre del tenant
  useEffect(() => {
    if (!usuario?.tenant?.name) return;

    const baseTitle = 'Zirqulo';
    const tenantName = usuario.tenant.name;
    document.title = `${baseTitle} - ${tenantName}`;
  }, [usuario]);

  // Track pageviews
  useEffect(() => {
    // Solo track en producción y si GA está configurado
    if (process.env.NODE_ENV !== 'production') return;
    if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;

    // Construir URL completa con query params
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Enviar pageview con datos enriquecidos del usuario
    pageview(url, {
      user_id: usuario?.id,
      user_role: usuario?.rol_actual || undefined,
      tenant_schema: usuario?.tenant?.schema || undefined,
      tenant_name: usuario?.tenant?.name || undefined,
      is_demo: usuario?.tenant?.es_demo,
    });
  }, [pathname, searchParams, usuario]);

  // Este componente no renderiza nada
  return null;
}
