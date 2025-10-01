import type { Metadata } from 'next'

/**
 * Layout para páginas de testing de dispositivos
 * - noindex: No indexar (son sesiones temporales)
 * - nofollow: No seguir enlaces
 */
export const metadata: Metadata = {
  title: 'Test de Dispositivo - Zirqulo',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
