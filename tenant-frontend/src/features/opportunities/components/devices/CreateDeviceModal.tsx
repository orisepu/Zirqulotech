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
  CircularProgress,
  Autocomplete
} from '@mui/material'
import { AddCircle, Warning, CheckCircle, Search } from '@mui/icons-material'
import { useState, useEffect, useMemo } from 'react'
import api from '@/services/api'

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
  // Resultado del mapeo v4 con información enriquecida
  mappingResult?: {
    needs_capacity_creation?: boolean
    suggested_capacity?: {
      device_type?: string
      storage_gb?: number
      existing_capacities?: number[]
      likewize_capacities?: number[]  // Capacidades que existen en Likewize
      missing_capacities?: number[]
      model_ids?: number[]
      model_found?: boolean
      modelo_descripcion?: string
    }
  }
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
  mappingResult,
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

  // Estado para buscador de modelos
  type ModelSearchResult = {
    id: number
    descripcion: string
    tipo: string
    procesador: string
  }

  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [modelSearchResults, setModelSearchResults] = useState<ModelSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedModelFromSearch, setSelectedModelFromSearch] = useState<ModelSearchResult | null>(null)

  // Función para limpiar y enriquecer el nombre del modelo
  const cleanModelName = (rawName: string, additionalInfo?: { cpu?: string, a_number?: string, year?: number }): string => {
    if (!rawName) return ''

    let cleaned = rawName

    // 1. Extraer tamaño de pantalla ANTES de normalizar (ej: "16 inch", "13 inch")
    const screenSizeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*inch/i)
    const screenSize = screenSizeMatch ? `${screenSizeMatch[1]}"` : ''

    // 2. Extraer información de cores antes de procesar (sin guiones)
    const coresMatch = cleaned.match(/(\d+)\s*Core\s+CPU\s+(\d+)\s*Core\s+GPU/i)
    const cores = coresMatch ? `${coresMatch[1]} Core CPU ${coresMatch[2]} Core GPU` : ''

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
    cleaned = cleaned.replace(/iMac(?:Pro)?\d+\s*\d+/gi, 'iMac')
    cleaned = cleaned.replace(/MacBook\s*Pro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBookPro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBook\s*Air\d+\s*\d+/gi, 'MacBook Air')
    cleaned = cleaned.replace(/MacBookAir\d+\s*\d+/gi, 'MacBook Air')
    cleaned = cleaned.replace(/Macmini\d+\s*\d+/gi, 'Mac mini')
    cleaned = cleaned.replace(/Mac\s*mini\d+\s*\d+/gi, 'Mac mini')
    cleaned = cleaned.replace(/MacStudio\d+\s*\d+/gi, 'Mac Studio')
    cleaned = cleaned.replace(/MacPro\d+\s*\d+/gi, 'Mac Pro')
    cleaned = cleaned.replace(/iPhone\d+,\d+/gi, (match) => {
      const num = match.match(/\d+/)
      return num ? `iPhone ${num[0]}` : 'iPhone'
    })

    // 10. Limpiar espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // 11. Construir nombre completo con formato: [base] [(año)] [A-number] [cpu] [cores] [screen]
    const parts = [cleaned]

    // Orden correcto: Mac mini (2023) A2816 M2 Pro 12 Core CPU 19 Core GPU
    if (additionalInfo?.year) parts.push(`(${additionalInfo.year})`)
    if (additionalInfo?.a_number) parts.push(additionalInfo.a_number)
    if (additionalInfo?.cpu) parts.push(additionalInfo.cpu)
    if (cores) parts.push(cores)
    if (screenSize) parts.push(screenSize)

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

  // Función para buscar modelos en la BD
  const searchModels = async (query: string) => {
    if (query.length < 2) {
      setModelSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await api.get('/api/admin/modelos/search/', {
        params: {
          q: query,
          tipo: formData.tipo || undefined,
          marca: formData.marca || undefined,
          limit: 10
        }
      })
      setModelSearchResults(response.data || [])
    } catch (error) {
      console.error('Error buscando modelos:', error)
      setModelSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounce para búsqueda de modelos
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modelSearchQuery) {
        searchModels(modelSearchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [modelSearchQuery, formData.tipo, formData.marca])

  // Función para obtener capacidades de un modelo seleccionado manualmente
  const fetchModelCapacities = async (modeloId: number) => {
    try {
      const response = await api.get(`/api/capacidades-por-modelo/?modelo_id=${modeloId}`)
      return response.data || []
    } catch (error) {
      console.error('Error obteniendo capacidades del modelo:', error)
      return []
    }
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

  // Detectar capacidades usando información enriquecida del backend (prioridad 1) o Likewize (prioridad 2)
  const capacitiesInfo = useMemo(() => {
    // PRIORIDAD 1: Usar información enriquecida del backend SOLO si el modelo fue encontrado
    if (mappingResult?.needs_capacity_creation &&
        mappingResult?.suggested_capacity &&
        mappingResult?.suggested_capacity.model_found) {
      const suggested = mappingResult.suggested_capacity

      return {
        source: 'backend' as const,
        existing: suggested.existing_capacities || [],
        missing: suggested.missing_capacities || [],
        likewize: suggested.likewize_capacities || [],  // Capacidades que existen en Likewize
        all: [
          ...(suggested.existing_capacities || []),
          ...(suggested.missing_capacities || [])
        ].sort((a, b) => a - b),
        modelFound: suggested.model_found || false,
        modelDescription: suggested.modelo_descripcion
      }
    }

    // PRIORIDAD 2 (FALLBACK): Detectar desde Likewize
    if (!item || !formData.modelo) {
      return {
        source: 'likewize' as const,
        existing: [],
        missing: [],
        likewize: [],
        all: [],
        modelFound: false
      }
    }

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

    const allCapacities = Array.from(capacitiesFromLikewize).sort((a, b) => a - b)

    return {
      source: 'likewize' as const,
      existing: [],
      missing: allCapacities, // Asumimos que todas son para crear cuando no hay info del backend
      likewize: allCapacities,
      all: allCapacities,
      modelFound: false
    }
  }, [formData.modelo, formData.tipo, item, allLikewizeItems, mappingResult])

  // Compatibilidad: availableCapacities como alias de capacitiesInfo.all
  const availableCapacities = capacitiesInfo.all

  // Actualizar capacidades seleccionadas cuando cambian las disponibles
  useEffect(() => {
    if (capacitiesInfo.source === 'backend' && capacitiesInfo.missing.length > 0) {
      // Con info del backend: auto-seleccionar solo las FALTANTES
      setSelectedCapacities(new Set(capacitiesInfo.missing))
    } else if (capacitiesInfo.source === 'likewize' && availableCapacities.length > 0) {
      // Sin info del backend: auto-seleccionar todas las encontradas en Likewize
      setSelectedCapacities(new Set(availableCapacities))
    }
  }, [capacitiesInfo, availableCapacities])

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

          {/* Selector de capacidades con información enriquecida */}
          <FormControl component="fieldset">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <FormLabel component="legend">
                {capacitiesInfo.source === 'backend' ? 'Análisis de Capacidades:' : 'Capacidades Detectadas en Likewize:'}
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

            {/* Alert informativo según la fuente */}
            {capacitiesInfo.source === 'backend' && capacitiesInfo.modelFound ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Modelo encontrado en BD:</strong> {capacitiesInfo.modelDescription || 'Sin descripción'}
                  </Typography>
                  <Typography variant="caption" component="div">
                    • <strong>En Likewize:</strong> {capacitiesInfo.likewize?.length || 0} capacidad{(capacitiesInfo.likewize?.length || 0) !== 1 ? 'es' : ''} detectada{(capacitiesInfo.likewize?.length || 0) !== 1 ? 's' : ''}
                    ({capacitiesInfo.likewize?.map(formatCapacity).join(', ') || 'ninguna'})<br />
                    • <strong>En BD:</strong> {capacitiesInfo.existing.length} ya existe{capacitiesInfo.existing.length === 1 ? '' : 'n'}
                    ({capacitiesInfo.existing.map(formatCapacity).join(', ') || 'ninguna'})<br />
                    • <strong>Faltantes:</strong> {capacitiesInfo.missing.length} por crear
                    ({capacitiesInfo.missing.map(formatCapacity).join(', ') || 'ninguna'})
                  </Typography>
                </Alert>

                {/* Buscador de modelos - permitir cambiar el modelo detectado automáticamente */}
                <Box sx={{ mb: 2 }}>
                  <Autocomplete<ModelSearchResult, false, false, true>
                    freeSolo
                    options={modelSearchResults}
                    getOptionLabel={(option: ModelSearchResult | string) =>
                      typeof option === 'string' ? option : `${option.descripcion} (${option.procesador || option.tipo})`
                    }
                    loading={isSearching}
                    value={selectedModelFromSearch}
                    onChange={async (event, newValue) => {
                      if (newValue && typeof newValue !== 'string') {
                        setSelectedModelFromSearch(newValue)

                        // Obtener capacidades del modelo seleccionado
                        const capacidades = await fetchModelCapacities(newValue.id)

                        // Convertir capacidades a GB
                        const capacidadesGB = capacidades.map((cap: any) => {
                          const tamaño = cap.tamaño || cap.tamano || ''
                          const match = tamaño.match(/(\d+)\s*(TB|GB)/i)
                          if (!match) return null
                          const value = parseInt(match[1])
                          const unit = match[2].toUpperCase()
                          return unit === 'TB' ? value * 1024 : value
                        }).filter((gb: number | null) => gb !== null)

                        // Detectar capacidades faltantes comparando con Likewize
                        const likewizeCapacitiesSet = new Set<number>()
                        const baseModelName = normalizeModelForComparison(newValue.descripcion)

                        allLikewizeItems.forEach(likewizeItem => {
                          const itemRawName = likewizeItem.likewize_info.modelo_raw || likewizeItem.likewize_info.modelo_norm || ''
                          const itemNormalizedName = normalizeModelForComparison(itemRawName)
                          const itemType = likewizeItem.likewize_info.tipo

                          const nameMatch = itemNormalizedName.includes(baseModelName) || baseModelName.includes(itemNormalizedName)
                          const typeMatch = !formData.tipo || itemType === formData.tipo || itemType.includes(formData.tipo)

                          if (nameMatch && typeMatch && likewizeItem.likewize_info.almacenamiento_gb) {
                            likewizeCapacitiesSet.add(likewizeItem.likewize_info.almacenamiento_gb)
                          }
                        })

                        const likewizeCapacities = Array.from(likewizeCapacitiesSet)
                        const missing = likewizeCapacities.filter(cap => !capacidadesGB.includes(cap))

                        // Auto-seleccionar capacidades faltantes
                        setSelectedCapacities(new Set(missing.length > 0 ? missing : likewizeCapacities))
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setModelSearchQuery(newInputValue)
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="¿Modelo incorrecto? Busca el correcto"
                        placeholder="Buscar modelo en BD..."
                        helperText="Si el modelo detectado es incorrecto, búscalo aquí"
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: <Search color="action" sx={{ mr: 1 }} />,
                          endAdornment: (
                            <>
                              {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <Box>
                          <Typography variant="body2">{option.descripcion}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.procesador && `${option.procesador} • `}{option.tipo}
                          </Typography>
                        </Box>
                      </li>
                    )}
                  />
                </Box>
              </>
            ) : availableCapacities.length > 0 ? (
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

            {/* Capacidades existentes (solo con info del backend) */}
            {capacitiesInfo.source === 'backend' && capacitiesInfo.existing.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Capacidades que YA EXISTEN en BD:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {capacitiesInfo.existing.map((capacity) => (
                    <Chip
                      key={`existing-${capacity}`}
                      label={formatCapacity(capacity)}
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<CheckCircle fontSize="small" />}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Capacidades faltantes (seleccionables) */}
            {capacitiesInfo.source === 'backend' && capacitiesInfo.missing.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Capacidades FALTANTES (selecciona cuáles crear):
                </Typography>
                <FormGroup row>
                  {capacitiesInfo.missing.map((capacity) => (
                    <FormControlLabel
                      key={`missing-${capacity}`}
                      control={
                        <Checkbox
                          checked={selectedCapacities.has(capacity)}
                          onChange={() => handleCapacityToggle(capacity)}
                          disabled={capacity === currentCapacity}
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
              </Box>
            )}

            {/* Capacidades detectadas (cuando no hay info del backend) */}
            {capacitiesInfo.source === 'likewize' && availableCapacities.length > 0 && (
              <FormGroup row>
                {availableCapacities.map((capacity) => (
                  <FormControlLabel
                    key={`likewize-${capacity}`}
                    control={
                      <Checkbox
                        checked={selectedCapacities.has(capacity)}
                        onChange={() => handleCapacityToggle(capacity)}
                        disabled={capacity === currentCapacity}
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
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {selectedCapacities.size} capacidad{selectedCapacities.size !== 1 ? 'es' : ''} seleccionada{selectedCapacities.size !== 1 ? 's' : ''} para crear
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
