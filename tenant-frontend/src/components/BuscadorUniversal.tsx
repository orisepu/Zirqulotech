'use client'

import {
  InputBase, Paper, Popper, List, ListItemButton, ListItemText, CircularProgress
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useState, useRef, useEffect } from 'react'
import api from '@/services/api'
import { useRouter } from 'next/navigation'

export default function BuscadorUniversal() {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const anchorRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    if (!query) {
      setResultados(null)
      return
    }

    const timeout = setTimeout(() => {
      setLoading(true)
      api.get('/api/busqueda-global/', { params: { q: query } })
        .then(res => setResultados(res.data))
        .finally(() => setLoading(false))
    }, 400)

    return () => clearTimeout(timeout)
  }, [query])

  const handleNavigate = (tipo: string, item: any) => {
    setResultados(null) // cerrar popper
    console.log("Navegar a:", tipo, item)

    if (tipo === 'clientes') {
      router.push(`/clientes/${item.id}`)
    } else if (tipo === 'dispositivo') {
      router.push(`/dispositivos/${item.id}`)
    } else if (tipo === 'oportunidades' && item.schema && item.uuid) {
      router.push(`/oportunidades/global/${item.schema}/${item.uuid}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && resultados) {
      const posibles = Object.entries(resultados)
        .flatMap(([tipo, items]: any) => items.map((item: any) => ({ tipo, item })))

      if (posibles.length > 0) {
        const { tipo, item } = posibles[0]
        handleNavigate(tipo, item)
      }
    }
  }

  return (
    <div ref={anchorRef}>
      <Paper sx={{ display: 'flex', alignItems: 'center', p: 0.5 }}>
        <SearchIcon />
        <InputBase
          placeholder="Buscador universal"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ ml: 1, flex: 1 }}
        />
      </Paper>

      <Popper open={!!resultados} anchorEl={anchorRef.current} placement="bottom-start">
        <Paper
          sx={{
            mt: 1,
            width: 300,
            maxHeight: 400,
            overflow: 'auto',
            pointerEvents: 'auto',
            zIndex: 1300
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ m: 2 }} />
          ) : resultados ? (
            <List dense>
              {Object.entries(resultados).flatMap(([tipo, items]: any) =>
                items.map((item: any) => (
                  <ListItemButton
                    key={`${tipo}-${item.id}`}
                    component="div"
                    onClick={() => handleNavigate(tipo, item)}
                    >
                    <ListItemText
                      primary={
                        item.nombre ||
                        item.modelo ||
                        item.razon_social ||
                        item.imei ||
                        item.numero_serie ||
                        'Sin nombre'
                      }
                      
                    />
                  </ListItemButton>
                ))
              )}
            </List>
          ) : null}
        </Paper>
      </Popper>
    </div>
  )
}
