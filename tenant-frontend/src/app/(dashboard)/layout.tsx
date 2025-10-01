import type { Metadata } from 'next'
import DashboardProviders from './DashboardProviders'

/**
 * Metadata para todas las páginas privadas del dashboard
 * - noindex: Evita indexación por motores de búsqueda
 * - nofollow: Evita seguimiento de enlaces
 * - Títulos genéricos: Evita fugas de información sensible
 */
export const metadata: Metadata = {
  title: {
    template: '%s - Zirqulo',
    default: 'Dashboard - Zirqulo',
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
  // Evita que se guarde en caché de navegador para páginas privadas
  other: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardProviders>{children}</DashboardProviders>
}
