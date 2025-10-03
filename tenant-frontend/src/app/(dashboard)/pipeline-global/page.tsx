'use client'

import { Box, Typography, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import TablaReactiva from '@/shared/components/TablaReactiva2'
import { getIdlink } from '@/shared/utils/id'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ESTADOS_PIPELINEADMIN } from '@/context/estados'
import { columnasAdmin } from '@/shared/components/TablaColumnas2'

type PipelineItem = any
type PipelineResponse = {
  count: number
  next?: string | null
  previous?: string | null
  results: PipelineItem[]
}

export default function PipelineGlobalPage() {
  const router = useRouter()
  const ESTADOS_PIPELINE = ESTADOS_PIPELINEADMIN
  const [pagina, setPagina] = useState(1)   // 1-based
  const [porPagina, setPorPagina] = useState(10)
  const columnas = columnasAdmin

  const { data, isLoading, error } = useQuery<PipelineResponse>({
    queryKey: ['pipeline-global', ESTADOS_PIPELINE, pagina, porPagina],
    queryFn: async () => {
      const res = await api.post(
        '/api/pipeline-oportunidades/',
        { estados: ESTADOS_PIPELINE },
        { params: { page: pagina, page_size: porPagina, ordering: '-fecha_creacion' } }
      )
      return res.data
    },
  })

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Pipeline global de oportunidades
      </Typography>

      {isLoading ? (
        <CircularProgress />
      ) : error ? (
        <Typography color="error">Error al cargar oportunidades</Typography>
      ) : (
        <TablaReactiva
          oportunidades={data?.results || []}
          columnas={columnas}
          loading={isLoading}
          defaultSorting={[{ id: 'fecha_creacion', desc: true }]}
          onRowClick={(o) => router.push(`/oportunidades/global/${o.tenant}/${getIdlink(o)}`)}
          serverPagination
          totalCount={data?.count || 0}
          pageIndex={pagina - 1}                   // 0-based para la tabla
          pageSize={porPagina}
          onPageChange={(pi) => setPagina(pi + 1)} // tabla → state
          onPageSizeChange={(ps) => { setPagina(1); setPorPagina(ps) }}
        />
      )}
    </Box>
  )
}
