import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { toastApiError } from './toastApiError'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Evita spam si el usuario ya tiene datos en caché y falla un refetch en background
      if (query.state.data !== undefined) return
      // Permite silenciar: queryFn puede pasar meta: { silent: true }
      if ((query.meta as any)?.silent) return
      toastApiError(error, '❌ Error cargando datos')
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if ((mutation.options as any)?.meta?.silent) return
      toastApiError(error, '❌ Operación no completada')
    },
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const msg = (mutation.options as any)?.meta?.successMessage
      if (msg) toast.success(msg)
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})
