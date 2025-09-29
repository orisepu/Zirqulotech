'use client'

import { Chip, Tooltip, Stack, Typography, Box, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Rating } from '@mui/material'
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon, Error as ErrorIcon, Info as InfoIcon, Feedback as FeedbackIcon } from '@mui/icons-material'
import { useState } from 'react'

export interface MappingConfidence {
  score: number // 0-100
  algorithm: 'cached' | 'exact' | 'fuzzy' | 'heuristic' | 'failed'
  needs_review: boolean
  times_confirmed: number
  metadata?: {
    fuzzy_score?: number
    heuristic?: string
    cached_mapping_id?: string
  }
}

export interface MappingFeedbackData {
  mapping_id: string
  feedback: 'correct' | 'incorrect' | 'partial' | 'needs_review'
  user_notes?: string
  suggested_capacity_id?: number
}

interface MappingConfidenceEnhancedProps {
  confidence: MappingConfidence
  mappingId?: string
  onFeedback?: (feedback: MappingFeedbackData) => void
  compact?: boolean
}

export default function MappingConfidenceEnhanced({
  confidence,
  mappingId,
  onFeedback,
  compact = false
}: MappingConfidenceEnhancedProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<MappingFeedbackData['feedback']>('correct')
  const [comments, setComments] = useState('')
  const [userRating, setUserRating] = useState<number>(3)

  // Determine confidence level and styling
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { level: 'alta', color: 'success' as const, icon: <CheckCircleIcon /> }
    if (score >= 60) return { level: 'media', color: 'warning' as const, icon: <InfoIcon /> }
    if (score >= 30) return { level: 'baja', color: 'error' as const, icon: <WarningIcon /> }
    return { level: 'crítica', color: 'error' as const, icon: <ErrorIcon /> }
  }

  const confidenceInfo = getConfidenceLevel(confidence.score)

  const getAlgorithmLabel = (algorithm: string) => {
    const labels = {
      'cached': 'Caché',
      'exact': 'Exacto',
      'fuzzy': 'Difuso',
      'heuristic': 'Heurístico',
      'failed': 'Falló'
    }
    return labels[algorithm as keyof typeof labels] || algorithm
  }

  const getAlgorithmDescription = (algorithm: string) => {
    const descriptions = {
      'cached': 'Mapeo reutilizado de actualizaciones anteriores',
      'exact': 'Mapeo por códigos específicos y señales fuertes',
      'fuzzy': 'Mapeo por similitud con scoring ponderado',
      'heuristic': 'Mapeo por reglas específicas de marca',
      'failed': 'No se pudo mapear automáticamente'
    }
    return descriptions[algorithm as keyof typeof descriptions] || 'Algoritmo de mapeo desconocido'
  }

  const handleFeedbackSubmit = () => {
    if (!mappingId || !onFeedback) return

    const trimmed = comments.trim()
    const ratingNote = `Calificación usuario: ${userRating}/5`
    const combinedNotes = [trimmed, ratingNote].filter(Boolean).join('\n')

    onFeedback({
      mapping_id: mappingId,
      feedback: feedbackType,
      user_notes: combinedNotes || undefined
    })

    setFeedbackOpen(false)
    setComments('')
    setUserRating(3)
  }

  if (compact) {
    return (
      <Tooltip
        title={
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>Confianza:</strong> {confidence.score}/100 ({confidenceInfo.level})
            </Typography>
            <Typography variant="body2">
              <strong>Algoritmo:</strong> {getAlgorithmLabel(confidence.algorithm)}
            </Typography>
            {confidence.times_confirmed > 1 && (
              <Typography variant="body2">
                <strong>Confirmado:</strong> {confidence.times_confirmed} veces
              </Typography>
            )}
            {confidence.needs_review && (
              <Typography variant="body2" color="warning.main">
                ⚠️ Necesita revisión manual
              </Typography>
            )}
          </Stack>
        }
      >
        <Chip
          size="small"
          icon={confidenceInfo.icon}
          label={`${confidence.score}%`}
          color={confidenceInfo.color}
          variant={confidence.needs_review ? "outlined" : "filled"}
        />
      </Tooltip>
    )
  }

  return (
    <>
      <Stack spacing={1} alignItems="flex-start">
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={confidenceInfo.icon}
            label={`${confidence.score}% ${confidenceInfo.level}`}
            color={confidenceInfo.color}
            variant={confidence.needs_review ? "outlined" : "filled"}
          />
          <Chip
            size="small"
            label={getAlgorithmLabel(confidence.algorithm)}
            variant="outlined"
            color="default"
          />
          {mappingId && onFeedback && (
            <Tooltip title="Proporcionar feedback sobre este mapeo">
              <IconButton
                size="small"
                onClick={() => setFeedbackOpen(true)}
                color="primary"
              >
                <FeedbackIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Additional details */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            {getAlgorithmDescription(confidence.algorithm)}
          </Typography>

          {confidence.times_confirmed > 1 && (
            <Typography variant="caption" color="success.main" display="block">
              ✓ Confirmado {confidence.times_confirmed} veces
            </Typography>
          )}

          {confidence.needs_review && (
            <Typography variant="caption" color="warning.main" display="block">
              ⚠️ Marcado para revisión manual
            </Typography>
          )}

          {confidence.metadata?.heuristic && (
            <Typography variant="caption" color="info.main" display="block">
              Heurística: {confidence.metadata.heuristic}
            </Typography>
          )}

          {confidence.metadata?.fuzzy_score && (
            <Typography variant="caption" color="text.secondary" display="block">
              Score difuso: {confidence.metadata.fuzzy_score}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Feedback Dialog */}
      <Dialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Feedback del Mapeo</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              Ayúdanos a mejorar el sistema de mapeo automático proporcionando feedback sobre la calidad de este mapeo.
            </Alert>

            <Box>
              <Typography variant="body2" gutterBottom fontWeight={600}>
                ¿Qué tan preciso es este mapeo?
              </Typography>
              <Rating
                value={userRating}
                onChange={(_, value) => setUserRating(value || 1)}
                size="large"
                max={5}
              />
              <Typography variant="caption" color="text.secondary">
                1 = Muy impreciso, 5 = Muy preciso
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom fontWeight={600}>
                Tipo de feedback:
              </Typography>
              <Stack spacing={1}>
                {[
                  { value: 'correct', label: 'Correcto', color: 'success' },
                  { value: 'partial', label: 'Parcial', color: 'info' },
                  { value: 'incorrect', label: 'Incorrecto', color: 'error' },
                  { value: 'needs_review', label: 'Necesita revisión', color: 'warning' }
                ].map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    clickable
                    color={feedbackType === option.value ? option.color as any : 'default'}
                    variant={feedbackType === option.value ? 'filled' : 'outlined'}
                    onClick={() => setFeedbackType(option.value as any)}
                  />
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="body2" gutterBottom fontWeight={600}>
                Comentarios adicionales (opcional):
              </Typography>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Describe cualquier problema o sugerencia..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Detalles del mapeo:</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Confianza: {confidence.score}% · Algoritmo: {getAlgorithmLabel(confidence.algorithm)}
                {confidence.times_confirmed > 1 && ` · Confirmado ${confidence.times_confirmed} veces`}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleFeedbackSubmit}
            disabled={!mappingId}
          >
            Enviar Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
