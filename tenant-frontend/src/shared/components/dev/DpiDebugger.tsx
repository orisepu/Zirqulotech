'use client';

import { Box, Paper, Typography, Chip, IconButton, Collapse } from '@mui/material';
import { useState, useEffect } from 'react';
import { useDpiDetection } from '@/hooks/useDpiDetection';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Componente de debugging para mostrar información del DPI en tiempo real
 *
 * Solo se muestra en desarrollo o cuando NEXT_PUBLIC_SHOW_DPI_DEBUGGER=true
 *
 * @example
 * ```tsx
 * // En layout.tsx o página principal
 * {process.env.NODE_ENV === 'development' && <DpiDebugger />}
 * ```
 */
export function DpiDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { dpiInfo, getDebugString, shouldWarnAboutLayout } = useDpiDetection({
    enableWarnings: true,
    enableDetailedLogging: false,
  });

  // Solo renderizar después de montar en el cliente (evita hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Solo mostrar en desarrollo o si está habilitado explícitamente
  const shouldShow =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_SHOW_DPI_DEBUGGER === 'true';

  if (!shouldShow || !mounted) {
    return null;
  }

  const dpiLevelColors = {
    normal: 'success',
    medium: 'info',
    high: 'warning',
    'very-high': 'error',
  } as const;

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <IconButton
          onClick={() => setIsOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 80,
            left: 20,
            zIndex: 9999,
            bgcolor: shouldWarnAboutLayout() ? 'error.main' : 'primary.main',
            color: 'white',
            '&:hover': {
              bgcolor: shouldWarnAboutLayout() ? 'error.dark' : 'primary.dark',
            },
            boxShadow: 3,
          }}
          size="small"
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      )}

      {/* Panel de información */}
      <Collapse in={isOpen}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 9999,
            p: 2,
            maxWidth: 400,
            bgcolor: 'background.paper',
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontSize="0.9rem" fontWeight="bold">
              📊 DPI Monitor
            </Typography>
            <IconButton onClick={() => setIsOpen(false)} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Nivel de DPI */}
          <Box mb={2}>
            <Chip
              label={`${dpiInfo.dpiLevel.toUpperCase()}: ${dpiInfo.scalingPercentage}%`}
              color={dpiLevelColors[dpiInfo.dpiLevel]}
              size="small"
              sx={{ mb: 1 }}
            />
            {shouldWarnAboutLayout() && (
              <Typography variant="caption" color="error" display="block">
                ⚠️ Posibles problemas de layout detectados
              </Typography>
            )}
          </Box>

          {/* Información detallada */}
          <Box
            sx={{
              bgcolor: 'background.default',
              borderRadius: 1,
              p: 1.5,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
          >
            <Typography variant="caption" component="div" gutterBottom>
              <strong>Device Pixel Ratio:</strong> {dpiInfo.devicePixelRatio}x
            </Typography>
            <Typography variant="caption" component="div" gutterBottom>
              <strong>Viewport (CSS):</strong> {dpiInfo.viewportWidth}x{dpiInfo.viewportHeight}px
            </Typography>
            <Typography variant="caption" component="div" gutterBottom>
              <strong>Viewport (Físico):</strong> {dpiInfo.physicalWidth}x{dpiInfo.physicalHeight}px
            </Typography>
            <Typography variant="caption" component="div" gutterBottom>
              <strong>Browser:</strong> {dpiInfo.browserInfo.vendor}
            </Typography>
            <Typography variant="caption" component="div" sx={{ mt: 1, color: 'text.secondary' }}>
              {getDebugString()}
            </Typography>
          </Box>

          {/* Recomendaciones */}
          {dpiInfo.isHighDpi && (
            <Box mt={2} p={1} bgcolor="info.main" borderRadius={1}>
              <Typography variant="caption" color="white" display="block">
                💡 <strong>Tip:</strong> Verifica que las tablas usen valores rem responsivos para
                mejor escalado.
              </Typography>
            </Box>
          )}

          {/* Debug info para copiar */}
          <Box mt={1}>
            <Typography
              variant="caption"
              sx={{
                cursor: 'pointer',
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' },
              }}
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(dpiInfo, null, 2));
                console.log('DPI Info copiado al portapapeles');
              }}
            >
              🔗 Click para copiar info completa
            </Typography>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
}
