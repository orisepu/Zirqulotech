import { NextResponse } from 'next/server'

type Results = Record<string, unknown>
type Store = Map<string, { results: Results; updatedAt: number }>

declare global {
   
  var __TEST_SESS_STORE__: Store | undefined
}

// In‑memory store (per Node.js process)
const store: Store = globalThis.__TEST_SESS_STORE__ ?? new Map()
globalThis.__TEST_SESS_STORE__ = store

export async function GET(req: Request) {
  const { pathname } = new URL(req.url)
  const m = pathname.match(/\/api\/test-sessions\/([^/]+)/)
  const id = m ? decodeURIComponent(m[1]) : ''
  const entry = store.get(id) || { results: {}, updatedAt: 0 }
  return NextResponse.json(entry)
}

export async function POST(req: Request) {
  const { pathname } = new URL(req.url)
  const m = pathname.match(/\/api\/test-sessions\/([^/]+)/)
  const id = m ? decodeURIComponent(m[1]) : ''
  const body = await req.json().catch(() => ({})) as Results
  const prev = store.get(id)?.results || {}
  const merged = { ...prev, ...body }
  store.set(id, { results: merged, updatedAt: Date.now() })
  return NextResponse.json({ ok: true })
}
