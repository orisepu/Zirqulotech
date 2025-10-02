'use client'

import { Box, Stack, Card, CardHeader, Tabs, Tab, Alert, Button, Chip, Typography } from '@mui/material'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import IncrementalUpdateControls from './IncrementalUpdateControls'
import { ValidationTabPanel } from './ValidationTabPanel'

// Types from the original page
type Cambio = {
  id: string
  kind: 'INSERT' | 'UPDATE' | 'DELETE'
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number
  capacidad_id?: number | null
  marca?: string
  antes: string | null
  despues: string | null
  delta: number | null
  nombre_likewize_original?: string
  nombre_normalizado?: string
  confianza_mapeo?: 'alta' | 'media' | 'baja'
  necesita_revision?: boolean
}

type DiffData = {
  summary: { inserts: number, updates: number, deletes: number, total: number }
  changes: Cambio[]
  comparaciones?: Array<{
    change_type?: string
    capacidad_id?: number
    staging_item_id?: string | number
    likewize_info?: {
      modelo_norm: string
      marca: string
      almacenamiento_gb: number
    }
    bd_info?: {
      modelo_descripcion: string
      marca: string
      capacidad: string
    }
    precio_info?: {
      precio_actual: number | null
      precio_nuevo: number | null
      diferencia: number | null
    }
    [key: string]: unknown
  }>
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`enhanced-tabpanel-${index}`}
      aria-labelledby={`enhanced-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

interface EnhancedLikewizePageProps {
  tareaId?: string
  onUpdateComplete?: (result: any) => void
}

export function EnhancedLikewizePage({
  tareaId,
  onUpdateComplete
}: EnhancedLikewizePageProps) {
  const [tabValue, setTabValue] = useState(0)
  const queryClient = useQueryClient()
  const activeTaskId = tareaId

  const diff = useQuery({
    queryKey: ['likewize_diff', activeTaskId],
    queryFn: async () => {
      if (!activeTaskId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${activeTaskId}/diff/`)
      return data as DiffData
    },
    enabled: !!activeTaskId,
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000,
  })

  const estado = useQuery({
    queryKey: ['likewize_tarea', activeTaskId],
    queryFn: async () => {
      if (!activeTaskId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${activeTaskId}/`)
      return data as { estado: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR', error_message?: string }
    },
    enabled: !!activeTaskId,
    refetchInterval: (q) => {
      const s = q.state.data?.estado
      return s && (s === 'SUCCESS' || s === 'ERROR') ? false : 1500
    },
  })

  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set())

  const aplicarCambios = useMutation({
    mutationFn: async (params: { staging_item_ids?: string[] }) => {
      if (!activeTaskId) throw new Error('No task ID')
      const { data } = await api.post(`/api/precios/likewize/tareas/${activeTaskId}/aplicar/`, {
        staging_item_ids: params.staging_item_ids
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['likewize_diff'] })
      queryClient.invalidateQueries({ queryKey: ['likewize_tarea'] })
      setSelectedChanges(new Set())
      if (onUpdateComplete) {
        onUpdateComplete({ success: true })
      }
    }
  })

  const handleUpdateComplete = (result: any) => {
    diff.refetch()
    estado.refetch()
    onUpdateComplete?.(result)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Card variant="outlined">
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Actualización" />
            <Tab label="Validación" />
            <Tab label="Cambios de Precios" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <IncrementalUpdateControls
              tareaId={tareaId}
              onUpdate={handleUpdateComplete}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ValidationTabPanel tareaId={activeTaskId} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3} sx={{ p: 2 }}>
              {!activeTaskId && (
                <Alert severity="info">
                  Ejecuta una actualización desde la pestaña "Actualización" para ver los cambios de precios.
                </Alert>
              )}

              {activeTaskId && diff.data?.summary && (
                <>
                  <Card variant="outlined">
                    <CardHeader title="Resumen de Cambios" />
                    <Box sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Typography variant="body2">
                          <strong>Nuevos:</strong> {diff.data.summary.inserts}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Actualizados:</strong> {diff.data.summary.updates}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Eliminados:</strong> {diff.data.summary.deletes}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Total:</strong> {diff.data.summary.total}
                        </Typography>
                      </Stack>
                    </Box>
                  </Card>

                  {diff.data.summary.total > 0 && (
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => aplicarCambios.mutate({})}
                      disabled={aplicarCambios.isPending}
                    >
                      {aplicarCambios.isPending ? 'Aplicando...' : `Aplicar ${diff.data.summary.total} Cambios`}
                    </Button>
                  )}
                </>
              )}

              {estado.data?.estado === 'ERROR' && (
                <Alert severity="error">
                  Error: {estado.data.error_message || 'Error desconocido'}
                </Alert>
              )}
            </Stack>
          </TabPanel>
        </Card>
      </Stack>
    </Box>
  )
}

export default EnhancedLikewizePage
