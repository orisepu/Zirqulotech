'use client'

import React, { useState } from 'react'
import {
  Chip,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  LinearProgress,
  Alert,
  Collapse
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Feedback as FeedbackIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
  Cached as CachedIcon,
  Search as SearchIcon,
  AutoFixHigh as AutoFixHighIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material'

// Interfaces actualizadas para V2
export interface MappingConfidence {
  score: number // 0-100
  algorithm: 'cached' | 'exact' | 'fuzzy' | 'heuristic' | 'failed'
  needs_review: boolean
  times_confirmed: number
  metadata?: {
    fuzzy_score?: number
    heuristic?: string
    cached_mapping_id?: string
    extraction_confidence?: number
    validation_notes?: string[]
  }
}

export interface MappingFeedbackData {
  confidence: 'correct' | 'incorrect' | 'partial'
  feedback: string
  deviceId: string
  mapping_id?: string
  suggested_improvement?: string
}

interface MappingConfidenceEnhancedProps {
  confidence: MappingConfidence
  compact?: boolean
  onFeedback?: (data: MappingFeedbackData) => void
  deviceId?: string
  mapping_id?: string
  showDetails?: boolean
  interactive?: boolean
}

// Funciones utilitarias
const getAlgorithmConfig = (algorithm: MappingConfidence['algorithm']) => {
  switch (algorithm) {
    case 'cached':
      return {
        icon: <CachedIcon fontSize="small" />,
        label: 'Caché',
        color: 'success' as const,
        description: 'Mapeo previamente validado reutilizado'
      }
    case 'exact':
      return {
        icon: <CheckCircleIcon fontSize="small" />,
        label: 'Exacto',
        color: 'success' as const,
        description: 'Coincidencia exacta por código específico (A-number, etc.)'
      }
    case 'fuzzy':
      return {
        icon: <SearchIcon fontSize="small" />,
        label: 'Difuso',
        color: 'warning' as const,
        description: 'Mapeo por similitud con scoring ponderado'
      }
    case 'heuristic':
      return {
        icon: <PsychologyIcon fontSize="small" />,
        label: 'Heurístico',
        color: 'info' as const,
        description: 'Reglas específicas por marca y características'
      }
    case 'failed':
      return {
        icon: <ErrorIcon fontSize="small" />,
        label: 'Falló',
        color: 'error' as const,
        description: 'No se pudo determinar mapeo automático'
      }
  }
}

const getConfidenceLevel = (score: number): { level: 'high' | 'medium' | 'low', color: 'success' | 'warning' | 'error' } => {
  if (score >= 85) return { level: 'high', color: 'success' }
  if (score >= 60) return { level: 'medium', color: 'warning' }
  return { level: 'low', color: 'error' }
}

export const MappingConfidenceEnhanced: React.FC<MappingConfidenceEnhancedProps> = ({
  confidence,
  compact = false,
  onFeedback,
  deviceId = '',
  mapping_id,
  showDetails = false,
  interactive = true
}) => {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({
    confidence: 'correct' as 'correct' | 'incorrect' | 'partial',
    feedback: '',
    suggested_improvement: ''
  })
  const [detailsExpanded, setDetailsExpanded] = useState(showDetails)

  const algorithmConfig = getAlgorithmConfig(confidence.algorithm)
  const confidenceLevel = getConfidenceLevel(confidence.score)

  const handleFeedbackSubmit = () => {
    if (onFeedback && deviceId) {
      onFeedback({
        ...feedbackForm,
        deviceId,
        mapping_id
      })
    }
    setFeedbackOpen(false)
    setFeedbackForm({ confidence: 'correct', feedback: '', suggested_improvement: '' })
  }

  // Componente compacto para tablas
  if (compact) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={`${confidence.score}/100 - ${algorithmConfig.description}`}>
          <Chip
            size="small"
            icon={algorithmConfig.icon}
            label={`${confidence.score}`}
            color={confidenceLevel.color}
            variant={confidence.needs_review ? 'outlined' : 'filled'}
          />
        </Tooltip>
        {confidence.times_confirmed > 0 && (
          <Tooltip title={`Confirmado ${confidence.times_confirmed} veces`}>
            <Chip size="small" label={`✓${confidence.times_confirmed}`} color="success" variant="outlined" />
          </Tooltip>
        )}
        {interactive && onFeedback && (
          <Tooltip title="Enviar feedback">
            <IconButton size="small" onClick={() => setFeedbackOpen(true)}>
              <FeedbackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    )
  }

  // Componente completo
  return (
    <Box>
      <Stack spacing={2}>
        {/* Header con score principal */}
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <LinearProgress
                variant="determinate"
                value={confidence.score}
                color={confidenceLevel.color}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  width: 80,
                  backgroundColor: 'action.hover'
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: -2,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.7rem'
                }}
              >
                {confidence.score}
              </Typography>
            </Box>

            <Chip
              icon={algorithmConfig.icon}
              label={algorithmConfig.label}
              color={algorithmConfig.color}
              size="medium"
            />

            {confidence.needs_review && (
              <Chip
                icon={<WarningIcon />}
                label="Revisión"
                color="warning"
                variant="outlined"
                size="small"
              />
            )}

            {confidence.times_confirmed > 0 && (
              <Chip
                label={`${confidence.times_confirmed}× confirmado`}
                color="success"
                variant="outlined"
                size="small"
              />
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            {interactive && (
              <Tooltip title="Detalles del mapeo">
                <IconButton size="small" onClick={() => setDetailsExpanded(!detailsExpanded)}>
                  {detailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            )}

            {interactive && onFeedback && (
              <Tooltip title="Enviar feedback sobre este mapeo">
                <IconButton size="small" onClick={() => setFeedbackOpen(true)}>
                  <FeedbackIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Detalles expandibles */}
        <Collapse in={detailsExpanded}>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {algorithmConfig.description}
            </Typography>

            {/* Metadata específica */}
            {confidence.metadata && (
              <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                <Stack spacing={0.5}>
                  {confidence.metadata.fuzzy_score && (
                    <Typography variant="caption" color="text.secondary">
                      Score difuso: {(confidence.metadata.fuzzy_score * 100).toFixed(1)}%
                    </Typography>
                  )}
                  {confidence.metadata.heuristic && (
                    <Typography variant="caption" color="text.secondary">
                      Heurística: {confidence.metadata.heuristic}
                    </Typography>
                  )}
                  {confidence.metadata.cached_mapping_id && (
                    <Typography variant="caption" color="text.secondary">
                      Caché ID: {confidence.metadata.cached_mapping_id}
                    </Typography>
                  )}
                  {confidence.metadata.extraction_confidence && (
                    <Typography variant="caption" color="text.secondary">
                      Confianza de extracción: {(confidence.metadata.extraction_confidence * 100).toFixed(1)}%
                    </Typography>
                  )}
                  {confidence.metadata.validation_notes && confidence.metadata.validation_notes.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Notas de validación:
                      </Typography>
                      {confidence.metadata.validation_notes.map((note, index) => (
                        <Typography key={index} variant="caption" color="text.secondary" sx={{ display: 'block', pl: 1 }}>
                          • {note}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Estado del sistema */}
            {confidence.needs_review && (
              <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Este mapeo requiere revisión manual debido a baja confianza o conflictos detectados.
                </Typography>
              </Alert>
            )}
          </Stack>
        </Collapse>
      </Stack>

      {/* Dialog de feedback */}
      <Dialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Feedback sobre Mapeo</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl>
              <FormLabel>¿Es correcto este mapeo?</FormLabel>
              <RadioGroup
                value={feedbackForm.confidence}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, confidence: e.target.value as any })}
              >
                <FormControlLabel value="correct" control={<Radio />} label="Correcto" />
                <FormControlLabel value="partial" control={<Radio />} label="Parcialmente correcto" />
                <FormControlLabel value="incorrect" control={<Radio />} label="Incorrecto" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="Comentarios (opcional)"
              multiline
              rows={3}
              value={feedbackForm.feedback}
              onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
              placeholder="Describe qué está bien o mal en este mapeo..."
            />

            {feedbackForm.confidence !== 'correct' && (
              <TextField
                label="Sugerencia de mejora"
                multiline
                rows={2}
                value={feedbackForm.suggested_improvement}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, suggested_improvement: e.target.value })}
                placeholder="¿Cómo se podría mejorar este mapeo?"
              />
            )}

            <Alert severity="info">
              Tu feedback ayuda a entrenar el sistema para futuros mapeos más precisos.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackOpen(false)}>Cancelar</Button>
          <Button onClick={handleFeedbackSubmit} variant="contained">
            Enviar Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default MappingConfidenceEnhanced