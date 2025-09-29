'use client'

import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Stack,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material'
import { Grid } from '@mui/material'
import { Refresh as RefreshIcon } from '@mui/icons-material'
import { useMemo } from 'react'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

interface MappingMetricsProps {
  compact?: boolean
}

const getStatusColor = (status: 'healthy' | 'warning' | 'critical' | 'error') => {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'warning':
      return 'warning'
    default:
      return 'error'
  }
}

export default function MappingMetrics({ compact = false }: MappingMetricsProps) {
  const { useMappingStatistics, useAlgorithmComparison } = useDeviceMappingEnhanced()

  const { data: statistics, isLoading, refetch } = useMappingStatistics()
  const { data: algorithmComparison } = useAlgorithmComparison()

  const totalMappings = statistics?.total_mappings ?? 0
  const highConfidence = statistics?.quality_distribution?.high ?? 0
  const mediumConfidence = statistics?.quality_distribution?.medium ?? 0
  const lowConfidence = statistics?.quality_distribution?.low ?? 0
  const successRate = totalMappings ? (highConfidence + mediumConfidence) / totalMappings : 1
  const avgConfidence = statistics?.avg_confidence ?? 0
  const needsReview = statistics?.needs_review ?? 0
  const userValidated = statistics?.user_validated ?? 0

  const status: 'healthy' | 'warning' | 'critical' = successRate >= 0.85 ? 'healthy' : successRate >= 0.65 ? 'warning' : 'critical'

  const algorithms = useMemo(() => {
    if (!algorithmComparison) return [] as Array<{
      name: string
      total_mappings: number
      avg_confidence: number
      high_confidence_count: number
      needs_review_count: number
      avg_processing_time: number
    }>

    return Object.entries(algorithmComparison).map(([name, data]) => ({ name, ...data }))
  }, [algorithmComparison])

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardHeader title="Métricas de Mapeo" />
        <CardContent>
          <LinearProgress />
        </CardContent>
      </Card>
    )
  }

  if (!statistics) {
    return (
      <Card variant="outlined">
        <CardHeader title="Métricas de Mapeo" />
        <CardContent>
          <Alert severity="info">No hay datos de métricas disponibles</Alert>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <Card variant="outlined" sx={{ minHeight: '120px' }}>
        <CardHeader
          title="Estado del Mapeo"
          action={
            <Tooltip title="Actualizar métricas">
              <IconButton size="small" onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
          sx={{ pb: 1 }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={status.toUpperCase()}
              color={getStatusColor(status) as any}
              size="small"
            />
            <Typography variant="body2">
              {(successRate * 100).toFixed(1)}% éxito
            </Typography>
            <Typography variant="body2">
              {avgConfidence.toFixed(1)} conf.
            </Typography>
            <Chip
              size="small"
              label={`${needsReview} en revisión`}
              color={needsReview > 0 ? 'warning' : 'success'}
              variant={needsReview > 0 ? 'outlined' : 'filled'}
            />
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Métricas del Sistema de Mapeo"
        action={
          <Tooltip title="Actualizar métricas">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Grid container spacing={3}>
          <Grid size={{xs:12, md:6}}>
            <Box>
              <Typography variant="h6" gutterBottom>Estado General</Typography>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Tasa de Éxito</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {(successRate * 100).toFixed(1)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={successRate * 100}
                    color={successRate >= 0.85 ? 'success' : successRate >= 0.65 ? 'warning' : 'error'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Confianza Promedio</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {avgConfidence.toFixed(1)}/100
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={avgConfidence}
                    color={avgConfidence >= 70 ? 'success' : 'warning'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" color="success" variant="outlined" label={`Alta: ${highConfidence}`} />
                    <Chip size="small" color="warning" variant="outlined" label={`Media: ${mediumConfidence}`} />
                    <Chip size="small" color="error" variant="outlined" label={`Baja: ${lowConfidence}`} />
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{xs:12, md:6}}>
            <Box>
              <Typography variant="h6" gutterBottom>Revisión y Calidad</Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Mappings en revisión</Typography>
                  <Chip size="small" color={needsReview > 0 ? 'warning' : 'success'} label={needsReview} />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Validaciones de usuario</Typography>
                  <Chip size="small" color="primary" label={userValidated} />
                </Stack>
                <Box>
                  <Typography variant="body2" gutterBottom>Por tipo de dispositivo</Typography>
                  <Stack spacing={0.5}>
                    {Object.entries(statistics.by_device_type || {}).map(([type, count]) => (
                      <Typography key={type} variant="caption" color="text.secondary">
                        {type}: {count} mappings
                      </Typography>
                    ))}
                    {Object.keys(statistics.by_device_type || {}).length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Sin datos recientes por tipo.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Grid>

          <Grid size={{xs:12}}>
            <Box>
              <Typography variant="h6" gutterBottom>Rendimiento por Algoritmo</Typography>
              {algorithms.length ? (
                <Grid container spacing={2}>
                  {algorithms.map((algorithm) => (
                    <Grid key={algorithm.name} size={{xs:12,md:6, lg:4}}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardHeader
                          title={algorithm.name}
                          subheader={`${algorithm.total_mappings} mappings`}
                          sx={{ pb: 0 }}
                        />
                        <CardContent sx={{ pt: 1.5 }}>
                          <Stack spacing={1}>
                            <Typography variant="caption" color="text.secondary">
                              Confianza media: {algorithm.avg_confidence.toFixed(1)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Alta confianza: {algorithm.high_confidence_count}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              En revisión: {algorithm.needs_review_count}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Tiempo medio: {Math.round(algorithm.avg_processing_time)} ms
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info" variant="outlined">
                  Aún no hay comparativa de algoritmos para el periodo seleccionado.
                </Alert>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
