'use client'

import DashboardShell from './DashboardShell'
import ChatPrincipal from '@/features/chat/components/ChatPrincipal'

export default function GeneralLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <ChatPrincipal />
    </>
  )
}
