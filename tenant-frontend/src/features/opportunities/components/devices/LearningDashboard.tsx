'use client'

import { useState, useEffect } from 'react'
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  TrendingUp,
  Psychology,
  Speed,
  CheckCircle,
  Warning,
  Error,
  Info,
  Refresh,
  ExpandMore,
  AutoAwesome,
  Analytics,
  Timeline,
  Assessment
} from '@mui/icons-material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LearningMetrics, KnowledgeBaseStats, ConfidenceLevel } from '@/types/autoaprendizaje-v3'
import { useLearningMetrics, useKnowledgeBaseStats } from '@/hooks/useLearningV3'
import { ConfidenceIndicator } from './ConfidenceIndicator'

const CONFIDENCE_COLORS = {
  very_high: '#4caf50',
  high: '#8bc34a',
  medium: '#ff9800',
  low: '#f44336',
  very_low: '#d32f2f'
}

export function LearningDashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useLearningMetrics(refreshKey)
  const { data: kbStats, isLoading: kbLoading, error: kbError } = useKnowledgeBaseStats(refreshKey)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'success'
      case 'good': return 'info'
      case 'fair': return 'warning'
      case 'poor': return 'error'
      default: return 'default'
    }
  }

  if (metricsError || kbError) {
    return (
      <Paper sx={{ p: 3, height: 'fit-content' }}>
        <Alert severity="error">
          Error cargando métricas del sistema de aprendizaje
        </Alert>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3, height: 'fit-content' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Psychology color="primary" />
          Dashboard de Aprendizaje
        </Typography>
        <Tooltip title="Actualizar métricas">
          <IconButton onClick={handleRefresh} size="small">
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* System Health */}
      {metricsLoading ? (
        <Skeleton variant="rectangular" height={120} sx={{ mb: 3 }} />
      ) : metrics?.system_health ? (
        <Card sx={{ mb: 3, bgcolor: `${getHealthColor(metrics.system_health.status)}.50` }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Salud del Sistema
              </Typography>
              <Chip
                label={metrics.system_health.status.toUpperCase()}
                color={getHealthColor(metrics.system_health.status) as any}
                variant="filled"
              />
            </Box>

            <Typography variant="h4" fontWeight="bold" color={`${getHealthColor(metrics.system_health.status)}.main`}>
              {metrics.system_health.score}%
            </Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 4 }}>
                <Typography variant="caption" color="text.secondary">Confianza</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.system_health.confidence_score}%
                </Typography>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Typography variant="caption" color="text.secondary">Validación</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.system_health.validation_rate}%
                </Typography>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Typography variant="caption" color="text.secondary">Alta Confianza</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {metrics.system_health.high_confidence_rate}%
                </Typography>
              </Grid>
            </Grid>

            {metrics.system_health.recommendations.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">Recomendaciones:</Typography>
                <List dense>
                  {metrics.system_health.recommendations.map((rec, index) => (
                    <ListItem key={index} sx={{ py: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <Info fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={rec}
                        primaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Key Metrics */}
      {metricsLoading ? (
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" height={80} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={80} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={80} />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {metrics?.knowledge_base_metrics && (
            <>
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <AutoAwesome color="primary" sx={{ fontSize: 32, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {metrics.knowledge_base_metrics.total_entries}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Entradas en Base de Conocimiento
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <CheckCircle color="success" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="body2" fontWeight="bold">
                      {Math.round((metrics.knowledge_base_metrics.avg_confidence || 0) * 100)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Confianza Promedio
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <TrendingUp color="info" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="body2" fontWeight="bold">
                      {Math.round((metrics.knowledge_base_metrics.avg_success_rate || 0) * 100)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tasa de Éxito
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}

      {/* Confidence Distribution */}
      {kbLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
      ) : kbStats?.confidence_distribution ? (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment />
              Distribución de Confianza
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={kbStats.confidence_distribution}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ label, count }) => `${label}: ${count}`}
                >
                  {kbStats.confidence_distribution.map((entry, index) => (
                    <Cell key={index} fill={CONFIDENCE_COLORS[entry.label as ConfidenceLevel]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {/* Learning Trend */}
      {metricsLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
      ) : metrics?.learning_trend && metrics.learning_trend.length > 0 ? (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timeline />
              Tendencia de Aprendizaje (4 semanas)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics.learning_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <RechartsTooltip
                  labelFormatter={(value) => `Semana del ${new Date(value).toLocaleDateString('es-ES')}`}
                />
                <Line
                  type="monotone"
                  dataKey="entries_created"
                  stroke="#1976d2"
                  strokeWidth={2}
                  name="Entradas Creadas"
                />
                <Line
                  type="monotone"
                  dataKey="avg_confidence"
                  stroke="#4caf50"
                  strokeWidth={2}
                  name="Confianza Promedio"
                />
              </LineChart>
            </ResponsiveContainer>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {/* Performance by Brand */}
      {metricsLoading ? (
        <Skeleton variant="rectangular" height={150} />
      ) : metrics?.performance_by_brand && metrics.performance_by_brand.length > 0 ? (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Analytics />
              Rendimiento por Marca
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {metrics.performance_by_brand.slice(0, 5).map((brand, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={brand.local_modelo__marca}
                    secondary={`${brand.total_mappings} mapeos • ${Math.round(brand.avg_confidence * 100)}% confianza`}
                  />
                  <Box sx={{ ml: 2 }}>
                    <ConfidenceIndicator
                      confidence={brand.avg_confidence}
                      size="small"
                    />
                  </Box>
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {metricsLoading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Cargando métricas de aprendizaje...
          </Typography>
        </Box>
      )}
    </Paper>
  )
}