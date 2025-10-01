import type { Metadata } from 'next'

/**
 * Layout para rutas públicas pero sensibles (KYC, tokens, etc.)
 * - noindex: No indexar en buscadores
 * - nofollow: No seguir enlaces
 * - Evita fugas de información sensible
 */
export const metadata: Metadata = {
  title: {
    template: '%s - Zirqulo',
    default: 'Verificación - Zirqulo',
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
