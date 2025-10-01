import type { Metadata } from 'next'
import GraciasClient from './GraciasClient'

export const metadata: Metadata = {
  title: 'Gracias - Zirqulo',
  description: 'Hemos recibido tu documentación correctamente',
  robots: {
    index: false,
    follow: false,
  },
}

export default function GraciasPage() {
  return <GraciasClient />
}
