'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Grid, Paper, Button, Typography, LinearProgress, CircularProgress, Stack, Link as MuiLink,
  Alert, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
  Card, CardContent, CardHeader, Box, FormControl, InputLabel, Select, MenuItem,
  Switch, FormControlLabel, Collapse, IconButton, Tooltip, Divider
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import {
  FilterList as FilterListIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material'

type EstadoTarea = {
  id: string
  estado: 'PENDING'|'RUNNING'|'SUCCESS'|'ERROR'
  log_url?: string
  error_message?: string
}

type Cambio = {
  id: string
  kind: 'INSERT'|'UPDATE'|'DELETE'
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number
  capacidad_id?: number | null
  marca?: string
  antes: string | null
  despues: string | null
  delta: number | null
  nombre_likewize_original?: string
  nombre_normalizado?: string
  confianza_mapeo?: 'alta' | 'media' | 'baja'
  necesita_revision?: boolean
}
type NoMap = {
  id: number
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number | null
  precio_b2b: number
  marca?: string
  likewize_model_code?: string | null
}
type EstadoTareaExt = EstadoTarea & { progreso?: number; subestado?: string }

type ModeloMini = {
  id: number
  descripcion: string
  tipo?: string | null
  marca?: string | null
  pantalla?: string | null
  'año'?: number | null
  procesador?: string | null
  likewize_modelo?: string | null
}

const sanitizeNombre = (valor?: string | null) => (valor ?? '').trim()

// Extract year from text using various patterns
const extractYear = (text: string): number | null => {
  const patterns = [
    /\b(20\d{2})\b/g,           // 2021, 2024, etc.
    /\b(\d{2})\/(\d{4})\b/g,    // 10/2024
    /\b(\d{1,2})\/(\d{2})\b/g   // 10/24
  ]

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern))
    for (const match of matches) {
      if (match[1] && match[1].length === 4) {
        const year = parseInt(match[1])
        if (year >= 2000 && year <= 2030) return year
      }
      if (match[2] && match[2].length === 4) {
        const year = parseInt(match[2])
        if (year >= 2000 && year <= 2030) return year
      }
      if (match[2] && match[2].length === 2) {
        const year = 2000 + parseInt(match[2])
        if (year >= 2000 && year <= 2030) return year
      }
    }
  }
  return null
}

