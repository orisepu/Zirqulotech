'use client'

import { Box, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material'
import { History as HistoryIcon } from '@mui/icons-material'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import EnhancedLikewizePage from '@/features/opportunities/components/devices/EnhancedLikewizePage'

export default function ActualizarPreciosV3() {
  const [tareaId, setTareaId] = useState<string | undefined>(undefined)

  // Consultar última tarea disponible
  const { data: ultimaTarea, isLoading, refetch } = useQuery({
    queryKey: ['ultima_tarea_likewize'],
    queryFn: async () => {
      const { data } = await api.get('/api/precios/likewize/ultima/')
      return data as { tarea_id: string, created_at: string, estado: string }
    },
    retry: 1
  })

  const handleCargarUltimaTarea = () => {
    if (ultimaTarea?.tarea_id) {
      setTareaId(ultimaTarea.tarea_id)
    }
  }

  const handleUpdateComplete = (result: any) => {
    // Cuando se completa una actualización, actualizar el tareaId
    if (result?.tarea_id) {
      setTareaId(result.tarea_id)
    }
    // Refrescar la última tarea disponible
    refetch()
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Actualización de Precios Likewize
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Actualización de precios desde Likewize con validación y corrección de mapeos
          </Typography>
        </Box>

        {/* Botón para cargar última tarea */}
        <Box>
          {isLoading ? (
            <CircularProgress size={24} />
          ) : ultimaTarea ? (
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={handleCargarUltimaTarea}
              disabled={tareaId === ultimaTarea.tarea_id}
            >
              Cargar Última Tarea
            </Button>
          ) : null}
        </Box>
      </Stack>

      {/* Info sobre tarea cargada */}
      {tareaId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Tarea activa: {tareaId}
        </Alert>
      )}

      {/* Main Content */}
      <EnhancedLikewizePage
        tareaId={tareaId}
        onUpdateComplete={handleUpdateComplete}
      />
    </Box>
  )
}