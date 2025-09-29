'use client'

import { useEffect, useState, type ComponentType } from 'react'

export default function ReactQueryDevtoolsClient() {
  const [Devtools, setDevtools] =
    useState<ComponentType<{ initialIsOpen: boolean }> | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    import('@tanstack/react-query-devtools')
      .then((mod) => setDevtools(() => mod.ReactQueryDevtools))
      .catch(() => {})
  }, [])

  if (!Devtools) return null
  return <Devtools initialIsOpen={false} />
}
