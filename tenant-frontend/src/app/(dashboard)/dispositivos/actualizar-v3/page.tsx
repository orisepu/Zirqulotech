'use client'

import { Box, Typography, Grid, Paper, Alert } from '@mui/material'
import { AutoAwesome, TrendingUp, Psychology, Speed } from '@mui/icons-material'
import { LearningDashboard } from '@/features/opportunities/components/devices/LearningDashboard'
import EnhancedLikewizePage from '@/features/opportunities/components/devices/EnhancedLikewizePage'

export default function ActualizarPreciosV3() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoAwesome color="primary" />
          Actualización de Precios V3
          <Typography
            variant="caption"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontWeight: 'bold'
            }}
          >
            IA AVANZADA
          </Typography>
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Sistema de autoaprendizaje con inteligencia artificial para actualización automática de precios
        </Typography>

        {/* Feature Highlights */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
              <Psychology color="primary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Autoaprendizaje
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Aprende de correcciones manuales
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
              <TrendingUp color="success" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="subtitle2" fontWeight="bold">
                95%+ Precisión
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Confianza objetivo del sistema
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
              <Speed color="warning" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="subtitle2" fontWeight="bold">
                10x Más Rápido
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Procesamiento asíncrono
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
              <AutoAwesome color="info" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="subtitle2" fontWeight="bold">
                30+ Características
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Extracción avanzada de features
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Nuevo en V3:</strong> Sistema de inteligencia artificial que aprende automáticamente
            de las correcciones manuales para mejorar la precisión de la actualización de precios.
            Incluye extracción avanzada de características y procesamiento asíncrono.
          </Typography>
        </Alert>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Learning Dashboard */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <LearningDashboard />
        </Grid>

        {/* Main Update Interface */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <EnhancedLikewizePage />
        </Grid>
      </Grid>
    </Box>
  )
}