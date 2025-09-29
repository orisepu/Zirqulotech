'use client'

import { Box, Stack, Card, CardHeader, Tabs, Tab, Alert, Button, Chip, Typography } from '@mui/material'
import { useMemo, useState } from 'react'

// Import existing components (assuming they exist)
// import LikewizeB2BPage from '@/app/(dashboard)/dispositivos/actualizar/page'
import MappingMetrics from './MappingMetrics'
import IncrementalUpdateControls from './IncrementalUpdateControls'
import MappingConfidenceEnhanced from './MappingConfidenceEnhanced'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

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

export default function EnhancedLikewizePage({
  tareaId,
  onUpdateComplete
}: EnhancedLikewizePageProps) {
  const [tabValue, setTabValue] = useState(0)
  const [showLegacyInterface, setShowLegacyInterface] = useState(false)

  const {
    useMappingStatistics,
    useMappingsForReview,
    useAlgorithmComparison,
    getMappingConfidence
  } = useDeviceMappingEnhanced()

  const { data: statistics, refetch: refetchStatistics } = useMappingStatistics()
  const { data: reviewMappings } = useMappingsForReview({ limit: 100 })
  const { data: algorithmComparison } = useAlgorithmComparison()

  const systemNeedsAttention = useMemo(() => {
    if (!statistics) return false

    const total = statistics.total_mappings ?? 0
    const high = statistics.quality_distribution?.high ?? 0
    const medium = statistics.quality_distribution?.medium ?? 0
    const successRate = total ? (high + medium) / total : 1

    return successRate < 0.8 || (statistics.needs_review ?? 0) > 50
  }, [statistics])

  const totalMappings = statistics?.total_mappings ?? 0
  const highConfidence = statistics?.quality_distribution?.high ?? 0
  const mediumConfidence = statistics?.quality_distribution?.medium ?? 0
  const lowConfidence = statistics?.quality_distribution?.low ?? 0
  const successRate = totalMappings ? (highConfidence + mediumConfidence) / totalMappings : 1
  const avgConfidence = statistics?.avg_confidence ?? 0
  const needsReview = statistics?.needs_review ?? 0
  const algorithmsBreakdown = useMemo(() => {
    if (!statistics?.by_algorithm) return [] as Array<{
      name: string
      count: number
      details?: { total_mappings: number; avg_confidence: number; high_confidence_count: number; needs_review_count: number; avg_processing_time: number } | undefined
    }>

    return Object.entries(statistics.by_algorithm)
      .map(([name, count]) => ({
        name,
        count,
        details: algorithmComparison?.[name]
      }))
      .sort((a, b) => b.count - a.count)
  }, [statistics?.by_algorithm, algorithmComparison])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleUpdateComplete = (result: any) => {
    refetchStatistics()
    onUpdateComplete?.(result)
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Card variant="outlined">
          <CardHeader
            title="Actualización Inteligente de Dispositivos"
            subheader="Sistema mejorado con mapeo automático, procesamiento incremental y monitoreo en tiempo real"
            action={
              <Button
                variant="outlined"
                onClick={() => setShowLegacyInterface(!showLegacyInterface)}
              >
                {showLegacyInterface ? 'Interface Mejorada' : 'Interface Clásica'}
              </Button>
            }
          />
        </Card>

        {/* System Status Alert */}
        {statistics && systemNeedsAttention && (
          <Alert severity="warning">
            <Stack spacing={1}>
              <Box>
                <strong>El sistema necesita atención:</strong>
              </Box>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <span>Tasa de éxito actual: {(successRate * 100).toFixed(1)}%</span>
                <span>Mappings en revisión: {needsReview}</span>
                {avgConfidence < 70 && (
                  <span>Confianza promedio baja ({avgConfidence.toFixed(1)})</span>
                )}
              </Stack>
            </Stack>
          </Alert>
        )}

        {/* Legacy Interface Toggle */}
        {showLegacyInterface ? (
          <Card variant="outlined">
            <CardHeader title="Interface Clásica" />
            {/* Here you would include the original LikewizeB2BPage component */}
            <Alert severity="info">
              Interface clásica habilitada. Cambia a "Interface Mejorada" para acceder
              a las nuevas funcionalidades de mapeo inteligente.
            </Alert>
          </Card>
        ) : (
          <>
            {/* Enhanced Interface */}
            <Card variant="outlined">
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="enhanced likewize tabs"
                sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
              >
                <Tab label="Actualización Inteligente" />
                <Tab label="Métricas y Monitoreo" />
                <Tab label="Revisión de Mappings" />
                <Tab label="Análisis de Calidad" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <IncrementalUpdateControls
                  tareaId={tareaId}
                  onUpdate={handleUpdateComplete}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Stack spacing={3}>
                  <MappingMetrics tareaId={tareaId} />

                  {/* Additional metrics components */}
                  {statistics && (
                    <Card variant="outlined">
                      <CardHeader title="Estado Detallado del Sistema" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          <Box>
                            <strong>Tasa de éxito (7 días):</strong> {(successRate * 100).toFixed(1)}%
                          </Box>
                          <Box>
                            <strong>Confianza promedio:</strong> {avgConfidence.toFixed(1)}/100
                          </Box>
                          <Box>
                            <strong>Mappings en revisión:</strong> {needsReview.toLocaleString()}
                          </Box>
                          <Box>
                            <strong>Validaciones de usuario:</strong> {statistics.user_validated.toLocaleString()}
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip size="small" color="success" variant="outlined" label={`Alta: ${highConfidence}`} />
                            <Chip size="small" color="warning" variant="outlined" label={`Media: ${mediumConfidence}`} />
                            <Chip size="small" color="error" variant="outlined" label={`Baja: ${lowConfidence}`} />
                          </Stack>
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Card variant="outlined">
                  <CardHeader title="Revisión de Mappings Pendientes" />
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={3}>
                      <Alert severity="info">
                        Revisa los mappings marcados para verificación manual. Confirma los correctos y
                        captura observaciones para seguir entrenando el sistema.
                      </Alert>

                      <Stack spacing={1.5}>
                        {(reviewMappings ?? []).slice(0, 6).map((mapping) => {
                          const confidence = getMappingConfidence({
                            confidence_score: mapping.confidence_score,
                            mapping_algorithm: mapping.mapping_algorithm,
                            needs_review: true,
                            times_confirmed: 1
                          })

                          return (
                            <Card key={mapping.id} variant="outlined" sx={{ borderLeft: '3px solid', borderColor: 'primary.main' }}>
                              <Box sx={{ p: 1.5 }}>
                                <Stack spacing={1.5}>
                                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                    <Stack spacing={0.5}>
                                      <Typography variant="body2" fontWeight={600}>
                                        {mapping.extracted_model_name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {mapping.mapped_description}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Chip size="small" label={mapping.source_type.toUpperCase()} />
                                      {confidence && typeof confidence === 'object' && (
                                        <MappingConfidenceEnhanced confidence={confidence} compact />
                                      )}
                                    </Stack>
                                  </Stack>

                                  <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">
                                      A-number extraído: {mapping.extracted_a_number || '—'} · Capacidad: {mapping.extracted_capacity_gb ?? '—'} GB
                                    </Typography>
                                    {mapping.review_reason && (
                                      <Typography variant="caption" color="warning.main">
                                        Motivo: {mapping.review_reason}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                      Registrado: {new Date(mapping.created_at).toLocaleString()}
                                    </Typography>
                                  </Stack>
                                </Stack>
                              </Box>
                            </Card>
                          )
                        })}

                        {!reviewMappings?.length && (
                          <Alert severity="success" variant="outlined">
                            No hay mappings pendientes de revisión. ¡Buen trabajo!
                          </Alert>
                        )}
                      </Stack>

                      {reviewMappings?.length ? (
                        <Typography variant="caption" color="text.secondary">
                          Mostrando {Math.min(reviewMappings.length, 6)} de {reviewMappings.length} mappings en revisión.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Box>
                </Card>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Card variant="outlined">
                  <CardHeader title="Análisis de Calidad de Mappings" />
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={3}>
                      <Alert severity="info">
                        Análisis detallado de la calidad de los mappings automáticos.
                        Identifica patrones y oportunidades de mejora.
                      </Alert>

                      {statistics ? (
                        <Stack spacing={2}>
                          <Box>
                            <strong>Distribución de Confianza (7 días):</strong>
                            <Box sx={{ mt: 1, pl: 2 }}>
                              <div>Alta (≥85%): {highConfidence}</div>
                              <div>Media (60-84%): {mediumConfidence}</div>
                              <div>Baja (&lt;60%): {lowConfidence}</div>
                            </Box>
                          </Box>

                          <Box>
                            <strong>Distribución por Algoritmo:</strong>
                            <Stack spacing={0.75} sx={{ mt: 1, pl: 2 }}>
                              {algorithmsBreakdown.length ? (
                                algorithmsBreakdown.map(({ name, count, details }) => (
                                  <Typography key={name} variant="caption" color="text.secondary">
                                    {name}: {count} mappings
                                    {details && ` · Confianza media ${details.avg_confidence.toFixed(1)} · Alta ${details.high_confidence_count}`}
                                  </Typography>
                                ))
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Sin datos recientes.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Box>
                            <strong>Recomendaciones:</strong>
                            <Stack spacing={1} sx={{ mt: 1, pl: 2 }}>
                              {needsReview > 0 && (
                                <Alert severity="warning" variant="outlined">
                                  {needsReview} mappings están pendientes de revisión manual.
                                </Alert>
                              )}
                              {successRate < 0.85 && (
                                <Alert severity="info" variant="outlined">
                                  Considera reforzar la base de conocimiento o validar mappings de baja confianza.
                                </Alert>
                              )}
                              {successRate >= 0.85 && needsReview === 0 && (
                                <Alert severity="success" variant="outlined">
                                  El sistema se encuentra en parámetros saludables.
                                </Alert>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      ) : (
                        <Alert severity="info" variant="outlined">
                          No hay datos de calidad disponibles para el periodo seleccionado.
                        </Alert>
                      )}
                    </Stack>
                  </Box>
                </Card>
              </TabPanel>
            </Card>
          </>
        )}
      </Stack>
    </Box>
  )
}
