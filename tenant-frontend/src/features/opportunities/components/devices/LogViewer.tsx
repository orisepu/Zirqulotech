'use client'

import React, { useRef, useEffect } from 'react'
import { Box, Paper, Typography, CircularProgress } from '@mui/material'

interface LogEntry {
  timestamp: string
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  message: string
}

interface LogViewerProps {
  logs: LogEntry[]
  isRunning: boolean
}

export function LogViewer({ logs, isRunning }: LogViewerProps) {
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al final cuando hay nuevos logs
  useEffect(() => {
    if (logContainerRef.current && isRunning) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isRunning])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'success.main'
      case 'WARNING':
        return 'warning.main'
      case 'ERROR':
        return 'error.main'
      default:
        return 'text.primary'
    }
  }

  return (
    <Paper variant="outlined" sx={{ bgcolor: 'grey.900', p: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ color: 'grey.100' }}>
        📋 Logs de Ejecución
      </Typography>

      <Box
        ref={logContainerRef}
        sx={{
          maxHeight: 400,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          bgcolor: '#1a1a1a',
          color: 'grey.100',
          p: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'grey.800',
        }}
      >
        {logs.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            No hay logs disponibles...
          </Typography>
        ) : (
          logs.map((log, idx) => (
            <Box key={idx} sx={{ mb: 0.5, display: 'flex', flexWrap: 'wrap' }}>
              <Typography
                component="span"
                variant="caption"
                sx={{ color: 'grey.500', mr: 1, minWidth: '80px' }}
              >
                {new Date(log.timestamp).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                sx={{
                  color: getLevelColor(log.level),
                  flex: 1,
                  wordBreak: 'break-word',
                }}
              >
                {log.message}
              </Typography>
            </Box>
          ))
        )}

        {isRunning && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <CircularProgress size={12} sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ color: 'grey.400' }}>
              Procesando...
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  )
}
