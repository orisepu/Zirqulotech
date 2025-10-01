import type { Metadata } from 'next'
import LoginPageClient from '../LoginPageClient'

export const metadata: Metadata = {
  title: 'Iniciar Sesión - Zirqulo',
  description: 'Accede a tu cuenta de partner en Zirqulo',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return <LoginPageClient />
}
