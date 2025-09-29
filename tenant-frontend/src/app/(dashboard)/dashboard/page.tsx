'use client'


import DashboardInterno from '@/features/dashboards/components/DashboardInterno'
import DashboardManager from '@/features/dashboards/components/DashboardManager'
import DashboardEmpleado from '@/features/dashboards/components/DashboardEmpleado'
import { useUsuario } from '@/context/UsuarioContext'
export default function DashboardPage() {
  const usuario = useUsuario();

  if (!usuario) return <p>Cargando...</p>

  if (usuario.es_empleado_interno) return <DashboardInterno />
  if (usuario.rol_actual?.rol === 'manager') return <DashboardManager />
  return <DashboardEmpleado />
}