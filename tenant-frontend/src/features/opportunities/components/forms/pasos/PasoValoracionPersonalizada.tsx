'use client'

import React, { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Stack,
  Paper,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Button,
  CircularProgress,
} from '@mui/material'
import { Grade } from '@/shared/types/grading'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

interface PasoValoracionPersonalizadaProps {
  dispositivo: DispositivoPersonalizado
  canal: 'B2B' | 'B2C'
  onGuardar: (data: { grado: Grade | 'V_SUELO'; precio_final: number; observaciones: string }) => void
  onCancelar: () => void
  guardando?: boolean
}

const GRADOS_CONFIG: Array<{
  value: Grade | 'V_SUELO'
  label: string
  descripcion: string
  color: string
}> = [
  {
    value: 'A+',
    label: 'A+ (Como nuevo)',
    descripcion: '100% funcional, sin marcas visibles, aspecto nuevo',
    color: '#4caf50',
  },
  {
    value: 'A',
    label: 'A (Excelente)',
    descripcion: '100% funcional, sin marcas en pantalla, micro-marcas leves en chasis',
    color: '#8bc34a',
  },
  {
    value: 'B',
    label: 'B (Muy bueno)',
    descripcion: '100% funcional, micro-arañazos en pantalla, marcas visibles leves en chasis',
    color: '#ff9800',
  },
  {
    value: 'C',
    label: 'C (Correcto)',
    descripcion: '100% funcional, arañazos evidentes en pantalla, desgaste notable en chasis',
    color: '#ff5722',
  },
  {
    value: 'V_SUELO',
    label: 'Precio Suelo',
    descripcion: 'Precio mínimo independiente del estado',
    color: '#9e9e9e',
  },
]

export default function PasoValoracionPersonalizada({
  dispositivo,
  canal,
  onGuardar,
  onCancelar,
  guardando = false,
}: PasoValoracionPersonalizadaProps) {
  const [gradoSeleccionado, setGradoSeleccionado] = useState<Grade | 'V_SUELO' | null>('A+')
  const [observaciones, setObservaciones] = useState('')

  // Obtener precio vigente según canal
  const precioVigente = canal === 'B2B' ? dispositivo.precio_b2b_vigente : dispositivo.precio_b2c_vigente

  // Calcular precio según grado seleccionado
  const precioCalculado = useMemo(() => {
    if (!gradoSeleccionado || !precioVigente) return null

    if (gradoSeleccionado === 'V_SUELO') {
      return dispositivo.precio_suelo
    }

    const precioBase = precioVigente
    const ppA = dispositivo.pp_A
    const ppB = dispositivo.pp_B
    const ppC = dispositivo.pp_C

    let precio: number

    switch (gradoSeleccionado) {
      case 'A+':
        precio = precioBase
        break
      case 'A':
        precio = precioBase * (1 - ppA)
        break
      case 'B':
        const V_A = precioBase * (1 - ppA)
        precio = V_A * (1 - ppB)
        break
      case 'C':
        const V_A2 = precioBase * (1 - ppA)
        const V_B = V_A2 * (1 - ppB)
        precio = V_B * (1 - ppC)
        break
      default:
        precio = precioBase
    }

    // Redondear a múltiplos de 5€
    const precioRedondeado = Math.round(precio / 5) * 5

    // Aplicar precio suelo como mínimo
    return Math.max(precioRedondeado, dispositivo.precio_suelo)
  }, [gradoSeleccionado, precioVigente, dispositivo])

  const handleGuardar = () => {
    if (!gradoSeleccionado || precioCalculado === null) return

    onGuardar({
      grado: gradoSeleccionado,
      precio_final: precioCalculado,
      observaciones: observaciones.trim(),
    })
  }

  const puedeGuardar = gradoSeleccionado !== null && precioCalculado !== null && typeof precioCalculado === 'number'

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Valoración de dispositivo personalizado
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Selecciona el grado estético del dispositivo para calcular la oferta automáticamente.
      </Typography>

      <Stack spacing={3}>
        {/* Info dispositivo */}
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            {dispositivo.descripcion_completa}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Canal: {canal === 'B2B' ? 'Empresas (B2B)' : 'Particulares (B2C)'}
          </Typography>
          {precioVigente ? (
            <Typography variant="body2" color="text.secondary">
              Precio base (A+): €{precioVigente.toFixed(2)}
            </Typography>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>
              No hay precio vigente configurado para este dispositivo en canal {canal}
            </Alert>
          )}
        </Paper>

        {/* Selector de grado */}
        {precioVigente && (
          <>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Selecciona el grado estético
              </Typography>
              <ToggleButtonGroup
                value={gradoSeleccionado}
                exclusive
                onChange={(_, value) => setGradoSeleccionado(value)}
                orientation="vertical"
                fullWidth
                sx={{ gap: 1 }}
              >
                {GRADOS_CONFIG.map((grado) => (
                  <ToggleButton
                    key={grado.value}
                    value={grado.value}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      p: 2,
                      border: `2px solid ${grado.color}`,
                      '&.Mui-selected': {
                        bgcolor: `${grado.color}15`,
                        borderColor: grado.color,
                        borderWidth: 2,
                      },
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight="bold">
                        {grado.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {grado.descripcion}
                      </Typography>
                    </Box>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {/* Preview precio calculado */}
            {precioCalculado !== null && typeof precioCalculado === 'number' && (
              <Paper sx={{ p: 2, bgcolor: 'success.lighter' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Precio de oferta calculado
                </Typography>
                <Typography variant="h4" color="success.dark" fontWeight="bold">
                  €{precioCalculado.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Grado {gradoSeleccionado} • Canal {canal}
                </Typography>
              </Paper>
            )}

            {/* Observaciones */}
            <TextField
              label="Observaciones (opcional)"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="Añade cualquier observación relevante sobre el estado del dispositivo..."
              helperText="Estas notas se guardarán con la valoración"
            />

            {/* Botones de acción */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={onCancelar} disabled={guardando}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={handleGuardar}
                disabled={!puedeGuardar || guardando}
                startIcon={guardando ? <CircularProgress size={16} /> : null}
              >
                {guardando ? 'Guardando...' : 'Guardar valoración'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  )
}
