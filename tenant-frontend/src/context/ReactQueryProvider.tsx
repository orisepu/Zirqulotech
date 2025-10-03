'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 5, // 5 minutos - tiempo que los datos permanecen en cache
        staleTime: 1000 * 60, // 1 minuto - tiempo antes de considerar datos obsoletos
        refetchOnWindowFocus: false,
        retry: 1, // Solo reintentar 1 vez en caso de error
      },
    },
  }))

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
