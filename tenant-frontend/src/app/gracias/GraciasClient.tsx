'use client'
import { Box, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

export default function GraciasClient() {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="70vh" gap={2} textAlign="center">
      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main' }} />
      <Typography variant="h4" fontWeight="bold">¡Gracias!</Typography>
      <Typography variant="body1" color="text.secondary" maxWidth={520}>
        Hemos recibido tu documentación. Te avisaremos por email cuando esté validada.
      </Typography>
    </Box>
  )
}
