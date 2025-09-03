'use client'
import { useEffect, useState } from 'react'
import ManagerLayout from './ManagerLayout'
import LayoutInterno from './LayoutInterno'
import GeneralLayout from './GeneralLayout'
import { useUsuario } from "@/context/UsuarioContext";
export default function DashboardLayoutCliente({ children }: { children: React.ReactNode }) {
  const  usuario  = useUsuario();
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted || !usuario) {
    // Renderiza nada hasta que esté montado en cliente
    return null
  }

  if (usuario.es_empleado_interno) {
    return <LayoutInterno>{children}</LayoutInterno>
  }

  if (usuario.rol_actual?.rol === 'manager') {
    return <ManagerLayout>{children}</ManagerLayout>
  }

  return <GeneralLayout>{children}</GeneralLayout>
}
