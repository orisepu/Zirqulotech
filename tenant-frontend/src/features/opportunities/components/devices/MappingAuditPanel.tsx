'use client'

import React, { useState, useMemo } from 'react'
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Box,
  Button,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  Avatar
} from '@mui/material'
import { Grid } from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Visibility as VisibilityIcon,
  BugReport as BugReportIcon,
  TrendingUp as TrendingUpIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material'

import MappingConfidenceEnhanced, { MappingConfidence, MappingFeedbackData } from './MappingConfidenceEnhanced'
import DeviceMappingStrategy from './DeviceMappingStrategy'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

interface MappingAuditItem {
  id: string
  device_signature: string
  source_type: string
  extracted_model_name: string
  extracted_a_number: string | null
  extracted_capacity_gb: number | null
  mapped_capacity_id: number
  mapped_description: string
  confidence_score: number
  mapping_algorithm: string
  review_reason: string | null
  created_at: string
  source_data: Record<string, any> | null
  priority_level?: 'high' | 'medium' | 'low'
  estimated_device_type?: string
  validation_flags?: string[]
}

interface MappingAuditPanelProps {
  compact?: boolean
  maxItems?: number
  showBulkActions?: boolean
  onMappingValidated?: (id: string, action: 'approve' | 'reject' | 'edit') => void
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'high':
      return { color: 'error' as const, label: 'Alta', icon: <WarningIcon fontSize="small" /> }
    case 'medium':
      return { color: 'warning' as const, label: 'Media', icon: <InfoIcon fontSize="small" /> }
    default:
      return { color: 'info' as const, label: 'Baja', icon: <TrendingUpIcon fontSize="small" /> }
  }
}

const getDeviceTypeFromSignature = (signature: string, modelName: string): string => {
  const sig = signature.toLowerCase()
  const model = modelName.toLowerCase()

  if (sig.includes('mac') || model.includes('mac') || model.includes('imac') || model.includes('macbook')) {
    return 'Mac'
  }
  if (sig.includes('iphone') || model.includes('iphone')) {
    return 'iPhone'
  }
  if (sig.includes('ipad') || model.includes('ipad')) {
    return 'iPad'
  }
  if (sig.includes('android') || model.includes('samsung') || model.includes('google')) {
    return 'Android'
  }
  return 'Other'
}

