'use client'
import React from 'react'
import { Grid, Card, CardContent, Typography, Box } from '@mui/material'
import { CheckCircle } from '@mui/icons-material'
import type { EstadoGeneral } from '@/shared/types/dispositivos'

interface EstadoOption {
  value: EstadoGeneral
  label: string
  percentage: number
  description: string
  color: string
  bgColor: string
}

const estadoOptions: EstadoOption[] = [
  {
    value: 'excelente',
    label: 'Excelente',
    percentage: 100,
    description: 'Como nuevo, sin signos de uso',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
  },
  {
    value: 'bueno',
    label: 'Bueno',
    percentage: 80,
    description: 'Ligeros signos de uso, plenamente funcional',
    color: '#ed6c02',
    bgColor: '#fff3e0',
  },
  {
    value: 'malo',
    label: 'Malo',
    percentage: 50,
    description: 'Signos evidentes de uso o defectos menores',
    color: '#d32f2f',
    bgColor: '#ffebee',
  },
]

export interface PasoEstadoGeneralProps {
  estadoGeneral: EstadoGeneral | null | ''
  onEstadoGeneralChange: (estado: EstadoGeneral) => void
}

export default function PasoEstadoGeneral({
  estadoGeneral,
  onEstadoGeneralChange,
}: PasoEstadoGeneralProps) {

  const handleCardClick = (estado: EstadoGeneral) => {
    if (onEstadoGeneralChange) {
      onEstadoGeneralChange(estado)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent, estado: EstadoGeneral) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick(estado)
    }
  }

  return (
    <Box>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ mb: 2 }}
        id="estado-general-heading"
      >
        Estado general del dispositivo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Seleccione el estado que mejor describe la condición actual del dispositivo.
        Use las teclas Tab para navegar entre opciones, Espacio o Enter para seleccionar.
      </Typography>

      <Grid
        container
        spacing={2}
        role="radiogroup"
        aria-labelledby="estado-general-heading"
      >
        {estadoOptions.map((option) => {
          const isSelected = estadoGeneral === option.value

          return (
            <Grid key={option.value} size={{ xs: 12, md: 4 }}>
              <Card
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                aria-label={`${option.label}: ${option.description}. Valoración al ${option.percentage}% del precio base.${isSelected ? ' Actualmente seleccionado.' : ''}`}
                onClick={() => handleCardClick(option.value)}
                onKeyDown={(e) => handleKeyDown(e, option.value)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  border: isSelected ? `3px solid ${option.color}` : '2px solid #e0e0e0',
                  backgroundColor: isSelected ? option.bgColor : '#ffffff',
                  transition: 'all 0.3s ease',
                  '&:hover:not(:focus)': {
                    borderColor: option.color,
                    backgroundColor: option.bgColor,
                    transform: 'translateY(-4px)',
                    boxShadow: `0 4px 12px ${option.color}40`,
                  },
                  '&:focus': {
                    outline: `3px solid ${option.color}`,
                    outlineOffset: '4px',
                    boxShadow: `0 0 0 6px rgba(0, 0, 0, 0.12)`,
                  },
                  '&:focus:not(:focus-visible)': {
                    outline: 'none',
                    boxShadow: 'none',
                  },
                }}
              >
                <CardContent>
                  {/* Checkmark icon para card seleccionada - decorativo */}
                  {isSelected && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                      }}
                      aria-hidden="true"
                    >
                      <CheckCircle sx={{ color: option.color, fontSize: 28 }} />
                    </Box>
                  )}

                  {/* Título del estado */}
                  <Typography
                    variant="h5"
                    sx={{
                      color: option.color,
                      fontWeight: isSelected ? 700 : 600,
                      mb: 1,
                    }}
                    aria-hidden="true"
                  >
                    {option.label}
                  </Typography>

                  {/* Porcentaje */}
                  <Typography
                    variant="h4"
                    sx={{
                      color: option.color,
                      fontWeight: 700,
                      mb: 1,
                    }}
                    aria-hidden="true"
                  >
                    {option.percentage}%
                  </Typography>

                  {/* Descripción */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minHeight: '40px' }}
                    aria-hidden="true"
                  >
                    {option.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
