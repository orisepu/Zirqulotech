import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

export default function useUsuarioActual() {
  const { data } = useQuery({
    queryKey: ['usuario-actual'],
    queryFn: async () => {
      const res = await api.get('/api/yo/')
      const global = res.data.global || {}
      return {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        rol_actual: global.rol_actual ?? null,
        es_superadmin: global.es_superadmin ?? false,
        es_empleado_interno: global.es_empleado_interno ?? false,
      }
    },
  })

  return data ?? null
}