export default function MappingAuditPanel({
  compact = false,
  maxItems = 10,
  showBulkActions = true,
  onMappingValidated
}: MappingAuditPanelProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)
  const [currentAuditItem, setCurrentAuditItem] = useState<MappingAuditItem | null>(null)
  const [auditDecision, setAuditDecision] = useState<'approve' | 'reject' | 'edit'>('approve')
  const [auditNotes, setAuditNotes] = useState('')
  const [correctedMapping, setCorrectedMapping] = useState('')

  const { useMappingsForReview, useMappingValidation, getMappingConfidence } = useDeviceMappingEnhanced()

  const { data: reviewMappings = [], refetch } = useMappingsForReview({
    limit: maxItems,
    min_confidence: 0
  })

  const validationMutation = useMappingValidation()

  // Enriquecer datos con prioridad y tipo estimado
  const enrichedMappings = useMemo(() => {
    return reviewMappings.map(mapping => {
      const deviceType = getDeviceTypeFromSignature(mapping.device_signature, mapping.extracted_model_name)

      // Calcular prioridad basada en confianza y flags
      let priorityLevel: 'high' | 'medium' | 'low' = 'low'
      if (mapping.confidence_score < 50) priorityLevel = 'high'
      else if (mapping.confidence_score < 70) priorityLevel = 'medium'
      else priorityLevel = 'low'

      // Flags de validación basados en el análisis
      const validationFlags: string[] = []
      if (mapping.confidence_score < 50) validationFlags.push('Baja confianza')
      if (!mapping.extracted_a_number && deviceType === 'Mac') validationFlags.push('Sin A-number')
      if (mapping.review_reason) validationFlags.push('Requiere revisión')
      if (mapping.mapping_algorithm === 'failed') validationFlags.push('Mapeo fallido')

      return {
        ...mapping,
        estimated_device_type: deviceType,
        priority_level: priorityLevel,
        validation_flags: validationFlags
      } as MappingAuditItem
    })
  }, [reviewMappings])

  // Estadísticas del panel
  const auditStats = useMemo(() => {
    const total = enrichedMappings.length
    const highPriority = enrichedMappings.filter(m => m.priority_level === 'high').length
    const mediumPriority = enrichedMappings.filter(m => m.priority_level === 'medium').length
    const avgConfidence = total > 0
      ? enrichedMappings.reduce((sum, m) => sum + m.confidence_score, 0) / total
      : 0

    return { total, highPriority, mediumPriority, avgConfidence }
  }, [enrichedMappings])

  const handleItemSelect = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    // Lógica para procesar múltiples elementos
    for (const id of selectedItems) {
      onMappingValidated?.(id, action)
    }
    setSelectedItems([])
    refetch()
  }

  const handleAuditItem = (item: MappingAuditItem) => {
    setCurrentAuditItem(item)
    setAuditDecision('approve')
    setAuditNotes('')
    setCorrectedMapping(item.mapped_description)
    setAuditDialogOpen(true)
  }

  const handleAuditSubmit = async () => {
    if (!currentAuditItem) return

    try {
      const confidence: 'correct' | 'incorrect' | 'partial' =
        auditDecision === 'approve' ? 'correct' :
        auditDecision === 'edit' ? 'partial' : 'incorrect'

      const feedbackData: MappingFeedbackData = {
        mapping_id: currentAuditItem.id,
        feedback: confidence,
        user_notes: auditNotes,
        suggested_capacity_id: auditDecision === 'edit' ? currentAuditItem.mapped_capacity_id : undefined
      }

      await validationMutation.mutateAsync(feedbackData)
      onMappingValidated?.(currentAuditItem.id, auditDecision)
      setAuditDialogOpen(false)
      refetch()
    } catch (error) {
      console.error('Error validating mapping:', error)
    }
  }

  if (compact) {
    return (
      <Card variant="outlined">
        <CardHeader
          title="Auditoría Rápida"
          subheader={`${auditStats.total} elementos pendientes`}
        />
        <CardContent>
          <Stack spacing={1}>
            {auditStats.highPriority > 0 && (
              <Alert severity="error" variant="outlined">
                {auditStats.highPriority} elementos de alta prioridad
              </Alert>
            )}
            <Typography variant="body2">
              Confianza promedio: {auditStats.avgConfidence.toFixed(1)}%
            </Typography>
            <Button size="small" variant="outlined" onClick={() => refetch()}>
              Actualizar
            </Button>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Header con estadísticas */}
        <Card variant="outlined">
          <CardHeader title="Panel de Auditoría V2" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{xs:6, md:3}}>
                <Box textAlign="center">
                  <Typography variant="h5" fontWeight={600} color="primary">
                    {auditStats.total}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total pendientes
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{xs:6, md:3}}>
                <Box textAlign="center">
                  <Typography variant="h5" fontWeight={600} color="error">
                    {auditStats.highPriority}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Alta prioridad
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{xs:6, md:3}}>
                <Box textAlign="center">
                  <Typography variant="h5" fontWeight={600} color="warning">
                    {auditStats.mediumPriority}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Media prioridad
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{xs:6, md:3}}>
                <Box textAlign="center">
                  <Typography variant="h5" fontWeight={600}>
                    {auditStats.avgConfidence.toFixed(1)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Confianza promedio
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Acciones en lote */}
            {showBulkActions && selectedItems.length > 0 && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2">
                    {selectedItems.length} elementos seleccionados
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => handleBulkAction('approve')}
                    color="success"
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={() => handleBulkAction('reject')}
                    color="error"
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedItems([])}
                  >
                    Limpiar
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Lista de elementos para auditar */}
        <Card variant="outlined">
          <CardHeader title="Elementos Pendientes de Revisión" />
          <CardContent>
            {enrichedMappings.length === 0 ? (
              <Alert severity="success">
                ¡Excelente! No hay mappings pendientes de auditoría.
              </Alert>
            ) : (
              <Stack spacing={2}>
                {enrichedMappings.map((item) => {
                  const priorityConfig = getPriorityConfig(item.priority_level || 'low')
                  const confidence = getMappingConfidence({
                    confidence_score: item.confidence_score,
                    mapping_algorithm: item.mapping_algorithm,
                    needs_review: true,
                    times_confirmed: 0
                  })

                  return (
                    <Accordion key={item.id} variant="outlined">
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={2} alignItems="center" width="100%">
                          <FormControlLabel
                            control={
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleItemSelect(item.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            }
                            label=""
                            sx={{ mr: 0 }}
                          />

                          <Stack spacing={1} flex={1}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Typography variant="body2" fontWeight={600}>
                                {item.extracted_model_name}
                              </Typography>
                              <Chip
                                size="small"
                                icon={priorityConfig.icon}
                                label={priorityConfig.label}
                                color={priorityConfig.color}
                                variant="outlined"
                              />
                              {item.estimated_device_type && (
                                <DeviceMappingStrategy
                                  deviceType={item.estimated_device_type as any}
                                  compact
                                  showMetrics={false}
                                />
                              )}
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              {confidence && (
                                <MappingConfidenceEnhanced
                                  confidence={confidence}
                                  compact
                                />
                              )}
                              {item.validation_flags && item.validation_flags.length > 0 && (
                                <Stack direction="row" spacing={0.5}>
                                  {item.validation_flags.slice(0, 2).map((flag, idx) => (
                                    <Chip key={idx} size="small" label={flag} color="warning" variant="outlined" />
                                  ))}
                                  {item.validation_flags.length > 2 && (
                                    <Chip size="small" label={`+${item.validation_flags.length - 2}`} />
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          </Stack>

                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Auditar elemento">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAuditItem(item)
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails>
                        <Stack spacing={2}>
                          <Divider />

                          {/* Detalles del dispositivo */}
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Detalles del Dispositivo
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid size={{xs:6}}>
                                <Typography variant="caption" color="text.secondary">
                                  Signature
                                </Typography>
                                <Typography variant="body2">
                                  {item.device_signature}
                                </Typography>
                              </Grid>
                              <Grid size={{xs:6}}>
                                <Typography variant="caption" color="text.secondary">
                                  Fuente
                                </Typography>
                                <Typography variant="body2">
                                  {item.source_type}
                                </Typography>
                              </Grid>
                              <Grid size={{xs:6}}>
                                <Typography variant="caption" color="text.secondary">
                                  A-number extraído
                                </Typography>
                                <Typography variant="body2">
                                  {item.extracted_a_number || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid size={{xs:6}}>
                                <Typography variant="caption" color="text.secondary">
                                  Capacidad
                                </Typography>
                                <Typography variant="body2">
                                  {item.extracted_capacity_gb ? `${item.extracted_capacity_gb} GB` : 'N/A'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>

                          {/* Resultado del mapeo */}
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Resultado del Mapeo
                            </Typography>
                            <Alert severity="info" variant="outlined">
                              <Stack spacing={1}>
                                <Typography variant="body2">
                                  <strong>Mapeado como:</strong> {item.mapped_description}
                                </Typography>
                                <Typography variant="body2">
                                  <strong>Algoritmo usado:</strong> {item.mapping_algorithm}
                                </Typography>
                                {item.review_reason && (
                                  <Typography variant="body2">
                                    <strong>Razón de revisión:</strong> {item.review_reason}
                                  </Typography>
                                )}
                              </Stack>
                            </Alert>
                          </Box>

                          {/* Acciones rápidas */}
                          <Stack direction="row" spacing={2}>
                            <Button
                              startIcon={<ThumbUpIcon />}
                              color="success"
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                onMappingValidated?.(item.id, 'approve')
                                refetch()
                              }}
                            >
                              Aprobar
                            </Button>
                            <Button
                              startIcon={<ThumbDownIcon />}
                              color="error"
                              variant="outlined"
                              size="small"
                              onClick={() => {
                                onMappingValidated?.(item.id, 'reject')
                                refetch()
                              }}
                            >
                              Rechazar
                            </Button>
                            <Button
                              startIcon={<EditIcon />}
                              variant="outlined"
                              size="small"
                              onClick={() => handleAuditItem(item)}
                            >
                              Auditoría Detallada
                            </Button>
                          </Stack>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  )
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      {/* Dialog de auditoría detallada */}
      <Dialog open={auditDialogOpen} onClose={() => setAuditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Auditoría Detallada</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {currentAuditItem && (
              <>
                <Alert severity="info">
                  <Typography variant="body2">
                    Revisando: <strong>{currentAuditItem.extracted_model_name}</strong>
                  </Typography>
                  <Typography variant="caption">
                    Mapeado como: {currentAuditItem.mapped_description}
                  </Typography>
                </Alert>

                <FormControl>
                  <FormLabel>Decisión de Auditoría</FormLabel>
                  <RadioGroup
                    value={auditDecision}
                    onChange={(e) => setAuditDecision(e.target.value as any)}
                  >
                    <FormControlLabel value="approve" control={<Radio />} label="✅ Aprobar - El mapeo es correcto" />
                    <FormControlLabel value="reject" control={<Radio />} label="❌ Rechazar - El mapeo es incorrecto" />
                    <FormControlLabel value="edit" control={<Radio />} label="✏️ Corregir - Necesita ajustes" />
                  </RadioGroup>
                </FormControl>

                {auditDecision === 'edit' && (
                  <TextField
                    label="Mapeo Correcto"
                    value={correctedMapping}
                    onChange={(e) => setCorrectedMapping(e.target.value)}
                    placeholder="Especifica el mapeo correcto..."
                    fullWidth
                  />
                )}

                <TextField
                  label="Notas de Auditoría"
                  multiline
                  rows={3}
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="Explica tu decisión y proporciona contexto para futuras mejoras..."
                  fullWidth
                />

                <Alert severity="success">
                  Tu feedback entrena el sistema V2 para mejorar futuros mapeos automáticos.
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleAuditSubmit}
            variant="contained"
            disabled={validationMutation.isPending}
          >
            {validationMutation.isPending ? 'Procesando...' : 'Confirmar Auditoría'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}