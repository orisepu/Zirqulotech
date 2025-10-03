'use client'

import {
  Card, CardHeader, CardContent, Button, Stack, Typography, Alert,
  FormControlLabel, Switch, Box, LinearProgress, Chip
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Update as UpdateIcon,
  Apple as AppleIcon,
  PhoneAndroid as AndroidIcon,
  SelectAll as SelectAllIcon
} from '@mui/icons-material'
import { useState } from 'react'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

interface IncrementalUpdateControlsProps {
  tareaId?: string
  onUpdate?: (result: any) => void
  disabled?: boolean
}

export default function IncrementalUpdateControls({
  tareaId,
  onUpdate,
  disabled = false
}: IncrementalUpdateControlsProps) {
  const [incrementalMode, setIncrementalMode] = useState(true)
  const [forceFullUpdate, setForceFullUpdate] = useState(false)
  const [selectedBrands, setSelectedBrands] = useState<string[]>(['Apple']) // Pre-seleccionar Apple

  const {
    useEnhancedLikewizeUpdate,
    useSessionReportFetcher
  } = useDeviceMappingEnhanced()

  const enhancedUpdate = useEnhancedLikewizeUpdate()
  const sessionReport = useSessionReportFetcher()

  const getErrorMessage = (error: unknown) => {
    if (!error) return ''
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error
    if (typeof (error as any)?.message === 'string') return (error as any).message
    return 'Error desconocido'
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    )
  }

  const handleSelectAll = () => {
    setSelectedBrands(prev =>
      prev.length === 3 ? [] : ['Apple', 'Google', 'Samsung']
    )
  }

  const handleUnifiedUpdate = async () => {
    // Determinar mode basado en selección
    const mode = selectedBrands.includes('Apple') && selectedBrands.length === 1
      ? 'apple'
      : 'others'

    const brands = mode === 'others' ? selectedBrands : undefined

    try {
      const result = await enhancedUpdate.mutateAsync({
        mode,
        brands,
        incremental: incrementalMode,
        force_full: forceFullUpdate
      })

      onUpdate?.(result)
    } catch (error) {
      console.error('Error in unified update:', error)
    }
  }

  const handleFetchSessionReport = async () => {
    if (!tareaId) return

    try {
      const result = await sessionReport.mutateAsync(tareaId)

      onUpdate?.(result)
    } catch (error) {
      console.error('Error fetching session report:', error)
    }
  }

  const isProcessing = enhancedUpdate.isPending || sessionReport.isPending

  return (
    <Card variant="outlined">
      <CardHeader title="Actualización de Precios Likewize" />

      <CardContent>
        <Stack spacing={3}>
          {/* Modo de Procesamiento */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Configuración
            </Typography>
            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={incrementalMode}
                    onChange={(e) => setIncrementalMode(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Procesamiento Incremental
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {incrementalMode
                        ? "Solo procesa cambios detectados"
                        : "Procesa todos los dispositivos"
                      }
                    </Typography>
                  </Box>
                }
              />

              {incrementalMode && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={forceFullUpdate}
                      onChange={(e) => setForceFullUpdate(e.target.checked)}
                      color="warning"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        Forzar Re-mapeo Completo
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Ignora caché y re-mapea todos los dispositivos
                      </Typography>
                    </Box>
                  }
                />
              )}
            </Stack>
          </Box>

          {/* Selector de Marcas */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Marcas a Actualizar
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label="Apple"
                icon={<AppleIcon />}
                clickable
                color={selectedBrands.includes('Apple') ? 'primary' : 'default'}
                variant={selectedBrands.includes('Apple') ? 'filled' : 'outlined'}
                onClick={() => toggleBrand('Apple')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Google"
                icon={<AndroidIcon />}
                clickable
                color={selectedBrands.includes('Google') ? 'primary' : 'default'}
                variant={selectedBrands.includes('Google') ? 'filled' : 'outlined'}
                onClick={() => toggleBrand('Google')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Samsung"
                icon={<AndroidIcon />}
                clickable
                color={selectedBrands.includes('Samsung') ? 'primary' : 'default'}
                variant={selectedBrands.includes('Samsung') ? 'filled' : 'outlined'}
                onClick={() => toggleBrand('Samsung')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                label="Todas"
                icon={<SelectAllIcon />}
                clickable
                color={selectedBrands.length === 3 ? 'secondary' : 'default'}
                variant={selectedBrands.length === 3 ? 'filled' : 'outlined'}
                onClick={handleSelectAll}
                sx={{ cursor: 'pointer' }}
              />
            </Stack>
          </Box>

          {/* Botones de Actualización */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Lanzar Actualización
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                size="large"
                startIcon={<UpdateIcon />}
                onClick={handleUnifiedUpdate}
                disabled={disabled || isProcessing || selectedBrands.length === 0}
                color="primary"
              >
                {isProcessing
                  ? 'Procesando...'
                  : `Actualizar ${selectedBrands.length === 3 ? 'Todas' : selectedBrands.join(', ')}`}
              </Button>

              {tareaId && (
                <Button
                  variant="outlined"
                  startIcon={<PlayIcon />}
                  onClick={handleFetchSessionReport}
                  disabled={disabled || isProcessing}
                >
                  Ver Reporte
                </Button>
              )}
            </Stack>
          </Box>

          {/* Progreso */}
          {isProcessing && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Procesando actualización...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Resultados */}
          {(enhancedUpdate.data || sessionReport.data) && (
            <Alert severity="success" variant="outlined">
              <Stack spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  ✓ Actualización completada
                </Typography>
                {sessionReport.data && (
                  <Typography variant="caption">
                    Procesados: {sessionReport.data.total_devices_processed} ·
                    Éxito: {sessionReport.data.success_rate.toFixed(1)}% ·
                    Fallos: {sessionReport.data.failed_mappings}
                  </Typography>
                )}
                {enhancedUpdate.data && (
                  <Typography variant="caption">
                    Tarea ID: {enhancedUpdate.data.tarea_id}
                  </Typography>
                )}
              </Stack>
            </Alert>
          )}

          {/* Errores */}
          {(enhancedUpdate.error || sessionReport.error) && (
            <Alert severity="error">
              <Typography variant="body2">
                Error: {getErrorMessage(enhancedUpdate.error || sessionReport.error)}
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
