'use client'

import {
  Card, CardHeader, CardContent, Button, Stack, Typography, Alert,
  FormControlLabel, Switch, Chip, Box, LinearProgress, Accordion,
  AccordionSummary, AccordionDetails, Tooltip, IconButton
} from '@mui/material'
import { Grid } from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Speed as SpeedIcon,
  Update as UpdateIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  Cached as CachedIcon
} from '@mui/icons-material'
import { useMemo, useState } from 'react'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

interface IncrementalUpdateControlsProps {
  tareaId?: string
  onUpdate?: (result: any) => void
  disabled?: boolean
}

export default function IncrementalUpdateControls({
  tareaId,
  onUpdate,
  disabled = false
}: IncrementalUpdateControlsProps) {
  const [incrementalMode, setIncrementalMode] = useState(true)
  const [forceFullUpdate, setForceFullUpdate] = useState(false)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    useEnhancedLikewizeUpdate,
    useSessionReportFetcher,
    useMappingStatistics
  } = useDeviceMappingEnhanced()

  const enhancedUpdate = useEnhancedLikewizeUpdate()
  const sessionReport = useSessionReportFetcher()
  const { data: statistics } = useMappingStatistics()

  const totalMappings = statistics?.total_mappings ?? 0
  const highConfidence = statistics?.quality_distribution?.high ?? 0
  const mediumConfidence = statistics?.quality_distribution?.medium ?? 0
  const lowConfidence = statistics?.quality_distribution?.low ?? 0
  const successRate = useMemo(() => {
    if (!totalMappings) return 1
    return (highConfidence + mediumConfidence) / Math.max(totalMappings, 1)
  }, [totalMappings, highConfidence, mediumConfidence])

  const avgConfidence = statistics?.avg_confidence ?? 0
  const needsReview = statistics?.needs_review ?? 0
  const userValidated = statistics?.user_validated ?? 0

  const overallStatus: 'healthy' | 'warning' | 'critical' = useMemo(() => {
    if (successRate >= 0.85) return 'healthy'
    if (successRate >= 0.65) return 'warning'
    return 'critical'
  }, [successRate])

  const getErrorMessage = (error: unknown) => {
    if (!error) return ''
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    if (typeof (error as any)?.message === 'string') return (error as any).message
    return 'Error desconocido'
  }

  const handleEnhancedUpdate = async (mode: 'apple' | 'others') => {
    try {
      const result = await enhancedUpdate.mutateAsync({
        mode,
        brands: selectedBrands.length > 0 ? selectedBrands : undefined,
        incremental: incrementalMode,
        force_full: forceFullUpdate
      })

      onUpdate?.(result)
    } catch (error) {
      console.error('Error in enhanced update:', error)
    }
  }

  const handleFetchSessionReport = async () => {
    if (!tareaId) return

    try {
      const result = await sessionReport.mutateAsync(tareaId)

      onUpdate?.(result)
    } catch (error) {
      console.error('Error fetching session report:', error)
    }
  }

  const isProcessing = enhancedUpdate.isPending || sessionReport.isPending

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <SpeedIcon color="primary" />
            <Typography variant="h6">Actualización Inteligente</Typography>
            <Chip
              size="small"
              label="NUEVO"
              color="success"
              variant="outlined"
            />
          </Stack>
        }
        subheader="Sistema optimizado con mapeo inteligente y procesamiento incremental"
        action={
          <Tooltip title="Sistema mejorado que detecta cambios y reutiliza mappings exitosos para mayor eficiencia">
            <IconButton>
              <InfoIcon />
            </IconButton>
          </Tooltip>
        }
      />

      <CardContent>
        <Stack spacing={3}>
          {/* Health Status Alert */}
          {statistics && (
            <Alert
              severity={
                overallStatus === 'healthy' ? 'success' :
                overallStatus === 'warning' ? 'warning' : 'error'
              }
              variant="outlined"
            >
              <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                  Estado del sistema: {overallStatus.toUpperCase()}
                </Typography>
                <Typography variant="caption">
                  Tasa de éxito: {(successRate * 100).toFixed(1)}% ·
                  Confianza promedio: {avgConfidence.toFixed(1)} ·
                  {needsReview} requieren revisión
                </Typography>
              </Stack>
            </Alert>
          )}

          {/* Main Update Controls */}
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Modo de Procesamiento
                </Typography>
                <Stack spacing={1.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={incrementalMode}
                        onChange={(e) => setIncrementalMode(e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          Procesamiento Incremental
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {incrementalMode
                            ? "Solo procesa cambios detectados (70-80% más rápido)"
                            : "Procesa todos los dispositivos desde cero"
                          }
                        </Typography>
                      </Stack>
                    }
                  />

                  {incrementalMode && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={forceFullUpdate}
                          onChange={(e) => setForceFullUpdate(e.target.checked)}
                          color="warning"
                        />
                      }
                      label={
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            Forzar Re-mapeo Completo
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Ignora caché y re-mapea todos los dispositivos
                          </Typography>
                        </Stack>
                      }
                    />
                  )}
                </Stack>
              </Box>
            </Grid>

            <Grid xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Beneficios del Sistema Mejorado
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CachedIcon fontSize="small" color="success" />
                    <Typography variant="caption">
                      Caché persistente de mappings exitosos
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUpIcon fontSize="small" color="primary" />
                    <Typography variant="caption">
                      Algoritmo de scoring en 4 fases
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SpeedIcon fontSize="small" color="info" />
                    <Typography variant="caption">
                      Extractores específicos por marca
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {/* Update Buttons */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Lanzar Actualización
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                size="large"
                startIcon={incrementalMode ? <SpeedIcon /> : <UpdateIcon />}
                onClick={() => handleEnhancedUpdate('apple')}
                disabled={disabled || isProcessing}
                color="primary"
              >
                {isProcessing ? 'Procesando...' :
                 incrementalMode ? 'Apple (Incremental)' : 'Apple (Completo)'}
              </Button>

              <Button
                variant="contained"
                size="large"
                color="secondary"
                startIcon={incrementalMode ? <SpeedIcon /> : <UpdateIcon />}
                onClick={() => handleEnhancedUpdate('others')}
                disabled={disabled || isProcessing || selectedBrands.length === 0}
              >
                {isProcessing ? 'Procesando...' :
                 incrementalMode ? 'Otras Marcas (Incremental)' : 'Otras Marcas (Completo)'}
              </Button>

              {tareaId && (
                <Button
                  variant="outlined"
                  startIcon={<PlayIcon />}
                  onClick={handleFetchSessionReport}
                  disabled={disabled || isProcessing}
                >
                  Consultar reporte de tarea
                </Button>
              )}
            </Stack>
          </Box>

          {/* Processing Progress */}
          {isProcessing && (
            <Box>
              <Typography variant="body2" gutterBottom>
                {enhancedUpdate.isPending ? 'Actualizando con sistema mejorado...' : 'Procesando incrementalmente...'}
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Advanced Settings */}
          <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Configuración Avanzada</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Alert severity="info" variant="outlined">
                  <Typography variant="body2">
                    <strong>Sistema de Mapeo Inteligente:</strong> El nuevo sistema utiliza múltiples fases
                    para mapear dispositivos con mayor precisión y eficiencia.
                  </Typography>
                </Alert>

                <Box>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Fases del Algoritmo de Mapeo:
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label="1" color="primary" />
                      <Typography variant="caption">
                        <strong>Caché:</strong> Reutiliza mappings exitosos previos
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label="2" color="secondary" />
                      <Typography variant="caption">
                        <strong>Exacto:</strong> Mapeo por códigos específicos (A-numbers, etc.)
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label="3" color="warning" />
                      <Typography variant="caption">
                        <strong>Fuzzy:</strong> Mapeo difuso con scoring ponderado
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label="4" color="info" />
                      <Typography variant="caption">
                        <strong>Heurístico:</strong> Reglas específicas por marca
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Extractores Específicos:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip size="small" label="Apple: A-numbers, M-chips, años" variant="outlined" />
                    <Chip size="small" label="Google: Códigos Pixel, variantes" variant="outlined" />
                    <Chip size="small" label="Samsung: Filtrado regional" variant="outlined" />
                  </Stack>
                </Box>

                {statistics && (
                  <Box>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Estadísticas del Sistema:
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Mapeos totales (últimos días)
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {totalMappings.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Confianza promedio
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {avgConfidence.toFixed(1)}/100
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Mapeos en revisión
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {needsReview.toLocaleString()}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Validados por usuario
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {userValidated.toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                      <Chip size="small" color="success" variant="outlined" label={`Alta: ${highConfidence}`} />
                      <Chip size="small" color="warning" variant="outlined" label={`Media: ${mediumConfidence}`} />
                      <Chip size="small" color="error" variant="outlined" label={`Baja: ${lowConfidence}`} />
                    </Stack>
                  </Box>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Results Display */}
          {(enhancedUpdate.data || sessionReport.data) && (
            <Alert severity="success" variant="outlined">
              <Stack spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  ✅ Procesamiento completado
                </Typography>
                {sessionReport.data && (
                  <Stack spacing={0.5}>
                    <Typography variant="caption">
                      Procesados: {sessionReport.data.total_devices_processed} ·
                      Éxito: {sessionReport.data.success_rate.toFixed(1)}% ·
                      Fallos: {sessionReport.data.failed_mappings}
                    </Typography>
                    <Typography variant="caption">
                      Alta confianza: {sessionReport.data.high_confidence_mappings} ·
                      Media: {sessionReport.data.medium_confidence_mappings} ·
                      Baja: {sessionReport.data.low_confidence_mappings}
                    </Typography>
                  </Stack>
                )}
                {enhancedUpdate.data && (
                  <Typography variant="caption">
                    Tarea creada: {enhancedUpdate.data.tarea_id}
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}

          {/* Error Display */}
          {(enhancedUpdate.error || sessionReport.error) && (
            <Alert severity="error">
              <Typography variant="body2">
                Error: {getErrorMessage(enhancedUpdate.error || sessionReport.error)}
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
