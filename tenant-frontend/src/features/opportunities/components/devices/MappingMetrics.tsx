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
              <Typography variant="h6" gutterBottom>Rendimiento por Algoritmo V2</Typography>
              {algorithms.length ? (
                <Stack spacing={3}>
                  {/* Resumen de estrategias */}
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Sistema V2:</strong> Utiliza estrategias híbridas optimizadas por tipo de dispositivo.
                      Mac (A-number First 95%+), iPhone/iPad (Name-Based + Enrichment 80%+).
                    </Typography>
                  </Alert>

                  <Grid container spacing={2}>
                    {algorithms.map((algorithm) => {
                      // Determinar icono y descripción por algoritmo
                      const getAlgorithmIcon = (name: string) => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('cache')) return '🚀'
                        if (lowerName.includes('exact') || lowerName.includes('a_number')) return '🎯'
                        if (lowerName.includes('fuzzy') || lowerName.includes('similar')) return '🔍'
                        if (lowerName.includes('heur') || lowerName.includes('rule')) return '🧠'
                        return '⚙️'
                      }

                      const getAlgorithmDescription = (name: string) => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('cache')) return 'Reutilización de mappings validados'
                        if (lowerName.includes('exact')) return 'Coincidencia exacta por códigos'
                        if (lowerName.includes('fuzzy')) return 'Mapeo por similitud ponderada'
                        if (lowerName.includes('heur')) return 'Reglas específicas por marca'
                        return 'Algoritmo personalizado'
                      }

                      const getPerformanceLevel = (confidence: number, reviewCount: number, totalMappings: number) => {
                        const reviewRate = totalMappings ? (reviewCount / totalMappings) * 100 : 0
                        if (confidence >= 90 && reviewRate < 10) return { level: 'Excelente', color: 'success' as const }
                        if (confidence >= 80 && reviewRate < 20) return { level: 'Bueno', color: 'success' as const }
                        if (confidence >= 70 && reviewRate < 30) return { level: 'Regular', color: 'warning' as const }
                        return { level: 'Necesita mejora', color: 'error' as const }
                      }

                      const performance = getPerformanceLevel(
                        algorithm.avg_confidence,
                        algorithm.needs_review_count,
                        algorithm.total_mappings
                      )

                      return (
                        <Grid key={algorithm.name} size={{xs:12, md:6, lg:4}}>
                          <Card variant="outlined" sx={{ height: '100%', position: 'relative' }}>
                            <CardHeader
                              title={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <span>{getAlgorithmIcon(algorithm.name)}</span>
                                  <Typography variant="subtitle2" fontWeight={600}>
                                    {algorithm.name.charAt(0).toUpperCase() + algorithm.name.slice(1)}
                                  </Typography>
                                </Stack>
                              }
                              subheader={getAlgorithmDescription(algorithm.name)}
                              sx={{ pb: 1 }}
                              action={
                                <Chip
                                  size="small"
                                  label={performance.level}
                                  color={performance.color}
                                  variant="outlined"
                                />
                              }
                            />
                            <CardContent>
                              <Stack spacing={2}>
                                {/* Métricas principales */}
                                <Box>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      Confianza Promedio
                                    </Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                      {algorithm.avg_confidence.toFixed(1)}%
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    variant="determinate"
                                    value={algorithm.avg_confidence}
                                    color={algorithm.avg_confidence >= 85 ? 'success' : algorithm.avg_confidence >= 70 ? 'warning' : 'error'}
                                    sx={{ height: 4, borderRadius: 2 }}
                                  />
                                </Box>

                                {/* Estadísticas detalladas */}
                                <Stack spacing={1}>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      Total procesados
                                    </Typography>
                                    <Typography variant="caption" fontWeight={600}>
                                      {algorithm.total_mappings.toLocaleString()}
                                    </Typography>
                                  </Stack>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      Alta confianza
                                    </Typography>
                                    <Typography variant="caption" fontWeight={600} color="success.main">
                                      {algorithm.high_confidence_count.toLocaleString()}
                                    </Typography>
                                  </Stack>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      En revisión
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      fontWeight={600}
                                      color={algorithm.needs_review_count > 0 ? 'warning.main' : 'text.secondary'}
                                    >
                                      {algorithm.needs_review_count.toLocaleString()}
                                    </Typography>
                                  </Stack>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption" color="text.secondary">
                                      Tiempo procesamiento
                                    </Typography>
                                    <Typography variant="caption" fontWeight={600}>
                                      {Math.round(algorithm.avg_processing_time)}ms
                                    </Typography>
                                  </Stack>
                                </Stack>

                                {/* Indicador de eficiencia */}
                                <Box sx={{ mt: 1 }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="caption" color="text.secondary">
                                      Eficiencia:
                                    </Typography>
                                    <LinearProgress
                                      variant="determinate"
                                      value={algorithm.total_mappings > 0 ? ((algorithm.total_mappings - algorithm.needs_review_count) / algorithm.total_mappings) * 100 : 0}
                                      color="primary"
                                      sx={{ flex: 1, height: 3, borderRadius: 1.5 }}
                                    />
                                    <Typography variant="caption" color="primary.main" fontWeight={600}>
                                      {algorithm.total_mappings > 0 ? (((algorithm.total_mappings - algorithm.needs_review_count) / algorithm.total_mappings) * 100).toFixed(0) : 0}%
                                    </Typography>
                                  </Stack>
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      )
                    })}
                  </Grid>

                  {/* Recomendaciones basadas en métricas */}
                  <Card variant="outlined" sx={{ backgroundColor: 'action.hover' }}>
                    <CardHeader title="🎯 Recomendaciones del Sistema V2" />
                    <CardContent>
                      <Stack spacing={1}>
                        {algorithms.some(a => a.needs_review_count > a.total_mappings * 0.2) && (
                          <Alert severity="warning" variant="outlined">
                            Algunos algoritmos tienen alta tasa de revisión. Considera ajustar umbral de confianza.
                          </Alert>
                        )}
                        {algorithms.some(a => a.avg_confidence < 75) && (
                          <Alert severity="info" variant="outlined">
                            Oportunidad: Enriquecer base de conocimiento para mejorar precisión de algoritmos difusos.
                          </Alert>
                        )}
                        {algorithms.every(a => a.avg_confidence >= 80) && (
                          <Alert severity="success" variant="outlined">
                            ¡Excelente! Todos los algoritmos mantienen alta precisión. Sistema funcionando óptimamente.
                          </Alert>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
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