// Extract processor info (M1, M2, M3, M4, Intel, etc.)
const extractProcessor = (text: string): string | null => {
  const processorPatterns = [
    /\b(M[1-4](?:\s+(?:Max|Pro|Ultra))?)\b/i,  // M1, M2, M3, M4 + variants
    /\b(Intel\s+Core\s+i[3-9])\b/i,           // Intel Core i5, i7, etc.
    /\b(Apple\s+Silicon)\b/i,                 // Apple Silicon
    /\b(Intel)\b/i                            // Generic Intel
  ]

  for (const pattern of processorPatterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

// Extract screen size (14 inch, 16 inch, etc.)
const extractScreenSize = (text: string): string | null => {
  const sizePatterns = [
    /\b(\d{1,2}(?:\.\d+)?)\s*(?:inch|pulgadas?|")\b/i,
    /\b(\d{1,2}(?:\.\d+)?)''\b/i
  ]

  for (const pattern of sizePatterns) {
    const match = text.match(pattern)
    if (match) return match[1] + '"'
  }
  return null
}

// Get detailed mapping analysis
const getMappingAnalysis = (cambio: Cambio) => {
  const original = cambio.nombre_likewize_original || ''
  const normalized = cambio.nombre_normalizado || cambio.modelo_norm

  const originalYear = extractYear(original)
  const normalizedYear = extractYear(normalized)
  const originalProcessor = extractProcessor(original)
  const normalizedProcessor = extractProcessor(normalized)
  const originalSize = extractScreenSize(original)
  const normalizedSize = extractScreenSize(normalized)

  const issues = []
  const warnings = []

  if (originalYear && normalizedYear && originalYear !== normalizedYear) {
    const diff = Math.abs(originalYear - normalizedYear)
    if (diff >= 2) {
      issues.push(`Diferencia de año significativa: ${normalizedYear} vs ${originalYear}`)
    } else {
      warnings.push(`Posible diferencia de año: ${normalizedYear} vs ${originalYear}`)
    }
  }

  if (originalProcessor && normalizedProcessor &&
      originalProcessor.toLowerCase() !== normalizedProcessor.toLowerCase()) {
    issues.push(`Procesador diferente: ${normalizedProcessor} vs ${originalProcessor}`)
  }

  if (originalSize && normalizedSize && originalSize !== normalizedSize) {
    warnings.push(`Tamaño de pantalla diferente: ${normalizedSize} vs ${originalSize}`)
  }

  return { issues, warnings, originalYear, normalizedYear, originalProcessor, normalizedProcessor }
}

// Enhanced mapping confidence with intelligent detection
const getMappingConfidence = (cambio: Cambio): 'alta' | 'media' | 'baja' => {
  if (cambio.confianza_mapeo) return cambio.confianza_mapeo

  const original = cambio.nombre_likewize_original || ''
  const normalized = cambio.nombre_normalizado || cambio.modelo_norm

  if (!original) return 'media'

  // Basic similarity check
  if (original.toLowerCase() === normalized.toLowerCase()) return 'alta'

  // Extract key attributes
  const originalYear = extractYear(original)
  const normalizedYear = extractYear(normalized)
  const originalProcessor = extractProcessor(original)
  const normalizedProcessor = extractProcessor(normalized)
  const originalSize = extractScreenSize(original)
  const normalizedSize = extractScreenSize(normalized)

  let confidence: 'alta' | 'media' | 'baja' = 'media'
  let issues = 0

  // Year mismatch is a major red flag
  if (originalYear && normalizedYear && Math.abs(originalYear - normalizedYear) > 0) {
    issues += 2 // Major issue
  }

  // Processor mismatch is also important
  if (originalProcessor && normalizedProcessor &&
      originalProcessor.toLowerCase() !== normalizedProcessor.toLowerCase()) {
    issues += 2 // Major issue
  }

  // Screen size mismatch
  if (originalSize && normalizedSize && originalSize !== normalizedSize) {
    issues += 1 // Minor issue
  }

  // Basic text similarity
  const textSimilarity =
    original.toLowerCase().includes(normalized.toLowerCase()) ||
    normalized.toLowerCase().includes(original.toLowerCase())

  if (!textSimilarity) {
    issues += 1
  }

  // Determine confidence based on issues
  if (issues >= 3) confidence = 'baja'
  else if (issues >= 1) confidence = 'media'
  else confidence = 'alta'

  return confidence
}

const NameMappingCell = ({ cambio, marca, getMappingAnalysis }: {
  cambio: Cambio;
  marca?: string;
  getMappingAnalysis: (cambio: Cambio) => { issues: string[]; warnings: string[]; originalYear: number | null; normalizedYear: number | null; originalProcessor: string | null; normalizedProcessor: string | null; }
}) => {
  const nombreSistema = sanitizeNombre(cambio.nombre_normalizado) || sanitizeNombre(cambio.modelo_norm)
  const nombreLikewize = sanitizeNombre(cambio.nombre_likewize_original) || nombreSistema
  const sonIguales = nombreSistema.localeCompare(nombreLikewize, undefined, { sensitivity: 'accent', usage: 'search' }) === 0

  const analysis = getMappingAnalysis(cambio)
  const hasIssues = analysis.issues.length > 0
  const hasWarnings = analysis.warnings.length > 0

  const arrowColor = sonIguales ? 'text.disabled' :
                    hasIssues ? 'error.main' :
                    hasWarnings ? 'warning.main' : 'info.main'

  // Backend provides all necessary mapping information

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
        {marca && <Chip size="small" variant="outlined" label={marca} />}
        {hasIssues && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            icon={<WarningIcon fontSize="small" />}
            label="Requiere revisión"
          />
        )}
        {hasWarnings && !hasIssues && (
          <Chip
            size="small"
            color="info"
            variant="outlined"
            icon={<InfoIcon fontSize="small" />}
            label="Diferencias menores"
          />
        )}
      </Stack>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ flexWrap: 'wrap' }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Sistema
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {nombreSistema || '—'}
          </Typography>
          {analysis.normalizedYear && (
            <Typography variant="caption" color="text.secondary">
              {analysis.normalizedYear}
            </Typography>
          )}
          {analysis.normalizedProcessor && (
            <Typography variant="caption" color="primary.main" sx={{ display: 'block' }}>
              {analysis.normalizedProcessor}
            </Typography>
          )}
        </Box>
        <Tooltip
          title={
            sonIguales ? 'El nombre coincide con el registrado en Likewize' :
            hasIssues ? 'Problemas detectados en el mapeo - requiere revisión' :
            hasWarnings ? 'Advertencias en el mapeo - revisa las diferencias' :
            'Nombre distinto al registrado en Likewize'
          }
        >
          <ArrowForwardIcon sx={{ color: arrowColor }} fontSize="small" />
        </Tooltip>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Likewize
          </Typography>
          <Typography
            variant="body2"
            fontWeight={sonIguales ? 500 : 600}
            color={sonIguales ? 'text.primary' : hasIssues ? 'error.main' : 'warning.main'}
            sx={{ wordBreak: 'break-word' }}
          >
            {nombreLikewize || '—'}
          </Typography>
          {analysis.originalYear && (
            <Typography variant="caption" color="text.secondary">
              {analysis.originalYear}
            </Typography>
          )}
          {analysis.originalProcessor && (
            <Typography variant="caption" color="primary.main" sx={{ display: 'block' }}>
              {analysis.originalProcessor}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Show specific issues */}
      {analysis.issues.length > 0 && (
        <Stack spacing={0.5}>
          {analysis.issues.map((issue, index) => (
            <Typography key={index} variant="caption" color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon fontSize="inherit" />
              {issue}
            </Typography>
          ))}
        </Stack>
      )}

      {/* Show warnings */}
      {analysis.warnings.length > 0 && (
        <Stack spacing={0.5}>
          {analysis.warnings.map((warning, index) => (
            <Typography key={index} variant="caption" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <InfoIcon fontSize="inherit" />
              {warning}
            </Typography>
          ))}
        </Stack>
      )}

      {!sonIguales && analysis.issues.length === 0 && analysis.warnings.length === 0 && (
        <Typography variant="caption" color="info.main">
          Los nombres difieren: revisa el mapeo si es necesario.
        </Typography>
      )}
    </Stack>
  )
}

const formatStorage = (gb?: number | null): string => {
  if (gb == null || Number.isNaN(gb)) return ''
  if (gb >= 1024 && gb % 1024 === 0) {
    const tb = gb / 1024
    const label = Number.isInteger(tb) ? String(tb) : tb.toString().replace(/\.0$/, '')
    return `${label}TB`
  }
  return `${gb} GB`
}

const parseStorageToGb = (input: string): number | undefined => {
  if (!input) return undefined
  const match = input.trim().match(/(\d+(?:[.,]\d+)?)(?:\s*)(TB|T|GB|G)?/i)
  if (!match) return undefined
  const amount = Number.parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const unit = (match[2] || 'GB').toUpperCase()
  const gb = unit.startsWith('T') ? amount * 1024 : amount
  return Math.round(gb)
}

const fetchMarcasModelo = async () => {
  const { data } = await api.get<string[]>('/api/marcas-modelo/')
  return data
}

const fetchLikewizePresets = async () => {
  const { data } = await api.get<{ apple: string[]; others: string[] }>('/api/precios/likewize/presets/')
  return data
}

function LiveLog({ tareaId, enabled }: { tareaId: string; enabled: boolean }) {
  const log = useQuery({
    queryKey: ['likewize_log', tareaId],
    queryFn: async () => {
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/log/`, { params: { n: 120 } })
      return data as { lines: string[] }
    },
    enabled,
    refetchInterval: enabled ? 1000 : false,
  })

  if (!enabled) return null
  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default', maxHeight: 240, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
      {(log.data?.lines || []).map((ln, i) => (
        <div key={i}>{ln}</div>
      ))}
    </Paper>
  )
}
// Helper function to get appropriate message for missing prices
function getPriceStatusMessage(cambio: Cambio): { message: string; tooltip: string; severity: 'warning' | 'error' | 'info' } {
  if (cambio.kind === 'DELETE' && cambio.antes) {
    const hasLikewizeOriginal = Boolean(cambio.nombre_likewize_original?.trim())
    const hasNormalizedName = Boolean(cambio.nombre_normalizado?.trim())

    if (!hasLikewizeOriginal && !hasNormalizedName) {
      return {
        message: "⚠️ Dispositivo sin identificación",
        tooltip: "Este dispositivo no tiene nombre identificable y no puede ser procesado.",
        severity: 'error'
      }
    }

    if (hasLikewizeOriginal) {
      return {
        message: "⚠️ No encontrado en Likewize",
        tooltip: `Este dispositivo (${cambio.nombre_likewize_original}) está en su BD local con precio €${cambio.antes}, pero no aparece en la actualización de Likewize. Puede estar descontinuado o tener un nombre diferente en Likewize.`,
        severity: 'warning'
      }
    }

    return {
      message: "⚠️ Sin mapeo a Likewize",
      tooltip: `Este dispositivo no tiene asociación con un código de Likewize. Necesita mapeo manual para sincronizar precios.`,
      severity: 'info'
    }
  }

  return {
    message: "-",
    tooltip: "Sin información de precio",
    severity: 'info'
  }
}

export default function LikewizeB2BPage() {
  const queryClient = useQueryClient()
  const [tareaId, setTareaId] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [openCrearDialog, setOpenCrearDialog] = useState(false)
  const [noMapTarget, setNoMapTarget] = useState<NoMap | null>(null)
  const [formTipo, setFormTipo] = useState('')
  const [formModelo, setFormModelo] = useState('')
  const [formCapacidad, setFormCapacidad] = useState('')
  const [formMarca, setFormMarca] = useState('Apple')
  const [formLikewizeCode, setFormLikewizeCode] = useState('')
  const [toggleMessage, setToggleMessage] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null)
  const [mappingSystem, setMappingSystem] = useState<'v1' | 'v2'>('v1')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [capStatus, setCapStatus] = useState<Record<number, boolean>>({})
  const [capMarcaLookup, setCapMarcaLookup] = useState<Record<number, string>>({})
  const [selectedOtherBrands, setSelectedOtherBrands] = useState<string[]>([])
  const [pendingMode, setPendingMode] = useState<'apple' | 'others' | null>(null)
  const [mapTarget, setMapTarget] = useState<Cambio | null>(null)
  const [selectedModelo, setSelectedModelo] = useState<ModeloMini | null>(null)
  const [mapNombre, setMapNombre] = useState('')
  const [modeloSearchTerm, setModeloSearchTerm] = useState('')
  const [showCrearModelo, setShowCrearModelo] = useState(false)
  const [nuevoModeloDescripcion, setNuevoModeloDescripcion] = useState('')
  const [nuevoModeloTipo, setNuevoModeloTipo] = useState('')
  const [nuevoModeloMarca, setNuevoModeloMarca] = useState('')
  const [nuevoModeloPantalla, setNuevoModeloPantalla] = useState('')
  const [nuevoModeloAno, setNuevoModeloAno] = useState('')
  const [nuevoModeloProcesador, setNuevoModeloProcesador] = useState('')

  // New filter states
  const [showDeactivated, setShowDeactivated] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')
  const [filterMarca, setFilterMarca] = useState<string>('all')
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'alta' | 'media' | 'baja'>('all')
  const [showOnlyProblematic, setShowOnlyProblematic] = useState(false)
  // Removed showOnlyExactMatches - not needed without exact match cache
  const [showFilters, setShowFilters] = useState(false)

  // Removed exactMatchCache system - backend should provide all necessary information
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => {
    setCapStatus({})
    setCapMarcaLookup({})
  }, [tareaId])

  const {
    mutate: lanzarActualizacionMutate,
    isPending: lanzarActualizacionPending,
  } = useMutation({
    mutationFn: async ({ mode, brands }: { mode: 'apple' | 'others'; brands?: string[] }) => {
      const payload: Record<string, unknown> = {
        mode,
        mapping_system: mappingSystem
      }
      if (brands && brands.length) {
        payload.brands = brands
      }

      // Validación y logging del payload
      console.log('🚀 Enviando actualización a Likewize:', {
        endpoint: '/api/precios/likewize/actualizar/',
        payload,
        mappingSystemSelected: mappingSystem,
        isV2: mappingSystem === 'v2'
      })

      if (mappingSystem === 'v2') {
        console.log('✅ Usando sistema V2 - mapeo inteligente con A-numbers para Mac y enriquecimiento para iPhone/iPad')
      } else {
        console.log('⚙️ Usando sistema V1 - mapeo heurístico básico')
      }

      const { data } = await api.post('/api/precios/likewize/actualizar/', payload)
      console.log('📋 Respuesta de actualización:', data)
      return data as { tarea_id: string }
    },
    onSuccess: (data) => setTareaId(data.tarea_id),
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error && 'response' in error && (error as any).response?.data?.detail)
          ? (error as any).response.data.detail
          : 'No se pudo lanzar la actualización.'
      setToggleMessage({ msg: String(message || 'No se pudo lanzar la actualización.'), sev: 'error' })
    },
  })

  const lanzarTarea = useCallback((mode: 'apple' | 'others', brands: string[]) => {
    const cleaned = Array.from(new Set(brands.map((b) => (b || '').trim()).filter(Boolean)))
    setPendingMode(mode)
    lanzarActualizacionMutate(
      { mode, brands: cleaned },
      {
        onSettled: () => setPendingMode(null),
      }
    )
  }, [lanzarActualizacionMutate])

  const cargarUltima = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/api/precios/likewize/ultima/')
      return data as { tarea_id: string }
    },
    onSuccess: (data) => setTareaId(data.tarea_id),
  })

  // B2C se gestiona en otra vista; eliminado para evitar variable no usada

  const estado = useQuery({
    queryKey: ['likewize_tarea', tareaId],
    queryFn: async () => {
      if (!tareaId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/`)
      return data as EstadoTarea
    },
    enabled: !!tareaId,
    refetchInterval: (q) => {
      const s = (q.state.data as EstadoTarea | null)?.estado
      return s && (s === 'SUCCESS' || s === 'ERROR') ? false : 1500
    },
  })

  const diff = useQuery({
    queryKey: ['likewize_diff', tareaId],
    queryFn: async () => {
      if (!tareaId) return null
      const { data } = await api.get(`/api/precios/likewize/tareas/${tareaId}/diff/`)
      return data as { summary: { inserts:number, updates:number, deletes:number, total:number }, changes: Cambio[], no_mapeados?: NoMap[] }
    },
    enabled: !!tareaId && estado.data?.estado === 'SUCCESS',
  })

  // Exact match query by likewize_modelo
  const exactLikewizeMatch = useQuery<ModeloMini[]>({
    queryKey: ['exact-likewize-match', mapTarget?.nombre_likewize_original],
    queryFn: async () => {
      const likewizeName = sanitizeNombre(mapTarget?.nombre_likewize_original)
      if (!likewizeName) return []

      // Try exact match first
      try {
        console.log('✅ Búsqueda exacta en:', '/api/admin/modelos/search/', {
          params: { q: likewizeName, limit: 10 }
        })
        const { data } = await api.get('/api/admin/modelos/search/', {
          params: {
            q: likewizeName,
            limit: 10
          }
        })
        console.log('📊 Búsqueda exacta resultados:', data)
        return (Array.isArray(data) ? data : data.results || []) as ModeloMini[]
      } catch (error) {
        console.error('❌ Error en búsqueda exacta:', error)
        console.error('❌ Detalles del error:', {
          message: error instanceof Error ? error.message : 'Error desconocido',
          response: (error as any)?.response?.data,
          status: (error as any)?.response?.status,
          config: (error as any)?.config
        })

        // Fallback: search without capacity/specs
        const cleanLikewizeName = likewizeName
          .replace(/\b\d+\s*(GB|TB)\b/gi, '') // Remove capacity
          .replace(/\b\d+\s*(inch|pulgadas?|''|")\b/gi, '') // Remove screen size
          .replace(/\(\d+\/\d+\)/g, '') // Remove date patterns
          .trim()

        if (cleanLikewizeName && cleanLikewizeName !== likewizeName) {
          try {
            console.log('🔄 Búsqueda fallback en:', '/api/admin/modelos/search/', {
              params: { q: cleanLikewizeName, limit: 10 }
            })
            const { data } = await api.get('/api/admin/modelos/search/', {
              params: {
                q: cleanLikewizeName,
                limit: 10
              }
            })
            console.log('📊 Búsqueda fallback resultados:', data)
            return (Array.isArray(data) ? data : data.results || []) as ModeloMini[]
          } catch (fallbackError) {
            console.error('❌ Error en búsqueda fallback:', fallbackError)
            console.error('❌ Detalles del error fallback:', {
              message: fallbackError instanceof Error ? fallbackError.message : 'Error desconocido',
              response: (fallbackError as any)?.response?.data,
              status: (fallbackError as any)?.response?.status
            })
          }
        }
        return []
      }
    },
    enabled: Boolean(mapTarget?.nombre_likewize_original),
    staleTime: 60_000,
  })

  const modelosSearch = useQuery<ModeloMini[]>({
    queryKey: ['admin-modelos-search', modeloSearchTerm, mapTarget?.tipo, mapTarget?.marca],
    queryFn: async () => {
      const params: Record<string, string> = { q: modeloSearchTerm }
      if (mapTarget?.tipo) params.tipo = mapTarget.tipo
      const marcaPreferida = mapTarget?.marca || (mapTarget?.capacidad_id ? capMarcaLookup[mapTarget.capacidad_id] : undefined)
      if (marcaPreferida) params.marca = marcaPreferida

      try {
        console.log('🔍 Buscando modelos con search en:', '/api/admin/modelos/search/', { params })
        const { data } = await api.get('/api/admin/modelos/search/', { params })
        console.log('🔍 Resultados de search:', data)
        return data as ModeloMini[]
      } catch (error) {
        console.error('❌ Error en búsqueda con search:', error)
        console.error('❌ Detalles del error search:', {
          message: error instanceof Error ? error.message : 'Error desconocido',
          response: (error as any)?.response?.data,
          status: (error as any)?.response?.status,
          params
        })
        return []
      }
    },
    enabled: Boolean(mapTarget && modeloSearchTerm.trim().length >= 2),
    staleTime: 30_000,
  })

  // Smart suggestions based on mapping analysis
  const getSmartSuggestions = useMemo(() => {
    if (!mapTarget) return []

    const analysis = getMappingAnalysis(mapTarget)
    const suggestions = []

    // Suggest search terms based on detected attributes
    if (analysis.originalYear && analysis.originalYear !== analysis.normalizedYear) {
      const baseModel = mapTarget.modelo_norm.replace(/\b20\d{2}\b/g, '').trim()
      suggestions.push(`${baseModel} ${analysis.originalYear}`)
    }

    if (analysis.originalProcessor && analysis.originalProcessor !== analysis.normalizedProcessor) {
      const baseModel = mapTarget.modelo_norm.replace(/\b(M[1-4]|Intel).*?\b/gi, '').trim()
      suggestions.push(`${baseModel} ${analysis.originalProcessor}`)
    }

    // Extract base model name without technical specs
    const baseModelName = mapTarget.modelo_norm
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .replace(/\b\d+\s*(GB|TB|inch|pulgadas?|''|")\b/gi, '') // Remove capacity/size specs
      .replace(/\b(M[1-4]|Intel).*$/gi, '') // Remove processor specs
      .replace(/\bA\d{4}\b/gi, '') // Remove model numbers
      .trim()

    if (baseModelName && baseModelName !== mapTarget.modelo_norm) {
      suggestions.push(baseModelName)
    }

    return [...new Set(suggestions)].slice(0, 3) // Remove duplicates and limit to 3
  }, [mapTarget, getMappingAnalysis])

  // Auto-suggest searches when dialog opens
  useEffect(() => {
    if (mapTarget && getSmartSuggestions.length > 0 && !modeloSearchTerm) {
      setModeloSearchTerm(getSmartSuggestions[0])
    }
  }, [mapTarget, getSmartSuggestions])

  // Auto-select exact matches when found
  useEffect(() => {
    if (exactLikewizeMatch.data && exactLikewizeMatch.data.length === 1 && !selectedModelo) {
      const exactMatch = exactLikewizeMatch.data[0]
      setSelectedModelo(exactMatch)
      setModeloSearchTerm(exactMatch.descripcion)
    }
  }, [exactLikewizeMatch.data, selectedModelo])

  function openMapDialog(c: Cambio) {
    setMapTarget(c)
    const likewizeName = sanitizeNombre(c.nombre_likewize_original) || c.modelo_norm
    setMapNombre(likewizeName)
    const initialSearch = sanitizeNombre(c.nombre_normalizado) || c.modelo_norm
    setModeloSearchTerm(initialSearch)
    setSelectedModelo(null)
    setShowCrearModelo(false)
    setNuevoModeloDescripcion(initialSearch)
    setNuevoModeloTipo(c.tipo)
    const marcaSugerida = c.marca || (c.capacidad_id ? capMarcaLookup[c.capacidad_id] : '') || 'Apple'
    setNuevoModeloMarca(marcaSugerida)
    setNuevoModeloPantalla('')
    setNuevoModeloAno('')
    setNuevoModeloProcesador('')
  }

  function closeMapDialog() {
    setMapTarget(null)
    setSelectedModelo(null)
    setModeloSearchTerm('')
    setMapNombre('')
    setShowCrearModelo(false)
    setNuevoModeloDescripcion('')
    setNuevoModeloTipo('')
    setNuevoModeloMarca('')
    setNuevoModeloPantalla('')
    setNuevoModeloAno('')
    setNuevoModeloProcesador('')
    crearModeloManual.reset()
  }

  const asociarLikewize = useMutation({
    mutationFn: async (
      {
        modeloId,
        nombre,
        cambioId,
        cambioKind,
      }: {
        modeloId: number
        nombre: string
        cambioId?: string
        cambioKind?: Cambio['kind']
      }
    ) => {
      console.log('🔗 Asociando Likewize en:', `/api/admin/modelos/${modeloId}/asociar-likewize/`, { nombre })
      const { data } = await api.post(`/api/admin/modelos/${modeloId}/asociar-likewize/`, { nombre })

      if (
        cambioId &&
        tareaId &&
        cambioKind &&
        (cambioKind === 'INSERT' || cambioKind === 'UPDATE')
      ) {
        await api.post(`/api/precios/likewize/tareas/${tareaId}/aplicar/`, {
          ids: [cambioId],
        })
      }

      return data as ModeloMini
    },
    onSuccess: () => {
      setToggleMessage({ msg: 'Modelo asociado manualmente', sev: 'success' })
      if (mapTarget) {
        const newNombreSistema = selectedModelo?.descripcion?.trim() || mapTarget.nombre_normalizado || mapTarget.modelo_norm
        const newNombreLikewize = trimmedMapNombre || mapTarget.nombre_likewize_original || mapTarget.modelo_norm
        if (tareaId) {
          queryClient.setQueryData(['likewize_diff', tareaId], (prev: any) => {
            if (!prev || !prev.changes) return prev
            const updatedChanges = prev.changes.map((change: any) => {
              if (change.id !== mapTarget.id) return change
              return {
                ...change,
                nombre_normalizado: newNombreSistema,
                modelo_norm: newNombreSistema,
                nombre_likewize_original: newNombreLikewize,
              }
            })
            return { ...prev, changes: updatedChanges }
          })
        }
      }
      closeMapDialog()
      diff.refetch()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'No se pudo asociar el modelo'
      setToggleMessage({ msg: message, sev: 'error' })
    },
  })

  const handleAssociate = () => {
    if (!mapTarget || !selectedModelo) return
    const nombre = mapNombre.trim()
    if (!nombre) {
      setToggleMessage({ msg: 'Introduce el nombre de Likewize para asociar.', sev: 'error' })
      return
    }
    asociarLikewize.mutate({
      modeloId: selectedModelo.id,
      nombre,
      cambioId: mapTarget.id,
      cambioKind: mapTarget.kind,
    })
  }

  const crearModeloManual = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        descripcion: nuevoModeloDescripcion.trim(),
        tipo: nuevoModeloTipo.trim(),
        marca: nuevoModeloMarca.trim(),
        pantalla: nuevoModeloPantalla.trim(),
        likewize_modelo: mapNombre.trim(),
      }
      const anoLimpio = nuevoModeloAno.trim()
      if (anoLimpio) {
        const parsed = Number.parseInt(anoLimpio, 10)
        if (!Number.isNaN(parsed)) payload['año'] = parsed
      }
      const procLimpio = nuevoModeloProcesador.trim()
      if (procLimpio) payload.procesador = procLimpio
      console.log('🆕 Creando modelo manual en:', '/api/admin/modelos/', payload)
      const { data } = await api.post('/api/admin/modelos/', payload)
      console.log('🆕 Modelo creado:', data)
      return data as ModeloMini
    },
    onSuccess: (modelo) => {
      setToggleMessage({ msg: 'Modelo creado correctamente', sev: 'success' })
      setSelectedModelo(modelo)
      setModeloSearchTerm(modelo.descripcion)
      setShowCrearModelo(false)
      modelosSearch.refetch()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'No se pudo crear el modelo'
      setToggleMessage({ msg: message, sev: 'error' })
    },
  })

  const selectedModeloLikewize = useMemo(
    () => (selectedModelo?.likewize_modelo || '').trim(),
    [selectedModelo]
  )
  const trimmedMapNombre = mapNombre.trim()
  const willOverrideLikewize = useMemo(() => {
    if (!selectedModeloLikewize) return false
    if (!trimmedMapNombre) return false
    return selectedModeloLikewize.localeCompare(trimmedMapNombre, undefined, {
      sensitivity: 'accent',
      usage: 'search',
    }) !== 0
  }, [selectedModeloLikewize, trimmedMapNombre])

  const { data: likewizePresets } = useQuery({
    queryKey: ['likewize-presets'],
    queryFn: fetchLikewizePresets,
    staleTime: 300_000,
  })

  const otherBrandOptions = useMemo(() => likewizePresets?.others ?? [], [likewizePresets])
  const appleBrandDefaults = useMemo(() => (
    (likewizePresets?.apple?.length ? likewizePresets.apple : ['Apple'])
  ), [likewizePresets])

  useEffect(() => {
    if (!otherBrandOptions.length) {
      return
    }
    setSelectedOtherBrands((prev) => {
      const filtered = prev.filter((brand) => otherBrandOptions.includes(brand))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [otherBrandOptions])

  const { data: marcasModelo } = useQuery({
    queryKey: ['marcas-modelo'],
    queryFn: fetchMarcasModelo,
    staleTime: 60_000,
  })

  useEffect(() => {
    const data = diff.data
    if (!data || !data.changes) return
    setCapMarcaLookup((prev) => {
      const next = { ...prev }
      data.changes.forEach((c) => {
        if (c.capacidad_id && c.marca) {
          next[c.capacidad_id] = c.marca
        }
      })
      return next
    })
  }, [diff.data])

  useEffect(() => {
    if (!diff.data) return
    const ids = Array.from(new Set(
      diff.data.changes
        .map((c) => c.capacidad_id)
        .filter((id): id is number => typeof id === 'number')
    ))
    if (!ids.length) return
    let cancelled = false
    ;(async () => {
      try {
        const responses = await Promise.all(ids.map(async (id) => {
          try {
            const { data } = await api.get(`/api/admin/capacidades/${id}/`)
            return {
              id,
              activo: Boolean(data?.activo),
              marca: data?.modelo?.marca ?? 'Apple',
            }
          } catch {
            return null
          }
        }))
        if (!cancelled) {
          setCapStatus((prev) => {
            const next = { ...prev }
            for (const entry of responses) {
              if (entry) {
                next[entry.id] = entry.activo
              }
            }
            return next
          })
          setCapMarcaLookup((prev) => {
            const next = { ...prev }
            for (const entry of responses) {
              if (entry) {
                next[entry.id] = entry.marca
              }
            }
            return next
          })
        }
      } catch {
        /* noop */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [diff.data])

  const aplicar = useMutation({
    mutationFn: async () => {
      if (!tareaId) throw new Error('No tarea')
      const ids = Array.from(seleccion)
      const { data } = await api.post(`/api/precios/likewize/tareas/${tareaId}/aplicar/`, { ids })
      return data
    },
    onSuccess: () => {
      setSeleccion(new Set())
      diff.refetch()
    }
  })

  const crearCapacidad = useMutation({
    mutationFn: async (payload: { staging_id: number; tipo: string; marca: string; modelo: string; capacidad: string; almacenamiento_gb?: number; likewize_model_code?: string }) => {
      if (!tareaId) throw new Error('No tarea')
      const { data } = await api.post(`/api/precios/likewize/tareas/${tareaId}/crear-capacidad/`, payload)
      return data as { capacidad_id: number; marca?: string }
    },
    onSuccess: (data) => {
      if (data?.capacidad_id && data?.marca) {
        setCapMarcaLookup(prev => ({ ...prev, [data.capacidad_id]: data.marca! }))
      }
      diff.refetch()
      closeCrearDialog()
    }
  })

  const submitCrearCapacidad = () => {
    if (!noMapTarget) return
    const tipo = formTipo.trim()
    const modelo = formModelo.trim()
    const capacidad = formCapacidad.trim()
    const marca = formMarca.trim() || 'Apple'
    const likewizeModelCode = formLikewizeCode.trim().toUpperCase()
    if (!tipo || !modelo || !capacidad || !marca.trim()) return
    const almacenamiento_gb = parseStorageToGb(capacidad)
    crearCapacidad.mutate({
      staging_id: noMapTarget.id,
      tipo,
      marca,
      modelo,
      capacidad,
      ...(almacenamiento_gb ? { almacenamiento_gb } : {}),
      ...(likewizeModelCode ? { likewize_model_code: likewizeModelCode } : {}),
    })
  }

  const toggleCapacidad = useMutation({
    mutationFn: async ({ capacidadId, activo }: { capacidadId: number; activo: boolean }) => {
      setTogglingId(capacidadId)
      const { data } = await api.patch(`/api/admin/capacidades/${capacidadId}/`, { activo })
      return data as { id: number; activo: boolean; modelo?: { marca?: string } }
    },
    onSuccess: (data) => {
      setCapStatus(prev => ({ ...prev, [data.id]: data.activo }))
      setCapMarcaLookup(prev => ({ ...prev, [data.id]: data?.modelo?.marca ?? prev[data.id] ?? 'Apple' }))
      setToggleMessage({ msg: data.activo ? 'Capacidad activada' : 'Capacidad marcada como baja', sev: 'success' })
      diff.refetch()
    },
    onError: (error: unknown) => {
      setToggleMessage({
        msg: error instanceof Error ? error.message : 'No se pudo actualizar la capacidad',
        sev: 'error',
      })
    },
    onSettled: () => {
      setTogglingId(null)
    },
  })

  // Filtered changes based on current filters
  const filteredChanges = useMemo(() => {
    if (!diff.data?.changes) return []

    return diff.data.changes.filter((c) => {
      // Filter out deactivated devices unless explicitly shown
      if (!showDeactivated && c.kind === 'DELETE' && capStatus[c.capacidad_id!] === false) {
        return false
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matches =
          c.modelo_norm.toLowerCase().includes(searchLower) ||
          (c.marca || '').toLowerCase().includes(searchLower) ||
          c.tipo.toLowerCase().includes(searchLower) ||
          (c.nombre_likewize_original || '').toLowerCase().includes(searchLower)
        if (!matches) return false
      }

      // Kind filter
      if (filterKind !== 'all' && c.kind !== filterKind) {
        return false
      }

      // Brand filter
      if (filterMarca !== 'all') {
        const marca = c.marca || capMarcaLookup[c.capacidad_id!] || ''
        if (marca !== filterMarca) return false
      }

      // Confidence filter
      if (filterConfidence !== 'all') {
        const confidence = getMappingConfidence(c)
        if (confidence !== filterConfidence) return false
      }

      // Show only problematic mappings
      if (showOnlyProblematic) {
        const analysis = getMappingAnalysis(c)
        const hasProblems = analysis.issues.length > 0 || analysis.warnings.length > 0
        if (!hasProblems) return false
      }

      // Removed exact match filtering - not needed without cache system

      return true
    })
  }, [diff.data?.changes, showDeactivated, searchTerm, filterKind, filterMarca, filterConfidence, showOnlyProblematic, capStatus, capMarcaLookup, getMappingConfidence, getMappingAnalysis])

  // Paginated changes
  const paginatedChanges = useMemo(() => {
    const startIndex = page * pageSize
    return filteredChanges.slice(startIndex, startIndex + pageSize)
  }, [filteredChanges, page, pageSize])

  // Available brands for filter
  const availableBrands = useMemo(() => {
    if (!diff.data?.changes) return []
    const brands = new Set<string>()
    diff.data.changes.forEach(c => {
      const marca = c.marca || capMarcaLookup[c.capacidad_id!] || ''
      if (marca) brands.add(marca)
    })
    return Array.from(brands).sort()
  }, [diff.data?.changes, capMarcaLookup])

  const bulkDeactivateTargets = useMemo(() => {
    if (!diff.data) return []
    const ids = filteredChanges
      .filter((c) => seleccion.has(c.id) && c.kind === 'DELETE' && c.capacidad_id)
      .map((c) => c.capacidad_id!)
    return Array.from(new Set(ids))
  }, [filteredChanges, seleccion])


  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [searchTerm, filterKind, filterMarca, filterConfidence, showOnlyProblematic, showDeactivated])

  function closeCrearDialog() {
    setOpenCrearDialog(false)
    setNoMapTarget(null)
    setFormTipo('')
    setFormModelo('')
    setFormCapacidad('')
    setFormMarca('Apple')
    setFormLikewizeCode('')
    crearCapacidad.reset()
  }

  function openCrearDesdeRow(row: NoMap) {
    crearCapacidad.reset()
    setNoMapTarget(row)
    setFormTipo(row.tipo)
    setFormModelo(row.modelo_norm)
    setFormCapacidad(formatStorage(row.almacenamiento_gb))
    setFormMarca(row.marca ?? 'Apple')
    setFormLikewizeCode((row.likewize_model_code ?? '').toUpperCase())
    setOpenCrearDialog(true)
  }

  const running = estado.data?.estado === 'RUNNING' || estado.data?.estado === 'PENDING'

  const toggle = (id: string) => {
    setSeleccion(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectAll = () => {
    setSeleccion(new Set(filteredChanges.map(c => c.id)))
  }

  const selectPage = () => {
    setSeleccion(prev => {
      const newSelection = new Set(prev)
      paginatedChanges.forEach(c => newSelection.add(c.id))
      return newSelection
    })
  }

  const clearAll = () => setSeleccion(new Set())

  const badge = (k: Cambio['kind']) =>
    k === 'INSERT' ? <Chip size="small" color="success" label="ALTA" /> :
    k === 'UPDATE' ? <Chip size="small" color="warning" label="CAMBIO" /> :
                     <Chip size="small" color="default" label="BAJA" />

  const MappingConfidenceIndicator = ({ cambio }: { cambio: Cambio }) => {
    const confidence = getMappingConfidence(cambio)
    const icon = confidence === 'alta' ? <CheckCircleIcon /> :
                 confidence === 'media' ? <InfoIcon /> : <WarningIcon />
    const color = confidence === 'alta' ? 'success' :
                  confidence === 'media' ? 'info' : 'warning'

    return (
      <Tooltip title={`Confianza del mapeo: ${confidence.toUpperCase()}`}>
        <Chip
          size="small"
          icon={icon}
          label={confidence.charAt(0).toUpperCase() + confidence.slice(1)}
          color={color}
          variant="outlined"
        />
      </Tooltip>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Card variant="outlined">
          <CardHeader
            title="Actualizar precios B2B (Likewize)"
            subheader="Descarga, revisa y aplica cambios de precios desde Likewize"
            avatar={
              <Box sx={{
                bgcolor: 'primary.main',
                borderRadius: '50%',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="h6" color="primary.contrastText" fontWeight={600}>
                  B2B
                </Typography>
              </Box>
            }
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => { window.location.href = '/dispositivos/actualizar-b2c' }}
                >
                  Actualizar B2C
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => { window.location.href = '/dispositivos/actualizar-b2c-backmarket' }}
                >
                  B2C (Back Market)
                </Button>
              </Stack>
            }
          />
        </Card>

        {/* Process Steps */}
        <Card variant="outlined">
          <CardHeader title="Proceso de Actualización" />
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label="1. Descargar"
                color={estado.data?.estado === 'SUCCESS' ? 'success' : 'default'}
                variant={estado.data?.estado === 'SUCCESS' ? 'filled' : 'outlined'}
              />
              <Typography variant="body2" color="text.secondary">→</Typography>
              <Chip
                label="2. Revisar"
                color={diff.data ? 'success' : 'default'}
                variant={diff.data ? 'filled' : 'outlined'}
              />
              <Typography variant="body2" color="text.secondary">→</Typography>
              <Chip
                label="3. Aplicar"
                color="default"
                variant="outlined"
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Download Controls */}
        {!running && estado.data?.estado !== 'SUCCESS' && (
          <Card variant="outlined">
            <CardHeader title="Paso 1: Descargar datos de Likewize" />
            <CardContent>
              <Stack spacing={3}>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Sistema de Mapeo</InputLabel>
                        <Select
                          value={mappingSystem}
                          label="Sistema de Mapeo"
                          onChange={(e) => setMappingSystem(e.target.value as 'v1' | 'v2')}
                          disabled={lanzarActualizacionPending}
                        >
                          <MenuItem value="v1">V1 - Heurística Básica</MenuItem>
                          <MenuItem value="v2">V2 - Inteligencia Avanzada</MenuItem>
                        </Select>
                      </FormControl>
                      <Tooltip title={
                        <div>
                          <Typography variant="caption" component="div" gutterBottom>
                            <strong>V1 - Heurística Básica:</strong> Mapeo basado en reglas simples y coincidencias de texto
                          </Typography>
                          <Typography variant="caption" component="div">
                            <strong>V2 - Inteligencia Avanzada:</strong> Mapeo con A-numbers para Mac, enriquecimiento de base de conocimiento para iPhone/iPad
                          </Typography>
                        </div>
                      }>
                        <IconButton size="small" sx={{ mt: 1.5 }}>
                          <InfoIcon fontSize="small" color="action" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Grid>
                  {mappingSystem === 'v1' && (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                        <Typography variant="caption">
                          <strong>Recomendación:</strong> Para MacBook Pro y dispositivos Apple recientes, se recomienda usar V2 para mejor precisión en el mapeo (95%+ vs 70-80%).
                        </Typography>
                      </Alert>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Autocomplete
                      multiple
                      disableCloseOnSelect
                      size="small"
                      options={otherBrandOptions}
                      value={selectedOtherBrands}
                      onChange={(_, newValue) => setSelectedOtherBrands(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Marcas adicionales"
                          placeholder="Selecciona marcas"
                        />
                      )}
                      disabled={lanzarActualizacionPending}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        variant="contained"
                        size="large"
                        onClick={() => lanzarTarea('apple', appleBrandDefaults)}
                        disabled={lanzarActualizacionPending}
                      >
                        {pendingMode === 'apple' && lanzarActualizacionPending ? 'Lanzando…' : 'Actualizar Apple'}
                      </Button>
                      <Button
                        variant="contained"
                        color="secondary"
                        size="large"
                        onClick={() => {
                          if (!selectedOtherBrands.length) {
                            setToggleMessage({ msg: 'Selecciona al menos una marca para sincronizar.', sev: 'error' })
                            return
                          }
                          lanzarTarea('others', selectedOtherBrands)
                        }}
                        disabled={lanzarActualizacionPending || selectedOtherBrands.length === 0}
                      >
                        {pendingMode === 'others' && lanzarActualizacionPending ? 'Lanzando…' : 'Actualizar otros'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => cargarUltima.mutate()}
                        disabled={cargarUltima.isPending}
                      >
                        {cargarUltima.isPending ? 'Cargando…' : 'Ver último descargado'}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {running && (
          <Card variant="outlined">
            <CardHeader title="Descargando datos..." />
            <CardContent>
              <Stack spacing={2}>
                <LinearProgress
                  variant={typeof (estado.data as EstadoTareaExt | undefined)?.progreso === 'number' ? 'determinate' : 'indeterminate'}
                  value={(estado.data as EstadoTareaExt | undefined)?.progreso ?? 0}
                />
                <Typography variant="body2" color="text.secondary">
                  {(estado.data as EstadoTareaExt | undefined)?.subestado || 'Procesando…'}
                </Typography>
                <LiveLog tareaId={tareaId!} enabled={running} />
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Error Messages */}
        {estado.data?.estado === 'ERROR' && (
          <Alert severity="error">
            Falló la actualización: {estado.data.error_message || 'Error desconocido'}{' '}
            {estado.data.log_url && (
              <MuiLink href={estado.data.log_url} target="_blank" rel="noopener">Ver log</MuiLink>
            )}
          </Alert>
        )}

        {toggleMessage && (
          <Alert
            severity={toggleMessage.sev}
            onClose={() => setToggleMessage(null)}
          >
            {toggleMessage.msg}
          </Alert>
        )}

        {/* Success State and Actions */}
        {estado.data?.estado === 'SUCCESS' && (
          <>
            <Alert severity="success">Staging listo. Revisa cambios antes de aplicar.</Alert>

            {/* Actions Card */}
            <Card variant="outlined">
              <CardHeader title="Paso 2: Revisar y Aplicar Cambios" />
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button size="small" variant="outlined" onClick={selectAll}>
                      Seleccionar filtrados ({filteredChanges.length})
                    </Button>
                    <Button size="small" variant="outlined" onClick={selectPage}>
                      Seleccionar página ({paginatedChanges.length})
                    </Button>
                    <Button size="small" variant="outlined" onClick={clearAll}>
                      Limpiar selección
                    </Button>
                    <Divider orientation="vertical" flexItem />
                    <Chip
                      label={`Seleccionados: ${seleccion.size}`}
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      variant="contained"
                      size="large"
                      disabled={seleccion.size === 0 || aplicar.isPending}
                      onClick={() => aplicar.mutate()}
                    >
                      {aplicar.isPending ? 'Aplicando…' : `Aplicar seleccionados (${seleccion.size})`}
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={bulkDeactivateTargets.length === 0 || toggleCapacidad.isPending}
                      onClick={async () => {
                        if (bulkDeactivateTargets.length === 0) {
                          setToggleMessage({ msg: 'Selecciona filas de tipo baja para desactivar.', sev: 'error' })
                          return
                        }
                        try {
                          for (const capId of bulkDeactivateTargets) {
                            await toggleCapacidad.mutateAsync({ capacidadId: capId, activo: false })
                          }
                          setToggleMessage({ msg: `Capacidades marcadas como baja (${bulkDeactivateTargets.length})`, sev: 'success' })
                        } catch (err) {
                          setToggleMessage({ msg: err instanceof Error ? err.message : 'Error desactivando capacidades', sev: 'error' })
                        }
                      }}
                    >
                      Marcar seleccionados como baja
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {diff.isLoading && <LinearProgress />}

                {diff.data && (
                  <>
                    <Card variant="outlined">
                      <CardHeader
                        title="Resumen de Cambios"
                        action={
                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={`Total: ${diff.data.summary.total}`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              label={`Filtrados: ${filteredChanges.length}`}
                              color="secondary"
                              variant="outlined"
                            />
                          </Stack>
                        }
                      />
                      <CardContent>
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                          <Chip
                            label={`Nuevos: ${diff.data.summary.inserts}`}
                            color="success"
                            variant="outlined"
                            title="Dispositivos encontrados en Likewize que no están en BD local"
                          />
                          <Chip
                            label={`Actualizados: ${diff.data.summary.updates}`}
                            color="info"
                            variant="outlined"
                            title="Dispositivos con cambios de precio desde Likewize"
                          />
                          <Chip
                            label={`Sin precio nuevo: ${diff.data.summary.deletes}`}
                            color="warning"
                            variant="outlined"
                            title="Dispositivos locales que no se encontraron en la actualización de Likewize"
                          />
                          {diff.data.no_mapeados && diff.data.no_mapeados.length > 0 && (
                            <Chip
                              label={`Sin mapeo: ${diff.data.no_mapeados.length}`}
                              color="error"
                              variant="outlined"
                              title="Dispositivos de Likewize que no pudieron mapearse a la BD local"
                            />
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Filters Card */}
                    <Card variant="outlined">
                      <CardHeader
                        title="Filtros y Búsqueda"
                        action={
                          <IconButton onClick={() => setShowFilters(!showFilters)}>
                            <ExpandMoreIcon sx={{ transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
                          </IconButton>
                        }
                      />
                      <Collapse in={showFilters}>
                        <CardContent>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Buscar"
                                placeholder="Modelo, marca, código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                }}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Tipo de Cambio</InputLabel>
                                <Select
                                  value={filterKind}
                                  label="Tipo de Cambio"
                                  onChange={(e) => setFilterKind(e.target.value as any)}
                                >
                                  <MenuItem value="all">Todos</MenuItem>
                                  <MenuItem value="INSERT">Altas</MenuItem>
                                  <MenuItem value="UPDATE">Cambios</MenuItem>
                                  <MenuItem value="DELETE">Bajas</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Marca</InputLabel>
                                <Select
                                  value={filterMarca}
                                  label="Marca"
                                  onChange={(e) => setFilterMarca(e.target.value)}
                                >
                                  <MenuItem value="all">Todas</MenuItem>
                                  {availableBrands.map((brand) => (
                                    <MenuItem key={brand} value={brand}>{brand}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Confianza</InputLabel>
                                <Select
                                  value={filterConfidence}
                                  label="Confianza"
                                  onChange={(e) => setFilterConfidence(e.target.value as any)}
                                >
                                  <MenuItem value="all">Todas</MenuItem>
                                  <MenuItem value="alta">Alta</MenuItem>
                                  <MenuItem value="media">Media</MenuItem>
                                  <MenuItem value="baja">Baja</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                              <Stack spacing={1}>
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={showOnlyProblematic}
                                      onChange={(e) => setShowOnlyProblematic(e.target.checked)}
                                      color="warning"
                                    />
                                  }
                                  label="Solo mapeos problemáticos"
                                />
                                {/* Removed "Solo con matches exactos en BD" - not needed without cache system */}
                                <FormControlLabel
                                  control={
                                    <Switch
                                      checked={showDeactivated}
                                      onChange={(e) => setShowDeactivated(e.target.checked)}
                                      icon={<VisibilityOffIcon />}
                                      checkedIcon={<VisibilityIcon />}
                                    />
                                  }
                                  label="Mostrar dispositivos en baja"
                                />
                              </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, md: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Por página</InputLabel>
                                <Select
                                  value={pageSize}
                                  label="Por página"
                                  onChange={(e) => setPageSize(Number(e.target.value))}
                                >
                                  <MenuItem value={25}>25</MenuItem>
                                  <MenuItem value={50}>50</MenuItem>
                                  <MenuItem value={100}>100</MenuItem>
                                  <MenuItem value={200}>200</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Collapse>
                    </Card>

                    <Card variant="outlined">
                      <CardHeader
                        title={`Cambios (${filteredChanges.length} de ${diff.data.summary.total})`}
                        subheader={`Página ${page + 1} de ${Math.ceil(filteredChanges.length / pageSize)}`}
                        action={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                              size="small"
                              disabled={page === 0}
                              onClick={() => setPage(p => Math.max(0, p - 1))}
                            >
                              Anterior
                            </Button>
                            <Typography variant="body2" color="text.secondary">
                              {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredChanges.length)} de {filteredChanges.length}
                            </Typography>
                            <Button
                              size="small"
                              disabled={page >= Math.ceil(filteredChanges.length / pageSize) - 1}
                              onClick={() => setPage(p => p + 1)}
                            >
                              Siguiente
                            </Button>
                          </Stack>
                        }
                      />
                      <CardContent sx={{ p: 0 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell />
                              <TableCell>Tipo</TableCell>
                              <TableCell>Modelo / Mapeo</TableCell>
                              <TableCell align="right">Cap.</TableCell>
                              <TableCell align="center">Confianza</TableCell>
                              <TableCell align="center">Acción</TableCell>
                              <TableCell>Tipo cambio</TableCell>
                              <TableCell align="right">Antes</TableCell>
                              <TableCell align="right">Después</TableCell>
                              <TableCell align="right">Δ</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedChanges.map(c => (
                          <TableRow key={c.id} hover>
                            <TableCell padding="checkbox">
                              <Checkbox checked={seleccion.has(c.id)} onChange={() => toggle(c.id)} />
                            </TableCell>
                            <TableCell>{c.tipo}</TableCell>
                          <TableCell>
                            <NameMappingCell
                              cambio={c}
                              marca={c.capacidad_id ? capMarcaLookup[c.capacidad_id] : undefined}
                              getMappingAnalysis={getMappingAnalysis}
                            />
                          </TableCell>
                            <TableCell align="right">{c.almacenamiento_gb || '-'}</TableCell>
                            <TableCell align="center">
                              <MappingConfidenceIndicator cambio={c} />
                            </TableCell>
                            <TableCell align="center">
                              <Stack spacing={1} alignItems="center">
                                {c.kind === 'DELETE' && c.capacidad_id ? (
                                  <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                                    <Button
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                      onClick={() => toggleCapacidad.mutate(
                                        { capacidadId: c.capacidad_id!, activo: false },
                                        {
                                          onSuccess: (data) => setToggleMessage({
                                            msg: data.activo ? 'Capacidad activada' : 'Capacidad marcada como baja',
                                            sev: 'success',
                                          })
                                        }
                                      )}
                                      disabled={
                                        (toggleCapacidad.isPending && togglingId === c.capacidad_id) ||
                                        capStatus[c.capacidad_id!] === false
                                      }
                                    >
                                      {toggleCapacidad.isPending && togglingId === c.capacidad_id
                                        ? 'Marcando…'
                                        : capStatus[c.capacidad_id!] === false
                                          ? 'Ya en baja'
                                          : 'Marcar baja'}
                                    </Button>
                                    {capStatus[c.capacidad_id!] === false && (
                                      <Chip size="small" label="Baja" color="default" variant="outlined" />
                                    )}
                                  </Stack>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    Sin acción automática
                                  </Typography>
                                )}
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<SearchIcon fontSize="small" />}
                                  onClick={() => openMapDialog(c)}
                                >
                                  Asociar modelo
                                </Button>
                              </Stack>
                            </TableCell>
                            <TableCell>{badge(c.kind)}</TableCell>
                            <TableCell align="right">{c.antes ?? '-'}</TableCell>
                            <TableCell align="right">
                              {c.despues ?? (() => {
                                const statusInfo = getPriceStatusMessage(c)
                                if (statusInfo.message === '-') {
                                  return '-'
                                }
                                return (
                                  <Tooltip
                                    title={statusInfo.tooltip}
                                    arrow
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'help' }}>
                                      <span style={{
                                        color: statusInfo.severity === 'error' ? '#d32f2f' :
                                               statusInfo.severity === 'warning' ? '#f57c00' : '#1976d2',
                                        fontWeight: 'bold',
                                        fontSize: '0.875rem'
                                      }}>
                                        {statusInfo.message}
                                      </span>
                                    </Box>
                                  </Tooltip>
                                )
                              })()}
                            </TableCell>
                            <TableCell align="right">
                              {typeof c.delta === 'number' ? c.delta.toFixed(2) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    {diff.data?.no_mapeados?.length ? (
                        <Card variant="outlined">
                          <CardHeader
                            title="Dispositivos no mapeados a capacidad"
                            subheader={`${diff.data.no_mapeados.length} dispositivos requieren revisión`}
                            avatar={<WarningIcon color="warning" />}
                          />
                          <CardContent sx={{ p: 0 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell />
                                  <TableCell>Tipo</TableCell>
                                  <TableCell>Modelo</TableCell>
                                  <TableCell>Código Likewize</TableCell>
                                  <TableCell>Marca</TableCell>
                                  <TableCell align="right">Cap.</TableCell>
                                  <TableCell align="right">Precio B2B</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {diff.data.no_mapeados.map((r: NoMap, i: number) => (
                                  <TableRow key={i} hover>
                                    <TableCell>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => openCrearDesdeRow(r)}
                                        disabled={crearCapacidad.isPending}
                                      >
                                        {crearCapacidad.isPending && noMapTarget?.id === r.id ? 'Creando…' : 'Revisar y crear'}
                                      </Button>
                                    </TableCell>
                                    <TableCell>
                                      <Chip size="small" label={r.tipo} variant="outlined" />
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontWeight={500}>
                                        {r.modelo_norm}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontFamily="monospace">
                                        {r.likewize_model_code ?? '—'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      {r.marca ? (
                                        <Chip size="small" label={r.marca} variant="outlined" />
                                      ) : '—'}
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">
                                        {formatStorage(r.almacenamiento_gb)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2" fontWeight={500}>
                                        €{r.precio_b2b}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                        ) : null}

                  </>
                )}
          </>
        )}
      </Stack>

      <Dialog
        open={Boolean(mapTarget)}
        onClose={closeMapDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Asociar modelo manualmente</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {mapTarget && (() => {
              const analysis = getMappingAnalysis(mapTarget)
              const hasIssues = analysis.issues.length > 0

              return (
                <>
                  <Alert severity={hasIssues ? "error" : "info"}>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        Sistema actual: <strong>{sanitizeNombre(mapTarget.nombre_normalizado) || mapTarget.modelo_norm}</strong>
                      </Typography>
                      <Typography variant="body2">
                        Likewize detectado: <strong>{sanitizeNombre(mapTarget.nombre_likewize_original) || mapTarget.modelo_norm}</strong>
                      </Typography>
                      <Typography variant="caption">
                        Capacidad: {mapTarget.almacenamiento_gb ? `${mapTarget.almacenamiento_gb} GB` : '—'} · Tipo: {mapTarget.tipo}
                      </Typography>
                    </Stack>
                  </Alert>

                  {/* Show mapping issues */}
                  {analysis.issues.length > 0 && (
                    <Alert severity="warning">
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Problemas detectados:
                      </Typography>
                      <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
                        {analysis.issues.map((issue, index) => (
                          <Typography key={index} component="li" variant="body2">
                            {issue}
                          </Typography>
                        ))}
                      </Stack>
                    </Alert>
                  )}

                  {/* Smart suggestions */}
                  {getSmartSuggestions.length > 0 && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Sugerencias de búsqueda:
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {getSmartSuggestions.map((suggestion, index) => (
                          <Chip
                            key={index}
                            label={suggestion}
                            size="small"
                            variant="outlined"
                            clickable
                            onClick={() => setModeloSearchTerm(suggestion)}
                            color={modeloSearchTerm === suggestion ? "primary" : "default"}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </>
              )
            })()}
            <TextField
              label="Nombre Likewize"
              value={mapNombre}
              onChange={(event) => setMapNombre(event.target.value)}
              helperText="Se guardará en el campo likewize_modelo del modelo seleccionado"
            />
            {/* Exact Matches Section */}
            {exactLikewizeMatch.data && exactLikewizeMatch.data.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight={600} color="success.main" gutterBottom>
                  ✓ Coincidencias exactas en likewize_modelo:
                </Typography>
                <Stack spacing={1}>
                  {exactLikewizeMatch.data.map((modelo) => (
                    <Card
                      key={`exact-${modelo.id}`}
                      variant="outlined"
                      sx={{
                        p: 1,
                        cursor: 'pointer',
                        borderColor: selectedModelo?.id === modelo.id ? 'success.main' : 'divider',
                        bgcolor: selectedModelo?.id === modelo.id ? 'success.light' : 'background.paper'
                      }}
                      onClick={() => {
                        setSelectedModelo(modelo)
                        setModeloSearchTerm(modelo.descripcion)
                      }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Stack flex={1}>
                          <Typography variant="body2" fontWeight={600}>
                            {modelo.descripcion}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {modelo.marca} · {modelo.tipo}
                          </Typography>
                          <Typography variant="caption" color="success.main">
                            Likewize: {modelo.likewize_modelo}
                          </Typography>
                        </Stack>
                        {selectedModelo?.id === modelo.id && (
                          <CheckCircleIcon color="success" />
                        )}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}

            {/* General Search Section */}
            <Box>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                {exactLikewizeMatch.data?.length ? 'O buscar otros modelos:' : 'Buscar modelo:'}
              </Typography>
              <Autocomplete
                options={modelosSearch.data ?? []}
                value={selectedModelo}
                inputValue={modeloSearchTerm}
                onInputChange={(_, value) => setModeloSearchTerm(value)}
                onChange={(_, value) => setSelectedModelo(value)}
                filterOptions={(x) => x}
                getOptionLabel={(option) => option.descripcion || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                loading={modelosSearch.isFetching || exactLikewizeMatch.isFetching}
                noOptionsText={modeloSearchTerm.trim().length < 2 ? 'Escribe al menos 2 caracteres' : 'Sin resultados'}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Buscar modelo del sistema"
                    helperText="Busca por nombre del sistema"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {(modelosSearch.isFetching || exactLikewizeMatch.isFetching) ? <CircularProgress color="inherit" size={16} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  const isExactMatch = exactLikewizeMatch.data?.some(exact => exact.id === option.id)
                  return (
                    <li {...props} key={option.id}>
                      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ width: '100%' }}>
                        {isExactMatch && <CheckCircleIcon color="success" fontSize="small" />}
                        <Stack spacing={0.25} flex={1}>
                          <Typography fontWeight={600}>{option.descripcion}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(option.marca ?? '—')} · {(option.tipo ?? '—')}
                          </Typography>
                          {option.likewize_modelo && (
                            <Typography variant="caption" color={isExactMatch ? "success.main" : "warning.main"}>
                              Likewize: {option.likewize_modelo}
                            </Typography>
                          )}
                          {isExactMatch && (
                            <Typography variant="caption" color="success.main" fontWeight={600}>
                              ✓ Coincidencia exacta
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    </li>
                  )
                }}
              />
            </Box>
            {selectedModeloLikewize && (
              willOverrideLikewize ? (
                <Alert severity="warning" variant="outlined">
                  Este modelo ya tiene asociado un nombre Likewize: <strong>{selectedModeloLikewize}</strong>. Se sobrescribirá con el nuevo valor.
                </Alert>
              ) : (
                <Alert severity="info" variant="outlined">
                  El modelo ya tiene asociado el mismo nombre de Likewize.
                </Alert>
              )
            )}
            <Button
              size="small"
              variant={showCrearModelo ? 'contained' : 'outlined'}
              onClick={() => setShowCrearModelo((prev) => !prev)}
            >
              {showCrearModelo ? 'Ocultar creación manual' : 'Crear modelo manualmente'}
            </Button>
            <Collapse in={showCrearModelo}>
              <Stack spacing={1.5} sx={{ border: '1px dashed', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle2">Nuevo modelo en el sistema</Typography>
                {crearModeloManual.isError && (
                  <Alert severity="error">
                    {crearModeloManual.error instanceof Error ? crearModeloManual.error.message : 'No se pudo crear el modelo.'}
                  </Alert>
                )}
                <TextField
                  label="Descripción"
                  value={nuevoModeloDescripcion}
                  onChange={(e) => setNuevoModeloDescripcion(e.target.value)}
                  required
                />
                <TextField
                  label="Tipo"
                  value={nuevoModeloTipo}
                  onChange={(e) => setNuevoModeloTipo(e.target.value)}
                  helperText="Ej: iPhone, iPad, MacBook"
                />
                <TextField
                  label="Marca"
                  value={nuevoModeloMarca}
                  onChange={(e) => setNuevoModeloMarca(e.target.value)}
                />
                <TextField
                  label="Pantalla"
                  value={nuevoModeloPantalla}
                  onChange={(e) => setNuevoModeloPantalla(e.target.value)}
                  helperText="Opcional (ej. 6.1'')"
                />
                <TextField
                  label="Año"
                  value={nuevoModeloAno}
                  onChange={(e) => setNuevoModeloAno(e.target.value.replace(/[^0-9]/g, ''))}
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4 }}
                />
                <TextField
                  label="Procesador"
                  value={nuevoModeloProcesador}
                  onChange={(e) => setNuevoModeloProcesador(e.target.value)}
                  helperText="Opcional"
                />
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => crearModeloManual.mutate()}
                    disabled={crearModeloManual.isPending || !nuevoModeloDescripcion.trim() || !nuevoModeloTipo.trim() || !nuevoModeloMarca.trim()}
                  >
                    {crearModeloManual.isPending ? 'Creando…' : 'Guardar modelo'}
                  </Button>
                </Stack>
              </Stack>
            </Collapse>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMapDialog} disabled={asociarLikewize.isPending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={!selectedModelo || !mapNombre.trim() || asociarLikewize.isPending}
          >
            {asociarLikewize.isPending ? 'Asociando…' : 'Asociar modelo'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCrearDialog} onClose={closeCrearDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Crear capacidad a partir de staging</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {crearCapacidad.isError && (
              <Alert severity="error">
                {crearCapacidad.error instanceof Error ? crearCapacidad.error.message : 'No se pudo crear la capacidad.'}
              </Alert>
            )}
            <TextField
              size="small"
              label="Tipo"
              value={formTipo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormTipo(e.target.value)}
              autoFocus
            />
            <TextField
              size="small"
              label="Modelo"
              value={formModelo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormModelo(e.target.value)}
            />
            <TextField
              size="small"
              label="Código Likewize"
              value={formLikewizeCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormLikewizeCode(e.target.value.toUpperCase())}
              helperText="Ej: GB7N6"
            />
            <Autocomplete
              freeSolo
              options={Array.from(new Set(marcasModelo ?? []))}
              value={formMarca}
              onChange={(_, newValue) => setFormMarca(newValue ?? '')}
              onInputChange={(_, newValue) => setFormMarca(newValue ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Marca"
                  size="small"
                  helperText="Ejemplo: Apple, Samsung, Google"
                />
              )}
            />
            <TextField
              size="small"
              label="Capacidad"
              value={formCapacidad}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormCapacidad(e.target.value)}
              helperText="Ejemplo: 256 GB, 1TB"
            />
            {noMapTarget && (
              <Typography variant="body2" color="text.secondary">
                Precio B2B detectado: {noMapTarget.precio_b2b}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCrearDialog} disabled={crearCapacidad.isPending}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submitCrearCapacidad}
            disabled={crearCapacidad.isPending || !noMapTarget || !formTipo.trim() || !formModelo.trim() || !formCapacidad.trim() || !formMarca.trim()}
          >
            {crearCapacidad.isPending ? 'Creando…' : 'Guardar y crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
