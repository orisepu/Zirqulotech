'use client'

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Box,
  Chip,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  Divider,
  Paper,
  MenuItem,
  CircularProgress
} from '@mui/material'
import { AddCircle, Warning } from '@mui/icons-material'
import { useState, useEffect, useMemo } from 'react'

// Tipos de dispositivo comunes
const DEVICE_TYPES = [
  { value: 'iPhone', label: 'iPhone' },
  { value: 'iPad', label: 'iPad' },
  { value: 'iPad Pro', label: 'iPad Pro' },
  { value: 'iPad Air', label: 'iPad Air' },
  { value: 'iPad mini', label: 'iPad mini' },
  { value: 'MacBook Pro', label: 'MacBook Pro' },
  { value: 'MacBook Air', label: 'MacBook Air' },
  { value: 'MacBook', label: 'MacBook' },
  { value: 'iMac', label: 'iMac' },
  { value: 'Mac mini', label: 'Mac mini' },
  { value: 'Mac Pro', label: 'Mac Pro' },
  { value: 'Mac Studio', label: 'Mac Studio' },
  { value: 'Mac', label: 'Mac (Genérico)' },
]

interface CreateDeviceModalProps {
  open: boolean
  onClose: () => void
  item: {
    id: string | number
    staging_item_id?: string | number
    likewize_info: {
      modelo_raw: string
      modelo_norm: string
      tipo: string
      marca: string
      almacenamiento_gb: number | null
      precio_b2b: number
      likewize_model_code?: string
      a_number?: string
      any?: number
      cpu?: string
    }
  } | null
  // Items de Likewize para detectar capacidades reales
  allLikewizeItems?: Array<{
    likewize_info: {
      modelo_raw?: string
      modelo_norm: string
      almacenamiento_gb: number | null
      tipo: string
    }
  }>
  onCreate: (deviceData: {
    staging_id: string | number
    tipo: string
    marca: string
    modelo: string
    almacenamiento_gb: number
    likewize_model_code?: string
    capacidades_a_crear?: number[] // Lista de capacidades desde Likewize
  }) => void
  isLoading?: boolean
}

