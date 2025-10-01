'use client'

import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Stack,
  Alert,
  Collapse,
} from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import HomeIcon from '@mui/icons-material/Home'
import BugReportIcon from '@mui/icons-material/BugReport'
import { useState } from 'react'

interface ErrorUIProps {
  error: Error & { digest?: string }
  reset?: () => void
  showHomeButton?: boolean
  title?: string
  description?: string
}

/**
 * Componente reutilizable para mostrar errores con estilo consistente
 * - Cumple WCAG 2.1 AA (accesibilidad)
 * - Muestra detalles técnicos solo en desarrollo
 * - Permite recuperación con botón reset
 */
export default function ErrorUI({
  error,
  reset,
  showHomeButton = false,
  title = 'Algo salió mal',
  description = 'Ha ocurrido un error inesperado. Por favor, intenta recargar la página.',
}: ErrorUIProps) {
  const [showDetails, setShowDetails] = useState(false)
  const isDevelopment = process.env.NODE_ENV === 'development'

  const handleGoHome = () => {
    window.location.href = '/'
  }

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          borderTop: 4,
          borderColor: 'error.main',
        }}
        role="alert"
        aria-live="assertive"
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <ErrorOutlineIcon
            sx={{ fontSize: 80, color: 'error.main' }}
            aria-hidden="true"
          />
        </Box>

        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {description}
        </Typography>

        {/* Detalles del error (solo en desarrollo o si hay digest) */}
        {(isDevelopment || error.digest) && (
          <Box sx={{ mb: 4 }}>
            <Button
              startIcon={<BugReportIcon />}
              onClick={() => setShowDetails(!showDetails)}
              size="small"
              variant="outlined"
              color="error"
              aria-expanded={showDetails}
              aria-controls="error-details"
            >
              {showDetails ? 'Ocultar detalles' : 'Ver detalles técnicos'}
            </Button>

            <Collapse in={showDetails}>
              <Alert
                severity="error"
                icon={false}
                sx={{ mt: 2, textAlign: 'left' }}
                id="error-details"
              >
                {error.digest && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Error ID:</strong> {error.digest}
                  </Typography>
                )}
                {isDevelopment && (
                  <>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Mensaje:</strong> {error.message}
                    </Typography>
                    {error.stack && (
                      <Typography
                        variant="body2"
                        component="pre"
                        sx={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          mt: 1,
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          maxHeight: 300,
                          overflow: 'auto',
                        }}
                      >
                        {error.stack}
                      </Typography>
                    )}
                  </>
                )}
              </Alert>
            </Collapse>
          </Box>
        )}

        {/* Botones de acción */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
        >
          {reset && (
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={reset}
              size="large"
              aria-label="Intentar de nuevo"
            >
              Intentar de nuevo
            </Button>
          )}

          {showHomeButton && (
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={handleGoHome}
              size="large"
              aria-label="Volver al inicio"
            >
              Volver al inicio
            </Button>
          )}
        </Stack>

        {/* Información adicional */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 4 }}
        >
          Si el problema persiste, contacta con soporte técnico.
        </Typography>
      </Paper>
    </Container>
  )
}
