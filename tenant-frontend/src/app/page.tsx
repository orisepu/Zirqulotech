import type { Metadata } from 'next'
import LoginPageClient from './LoginPageClient'

export const metadata: Metadata = {
  title: 'Zirqulo - Plataforma de Gestión de Trade-In',
  description: 'Plataforma integral para la gestión de dispositivos móviles, valoraciones y operaciones de compraventa. Accede a tu cuenta de partner.',
  keywords: ['trade-in', 'dispositivos móviles', 'valoración', 'compraventa', 'gestión', 'partners'],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Zirqulo - Plataforma de Gestión de Trade-In',
    description: 'Plataforma integral para la gestión de dispositivos móviles y operaciones de compraventa.',
    type: 'website',
    locale: 'es_ES',
  },
}

export default function LoginPage() {
  return <LoginPageClient />
}
