'use client'

import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton
} from '@mui/material'
import {
  Apple as AppleIcon,
  Android as AndroidIcon,
  Laptop as LaptopIcon,
  Tag as TagIcon,
  Psychology as PsychologyIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'

interface DeviceMappingStrategyProps {
  deviceType?: 'Mac' | 'iPhone' | 'iPad' | 'Android' | 'Other'
  deviceFamily?: string
  modelName?: string
  compact?: boolean
  showMetrics?: boolean
  successRate?: number
  avgConfidence?: number
}

const getDeviceIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case 'mac':
      return <LaptopIcon />
    case 'iphone':
    case 'ipad':
      return <AppleIcon />
    case 'android':
      return <AndroidIcon />
    default:
      return <TagIcon />
  }
}

const getStrategyConfig = (deviceType?: string) => {
  const type = deviceType?.toLowerCase() || 'other'

  switch (type) {
    case 'mac':
      return {
        title: 'Estrategia A-number First',
        description: 'Optimizada para dispositivos Mac con alta precisión',
        precision: '95%+',
        color: 'success' as const,
        steps: [
          {
            phase: 1,
            name: 'Extracción A-number',
            description: 'Identifica código único Apple del dispositivo',
            icon: <TagIcon fontSize="small" />,
            confidence: 95
          },
          {
            phase: 2,
            name: 'Mapeo Directo',
            description: 'Coincidencia exacta en base de conocimiento',
            icon: <CheckCircleIcon fontSize="small" />,
            confidence: 98
          },
          {
            phase: 3,
            name: 'Enriquecimiento',
            description: 'Añade capacidades y variantes disponibles',
            icon: <TrendingUpIcon fontSize="small" />,
            confidence: 90
          }
        ],
        advantages: [
          'Máxima precisión con códigos únicos',
          'Identificación instantánea de modelo exacto',
          'Soporte completo para toda la gama Mac',
          'Detección automática de capacidades'
        ],
        limitations: [
          'Requiere A-number visible/extraíble',
          'Dependiente de base de conocimiento actualizada'
        ]
      }

    case 'iphone':
    case 'ipad':
      return {
        title: 'Estrategia Name-Based + Enrichment',
        description: 'Optimizada para iPhone/iPad con enriquecimiento inteligente',
        precision: '80%+',
        color: 'warning' as const,
        steps: [
          {
            phase: 1,
            name: 'Análisis de Nombre',
            description: 'Extrae información del nombre del modelo',
            icon: <SearchIcon fontSize="small" />,
            confidence: 75
          },
          {
            phase: 2,
            name: 'Matching Difuso',
            description: 'Coincidencia por similitud ponderada',
            icon: <PsychologyIcon fontSize="small" />,
            confidence: 80
          },
          {
            phase: 3,
            name: 'Enriquecimiento Contextual',
            description: 'Aplica reglas específicas y contexto',
            icon: <TrendingUpIcon fontSize="small" />,
            confidence: 85
          }
        ],
        advantages: [
          'Funciona sin códigos específicos',
          'Manejo inteligente de variantes',
          'Adaptación a nuevos modelos',
          'Enriquecimiento automático de datos'
        ],
        limitations: [
          'Mayor variabilidad en precisión',
          'Requiere validación manual ocasional',
          'Sensible a cambios en nomenclatura'
        ]
      }

    default:
      return {
        title: 'Estrategia Híbrida Universal',
        description: 'Enfoque adaptativo para dispositivos diversos',
        precision: '70%+',
        color: 'info' as const,
        steps: [
          {
            phase: 1,
            name: 'Detección de Tipo',
            description: 'Identifica familia y marca del dispositivo',
            icon: <SearchIcon fontSize="small" />,
            confidence: 70
          },
          {
            phase: 2,
            name: 'Estrategia Adaptativa',
            description: 'Aplica algoritmo según tipo detectado',
            icon: <PsychologyIcon fontSize="small" />,
            confidence: 75
          },
          {
            phase: 3,
            name: 'Validación Cruzada',
            description: 'Verifica consistencia de resultados',
            icon: <CheckCircleIcon fontSize="small" />,
            confidence: 80
          }
        ],
        advantages: [
          'Soporte universal para cualquier dispositivo',
          'Estrategia adaptativa por marca',
          'Fallback robusto para casos complejos'
        ],
        limitations: [
          'Precisión variable según tipo',
          'Requiere mayor supervisión manual',
          'Tiempo de procesamiento variable'
        ]
      }
  }
}

