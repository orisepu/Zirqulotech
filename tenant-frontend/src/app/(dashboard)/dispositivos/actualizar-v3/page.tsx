'use client'

import { Box, Typography } from '@mui/material'
import EnhancedLikewizePage from '@/features/opportunities/components/devices/EnhancedLikewizePage'

export default function ActualizarPreciosV3() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Actualización de Precios Likewize
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Actualización de precios desde Likewize con validación y corrección de mapeos
        </Typography>
      </Box>

      {/* Main Content */}
      <EnhancedLikewizePage />
    </Box>
  )
}