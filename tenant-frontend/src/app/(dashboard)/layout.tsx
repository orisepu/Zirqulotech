'use client'

import DashboardLayoutCliente from "@/components/layout/DashboardLayoutCliente"
import ReactQueryDevtoolsClient from "@/components/ReactQueryDevtoolsClient"
import { UsuarioProvider } from "@/context/UsuarioContext"
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/reactQuery'
import dynamic from 'next/dynamic'
const ToastContainer = dynamic(
  () => import('react-toastify').then(m => m.ToastContainer),
  { ssr: false }
)
import 'react-toastify/dist/ReactToastify.css'

dayjs.locale('es')

// 👇 Export nombrado (no default) para evitar conflicto
export function ChunkReload() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String(e?.reason?.message || e?.reason || '')
      if (/(ChunkLoadError|Loading chunk .* failed|CSS_CHUNK_LOAD_FAILED)/i.test(msg)) {
        location.reload()
      }
    }
    const onError = (e: ErrorEvent) => {
      // captura fallos de carga de <script>/<link> de chunks estáticos
      const target = e?.target as HTMLElement | null
      const src = (target as any)?.src || (target as any)?.href || ''
      if (src && /\/_next\/static\//.test(src)) location.reload()
    }
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError, true)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError, true)
    }
  }, [])
  return null
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <UsuarioProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          {/* 🔁 auto-reload si falla un chunk */}
          <ChunkReload />

          <DashboardLayoutCliente>
            {children}
          </DashboardLayoutCliente>

          {/* Devtools opcionales */}
          <ReactQueryDevtoolsClient />

          {/* Toaster global (client-only to avoid hydration mismatch) */}
          <ToastContainer position="top-right" newestOnTop theme="colored" />
        </LocalizationProvider>
      </UsuarioProvider>
    </QueryClientProvider>
  )
}