export function CreateDeviceModal({
  open,
  onClose,
  item,
  allLikewizeItems = [],
  onCreate,
  isLoading = false
}: CreateDeviceModalProps) {
  const [formData, setFormData] = useState({
    tipo: '',
    marca: '',
    modelo: '',
    almacenamiento_gb: '',
    likewize_model_code: ''
  })

  const [selectedCapacities, setSelectedCapacities] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Función para limpiar y enriquecer el nombre del modelo
  const cleanModelName = (rawName: string, additionalInfo?: { cpu?: string, a_number?: string, year?: number }): string => {
    if (!rawName) return ''

    let cleaned = rawName

    // 1. Extraer tamaño de pantalla ANTES de normalizar (ej: "16 inch", "13 inch")
    const screenSizeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*inch/i)
    const screenSize = screenSizeMatch ? `${screenSizeMatch[1]}"` : ''

    // 2. Extraer información de cores antes de procesar
    const coresMatch = cleaned.match(/(\d+)\s*Core\s+CPU\s+(\d+)\s*Core\s+GPU/i)
    const cores = coresMatch ? `${coresMatch[1]}-Core CPU ${coresMatch[2]}-Core GPU` :
                  cleaned.match(/(\d+)\s*Core\s+(CPU|GPU)/gi)?.map(c => c.replace(/(\d+)\s*Core\s+(CPU|GPU)/i, '$1-Core $2')).join(' ') || ''

    // 3. Remover M-chips del texto (M1, M2, M3, M4 Pro, M4 Max, etc.) - los añadiremos desde additionalInfo.cpu
    cleaned = cleaned.replace(/\s*M\d+\s*(Pro|Max|Ultra)?/gi, '')

    // 4. Remover A-Numbers del texto (A3403, A2337, etc.) - los añadiremos desde additionalInfo.a_number
    cleaned = cleaned.replace(/\s*A\d{4}/gi, '')

    // 5. Remover capacidad de almacenamiento (GB/TB/SSD/HDD)
    cleaned = cleaned.replace(/\s*\d+\s*(GB|TB)\s*(SSD|HDD)?/gi, '')

    // 6. Remover tamaño de pantalla del texto (ya lo extraímos)
    cleaned = cleaned.replace(/\s*\d+(?:\.\d+)?\s*inch/gi, '')

    // 7. Remover información de cores del texto (ya la extraímos)
    cleaned = cleaned.replace(/\s*\d+\s*Core\s+(CPU|GPU)/gi, '')

    // 8. Remover fechas (las manejaremos con el campo year)
    cleaned = cleaned.replace(/\b\d{1,2}\/\d{4}\b/g, '')

    // 9. Normalizar nombres base de modelos (eliminando códigos internos)
    cleaned = cleaned.replace(/iMac\d+\s*\d+/gi, 'iMac')
    cleaned = cleaned.replace(/MacBook\s*Pro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBookPro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBook\s*Air\d+\s*\d+/gi, 'MacBook Air')
    cleaned = cleaned.replace(/MacBookAir\d+\s*\d+/gi, 'MacBook Air')
    cleaned = cleaned.replace(/iPhone\d+,\d+/gi, (match) => {
      const num = match.match(/\d+/)
      return num ? `iPhone ${num[0]}` : 'iPhone'
    })

    // 10. Limpiar espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // 11. Construir nombre completo con toda la información disponible
    const parts = [cleaned]

    if (screenSize) parts.push(screenSize)
    if (additionalInfo?.cpu) parts.push(additionalInfo.cpu)
    if (cores) parts.push(cores)
    if (additionalInfo?.a_number) parts.push(additionalInfo.a_number)
    if (additionalInfo?.year) parts.push(`(${additionalInfo.year})`)

    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }

  // Extraer tipo genérico del nombre del modelo (debe coincidir con DEVICE_TYPES)
  const extractDeviceType = (modelName: string): string => {
    const lower = modelName.toLowerCase().replace(/\s+/g, ' ') // Normalizar espacios

    // iPhone - devolver solo "iPhone" genérico
    if (lower.includes('iphone')) {
      return 'iPhone'
    }

    // iPad (chequear variantes específicas primero)
    if (lower.includes('ipad pro') || lower.includes('ipadpro')) return 'iPad Pro'
    if (lower.includes('ipad air') || lower.includes('ipadair')) return 'iPad Air'
    if (lower.includes('ipad mini') || lower.includes('ipadmini')) return 'iPad mini'
    if (lower.includes('ipad')) return 'iPad'

    // MacBook (chequear variantes específicas primero)
    if (lower.includes('macbook pro') || lower.includes('macbookpro')) return 'MacBook Pro'
    if (lower.includes('macbook air') || lower.includes('macbookair')) return 'MacBook Air'
    if (lower.includes('macbook')) return 'MacBook'

    // Mac desktop
    if (lower.includes('imac')) return 'iMac'
    if (lower.includes('mac mini') || lower.includes('macmini')) return 'Mac mini'
    if (lower.includes('mac pro') || lower.includes('macpro')) return 'Mac Pro'
    if (lower.includes('mac studio') || lower.includes('macstudio')) return 'Mac Studio'

    return 'Mac'
  }

  // Auto-rellenar formulario cuando se abre el modal
  useEffect(() => {
    if (open && item) {
      const modelName = item.likewize_info.modelo_raw || item.likewize_info.modelo_norm || ''
      const extractedType = extractDeviceType(modelName)

      // Determinar código Likewize: priorizar A-number si existe, sino usar M_Model del backend
      const likewizeCode = item.likewize_info.a_number ||
                          item.likewize_info.likewize_model_code ||
                          extractDeviceType(modelName)

      setFormData({
        tipo: extractedType || item.likewize_info.tipo || 'Mac',
        marca: item.likewize_info.marca || 'Apple',
        modelo: cleanModelName(modelName, {
          cpu: item.likewize_info.cpu,
          a_number: item.likewize_info.a_number,
          year: item.likewize_info.any
        }),
        almacenamiento_gb: String(item.likewize_info.almacenamiento_gb || ''),
        likewize_model_code: likewizeCode
      })

      // Las capacidades se auto-seleccionarán mediante el useEffect de availableCapacities
      // No hacemos nada aquí, solo inicializamos el form

      setError(null)
    } else {
      // Reset
      setFormData({
        tipo: '',
        marca: '',
        modelo: '',
        almacenamiento_gb: '',
        likewize_model_code: ''
      })
      setSelectedCapacities(new Set())
      setError(null)
    }
  }, [open, item])

  // Normalizar nombre de modelo para comparación (eliminar variantes como Wi-Fi/Cellular/capacidades)
  const normalizeModelForComparison = (modelName: string): string => {
    let normalized = cleanModelName(modelName).toLowerCase()

    // Eliminar variantes de conectividad
    normalized = normalized.replace(/\s+(wi-fi|cellular|wifi|lte|5g)\s*/gi, ' ')

    // Eliminar capacidades (GB, TB)
    normalized = normalized.replace(/\s+\d+\s*(gb|tb)\s*/gi, ' ')

    // Eliminar espacios múltiples
    normalized = normalized.replace(/\s+/g, ' ').trim()

    return normalized
  }

  // Detectar capacidades reales desde Likewize
  const availableCapacities = useMemo(() => {
    if (!item || !formData.modelo) return []

    // Normalizar el nombre del modelo para buscar variantes
    const baseModelName = normalizeModelForComparison(formData.modelo)

    const capacitiesFromLikewize = new Set<number>()

    allLikewizeItems.forEach(likewizeItem => {
      const itemRawName = likewizeItem.likewize_info.modelo_raw || likewizeItem.likewize_info.modelo_norm || ''
      const itemNormalizedName = normalizeModelForComparison(itemRawName)
      const itemType = likewizeItem.likewize_info.tipo

      // Match por nombre base (sin variantes)
      const nameMatch = itemNormalizedName.includes(baseModelName) || baseModelName.includes(itemNormalizedName)
      const typeMatch = !formData.tipo || itemType === formData.tipo || itemType.includes(formData.tipo)

      if (nameMatch && typeMatch && likewizeItem.likewize_info.almacenamiento_gb) {
        capacitiesFromLikewize.add(likewizeItem.likewize_info.almacenamiento_gb)
      }
    })

    // Siempre incluir la capacidad del item actual
    if (item.likewize_info.almacenamiento_gb) {
      capacitiesFromLikewize.add(item.likewize_info.almacenamiento_gb)
    }

    return Array.from(capacitiesFromLikewize).sort((a, b) => a - b)
  }, [formData.modelo, formData.tipo, item, allLikewizeItems])

  // Actualizar capacidades seleccionadas cuando cambian las disponibles
  useEffect(() => {
    if (availableCapacities.length > 0) {
      // Auto-seleccionar todas las capacidades encontradas
      setSelectedCapacities(new Set(availableCapacities))
    }
  }, [availableCapacities])

  const handleCapacityToggle = (capacity: number) => {
    const newSelection = new Set(selectedCapacities)
    if (newSelection.has(capacity)) {
      newSelection.delete(capacity)
    } else {
      newSelection.add(capacity)
    }
    setSelectedCapacities(newSelection)
  }

  const handleSelectAllCapacities = () => {
    setSelectedCapacities(new Set(availableCapacities))
  }

  const handleDeselectAllCapacities = () => {
    // Mantener solo la capacidad actual del item
    if (item?.likewize_info.almacenamiento_gb) {
      setSelectedCapacities(new Set([item.likewize_info.almacenamiento_gb]))
    } else {
      setSelectedCapacities(new Set())
    }
  }

  const handleCreate = () => {
    // Validaciones
    if (!formData.modelo.trim()) {
      setError('El nombre del modelo es requerido')
      return
    }

    if (!formData.tipo.trim()) {
      setError('El tipo de dispositivo es requerido')
      return
    }

    const almacenamiento = parseInt(formData.almacenamiento_gb)
    if (!almacenamiento || almacenamiento <= 0) {
      setError('La capacidad de almacenamiento es requerida y debe ser mayor a 0')
      return
    }

    if (selectedCapacities.size === 0) {
      setError('Debes seleccionar al menos una capacidad estándar para crear')
      return
    }

    // Asegurarse de que la capacidad del item esté incluida
    if (!selectedCapacities.has(almacenamiento)) {
      setError(`La capacidad ${almacenamiento}GB del dispositivo debe estar incluida en las capacidades a crear`)
      return
    }

    setError(null)

    onCreate({
      staging_id: item!.id,
      tipo: formData.tipo.trim(),
      marca: formData.marca.trim(),
      modelo: formData.modelo.trim(),
      almacenamiento_gb: almacenamiento,
      likewize_model_code: formData.likewize_model_code.trim(),
      capacidades_a_crear: Array.from(selectedCapacities).sort((a, b) => a - b)
    })
  }

  const formatCapacity = (gb: number): string => {
    if (gb >= 1024) {
      return `${gb / 1024} TB`
    }
    return `${gb} GB`
  }

  if (!item) return null

  const currentCapacity = item.likewize_info.almacenamiento_gb

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '75vh', maxHeight: '90vh' } }}
    >
      <DialogTitle>
        Crear Nuevo Dispositivo
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Información del item de Likewize */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Datos extraídos de Likewize:
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="caption">
                <strong>Nombre Original:</strong> {item.likewize_info.modelo_raw}
              </Typography>
              <Typography variant="caption">
                <strong>Tipo:</strong> {item.likewize_info.tipo} • <strong>Marca:</strong> {item.likewize_info.marca}
              </Typography>
              {item.likewize_info.a_number && (
                <Typography variant="caption">
                  <strong>A-Number:</strong> {item.likewize_info.a_number}
                </Typography>
              )}
              {item.likewize_info.any && (
                <Typography variant="caption">
                  <strong>Año:</strong> {item.likewize_info.any}
                </Typography>
              )}
              {item.likewize_info.cpu && (
                <Typography variant="caption">
                  <strong>CPU:</strong> {item.likewize_info.cpu}
                </Typography>
              )}
            </Stack>
          </Paper>

          <Divider />

          {/* Formulario de creación */}
          <Typography variant="subtitle2">
            Datos del Nuevo Modelo:
          </Typography>

          <TextField
            fullWidth
            required
            label="Nombre del Modelo"
            value={formData.modelo}
            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
            placeholder="Ej: iPhone 14 Pro, MacBook Air M2, iMac 24 pulgadas"
            helperText="Nombre normalizado del modelo (sin capacidad de almacenamiento)"
          />

          <Stack direction="row" spacing={2}>
            <TextField
              select
              fullWidth
              required
              label="Tipo"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              helperText="Selecciona el tipo de dispositivo"
            >
              {DEVICE_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              required
              label="Marca"
              value={formData.marca}
              onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth
              required
              label="Almacenamiento (GB)"
              type="number"
              value={formData.almacenamiento_gb}
              onChange={(e) => setFormData({ ...formData, almacenamiento_gb: e.target.value })}
              helperText="Capacidad de este dispositivo específico"
            />

            <TextField
              fullWidth
              label="Código Likewize (Opcional)"
              value={formData.likewize_model_code}
              onChange={(e) => setFormData({ ...formData, likewize_model_code: e.target.value.toUpperCase() })}
              helperText="Código M del modelo"
            />
          </Stack>

          <Divider />

          {/* Selector de capacidades desde Likewize */}
          <FormControl component="fieldset">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <FormLabel component="legend">
                Capacidades Detectadas en Likewize:
              </FormLabel>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={handleSelectAllCapacities}>
                  Todas
                </Button>
                <Button size="small" onClick={handleDeselectAllCapacities}>
                  Solo Actual
                </Button>
              </Stack>
            </Stack>

            {availableCapacities.length > 0 ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Se encontraron <strong>{availableCapacities.length} capacidades</strong> en los datos de Likewize para este modelo.
                  Se crearán todas las capacidades seleccionadas, permitiendo mapear automáticamente otros items con el mismo modelo.
                </Typography>
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  No se encontraron capacidades automáticamente. Introduce el modelo para detectar capacidades de items similares en Likewize.
                </Typography>
              </Alert>
            )}

            <FormGroup row>
              {availableCapacities.map((capacity) => (
                <FormControlLabel
                  key={capacity}
                  control={
                    <Checkbox
                      checked={selectedCapacities.has(capacity)}
                      onChange={() => handleCapacityToggle(capacity)}
                      disabled={capacity === currentCapacity} // La capacidad actual siempre debe estar
                    />
                  }
                  label={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>{formatCapacity(capacity)}</span>
                      {capacity === currentCapacity && (
                        <Chip label="Actual" size="small" color="primary" />
                      )}
                    </Stack>
                  }
                />
              ))}
            </FormGroup>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {selectedCapacities.size} capacidad{selectedCapacities.size !== 1 ? 'es' : ''} seleccionada{selectedCapacities.size !== 1 ? 's' : ''}
            </Typography>
          </FormControl>

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Preview */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Preview del modelo a crear:
            </Typography>
            <Typography variant="body2">
              {formData.modelo || '(Nombre del modelo)'} - {formData.marca || '(Marca)'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tipo: {formData.tipo || '(Tipo)'} • Capacidades: {Array.from(selectedCapacities).sort((a, b) => a - b).map(formatCapacity).join(', ')}
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <AddCircle />}
        >
          {isLoading ? 'Creando...' : 'Crear Modelo y Capacidades'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
