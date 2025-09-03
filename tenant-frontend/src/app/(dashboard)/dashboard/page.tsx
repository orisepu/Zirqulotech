'use client'


import DashboardInterno from '@/components/dashboards/DashboardInterno'
import DashboardManager from '@/components/dashboards/DashboardManager'
import DashboardEmpleado from '@/components/dashboards/DashboardEmpleado'
import { useUsuario } from '@/context/UsuarioContext'
export default function DashboardPage() {
  const usuario = useUsuario();

  if (!usuario) return <p>Cargando...</p>

  if (usuario.es_empleado_interno) return <DashboardInterno />
  if (usuario.rol_actual?.rol === 'manager') return <DashboardManager />
  return <DashboardEmpleado />
}