export default function DeviceMappingStrategy({
  deviceType = 'Other',
  deviceFamily,
  modelName,
  compact = false,
  showMetrics = true,
  successRate,
  avgConfidence
}: DeviceMappingStrategyProps) {
  const strategy = getStrategyConfig(deviceType)
  const deviceIcon = getDeviceIcon(deviceType)

  if (compact) {
    return (
      <Card variant="outlined" sx={{ minHeight: '120px' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ color: `${strategy.color}.main` }}>
              {deviceIcon}
            </Box>
            <Stack spacing={0.5} flex={1}>
              <Typography variant="body2" fontWeight={600}>
                {strategy.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Precisión: {strategy.precision}
              </Typography>
              {showMetrics && (successRate || avgConfidence) && (
                <Stack direction="row" spacing={1} alignItems="center">
                  {successRate && (
                    <Chip
                      size="small"
                      label={`${(successRate * 100).toFixed(0)}% éxito`}
                      color={successRate >= 0.8 ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  )}
                  {avgConfidence && (
                    <Chip
                      size="small"
                      label={`${avgConfidence.toFixed(0)} conf.`}
                      color={avgConfidence >= 80 ? 'success' : 'info'}
                      variant="outlined"
                    />
                  )}
                </Stack>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ color: `${strategy.color}.main`, mt: 0.5 }}>
              {deviceIcon}
            </Box>
            <Stack spacing={1} flex={1}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={600}>
                  {strategy.title}
                </Typography>
                <Chip
                  label={`Precisión ${strategy.precision}`}
                  color={strategy.color}
                  size="small"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {strategy.description}
              </Typography>
              {(deviceFamily || modelName) && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Aplicando a:
                  </Typography>
                  {deviceFamily && (
                    <Chip size="small" label={deviceFamily} variant="outlined" />
                  )}
                  {modelName && (
                    <Typography variant="caption" fontWeight={600}>
                      {modelName}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Stack>

          {/* Métricas actuales */}
          {showMetrics && (successRate || avgConfidence) && (
            <Alert severity="info" variant="outlined">
              <Stack spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  Rendimiento actual del sistema:
                </Typography>
                <Stack direction="row" spacing={3}>
                  {successRate && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Tasa de éxito
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={successRate * 100}
                        color={successRate >= 0.8 ? 'success' : 'warning'}
                        sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                      />
                      <Typography variant="caption" fontWeight={600}>
                        {(successRate * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  )}
                  {avgConfidence && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Confianza promedio
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={avgConfidence}
                        color={avgConfidence >= 80 ? 'success' : 'info'}
                        sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                      />
                      <Typography variant="caption" fontWeight={600}>
                        {avgConfidence.toFixed(1)}/100
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Stack>
            </Alert>
          )}

          {/* Fases del proceso */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Fases del Proceso de Mapeo
            </Typography>
            <Stack spacing={2}>
              {strategy.steps.map((step, index) => (
                <Card key={index} variant="outlined" sx={{ backgroundColor: 'action.hover' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip
                        size="small"
                        label={step.phase}
                        color="primary"
                      />
                      <Box sx={{ color: 'text.secondary' }}>
                        {step.icon}
                      </Box>
                      <Stack spacing={0.5} flex={1}>
                        <Typography variant="body2" fontWeight={600}>
                          {step.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {step.description}
                        </Typography>
                      </Stack>
                      <Stack alignItems="center" spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Conf.
                        </Typography>
                        <Chip
                          size="small"
                          label={`${step.confidence}%`}
                          color={step.confidence >= 90 ? 'success' : step.confidence >= 80 ? 'warning' : 'info'}
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>

          {/* Ventajas y limitaciones */}
          <Stack direction="row" spacing={2}>
            <Box flex={1}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600} color="success.main">
                ✓ Ventajas
              </Typography>
              <Stack spacing={0.5}>
                {strategy.advantages.map((advantage, index) => (
                  <Typography key={index} variant="caption" color="text.secondary">
                    • {advantage}
                  </Typography>
                ))}
              </Stack>
            </Box>
            <Box flex={1}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600} color="warning.main">
                ⚠ Limitaciones
              </Typography>
              <Stack spacing={0.5}>
                {strategy.limitations.map((limitation, index) => (
                  <Typography key={index} variant="caption" color="text.secondary">
                    • {limitation}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}