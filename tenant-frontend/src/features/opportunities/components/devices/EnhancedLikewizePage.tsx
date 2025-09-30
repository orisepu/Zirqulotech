'use client'

import { Box, Stack, Card, CardHeader, Tabs, Tab, Alert, Button, Chip, Typography, LinearProgress, Grid, Paper } from '@mui/material'
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AutoAwesome, Psychology, Speed, TrendingUp } from '@mui/icons-material'
import api from '@/services/api'

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
  // Propiedades V3
  is_v3?: boolean
  resumen?: {
    total_comparaciones?: number
    inserciones?: number
    actualizaciones?: number
    eliminaciones?: number
    sin_cambios?: number
  }
  v3_stats?: {
    confidence_stats?: {
      promedio?: number
      alta_confianza?: number
      media_confianza?: number
      baja_confianza?: number
    }
  }
  comparaciones?: Array<{
    change_type?: string
    likewize_info?: {
      modelo_raw?: string
      modelo_norm?: string
      likewize_model_code?: string
      marca?: string
      almacenamiento_gb?: string | number
    }
    [key: string]: any
  }>
}

// Import existing components (assuming they exist)
// import LikewizeB2BPage from '@/app/(dashboard)/dispositivos/actualizar/page'
import MappingMetrics from './MappingMetrics'
import IncrementalUpdateControls from './IncrementalUpdateControls'
import MappingConfidenceEnhanced from './MappingConfidenceEnhanced'
import DeviceMappingStrategy from './DeviceMappingStrategy'
import MappingAuditPanel from './MappingAuditPanel'
import { ReviewPanel } from './ReviewPanel'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'
import { useLearningMetrics, useLaunchV3UpdateTask, useRealTimeLearningMetrics, useTaskMonitoring, useActiveV3Tasks } from '@/hooks/useLearningV3'

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
  const [showLegacyInterface, setShowLegacyInterface] = useState(false)
  const [isV3UpdateRunning, setIsV3UpdateRunning] = useState(false)
  const [currentV3TaskId, setCurrentV3TaskId] = useState<string | null>(null)

  const {
    useMappingStatistics,
    useMappingsForReview,
    useAlgorithmComparison,
    getMappingConfidence
  } = useDeviceMappingEnhanced()

  // V3 Learning System Integration
  const { data: learningMetrics, refetch: refetchLearningMetrics } = useLearningMetrics()
  const { mutate: launchV3Update, isPending: isLaunchingV3 } = useLaunchV3UpdateTask()
  const { data: realTimeMetrics } = useRealTimeLearningMetrics(isV3UpdateRunning)

  // V3 Task Monitoring
  const { data: activeTasks } = useActiveV3Tasks()
  const taskMonitoring = useTaskMonitoring(currentV3TaskId || '', !!currentV3TaskId)

  // Query real diff data - prioritize V3 task if available
  const activeTaskId = currentV3TaskId || tareaId
  const isV3Task = !!currentV3TaskId

  const diff = useQuery({
    queryKey: ['likewize_diff', activeTaskId, isV3Task ? 'v3' : 'v1'],
    queryFn: async () => {
      if (!activeTaskId) return null

      // Use V3 endpoint for V3 tasks, regular endpoint for V1/V2 tasks
      const endpoint = isV3Task
        ? `/api/likewize/v3/tareas/${activeTaskId}/diff/`
        : `/api/precios/likewize/tareas/${activeTaskId}/diff/`

      const { data } = await api.get(endpoint)
      return data as DiffData
    },
    enabled: !!activeTaskId,
    staleTime: 30_000
  })

  // Task status query - use active task
  const estado = useQuery({
    queryKey: ['likewize_tarea', activeTaskId, isV3Task ? 'v3' : 'v1'],
    queryFn: async () => {
      if (!activeTaskId) return null

      // Use V3 monitoring endpoint for V3 tasks
      const endpoint = isV3Task
        ? `/api/likewize/v3/tareas/${activeTaskId}/estado/`
        : `/api/precios/likewize/tareas/${activeTaskId}/`

      const { data } = await api.get(endpoint)

      // Normalize response format
      if (isV3Task && data?.task) {
        return {
          estado: data.task.estado,
          error_message: data.task.error_message
        }
      }

      return data as { estado: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR', error_message?: string }
    },
    enabled: !!activeTaskId,
    refetchInterval: (q) => {
      const s = q.state.data?.estado
      return s && (s === 'SUCCESS' || s === 'ERROR') ? false : 1500
    },
  })

  const { data: statistics, refetch: refetchStatistics } = useMappingStatistics()
  const { data: reviewMappings } = useMappingsForReview({ limit: 100 })
  const { data: algorithmComparison } = useAlgorithmComparison()

  // Mutation for applying V3 changes
  const queryClient = useQueryClient()
  const aplicarCambiosV3 = useMutation({
    mutationFn: async (params: {
      tarea_id: string
      aplicar_inserciones?: boolean
      aplicar_actualizaciones?: boolean
      aplicar_eliminaciones?: boolean
      confidence_threshold?: number
    }) => {
      const { data } = await api.post(`/api/likewize/v3/tareas/${params.tarea_id}/aplicar/`, {
        aplicar_inserciones: params.aplicar_inserciones ?? true,
        aplicar_actualizaciones: params.aplicar_actualizaciones ?? true,
        aplicar_eliminaciones: params.aplicar_eliminaciones ?? false,
        confidence_threshold: params.confidence_threshold ?? 0.7
      })
      return data
    },
    onSuccess: () => {
      // Invalidate relevant queries after applying changes
      queryClient.invalidateQueries({ queryKey: ['likewize_diff'] })
      queryClient.invalidateQueries({ queryKey: ['likewize_tarea'] })
      refetchStatistics()
    }
  })

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
    refetchLearningMetrics()
    onUpdateComplete?.(result)
  }

  const handleLaunchV3Update = () => {
    setIsV3UpdateRunning(true)
    launchV3Update({
      enable_learning: true,
      confidence_threshold: 0.7,
      parallel_requests: 5
    }, {
      onSuccess: (result) => {
        console.log('V3 Update Success:', result)
        if (result?.tarea_id) {
          setCurrentV3TaskId(result.tarea_id)
        }
        handleUpdateComplete(result)
        // Keep V3 running state until task completes
      },
      onError: (error) => {
        console.error('V3 Update Error:', error)
        setIsV3UpdateRunning(false)
        setCurrentV3TaskId(null)
        // Show error message to user
        alert(`Error en actualización V3: ${error?.message || error?.toString() || 'Error desconocido'}`)
      }
    })
  }

  // Update V3 running state and refresh data when task completes
  const [hasAutoSwitched, setHasAutoSwitched] = React.useState(false)

  React.useEffect(() => {
    if (taskMonitoring.isCompleted || taskMonitoring.hasError) {
      setIsV3UpdateRunning(false)

      // Auto-refresh diff data when V3 completes (only once)
      if (taskMonitoring.isCompleted && currentV3TaskId && !hasAutoSwitched) {
        // Invalidate and refetch diff data
        diff.refetch()
        estado.refetch()

        // Also refresh learning metrics
        refetchLearningMetrics()

        // Switch to "Cambios de Precios" tab to show results (only once)
        setTimeout(() => {
          setTabValue(1) // Switch to tab index 1 (Cambios de Precios)
          setHasAutoSwitched(true) // Prevent future auto-switches
        }, 1000)
      }
    }
  }, [taskMonitoring.isCompleted, taskMonitoring.hasError, currentV3TaskId, hasAutoSwitched])

  // Reset auto-switch flag when starting new V3 task
  React.useEffect(() => {
    if (isLaunchingV3) {
      setHasAutoSwitched(false)
    }
  }, [isLaunchingV3])

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header with V3 Features */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AutoAwesome color="primary" />
                Actualización Inteligente V3
                <Chip
                  label="AUTOAPRENDIZAJE"
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
            }
            subheader="Sistema de inteligencia artificial con autoaprendizaje para actualización automática de precios"
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Psychology />}
                  onClick={handleLaunchV3Update}
                  disabled={isLaunchingV3 || isV3UpdateRunning}
                >
                  {isLaunchingV3 || isV3UpdateRunning ? 'Actualizando...' : 'Actualizar Precios V3'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowLegacyInterface(!showLegacyInterface)}
                >
                  {showLegacyInterface ? 'Interface V3' : 'Interface V2'}
                </Button>
              </Stack>
            }
          />

          {/* V3 Status Indicators */}
          {learningMetrics && (
            <Box sx={{ px: 3, pb: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                    <Psychology color="primary" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.knowledge_base_metrics?.total_entries || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Entradas Aprendidas
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                    <TrendingUp color="success" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {Math.round((learningMetrics.knowledge_base_metrics?.avg_confidence || 0) * 100)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Confianza Promedio
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                    <Speed color="warning" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.system_health?.score || 0}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Salud del Sistema
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                    <AutoAwesome color="info" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.knowledge_base_metrics?.user_validated_entries || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Validaciones Usuario
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* System Health Alert */}
              {learningMetrics.system_health && (
                <Box sx={{ mt: 2 }}>
                  <ConfidenceIndicator
                    confidence={learningMetrics.system_health.score / 100}
                    variant="detailed"
                    size="large"
                  />
                </Box>
              )}
            </Box>
          )}
        </Card>

        {/* V3 Task Monitoring */}
        {(currentV3TaskId || isV3UpdateRunning) && (
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Psychology color="primary" />
                  <Typography variant="h6">Monitor de Proceso V3</Typography>
                  <Chip
                    label={taskMonitoring.isRunning ? 'EJECUTANDO' : taskMonitoring.isCompleted ? 'COMPLETADO' : taskMonitoring.hasError ? 'ERROR' : 'INICIANDO'}
                    color={taskMonitoring.isRunning ? 'warning' : taskMonitoring.isCompleted ? 'success' : taskMonitoring.hasError ? 'error' : 'info'}
                    size="small"
                  />
                </Stack>
              }
              subheader={currentV3TaskId ? `Tarea ID: ${currentV3TaskId}` : 'Iniciando proceso...'}
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => taskMonitoring.refetchAll()}
                  disabled={!currentV3TaskId}
                >
                  Actualizar
                </Button>
              }
            />
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                {/* Task Status Info */}
                {taskMonitoring.status.data?.task && (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography variant="caption" color="text.secondary">Estado</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {taskMonitoring.status.data.task.estado}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography variant="caption" color="text.secondary">Iniciado</Typography>
                      <Typography variant="body2">
                        {taskMonitoring.status.data.task.iniciado_en
                          ? new Date(taskMonitoring.status.data.task.iniciado_en).toLocaleTimeString()
                          : 'N/A'
                        }
                      </Typography>
                    </Grid>
                    {taskMonitoring.status.data.task.is_v3 && (
                      <>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Typography variant="caption" color="text.secondary">Aprendizaje</Typography>
                          <Typography variant="body2">
                            {taskMonitoring.status.data.task.v3_params?.enable_learning ? 'Activado' : 'Desactivado'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Typography variant="caption" color="text.secondary">Umbral Confianza</Typography>
                          <Typography variant="body2">
                            {(taskMonitoring.status.data.task.v3_params?.confidence_threshold * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                )}

                {/* Progress Indicator */}
                {taskMonitoring.isRunning && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Procesando con autoaprendizaje V3...
                    </Typography>
                    <LinearProgress />
                  </Box>
                )}

                {/* Error Display */}
                {taskMonitoring.hasError && (
                  <Alert severity="error">
                    <Typography variant="body2">
                      Error: {taskMonitoring.errorMessage || 'Error desconocido en el proceso'}
                    </Typography>
                  </Alert>
                )}

                {/* Recent Logs */}
                {taskMonitoring.logs.data?.log_lines && taskMonitoring.logs.data.log_lines.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Logs Recientes ({taskMonitoring.logs.data.log_stats?.returned_lines || 0} líneas)
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        maxHeight: 200,
                        overflow: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        bgcolor: 'grey.50',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {taskMonitoring.logs.data.log_lines.slice(-10).map((line: string, index: number) => (
                        <div key={index} style={{ marginBottom: '2px' }}>
                          {line}
                        </div>
                      ))}
                    </Paper>
                    {taskMonitoring.logs.data.log_stats && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Total: {taskMonitoring.logs.data.log_stats.total_lines} líneas,
                        Tamaño: {(taskMonitoring.logs.data.log_stats.current_size_bytes / 1024).toFixed(1)} KB
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Completion Status */}
                {taskMonitoring.isCompleted && (
                  <Alert severity="success">
                    <Typography variant="body2">
                      ✅ Proceso V3 completado exitosamente
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </Box>
          </Card>
        )}

        {/* Active Tasks Summary */}
        {activeTasks?.tasks && activeTasks.tasks.length > 0 && !currentV3TaskId && (
          <Alert severity="info" variant="outlined">
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight="bold">
                Tareas V3 Activas: {activeTasks.active_tasks_count}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {activeTasks.tasks.slice(0, 3).map((task: any) => (
                  <Chip
                    key={task.tarea_id}
                    label={`${task.estado} (${Math.round(task.duracion_minutos || 0)}min)`}
                    size="small"
                    variant="outlined"
                    onClick={() => setCurrentV3TaskId(task.tarea_id)}
                    clickable
                  />
                ))}
              </Stack>
            </Stack>
          </Alert>
        )}

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
              a las nuevas funcionalidades de actualización inteligente de precios.
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
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Actualización V3" />
                <Tab label="Cambios de Precios" />
                <Tab label="Revisión Manual" />
                <Tab label="Estrategias de Mapeo" />
                <Tab label="Métricas y Monitoreo" />
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
                  {/* Task Source Indicator & Switcher */}
                  {activeTaskId && (
                    <Card variant="outlined">
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {currentV3TaskId ? '🤖 Resultados de V3 (Autoaprendizaje)' : '📊 Resultados de V2 (Tradicional)'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Tarea ID: {activeTaskId}
                                {currentV3TaskId && taskMonitoring.isCompleted && ' • Completado con IA'}
                              </Typography>
                            </Box>

                            {/* Task Switcher */}
                            <Stack direction="row" spacing={1}>
                              {tareaId && currentV3TaskId && (
                                <>
                                  <Button
                                    size="small"
                                    variant={!currentV3TaskId ? "contained" : "outlined"}
                                    onClick={() => setCurrentV3TaskId(null)}
                                    startIcon={<Psychology />}
                                  >
                                    Ver V2
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={currentV3TaskId ? "contained" : "outlined"}
                                    onClick={() => setCurrentV3TaskId(currentV3TaskId)}
                                    startIcon={<AutoAwesome />}
                                    color="primary"
                                  >
                                    Ver V3
                                  </Button>
                                </>
                              )}

                              {/* Refresh Button */}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  diff.refetch()
                                  estado.refetch()
                                }}
                                disabled={diff.isLoading}
                              >
                                {diff.isLoading ? 'Cargando...' : 'Actualizar'}
                              </Button>
                            </Stack>
                          </Stack>

                          {/* Status Indicators */}
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              size="small"
                              label={currentV3TaskId ? "V3 Autoaprendizaje" : "V2 Tradicional"}
                              color={currentV3TaskId ? "success" : "default"}
                              variant="outlined"
                            />
                            {estado.data?.estado && (
                              <Chip
                                size="small"
                                label={estado.data.estado}
                                color={
                                  estado.data.estado === 'SUCCESS' ? 'success' :
                                  estado.data.estado === 'ERROR' ? 'error' :
                                  estado.data.estado === 'RUNNING' ? 'warning' : 'default'
                                }
                              />
                            )}
                            {diff.data?.summary && (
                              <Chip
                                size="small"
                                label={`${diff.data.summary.total} cambios`}
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    </Card>
                  )}

                  {!activeTaskId && (
                    <Alert severity="info">
                      Ejecuta una actualización desde la pestaña "Actualización V3" o "Actualización Inteligente" para ver los cambios de precios.
                    </Alert>
                  )}

                  {/* V3 Model Comparison & Apply Controls */}
                  {isV3Task && diff.data?.is_v3 && (
                    <Card variant="outlined">
                      <CardHeader
                        title={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoAwesome color="primary" />
                            Comparación V3: Modelos Externos vs BD
                          </Box>
                        }
                        subheader={`${diff.data.resumen?.total_comparaciones || 0} comparaciones realizadas por IA`}
                      />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={3}>
                          {/* V3 Statistics */}
                          {diff.data.v3_stats && (
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>Confianza del Mapeo</Typography>
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Promedio:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {((diff.data.v3_stats.confidence_stats?.promedio || 0) * 100).toFixed(1)}%
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Alta confianza (≥90%):</Typography>
                                      <Typography variant="body2" color="success.main">
                                        {diff.data.v3_stats.confidence_stats?.alta_confianza || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Media confianza (70-90%):</Typography>
                                      <Typography variant="body2" color="warning.main">
                                        {diff.data.v3_stats.confidence_stats?.media_confianza || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Baja confianza (&lt;70%):</Typography>
                                      <Typography variant="body2" color="error.main">
                                        {diff.data.v3_stats.confidence_stats?.baja_confianza || 0}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>Resumen de Cambios</Typography>
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="success.main">Nuevos precios:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.inserciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="info.main">Actualizaciones:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.actualizaciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="error.main">Eliminaciones:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.eliminaciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Sin cambios:</Typography>
                                      <Typography variant="body2">
                                        {diff.data.resumen?.sin_cambios || 0}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              </Grid>
                            </Grid>
                          )}

                          {/* Apply Changes Controls */}
                          {estado.data?.estado === 'SUCCESS' && (
                            <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                              <Box sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    ✅ Cambios listos para aplicar
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Los precios han sido procesados por V3. Puedes aplicar los cambios con confianza alta.
                                  </Typography>
                                  <Stack direction="row" spacing={2}>
                                    <Button
                                      variant="contained"
                                      color="primary"
                                      onClick={() => {
                                        if (activeTaskId) {
                                          aplicarCambiosV3.mutate({
                                            tarea_id: activeTaskId,
                                            aplicar_inserciones: true,
                                            aplicar_actualizaciones: true,
                                            aplicar_eliminaciones: false,
                                            confidence_threshold: 0.7
                                          })
                                        }
                                      }}
                                      disabled={aplicarCambiosV3.isPending}
                                      startIcon={<AutoAwesome />}
                                    >
                                      {aplicarCambiosV3.isPending ? 'Aplicando...' : 'Aplicar Cambios V3'}
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      onClick={() => {
                                        if (activeTaskId) {
                                          aplicarCambiosV3.mutate({
                                            tarea_id: activeTaskId,
                                            aplicar_inserciones: true,
                                            aplicar_actualizaciones: true,
                                            aplicar_eliminaciones: true,
                                            confidence_threshold: 0.8
                                          })
                                        }
                                      }}
                                      disabled={aplicarCambiosV3.isPending}
                                    >
                                      Aplicar Todo (incluir eliminaciones)
                                    </Button>
                                  </Stack>
                                  {aplicarCambiosV3.isSuccess && (
                                    <Alert severity="success">
                                      ✅ Cambios aplicados exitosamente. Los precios han sido actualizados en la base de datos.
                                    </Alert>
                                  )}
                                  {aplicarCambiosV3.isError && (
                                    <Alert severity="error">
                                      ❌ Error aplicando cambios: {aplicarCambiosV3.error?.message}
                                    </Alert>
                                  )}
                                </Stack>
                              </Box>
                            </Card>
                          )}

                          {/* Detailed V3 Comparisons Table */}
                          {diff.data.comparaciones && diff.data.comparaciones.length > 0 && (
                            <Card variant="outlined">
                              <CardHeader
                                title="Comparación Detallada de Modelos"
                                subheader="Mapeo entre modelos externos (Proveedor) y base de datos interna"
                              />
                              <Box sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                  {diff.data.comparaciones.slice(0, 20).map((comp: any, index: number) => (
                                    <Paper
                                      key={index}
                                      variant="outlined"
                                      sx={{
                                        p: 2,
                                        borderLeft: 4,
                                        borderLeftColor:
                                          comp.change_type === 'INSERT' ? 'success.main' :
                                          comp.change_type === 'UPDATE' ? 'info.main' :
                                          comp.change_type === 'DELETE' ? 'error.main' : 'grey.300'
                                      }}
                                    >
                                      <Grid container spacing={2}>
                                        {/* External Model Info */}
                                        <Grid size={{ xs: 12, md: 5 }}>
                                          <Stack spacing={1}>
                                            <Typography variant="subtitle2" color="primary">
                                              📦 Modelo Externo (Proveedor)
                                            </Typography>
                                            <Box>
                                              <Typography variant="body2">
                                                <strong>Raw:</strong> {comp.likewize_info?.modelo_raw || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Normalizado:</strong> {comp.likewize_info?.modelo_norm || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Código:</strong> {comp.likewize_info?.likewize_model_code || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Marca:</strong> {comp.likewize_info?.marca || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Almacenamiento:</strong> {comp.likewize_info?.almacenamiento_gb || 'N/A'} GB
                                              </Typography>
                                            </Box>
                                          </Stack>
                                        </Grid>

                                        {/* Mapping Arrow & Confidence */}
                                        <Grid size={{ xs: 12, md: 2 }}>
                                          <Stack spacing={1} alignItems="center" sx={{ height: '100%', justifyContent: 'center' }}>
                                            <Typography variant="h6">→</Typography>
                                            {comp.v3_metrics?.confidence_score && (
                                              <Chip
                                                size="small"
                                                label={`${(comp.v3_metrics.confidence_score * 100).toFixed(0)}%`}
                                                color={
                                                  comp.v3_metrics.confidence_score >= 0.9 ? 'success' :
                                                  comp.v3_metrics.confidence_score >= 0.7 ? 'warning' : 'error'
                                                }
                                              />
                                            )}
                                            <Chip
                                              size="small"
                                              label={comp.change_type}
                                              color={
                                                comp.change_type === 'INSERT' ? 'success' :
                                                comp.change_type === 'UPDATE' ? 'info' :
                                                comp.change_type === 'DELETE' ? 'error' : 'default'
                                              }
                                              variant="outlined"
                                            />
                                          </Stack>
                                        </Grid>

                                        {/* Internal Model Info */}
                                        <Grid size={{ xs: 12, md: 5 }}>
                                          <Stack spacing={1}>
                                            <Typography variant="subtitle2" color="secondary">
                                              🗄️ Modelo BD Interna
                                            </Typography>
                                            <Box>
                                              <Typography variant="body2">
                                                <strong>Descripción:</strong> {comp.bd_info?.modelo_descripcion || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Marca:</strong> {comp.bd_info?.marca || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Tipo:</strong> {comp.bd_info?.tipo || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>Capacidad:</strong> {comp.bd_info?.capacidad || 'N/A'}
                                              </Typography>
                                              <Typography variant="body2">
                                                <strong>ID:</strong> {comp.capacidad_id || 'N/A'}
                                              </Typography>
                                            </Box>

                                            {/* Price Info */}
                                            {comp.precio_info && (
                                              <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                                <Typography variant="caption" gutterBottom>Precios:</Typography>
                                                <Stack direction="row" spacing={2}>
                                                  <Typography variant="body2">
                                                    Actual: {comp.precio_info.precio_actual ? `€${comp.precio_info.precio_actual}` : 'N/A'}
                                                  </Typography>
                                                  <Typography variant="body2">
                                                    Nuevo: {comp.precio_info.precio_nuevo ? `€${comp.precio_info.precio_nuevo}` : 'N/A'}
                                                  </Typography>
                                                  {comp.precio_info.diferencia && (
                                                    <Typography
                                                      variant="body2"
                                                      color={comp.precio_info.diferencia > 0 ? 'success.main' : 'error.main'}
                                                    >
                                                      {comp.precio_info.diferencia > 0 ? '+' : ''}€{comp.precio_info.diferencia.toFixed(2)}
                                                    </Typography>
                                                  )}
                                                </Stack>
                                              </Box>
                                            )}
                                          </Stack>
                                        </Grid>
                                      </Grid>
                                    </Paper>
                                  ))}

                                  {diff.data.comparaciones.length > 20 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                      Mostrando los primeros 20 de {diff.data.comparaciones.length} comparaciones
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            </Card>
                          )}
                        </Stack>
                      </Box>
                    </Card>
                  )}

                  {activeTaskId && !diff.data && diff.isLoading && (
                    <Stack spacing={2}>
                      <Typography variant="h6">Cargando cambios de precios...</Typography>
                      <LinearProgress />
                    </Stack>
                  )}

                  {activeTaskId && diff.data && (
                    <>
                      {/* Resumen de cambios */}
                      <Card variant="outlined">
                        <CardHeader
                          title={currentV3TaskId ? "Resumen de Cambios de Precios V3 (IA)" : "Resumen de Cambios de Precios V2"}
                          action={
                            currentV3TaskId && (
                              <Chip
                                label="AUTOAPRENDIZAJE"
                                color="primary"
                                size="small"
                                icon={<Psychology />}
                              />
                            )
                          }
                        />
                        <Box sx={{ p: 2 }}>
                          <Stack direction="row" spacing={2} flexWrap="wrap">
                            <Chip label={`Total: ${diff.data.summary.total}`} color="primary" />
                            <Chip label={`Altas: ${diff.data.summary.inserts}`} color="success" variant="outlined" />
                            <Chip label={`Cambios: ${diff.data.summary.updates}`} color="warning" variant="outlined" />
                            <Chip label={`Bajas: ${diff.data.summary.deletes}`} color="default" variant="outlined" />
                          </Stack>
                        </Box>
                      </Card>

                      {/* Tabla de cambios */}
                      <Card variant="outlined">
                        <CardHeader title="Cambios de Precios Detallados" />
                        <Box sx={{ p: 1, maxHeight: 600, overflow: 'auto' }}>
                          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                            <Box component="thead">
                              <Box component="tr">
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Tipo
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Modelo
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Capacidad
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Precio Antes
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Precio Después
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Diferencia
                                </Box>
                              </Box>
                            </Box>
                            <Box component="tbody">
                              {diff.data.changes.slice(0, 20).map((cambio) => (
                                <Box component="tr" key={cambio.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                    <Chip
                                      size="small"
                                      label={cambio.tipo}
                                      color={cambio.kind === 'INSERT' ? 'success' : cambio.kind === 'UPDATE' ? 'warning' : 'default'}
                                      variant="outlined"
                                    />
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                    <Typography variant="body2" fontWeight={500}>
                                      {cambio.modelo_norm}
                                    </Typography>
                                    {cambio.marca && (
                                      <Typography variant="caption" color="text.secondary">
                                        {cambio.marca}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}>
                                    <Typography variant="body2">
                                      {cambio.almacenamiento_gb ? `${cambio.almacenamiento_gb} GB` : '—'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    <Typography variant="body2" fontWeight={500}>
                                      {cambio.antes || '—'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={600}
                                      color={cambio.despues ? 'text.primary' : 'error.main'}
                                    >
                                      {cambio.despues || 'Sin precio'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    {cambio.delta !== null && (
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                        color={cambio.delta > 0 ? 'success.main' : cambio.delta < 0 ? 'error.main' : 'text.secondary'}
                                      >
                                        {cambio.delta > 0 ? '+' : ''}{cambio.delta.toFixed(2)}€
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          {diff.data.changes.length > 20 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                              Mostrando los primeros 20 de {diff.data.changes.length} cambios
                            </Typography>
                          )}
                        </Box>
                      </Card>
                    </>
                  )}

                  {tareaId && estado.data?.estado === 'ERROR' && (
                    <Alert severity="error">
                      Error al procesar la actualización: {estado.data.error_message || 'Error desconocido'}
                    </Alert>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Stack spacing={3}>
                  <Alert severity="info">
                    El sistema V2 utiliza estrategias específicas optimizadas según el tipo de dispositivo
                    para maximizar la precisión del mapeo automático.
                  </Alert>

                  {/* Estrategias principales */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Estrategias de Mapeo por Dispositivo
                    </Typography>
                    <Stack spacing={3}>
                      <DeviceMappingStrategy
                        deviceType="Mac"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPhone"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPad"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                    </Stack>
                  </Box>

                  {/* Resumen de distribución por algoritmo */}
                  {statistics && (
                    <Card variant="outlined">
                      <CardHeader title="Distribución Actual de Algoritmos" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          {algorithmsBreakdown.map(({ name, count, details }) => (
                            <Box key={name}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight={600}>
                                  {name.charAt(0).toUpperCase() + name.slice(1)}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2">
                                    {count} mappings
                                  </Typography>
                                  {details && (
                                    <Chip
                                      size="small"
                                      label={`${details.avg_confidence.toFixed(1)}% conf.`}
                                      color={details.avg_confidence >= 85 ? 'success' : details.avg_confidence >= 70 ? 'warning' : 'error'}
                                      variant="outlined"
                                    />
                                  )}
                                </Stack>
                              </Stack>
                              {totalMappings > 0 && (
                                <LinearProgress
                                  variant="determinate"
                                  value={(count / totalMappings) * 100}
                                  sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Stack spacing={3}>
                  <MappingMetrics />

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
                <ReviewPanel
                  onReviewCompleted={() => {
                    refetchLearningMetrics()
                    refetchStatistics()
                  }}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <Stack spacing={3}>
                  <Alert severity="info">
                    El sistema V3 utiliza estrategias específicas optimizadas según el tipo de dispositivo
                    para maximizar la precisión del mapeo automático con inteligencia artificial.
                  </Alert>

                  {/* Estrategias principales */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Estrategias de Mapeo por Dispositivo
                    </Typography>
                    <Stack spacing={3}>
                      <DeviceMappingStrategy
                        deviceType="Mac"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPhone"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPad"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                    </Stack>
                  </Box>

                  {/* Learning System Performance */}
                  {learningMetrics?.performance_by_brand && (
                    <Card variant="outlined">
                      <CardHeader title="Rendimiento por Marca (Autoaprendizaje)" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          {learningMetrics.performance_by_brand.slice(0, 5).map((brand, index) => (
                            <Box key={index}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight={600}>
                                  {brand.local_modelo__marca}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2">
                                    {brand.total_mappings} mapeos
                                  </Typography>
                                  <ConfidenceIndicator
                                    confidence={brand.avg_confidence}
                                    variant="chip"
                                    size="small"
                                    showPercentage
                                  />
                                </Stack>
                              </Stack>
                              {learningMetrics.knowledge_base_metrics?.total_entries && (
                                <LinearProgress
                                  variant="determinate"
                                  value={(brand.total_mappings / learningMetrics.knowledge_base_metrics.total_entries) * 100}
                                  sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <Stack spacing={3}>
                  <MappingMetrics />

                  {/* V3 Learning Metrics */}
                  {learningMetrics && (
                    <Card variant="outlined">
                      <CardHeader title="Métricas del Sistema de Autoaprendizaje V3" />
                      <Box sx={{ p: 2 }}>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Base de Conocimiento
                            </Typography>
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Entradas totales:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.total_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Alta confianza:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.high_confidence_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Validadas por usuario:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.user_validated_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Aprendidas automáticamente:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.auto_learned_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Correcciones (30 días)
                            </Typography>
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Total correcciones:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.correction_metrics?.total_corrections?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Confianza orig. promedio:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {Math.round((learningMetrics.correction_metrics?.avg_original_confidence || 0) * 100)}%
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>

                        {/* System Health Recommendations */}
                        {learningMetrics.system_health?.recommendations && learningMetrics.system_health.recommendations.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Recomendaciones del Sistema
                            </Typography>
                            <Stack spacing={1}>
                              {learningMetrics.system_health.recommendations.map((rec, index) => (
                                <Alert key={index} severity="info" variant="outlined">
                                  {rec}
                                </Alert>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                <Card variant="outlined">
                  <CardHeader title="Análisis de Calidad de Mappings V3" />
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

export default EnhancedLikewizePage
