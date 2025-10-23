import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import api from '@/services/api'

// Rutas públicas donde NO se debe verificar autenticación
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/gracias', '/']

export default function useUsuarioActual() {
  const pathname = usePathname()
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  const { data } = useQuery({
    queryKey: ['usuario-actual'],
    queryFn: async () => {
      const res = await api.get('/api/yo/')
      const global = res.data.global || {}
      const tenant = res.data.tenant || null
      return {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        rol_actual: global.rol_actual ?? null,
        es_superadmin: global.es_superadmin ?? false,
        es_empleado_interno: global.es_empleado_interno ?? false,
        tenant: tenant
          ? {
              schema: tenant.schema ?? null,
              name: tenant.name ?? null,
              solo_empresas: Boolean(tenant.solo_empresas),
              es_demo: Boolean(tenant.es_demo),
              management_mode: tenant.management_mode ?? null,
            }
          : null,
      }
    },
    // No ejecutar query en rutas públicas
    enabled: !isPublicRoute,
  })

  return data ?? null
}
