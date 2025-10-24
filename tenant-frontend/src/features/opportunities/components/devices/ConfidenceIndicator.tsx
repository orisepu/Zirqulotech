'use client'

import { Box, Chip, Tooltip, Typography, LinearProgress } from '@mui/material'
import {
  CheckCircle,
  Error,
  Info,
  Psychology,
  TrendingUp,
  TrendingDown,
  Remove
} from '@mui/icons-material'
import { ConfidenceLevel, ConfidenceThresholds } from '@/types/autoaprendizaje-v3'

interface ConfidenceIndicatorProps {
  confidence: number
  size?: 'small' | 'medium' | 'large'
  variant?: 'chip' | 'progress' | 'detailed' | 'icon'
  showLabel?: boolean
  showPercentage?: boolean
  animated?: boolean
  className?: string
}

const CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  very_high: 0.9,
  high: 0.7,
  medium: 0.5,
  low: 0.3,
  very_low: 0.0
}

const CONFIDENCE_CONFIG = {
  very_high: {
    label: 'Muy Alta',
    color: '#4caf50',
    bgColor: '#e8f5e8',
    icon: CheckCircle,
    description: 'Mapeo altamente confiable, probablemente correcto'
  },
  high: {
    label: 'Alta',
    color: '#8bc34a',
    bgColor: '#f1f8e9',
    icon: TrendingUp,
    description: 'Mapeo confiable, generalmente correcto'
  },
  medium: {
    label: 'Media',
    color: '#ff9800',
    bgColor: '#fff3e0',
    icon: Remove,
    description: 'Mapeo moderadamente confiable, revisar si es posible'
  },
  low: {
    label: 'Baja',
    color: '#f44336',
    bgColor: '#ffebee',
    icon: TrendingDown,
    description: 'Mapeo poco confiable, requiere revisión'
  },
  very_low: {
    label: 'Muy Baja',
    color: '#d32f2f',
    bgColor: '#ffebee',
    icon: Error,
    description: 'Mapeo no confiable, requiere corrección manual'
  }
}

export function ConfidenceIndicator({
  confidence,
  size = 'medium',
  variant = 'chip',
  showLabel = true,
  showPercentage = false,
  animated = false,
  className
}: ConfidenceIndicatorProps) {
  const getConfidenceLevel = (score: number): ConfidenceLevel => {
    if (score >= CONFIDENCE_THRESHOLDS.very_high) return 'very_high'
    if (score >= CONFIDENCE_THRESHOLDS.high) return 'high'
    if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium'
    if (score >= CONFIDENCE_THRESHOLDS.low) return 'low'
    return 'very_low'
  }

  const level = getConfidenceLevel(confidence)
  const config = CONFIDENCE_CONFIG[level]
  const percentage = Math.round(confidence * 100)

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16
      case 'large': return 32
      default: return 20
    }
  }

  const getChipSize = () => {
    switch (size) {
      case 'small': return 'small' as const
      case 'large': return 'medium' as const
      default: return 'small' as const
    }
  }

  const IconComponent = config.icon

  if (variant === 'icon') {
    return (
      <Tooltip title={`${config.label}: ${percentage}% - ${config.description}`}>
        <IconComponent
          sx={{
            color: config.color,
            fontSize: getIconSize(),
            ...(animated && {
              animation: 'pulse 2s infinite'
            })
          }}
          className={className}
        />
      </Tooltip>
    )
  }

  if (variant === 'progress') {
    return (
      <Box className={className}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <IconComponent sx={{ color: config.color, fontSize: getIconSize() }} />
          {showLabel && (
            <Typography variant={size === 'small' ? 'caption' : 'body2'} fontWeight="bold">
              {config.label}
            </Typography>
          )}
          {showPercentage && (
            <Typography variant={size === 'small' ? 'caption' : 'body2'} color="text.secondary">
              {percentage}%
            </Typography>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: size === 'small' ? 4 : size === 'large' ? 8 : 6,
            borderRadius: 2,
            backgroundColor: config.bgColor,
            '& .MuiLinearProgress-bar': {
              backgroundColor: config.color,
              ...(animated && {
                animation: 'loading 1.5s infinite ease-in-out'
              })
            }
          }}
        />
      </Box>
    )
  }

  if (variant === 'detailed') {
    return (
      <Box
        className={className}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: config.bgColor,
          border: `1px solid ${config.color}20`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <IconComponent sx={{ color: config.color, fontSize: getIconSize() }} />
          <Typography variant="subtitle2" fontWeight="bold" sx={{ color: config.color }}>
            Confianza {config.label}
          </Typography>
        </Box>

        <Typography variant="h6" fontWeight="bold" sx={{ color: config.color, mb: 1 }}>
          {percentage}%
        </Typography>

        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 6,
            borderRadius: 3,
            mb: 1,
            backgroundColor: config.bgColor,
            '& .MuiLinearProgress-bar': {
              backgroundColor: config.color
            }
          }}
        />

        <Typography variant="caption" color="text.secondary">
          {config.description}
        </Typography>
      </Box>
    )
  }

  // Default: chip variant
  return (
    <Tooltip title={`${percentage}% - ${config.description}`}>
      <Chip
        icon={<IconComponent />}
        label={
          showLabel
            ? showPercentage
              ? `${config.label} (${percentage}%)`
              : config.label
            : showPercentage
              ? `${percentage}%`
              : undefined
        }
        size={getChipSize()}
        sx={{
          backgroundColor: config.bgColor,
          color: config.color,
          border: `1px solid ${config.color}40`,
          '& .MuiChip-icon': {
            color: config.color
          },
          ...(animated && {
            animation: 'pulse 2s infinite'
          })
        }}
        className={className}
      />
    </Tooltip>
  )
}

// Helper component for confidence comparison
export function ConfidenceComparison({
  oldConfidence,
  newConfidence,
  size = 'medium'
}: {
  oldConfidence: number
  newConfidence: number
  size?: 'small' | 'medium' | 'large'
}) {
  const improvement = newConfidence - oldConfidence
  const isImprovement = improvement > 0
  const isSignificant = Math.abs(improvement) > 0.1

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ConfidenceIndicator
        confidence={oldConfidence}
        size={size}
        variant="chip"
        showPercentage
      />

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {isImprovement ? (
          <TrendingUp color={isSignificant ? 'success' : 'info'} fontSize="small" />
        ) : improvement < 0 ? (
          <TrendingDown color={isSignificant ? 'error' : 'warning'} fontSize="small" />
        ) : (
          <Remove color="disabled" fontSize="small" />
        )}

        <Typography
          variant="caption"
          sx={{
            color: isImprovement
              ? isSignificant ? 'success.main' : 'info.main'
              : improvement < 0
                ? isSignificant ? 'error.main' : 'warning.main'
                : 'text.disabled',
            fontWeight: isSignificant ? 'bold' : 'normal'
          }}
        >
          {improvement > 0 ? '+' : ''}{Math.round(improvement * 100)}%
        </Typography>
      </Box>

      <ConfidenceIndicator
        confidence={newConfidence}
        size={size}
        variant="chip"
        showPercentage
        animated={isSignificant}
      />
    </Box>
  )
}

// Helper function to get confidence level
export const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
  if (confidence >= CONFIDENCE_THRESHOLDS.very_high) return 'very_high'
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high'
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium'
  if (confidence >= CONFIDENCE_THRESHOLDS.low) return 'low'
  return 'very_low'
}

// Helper function to get confidence color
export const getConfidenceColor = (confidence: number): string => {
  const level = getConfidenceLevel(confidence)
  return CONFIDENCE_CONFIG[level].color
}