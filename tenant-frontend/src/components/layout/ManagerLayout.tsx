'use client'

import DashboardShell from './DashboardShell'
import ChatPrincipal from '../chat/ChatPrincipal'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <ChatPrincipal />
    </>
  )
}
