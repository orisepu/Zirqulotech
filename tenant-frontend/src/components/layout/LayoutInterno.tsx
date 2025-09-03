'use client'

import LayoutInternoShell from './LayoutInternoShell'
import ChatPrincipal from '../chat/ChatPrincipal'

export default function LayoutInterno({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LayoutInternoShell>{children}</LayoutInternoShell>
      <ChatPrincipal />
    </>
  )
}
