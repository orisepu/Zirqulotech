'use client'

import { Box, Stack, Card, CardHeader, Tabs, Tab, Alert, Button, Chip, Typography, LinearProgress, Grid, Paper, Collapse, Divider, CircularProgress, CardContent, Checkbox, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AutoAwesome, Psychology, Speed, TrendingUp, Warning, Close, Search } from '@mui/icons-material'
import api from '@/services/api'
// Import existing components (assuming they exist)
// import LikewizeB2BPage from '@/app/(dashboard)/dispositivos/actualizar/page'
import MappingMetrics from './MappingMetrics'
import IncrementalUpdateControls from './IncrementalUpdateControls'
import MappingConfidenceEnhanced from './MappingConfidenceEnhanced'
import DeviceMappingStrategy from './DeviceMappingStrategy'
import MappingAuditPanel from './MappingAuditPanel'
import { ReviewPanel } from './ReviewPanel'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { ValidationTabPanel } from './ValidationTabPanel'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'
import { useLearningMetrics, useLaunchV3UpdateTask, useRealTimeLearningMetrics, useTaskMonitoring, useActiveV3Tasks } from '@/hooks/useLearningV3'

// Types from the original page
type Cambio = {
  id: string
  kind: 'INSERT' | 'UPDATE' | 'DELETE'
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

type DiffData = {
  summary: { inserts: number, updates: number, deletes: number, total: number }
  changes: Cambio[]
  // V3 specific fields
  is_v3?: boolean
  resumen?: {
    inserciones?: number
    actualizaciones?: number
    eliminaciones?: number
    sin_cambios?: number
    total_comparaciones?: number
  }
  v3_stats?: {
    confidence_stats?: {
      promedio?: number
      alta_confianza?: number
      media_confianza?: number
      baja_confianza?: number
    }
  }
  comparaciones?: Array<{
    change_type?: string
    [key: string]: unknown
  }>
}

// Capacidades estándar por tipo de dispositivo (debe coincidir con backend)
const STANDARD_CAPACITIES: Record<string, number[]> = {
  'iMac': [256, 512, 1024, 2048],
  'MacBook Pro': [256, 512, 1024, 2048],
  'MacBook Air': [256, 512, 1024, 2048],
  'MacBook': [256, 512],
  'Mac mini': [256, 512, 1024, 2048],
  'Mac Pro': [512, 1024, 2048, 4096, 8192],
  'Mac Studio': [512, 1024, 2048, 4096, 8192],
  'iPhone': [64, 128, 256, 512, 1024],
  'iPhone 11': [64, 128, 256],
  'iPhone 12': [64, 128, 256, 512],
  'iPhone 13': [128, 256, 512, 1024],
  'iPhone 14': [128, 256, 512, 1024],
  'iPhone 15': [128, 256, 512, 1024],
  'iPhone 15 Pro': [256, 512, 1024],
  'iPhone 15 Pro Max': [256, 512, 1024],
  'iPhone 16': [128, 256, 512, 1024],
  'iPhone 16 Pro': [256, 512, 1024],
  'iPhone 16 Pro Max': [256, 512, 1024],
  'iPad': [64, 256, 512],
  'iPad Pro': [128, 256, 512, 1024, 2048],
  'iPad Air': [64, 256, 512],
  'iPad mini': [64, 256, 512],
}

// Función helper para formatear capacidades GB → texto legible
const formatCapacity = (gb: number): string => {
  if (gb >= 1024) {
    return `${gb / 1024} TB`
  }
  return `${gb} GB`
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`enhanced-tabpanel-${index}`}
      aria-labelledby={`enhanced-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

interface EnhancedLikewizePageProps {
  tareaId?: string
  onUpdateComplete?: (result: any) => void
}

export function EnhancedLikewizePage({
  tareaId,
  onUpdateComplete
}: EnhancedLikewizePageProps) {
  const [tabValue, setTabValue] = useState(0)
  const [showLegacyInterface, setShowLegacyInterface] = useState(false)
  const [isV3UpdateRunning, setIsV3UpdateRunning] = useState(false)
  const [currentV3TaskId, setCurrentV3TaskId] = useState<string | null>(null)

  // Estados para corrección manual de mapeos
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedItemForCorrection, setSelectedItemForCorrection] = useState<any>(null)

  // Estados para creación de dispositivos no encontrados
  const [createDeviceModalOpen, setCreateDeviceModalOpen] = useState(false)
  const [selectedUnmappedItem, setSelectedUnmappedItem] = useState<any>(null)
  const [editableDevice, setEditableDevice] = useState({
    modelo: '',
    marca: '',
    tipo: '',
    almacenamiento_gb: '',
    likewize_model_code: ''
  })

  // Función para limpiar el nombre del modelo manteniendo información técnica importante
  const cleanModelName = (rawName: string): string => {
    if (!rawName) return ''

    let cleaned = rawName

    // 1. Remover SOLO capacidad de almacenamiento (GB/TB/SSD/HDD)
    cleaned = cleaned.replace(/\s*\d+\s*(GB|TB)\s*(SSD|HDD)?/gi, '')

    // 2. Mejorar formato de cores: "8 Core CPU" → "8-Core CPU"
    cleaned = cleaned.replace(/(\d+)\s*Core\s+(CPU|GPU)/gi, '$1-Core $2')

    // 3. Simplificar modelo base manteniendo resto de info
    cleaned = cleaned.replace(/iMac\d+\s*\d+/gi, 'iMac')
    // MacBook Pro (varias variantes)
    cleaned = cleaned.replace(/MacBook\s*Pro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBookPro\d+\s*\d+/gi, 'MacBook Pro')
    cleaned = cleaned.replace(/MacBook\s*Pro\d+,\d+/gi, 'MacBook Pro')
    // MacBook Air
    cleaned = cleaned.replace(/MacBook\s*Air\d+\s*\d+/gi, 'MacBook Air')
    cleaned = cleaned.replace(/MacBookAir\d+\s*\d+/gi, 'MacBook Air')
    // iPhone
    cleaned = cleaned.replace(/iPhone\d+,\d+/gi, (match) => {
      const num = match.match(/\d+/)
      return num ? `iPhone ${num[0]}` : 'iPhone'
    })

    // 4. Convertir pulgadas: "24 inch" → "24\""
    cleaned = cleaned.replace(/(\d+)\s*inch/gi, '$1"')

    // 5. Extraer y formatear año: "10/2023" → "(2023)"
    const yearMatch = cleaned.match(/\b(\d{1,2}\/)?(\d{4})\b/)
    let year = ''
    if (yearMatch) {
      year = ` (${yearMatch[2]})`
      cleaned = cleaned.replace(/\b\d{1,2}\/\d{4}\b/, '')
    }

    // 6. Limpiar espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    // 7. Añadir año al final
    if (year) {
      cleaned += year
    }

    return cleaned
  }

  // Función para limpiar código Likewize (sin capacidad pero manteniendo info técnica)
  const cleanLikewizeCode = (rawCode: string): string => {
    if (!rawCode) return ''

    let cleaned = rawCode

    // Remover SOLO la capacidad de almacenamiento, mantener resto de info técnica
    cleaned = cleaned.replace(/\s*\d+\s*(GB|TB)\s*(SSD|HDD)?/gi, '')

    // Limpiar espacios múltiples
    cleaned = cleaned.replace(/\s+/g, ' ').trim()

    return cleaned
  }

  // Función para extraer tipo específico del dispositivo del nombre del modelo
  const extractDeviceType = (modelName: string): string => {
    if (!modelName) return ''

    const lower = modelName.toLowerCase()

    // Detectar tipos específicos de Mac (orden importante: específicos primero)
    if (lower.includes('imac')) return 'iMac'
    if (lower.includes('macbookpro') || lower.includes('macbook pro')) return 'MacBook Pro'
    if (lower.includes('macbookair') || lower.includes('macbook air')) return 'MacBook Air'
    if (lower.includes('macbook')) return 'MacBook'
    if (lower.includes('mac mini')) return 'Mac mini'
    if (lower.includes('mac pro')) return 'Mac Pro'
    if (lower.includes('mac studio')) return 'Mac Studio'

    // Detectar modelos de iPhone (intentar mantener número de modelo)
    if (lower.includes('iphone')) {
      // Extraer "iPhone 15 Pro Max", "iPhone 14", etc.
      const iphoneMatch = modelName.match(/iPhone\s+(\d+\s*)?(Pro\s*Max|Pro|Plus)?/i)
      if (iphoneMatch) {
        return iphoneMatch[0].trim()
      }
      return 'iPhone'
    }

    // Detectar iPad
    if (lower.includes('ipad pro')) return 'iPad Pro'
    if (lower.includes('ipad air')) return 'iPad Air'
    if (lower.includes('ipad mini')) return 'iPad mini'
    if (lower.includes('ipad')) return 'iPad'

    // Otros dispositivos Apple
    if (lower.includes('apple watch')) return 'Apple Watch'
    if (lower.includes('airpods')) return 'AirPods'

    // Fallback genérico
    if (lower.includes('mac')) return 'Mac'

    return ''
  }

  const {
    useMappingStatistics,
    useMappingsForReview,
    useAlgorithmComparison,
    getMappingConfidence
  } = useDeviceMappingEnhanced()

  // V3 Learning System Integration
  const { data: learningMetrics, refetch: refetchLearningMetrics } = useLearningMetrics()
  const { mutate: launchV3Update, isPending: isLaunchingV3 } = useLaunchV3UpdateTask()
  const { data: realTimeMetrics } = useRealTimeLearningMetrics(isV3UpdateRunning)

  // V3 Task Monitoring
  const { data: activeTasks } = useActiveV3Tasks()
  const taskMonitoring = useTaskMonitoring(currentV3TaskId || '', !!currentV3TaskId)

  // Query real diff data - prioritize V3 task if available
  const activeTaskId = currentV3TaskId || tareaId
  const isV3Task = !!currentV3TaskId

  const diff = useQuery({
    queryKey: ['likewize_diff', activeTaskId, isV3Task ? 'v3' : 'v1'],
    queryFn: async () => {
      if (!activeTaskId) return null

      // Use V3 endpoint for V3 tasks, regular endpoint for V1/V2 tasks
      const endpoint = isV3Task
        ? `/api/likewize/v3/tareas/${activeTaskId}/diff/`
        : `/api/precios/likewize/tareas/${activeTaskId}/diff/`

      console.log('🔍 [EnhancedLikewize] Fetching diff:', { activeTaskId, isV3Task, endpoint })
      const { data } = await api.get(endpoint)
      console.log('📊 [EnhancedLikewize] Diff data received:', {
        summary: data.summary,
        resumen: data.resumen,
        changesLength: data.changes?.length,
        comparacionesLength: data.comparaciones?.length,
        isV3: data.is_v3
      })
      return data as DiffData
    },
    enabled: !!activeTaskId,
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000,
  })

  // Task status query - use active task
  const estado = useQuery({
    queryKey: ['likewize_tarea', activeTaskId, isV3Task ? 'v3' : 'v1'],
    queryFn: async () => {
      if (!activeTaskId) return null

      // Use V3 monitoring endpoint for V3 tasks
      const endpoint = isV3Task
        ? `/api/likewize/v3/tareas/${activeTaskId}/estado/`
        : `/api/precios/likewize/tareas/${activeTaskId}/`

      const { data } = await api.get(endpoint)

      // Normalize response format
      if (isV3Task && data?.task) {
        return {
          estado: data.task.estado,
          error_message: data.task.error_message
        }
      }

      return data as { estado: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR', error_message?: string }
    },
    enabled: !!activeTaskId,
    refetchInterval: (q) => {
      const s = q.state.data?.estado
      return s && (s === 'SUCCESS' || s === 'ERROR') ? false : 1500
    },
  })

  const { data: statistics, refetch: refetchStatistics } = useMappingStatistics()
  const { data: reviewMappings } = useMappingsForReview({ limit: 100 })
  const { data: algorithmComparison } = useAlgorithmComparison()

  // State for selecting individual changes to apply
  const [selectedChanges, setSelectedChanges] = React.useState<Set<string>>(new Set())

  // Query para items no mapeados
  const unmappedItems = useQuery({
    queryKey: ['unmapped_items', activeTaskId],
    queryFn: async () => {
      if (!activeTaskId) return null
      const { data } = await api.get(`/api/likewize/v3/tareas/${activeTaskId}/no-mapeados/`)
      return data
    },
    enabled: !!activeTaskId && estado.data?.estado === 'SUCCESS',
    staleTime: 30_000
  })

  // Query historical tasks for reusing previous staging data
  const [mostrarHistorial, setMostrarHistorial] = React.useState(false)
  const tareasHistoricas = useQuery({
    queryKey: ['likewize_tareas_historicas'],
    queryFn: async () => {
      const { data } = await api.get('/api/precios/likewize/tareas/', { params: { limit: 20 } })
      return data as {
        tareas: Array<{
          tarea_id: string
          finalizado_en: string
          meta: Record<string, unknown>
          staging_count: number
          mapped_count: number
        }>
        total: number
      }
    },
    staleTime: 60_000, // Cache for 1 minute
  })

  // Mutation for remapping historical tasks
  const remapearTarea = useMutation({
    mutationFn: async (tareaId: string) => {
      const { data } = await api.post(`/api/precios/likewize/tareas/${tareaId}/remapear/`)
      return data
    },
    onSuccess: (data, tareaId) => {
      // Refetch historical tasks to update counts
      tareasHistoricas.refetch()
      // If this is the active task, refetch diff and estado
      if (tareaId === activeTaskId) {
        diff.refetch()
        estado.refetch()
      }
    }
  })

  // Mutation for applying V3 changes
  const queryClient = useQueryClient()
  const aplicarCambiosV3 = useMutation({
    mutationFn: async (params: {
      tarea_id: string
      aplicar_inserciones?: boolean
      aplicar_actualizaciones?: boolean
      aplicar_eliminaciones?: boolean
      confidence_threshold?: number
      staging_item_ids?: string[]
    }) => {
      const { data } = await api.post(`/api/likewize/v3/tareas/${params.tarea_id}/aplicar/`, {
        aplicar_inserciones: params.aplicar_inserciones ?? true,
        aplicar_actualizaciones: params.aplicar_actualizaciones ?? true,
        aplicar_eliminaciones: params.aplicar_eliminaciones ?? false,
        confidence_threshold: params.confidence_threshold ?? 0.7,
        staging_item_ids: params.staging_item_ids
      })
      return data
    },
    onSuccess: () => {
      // Invalidate relevant queries after applying changes
      queryClient.invalidateQueries({ queryKey: ['likewize_diff'] })
      queryClient.invalidateQueries({ queryKey: ['likewize_tarea'] })
      refetchStatistics()
      // Reset selections after applying changes
      setSelectedChanges(new Set())
    }
  })

  // Mutation para aplicar corrección manual
  const applyManualCorrectionMutation = useMutation({
    mutationFn: async (params: {
      tarea_id: string
      staging_item_id: string
      new_capacidad_id: number
      reason: string
    }) => {
      const { data } = await api.post('/api/device-mapping/v2/manual-correction/', params)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['likewize_diff'] })
      setSearchModalOpen(false)
      setSearchQuery('')
      setSearchResults([])
      setSelectedItemForCorrection(null)
    }
  })

  // Función para buscar capacidades
  const handleSearchCapacidades = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const { data } = await api.get('/api/admin/capacidades/', {
        params: { q: query, limit: 10 }
      })
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Error buscando capacidades:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  // Abrir modal de búsqueda
  const handleOpenSearchModal = (item: any) => {
    setSelectedItemForCorrection(item)
    setSearchQuery(item.likewize_info?.modelo_norm || '')
    setSearchModalOpen(true)
    handleSearchCapacidades(item.likewize_info?.modelo_norm || '')
  }

  // Aplicar corrección manual
  const handleApplyCorrection = (capacidad: any) => {
    if (!selectedItemForCorrection || !activeTaskId) return

    if (!selectedItemForCorrection.staging_item_id) {
      console.error('staging_item_id no disponible en el item:', selectedItemForCorrection)
      return
    }

    applyManualCorrectionMutation.mutate({
      tarea_id: activeTaskId,
      staging_item_id: selectedItemForCorrection.staging_item_id,
      new_capacidad_id: capacidad.id,
      reason: `Corrección manual: ${selectedItemForCorrection.likewize_info?.modelo_norm} → ${capacidad.modelo?.descripcion}`
    })
  }

  // Mutation para crear modelo+capacidad desde item no mapeado
  const createFromUnmappedMutation = useMutation({
    mutationFn: async (params: {
      staging_id: number
      tipo?: string
      marca?: string
      modelo?: string
      almacenamiento_gb?: number
      likewize_model_code?: string
    }) => {
      const { data } = await api.post(`/api/precios/likewize/tareas/${activeTaskId}/crear-capacidad/`, params)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unmapped_items'] })
      queryClient.invalidateQueries({ queryKey: ['likewize_diff'] })
      queryClient.invalidateQueries({ queryKey: ['likewize_tarea'] })
      setCreateDeviceModalOpen(false)
      setSelectedUnmappedItem(null)

      // Mostrar mensaje de éxito con auto-mapeo
      if (data.auto_mapped_count > 0) {
        alert(`✅ Modelo creado con éxito!\n\n📦 Capacidades creadas automáticamente\n🔗 ${data.auto_mapped_count} items adicionales mapeados automáticamente`)
      } else {
        alert('✅ Modelo y capacidades creados con éxito!')
      }
    }
  })

  // Abrir modal de creación
  const handleOpenCreateModal = (item: any) => {
    setSelectedUnmappedItem(item)

    // Inicializar campos editables con valores limpios
    const modelName = item.modelo_norm || item.modelo_raw || ''

    setEditableDevice({
      modelo: cleanModelName(modelName),
      marca: item.marca || 'Apple',
      tipo: extractDeviceType(modelName) || item.tipo || 'Mac', // Extraer tipo específico del nombre
      almacenamiento_gb: String(item.almacenamiento_gb || ''),
      likewize_model_code: cleanLikewizeCode(item.modelo_raw || item.likewize_model_code || '') // Priorizar modelo_raw sobre likewize_model_code
    })

    setCreateDeviceModalOpen(true)
  }

  // Crear dispositivo desde no mapeado
  const handleCreateDevice = () => {
    if (!selectedUnmappedItem) return

    createFromUnmappedMutation.mutate({
      staging_id: selectedUnmappedItem.id,
      tipo: editableDevice.tipo,
      marca: editableDevice.marca,
      modelo: editableDevice.modelo,
      almacenamiento_gb: parseInt(editableDevice.almacenamiento_gb) || selectedUnmappedItem.almacenamiento_gb,
      likewize_model_code: editableDevice.likewize_model_code
    })
  }

  const systemNeedsAttention = useMemo(() => {
    if (!statistics) return false

    const total = statistics.total_mappings ?? 0
    const high = statistics.quality_distribution?.high ?? 0
    const medium = statistics.quality_distribution?.medium ?? 0
    const successRate = total ? (high + medium) / total : 1

    return successRate < 0.8 || (statistics.needs_review ?? 0) > 50
  }, [statistics])

  const totalMappings = statistics?.total_mappings ?? 0
  const highConfidence = statistics?.quality_distribution?.high ?? 0
  const mediumConfidence = statistics?.quality_distribution?.medium ?? 0
  const lowConfidence = statistics?.quality_distribution?.low ?? 0
  const successRate = totalMappings ? (highConfidence + mediumConfidence) / totalMappings : 1
  const avgConfidence = statistics?.avg_confidence ?? 0
  const needsReview = statistics?.needs_review ?? 0
  const algorithmsBreakdown = useMemo(() => {
    if (!statistics?.by_algorithm) return [] as Array<{
      name: string
      count: number
      details?: { total_mappings: number; avg_confidence: number; high_confidence_count: number; needs_review_count: number; avg_processing_time: number } | undefined
    }>

    return Object.entries(statistics.by_algorithm)
      .map(([name, count]) => ({
        name,
        count,
        details: algorithmComparison?.[name]
      }))
      .sort((a, b) => b.count - a.count)
  }, [statistics?.by_algorithm, algorithmComparison])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleUpdateComplete = (result: any) => {
    refetchStatistics()
    refetchLearningMetrics()
    onUpdateComplete?.(result)
  }

  const handleLaunchV3Update = () => {
    setIsV3UpdateRunning(true)
    launchV3Update({
      enable_learning: true,
      confidence_threshold: 0.7,
      parallel_requests: 5
    }, {
      onSuccess: (result) => {
        console.log('V3 Update Success:', result)
        if (result?.tarea_id) {
          setCurrentV3TaskId(result.tarea_id)
        }
        handleUpdateComplete(result)
        // Keep V3 running state until task completes
      },
      onError: (error) => {
        console.error('V3 Update Error:', error)
        setIsV3UpdateRunning(false)
        setCurrentV3TaskId(null)
        // Show error message to user
        alert(`Error en actualización V3: ${error?.message || error?.toString() || 'Error desconocido'}`)
      }
    })
  }

  // Update V3 running state and refresh data when task completes
  const [hasAutoSwitched, setHasAutoSwitched] = React.useState(false)

  React.useEffect(() => {
    if (taskMonitoring.isCompleted || taskMonitoring.hasError) {
      setIsV3UpdateRunning(false)

      // Auto-refresh diff data when V3 completes (only once)
      if (taskMonitoring.isCompleted && currentV3TaskId && !hasAutoSwitched) {
        // Invalidate and refetch diff data
        diff.refetch()
        estado.refetch()

        // Also refresh learning metrics
        refetchLearningMetrics()

        // Switch to "Cambios de Precios" tab to show results (only once)
        setTimeout(() => {
          setTabValue(1) // Switch to tab index 1 (Cambios de Precios)
          setHasAutoSwitched(true) // Prevent future auto-switches
        }, 1000)
      }
    }
  }, [taskMonitoring.isCompleted, taskMonitoring.hasError, currentV3TaskId, hasAutoSwitched])

  // Reset auto-switch flag when starting new V3 task
  React.useEffect(() => {
    if (isLaunchingV3) {
      setHasAutoSwitched(false)
    }
  }, [isLaunchingV3])

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header with V3 Features */}
        <Card variant="outlined">
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AutoAwesome color="primary" />
                Actualización Inteligente V3
                <Chip
                  label="AUTOAPRENDIZAJE"
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>
            }
            subheader="Sistema de inteligencia artificial con autoaprendizaje para actualización automática de precios"
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Psychology />}
                  onClick={handleLaunchV3Update}
                  disabled={isLaunchingV3 || isV3UpdateRunning}
                >
                  {isLaunchingV3 || isV3UpdateRunning ? 'Actualizando...' : 'Actualizar Precios V3'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowLegacyInterface(!showLegacyInterface)}
                >
                  {showLegacyInterface ? 'Interface V3' : 'Interface V2'}
                </Button>
              </Stack>
            }
          />

          {/* V3 Status Indicators */}
          {learningMetrics && (
            <Box sx={{ px: 3, pb: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.50' }}>
                    <Psychology color="primary" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.knowledge_base_metrics?.total_entries || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Entradas Aprendidas
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.50' }}>
                    <TrendingUp color="success" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {Math.round((learningMetrics.knowledge_base_metrics?.avg_confidence || 0) * 100)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Confianza Promedio
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}>
                    <Speed color="warning" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.system_health?.score || 0}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Salud del Sistema
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50' }}>
                    <AutoAwesome color="info" sx={{ fontSize: 24, mb: 1 }} />
                    <Typography variant="h6" fontWeight="bold">
                      {learningMetrics.knowledge_base_metrics?.user_validated_entries || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Validaciones Usuario
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* System Health Alert */}
              {learningMetrics.system_health && (
                <Box sx={{ mt: 2 }}>
                  <ConfidenceIndicator
                    confidence={learningMetrics.system_health.score / 100}
                    variant="detailed"
                    size="large"
                  />
                </Box>
              )}
            </Box>
          )}
        </Card>

        {/* Historical Tasks Selector */}
        <Card variant="outlined">
          <CardHeader
            title="📚 Historial de Tareas"
            subheader="Reutiliza staging de actualizaciones anteriores sin consultar la API externa"
            action={
              <Button
                variant="outlined"
                size="small"
                onClick={() => setMostrarHistorial(!mostrarHistorial)}
                disabled={tareasHistoricas.isLoading}
              >
                {mostrarHistorial ? 'Ocultar' : 'Ver historial'}
              </Button>
            }
          />
          <Collapse in={mostrarHistorial}>
            <CardContent>
              {tareasHistoricas.isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {tareasHistoricas.data && tareasHistoricas.data.tareas.length > 0 && (
                <Stack spacing={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {tareasHistoricas.data.tareas.map((tarea) => {
                    const fecha = new Date(tarea.finalizado_en)
                    const isSelected = activeTaskId === tarea.tarea_id

                    return (
                      <Paper
                        key={tarea.tarea_id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          borderWidth: isSelected ? 2 : 1,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => {
                          setCurrentV3TaskId(tarea.tarea_id)
                          setMostrarHistorial(false)
                          // Refetch diff and estado with new task
                          diff.refetch()
                          estado.refetch()
                        }}
                      >
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" fontWeight={600}>
                              {fecha.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                            {isSelected && (
                              <Chip size="small" label="Actual" color="primary" variant="filled" />
                            )}
                          </Stack>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              size="small"
                              label={`${tarea.mapped_count} mapeados`}
                              variant="outlined"
                              color="success"
                            />
                            <Chip
                              size="small"
                              label={`${tarea.staging_count - tarea.mapped_count} sin mapear`}
                              variant="outlined"
                            />
                            {(tarea.staging_count - tarea.mapped_count) > 0 && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation() // Prevenir selección de tarea
                                  remapearTarea.mutate(tarea.tarea_id)
                                }}
                                disabled={remapearTarea.isPending}
                                sx={{ minWidth: 'auto', px: 1 }}
                              >
                                {remapearTarea.isPending ? 'Remapeando...' : 'Remapear'}
                              </Button>
                            )}
                            {tarea.meta?.mode && typeof tarea.meta.mode === 'string' ? (
                              <Chip
                                size="small"
                                label={tarea.meta.mode === 'apple' ? '🍎 Apple' : '🔧 Otros'}
                                variant="outlined"
                              />
                            ) : null}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            ID: {tarea.tarea_id.substring(0, 8)}...
                          </Typography>
                        </Stack>
                      </Paper>
                    )
                  })}
                </Stack>
              )}
              {tareasHistoricas.data && tareasHistoricas.data.tareas.length === 0 && (
                <Alert severity="info">No hay tareas anteriores disponibles</Alert>
              )}
            </CardContent>
          </Collapse>
        </Card>

        {/* V3 Task Monitoring */}
        {(currentV3TaskId || isV3UpdateRunning) && (
          <Card variant="outlined">
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Psychology color="primary" />
                  <Typography variant="h6">Monitor de Proceso V3</Typography>
                  <Chip
                    label={taskMonitoring.isRunning ? 'EJECUTANDO' : taskMonitoring.isCompleted ? 'COMPLETADO' : taskMonitoring.hasError ? 'ERROR' : 'INICIANDO'}
                    color={taskMonitoring.isRunning ? 'warning' : taskMonitoring.isCompleted ? 'success' : taskMonitoring.hasError ? 'error' : 'info'}
                    size="small"
                  />
                </Stack>
              }
              subheader={currentV3TaskId ? `Tarea ID: ${currentV3TaskId}` : 'Iniciando proceso...'}
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => taskMonitoring.refetchAll()}
                  disabled={!currentV3TaskId}
                >
                  Actualizar
                </Button>
              }
            />
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                {/* Task Status Info */}
                {taskMonitoring.status.data?.task && (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography variant="caption" color="text.secondary">Estado</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {taskMonitoring.status.data.task.estado}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography variant="caption" color="text.secondary">Iniciado</Typography>
                      <Typography variant="body2">
                        {taskMonitoring.status.data.task.iniciado_en
                          ? new Date(taskMonitoring.status.data.task.iniciado_en).toLocaleTimeString()
                          : 'N/A'
                        }
                      </Typography>
                    </Grid>
                    {taskMonitoring.status.data.task.is_v3 && (
                      <>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Typography variant="caption" color="text.secondary">Aprendizaje</Typography>
                          <Typography variant="body2">
                            {taskMonitoring.status.data.task.v3_params?.enable_learning ? 'Activado' : 'Desactivado'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Typography variant="caption" color="text.secondary">Umbral Confianza</Typography>
                          <Typography variant="body2">
                            {(taskMonitoring.status.data.task.v3_params?.confidence_threshold * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                )}

                {/* Progress Indicator */}
                {taskMonitoring.isRunning && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Procesando con autoaprendizaje V3...
                    </Typography>
                    <LinearProgress />
                  </Box>
                )}

                {/* Error Display */}
                {taskMonitoring.hasError && (
                  <Alert severity="error">
                    <Typography variant="body2">
                      Error: {taskMonitoring.errorMessage || 'Error desconocido en el proceso'}
                    </Typography>
                  </Alert>
                )}

                {/* Recent Logs */}
                {taskMonitoring.logs.data?.log_lines && taskMonitoring.logs.data.log_lines.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Logs Recientes ({taskMonitoring.logs.data.log_stats?.returned_lines || 0} líneas)
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        maxHeight: 200,
                        overflow: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        bgcolor: 'grey.50',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {taskMonitoring.logs.data.log_lines.slice(-10).map((line: string, index: number) => (
                        <div key={index} style={{ marginBottom: '2px' }}>
                          {line}
                        </div>
                      ))}
                    </Paper>
                    {taskMonitoring.logs.data.log_stats && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Total: {taskMonitoring.logs.data.log_stats.total_lines} líneas,
                        Tamaño: {(taskMonitoring.logs.data.log_stats.current_size_bytes / 1024).toFixed(1)} KB
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Completion Status */}
                {taskMonitoring.isCompleted && (
                  <Alert severity="success">
                    <Typography variant="body2">
                      ✅ Proceso V3 completado exitosamente
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </Box>
          </Card>
        )}

        {/* Active Tasks Summary */}
        {activeTasks?.tasks && activeTasks.tasks.length > 0 && !currentV3TaskId && (
          <Alert severity="info" variant="outlined">
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight="bold">
                Tareas V3 Activas: {activeTasks.active_tasks_count}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {activeTasks.tasks.slice(0, 3).map((task: any) => (
                  <Chip
                    key={task.tarea_id}
                    label={`${task.estado} (${Math.round(task.duracion_minutos || 0)}min)`}
                    size="small"
                    variant="outlined"
                    onClick={() => setCurrentV3TaskId(task.tarea_id)}
                    clickable
                  />
                ))}
              </Stack>
            </Stack>
          </Alert>
        )}

        {/* System Status Alert */}
        {statistics && systemNeedsAttention && (
          <Alert severity="warning">
            <Stack spacing={1}>
              <Box>
                <strong>El sistema necesita atención:</strong>
              </Box>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <span>Tasa de éxito actual: {(successRate * 100).toFixed(1)}%</span>
                <span>Mappings en revisión: {needsReview}</span>
                {avgConfidence < 70 && (
                  <span>Confianza promedio baja ({avgConfidence.toFixed(1)})</span>
                )}
              </Stack>
            </Stack>
          </Alert>
        )}

        {/* Legacy Interface Toggle */}
        {showLegacyInterface ? (
          <Card variant="outlined">
            <CardHeader title="Interface Clásica" />
            {/* Here you would include the original LikewizeB2BPage component */}
            <Alert severity="info">
              Interface clásica habilitada. Cambia a "Interface Mejorada" para acceder
              a las nuevas funcionalidades de actualización inteligente de precios.
            </Alert>
          </Card>
        ) : (
          <>
            {/* Enhanced Interface */}
            <Card variant="outlined">
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="enhanced likewize tabs"
                sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Actualización V3" />
                <Tab label="Validación" icon={<Psychology fontSize="small" />} iconPosition="start" />
                <Tab label="Cambios de Precios" />
                <Tab label="No Encontrados" />
                <Tab label="Revisión Manual" />
                <Tab label="Estrategias de Mapeo" />
                <Tab label="Métricas y Monitoreo" />
                <Tab label="Análisis de Calidad" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <IncrementalUpdateControls
                  tareaId={tareaId}
                  onUpdate={handleUpdateComplete}
                />
              </TabPanel>

              {/* Nueva Tab de Validación */}
              <TabPanel value={tabValue} index={1}>
                <ValidationTabPanel tareaId={activeTaskId} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <Stack spacing={3}>
                  {/* Task Source Indicator & Switcher - Cambios de Precios */}
                  {activeTaskId && (
                    <Card variant="outlined">
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {currentV3TaskId ? '🤖 Resultados de V3 (Autoaprendizaje)' : '📊 Resultados de V2 (Tradicional)'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Tarea ID: {activeTaskId}
                                {currentV3TaskId && taskMonitoring.isCompleted && ' • Completado con IA'}
                              </Typography>
                            </Box>

                            {/* Task Switcher */}
                            <Stack direction="row" spacing={1}>
                              {tareaId && currentV3TaskId && (
                                <>
                                  <Button
                                    size="small"
                                    variant={!currentV3TaskId ? "contained" : "outlined"}
                                    onClick={() => setCurrentV3TaskId(null)}
                                    startIcon={<Psychology />}
                                  >
                                    Ver V2
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={currentV3TaskId ? "contained" : "outlined"}
                                    onClick={() => setCurrentV3TaskId(currentV3TaskId)}
                                    startIcon={<AutoAwesome />}
                                    color="primary"
                                  >
                                    Ver V3
                                  </Button>
                                </>
                              )}

                              {/* Refresh Button */}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  diff.refetch()
                                  estado.refetch()
                                }}
                                disabled={diff.isLoading}
                              >
                                {diff.isLoading ? 'Cargando...' : 'Actualizar'}
                              </Button>
                            </Stack>
                          </Stack>

                          {/* Status Indicators */}
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              size="small"
                              label={currentV3TaskId ? "V3 Autoaprendizaje" : "V2 Tradicional"}
                              color={currentV3TaskId ? "success" : "default"}
                              variant="outlined"
                            />
                            {estado.data?.estado && (
                              <Chip
                                size="small"
                                label={estado.data.estado}
                                color={
                                  estado.data.estado === 'SUCCESS' ? 'success' :
                                  estado.data.estado === 'ERROR' ? 'error' :
                                  estado.data.estado === 'RUNNING' ? 'warning' : 'default'
                                }
                              />
                            )}
                            {diff.data?.summary && (
                              <Chip
                                size="small"
                                label={`${diff.data.summary.total} cambios`}
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    </Card>
                  )}

                  {!activeTaskId && (
                    <Alert severity="info">
                      Ejecuta una actualización desde la pestaña "Actualización V3" o "Actualización Inteligente" para ver los cambios de precios.
                    </Alert>
                  )}

                  {/* V3 Model Comparison & Apply Controls */}
                  {isV3Task && diff.data?.is_v3 && (
                    <Card variant="outlined">
                      <CardHeader
                        title={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoAwesome color="primary" />
                            Comparación V3: Modelos Externos vs BD
                          </Box>
                        }
                        subheader={`${diff.data.resumen?.total_comparaciones || 0} comparaciones realizadas por IA`}
                      />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={3}>
                          {/* V3 Statistics */}
                          {diff.data.v3_stats && (
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>Confianza del Mapeo</Typography>
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Promedio:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {((diff.data.v3_stats.confidence_stats?.promedio || 0) * 100).toFixed(1)}%
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Alta confianza (≥90%):</Typography>
                                      <Typography variant="body2" color="success.main">
                                        {diff.data.v3_stats.confidence_stats?.alta_confianza || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Media confianza (70-90%):</Typography>
                                      <Typography variant="body2" color="warning.main">
                                        {diff.data.v3_stats.confidence_stats?.media_confianza || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Baja confianza (&lt;70%):</Typography>
                                      <Typography variant="body2" color="error.main">
                                        {diff.data.v3_stats.confidence_stats?.baja_confianza || 0}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Paper sx={{ p: 2 }}>
                                  <Typography variant="subtitle2" gutterBottom>Resumen de Cambios</Typography>
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="success.main">Nuevos precios:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.inserciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="info.main">Actualizaciones:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.actualizaciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2" color="error.main">Eliminaciones:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        {diff.data.resumen?.eliminaciones || 0}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <Typography variant="body2">Sin cambios:</Typography>
                                      <Typography variant="body2">
                                        {diff.data.resumen?.sin_cambios || 0}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              </Grid>
                            </Grid>
                          )}

                          {/* Message when no changes found */}
                          {diff.data && (diff.data.summary?.total === 0 || diff.data.resumen?.total_comparaciones === 0) && (
                            <Alert severity="info">
                              <Typography variant="body2" fontWeight={600} gutterBottom>
                                📊 No se encontraron cambios de precios
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Nuevos precios: {diff.data.summary?.inserts || diff.data.resumen?.inserciones || 0}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Actualizaciones: {diff.data.summary?.updates || diff.data.resumen?.actualizaciones || 0}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Eliminaciones: {diff.data.summary?.deletes || diff.data.resumen?.eliminaciones || 0}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Esto puede ocurrir si: (1) Los precios son iguales a los actuales, (2) No hay dispositivos mapeados en staging, (3) El scraping no obtuvo datos de la API externa
                              </Typography>
                            </Alert>
                          )}

                          {/* Debug info in development */}
                          {process.env.NODE_ENV === 'development' && diff.data && (
                            <Alert severity="info">
                              <Typography variant="caption" component="div" fontWeight={600}>
                                🔧 Debug Info (solo en desarrollo):
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Tarea ID: {activeTaskId}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Es V3: {isV3Task ? 'Sí' : 'No'}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Total cambios (summary): {diff.data.summary?.total || 0}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Total comparaciones (resumen): {diff.data.resumen?.total_comparaciones || 0}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Changes array length: {diff.data.changes?.length || 0}
                              </Typography>
                              <Typography variant="caption" component="div">
                                • Comparaciones array length: {diff.data.comparaciones?.length || 0}
                              </Typography>
                            </Alert>
                          )}

                          {/* Apply Changes Controls */}
                          {estado.data?.estado === 'SUCCESS' && (
                            <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                              <Box sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                  <Typography variant="subtitle1" fontWeight="bold">
                                    ✅ Cambios listos para aplicar
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Los precios han sido procesados por V3. Puedes aplicar los cambios con confianza alta.
                                  </Typography>
                                  <Stack direction="row" spacing={2} alignItems="center">
                                    <Typography variant="caption" color="text.secondary">
                                      {selectedChanges.size > 0 ? `${selectedChanges.size} seleccionados` : 'Selecciona cambios para aplicar'}
                                    </Typography>
                                    <Button
                                      variant="contained"
                                      color="primary"
                                      onClick={() => {
                                        if (activeTaskId) {
                                          aplicarCambiosV3.mutate({
                                            tarea_id: activeTaskId,
                                            aplicar_inserciones: true,
                                            aplicar_actualizaciones: true,
                                            aplicar_eliminaciones: false,
                                            confidence_threshold: 0.7,
                                            staging_item_ids: selectedChanges.size > 0 ? Array.from(selectedChanges) : undefined
                                          })
                                        }
                                      }}
                                      disabled={aplicarCambiosV3.isPending || selectedChanges.size === 0}
                                      startIcon={<AutoAwesome />}
                                    >
                                      {aplicarCambiosV3.isPending ? 'Aplicando...' : `Aplicar Seleccionados (${selectedChanges.size})`}
                                    </Button>
                                    <Button
                                      variant="outlined"
                                      onClick={() => {
                                        if (activeTaskId && diff.data) {
                                          const allIds = new Set(diff.data.changes.map(c => c.id))
                                          setSelectedChanges(allIds)
                                          aplicarCambiosV3.mutate({
                                            tarea_id: activeTaskId,
                                            aplicar_inserciones: true,
                                            aplicar_actualizaciones: true,
                                            aplicar_eliminaciones: true,
                                            confidence_threshold: 0.8
                                          })
                                        }
                                      }}
                                      disabled={aplicarCambiosV3.isPending}
                                    >
                                      Aplicar Todo (incluir eliminaciones)
                                    </Button>
                                  </Stack>
                                  {aplicarCambiosV3.isSuccess && (
                                    <Alert severity="success">
                                      ✅ Cambios aplicados exitosamente. Los precios han sido actualizados en la base de datos.
                                    </Alert>
                                  )}
                                  {aplicarCambiosV3.isError && (
                                    <Alert severity="error">
                                      ❌ Error aplicando cambios: {aplicarCambiosV3.error?.message}
                                    </Alert>
                                  )}
                                </Stack>
                              </Box>
                            </Card>
                          )}

                          {/* Detailed V3 Comparisons Table */}
                          {diff.data.comparaciones && diff.data.comparaciones.length > 0 && (
                            <Card variant="outlined">
                              <CardHeader
                                title="Comparación Detallada de Modelos"
                                subheader={`${selectedChanges.size > 0 ? `${selectedChanges.size} seleccionados - ` : ''}Mapeo entre modelos externos y base de datos interna`}
                              />
                              <Box sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                  {diff.data.comparaciones.slice(0, 50).map((comp: any, index: number) => {
                                    // Extract capacity from normalized name for display
                                    const modeloNorm = comp.likewize_info?.modelo_norm || ''
                                    const capacityMatch = modeloNorm.match(/(\d+)\s*(GB|TB)/i)
                                    const extractedCapacity = capacityMatch ? `${capacityMatch[1]} ${capacityMatch[2].toUpperCase()}` : null

                                    // Detectar mapeo sospechoso (modelos diferentes)
                                    const detectSuspiciousMapping = (externo: string, bd: string): boolean => {
                                      if (!externo || !bd || bd === 'Información no disponible') return false

                                      // Limpiar nombres: quitar capacidad, "Apple", espacios extras
                                      const clean = (s: string) => s
                                        .replace(/\s*\d+\s*(GB|TB)\s*/gi, '')  // Quitar capacidad
                                        .replace(/\bapple\b/gi, '')            // Quitar "Apple"
                                        .replace(/\s+/g, ' ')                  // Normalizar espacios
                                        .trim()
                                        .toLowerCase()

                                      const cleanExterno = clean(externo)
                                      const cleanBD = clean(bd)

                                      // Comparar - si son diferentes, es sospechoso
                                      return cleanExterno !== cleanBD && cleanBD.length > 0
                                    }

                                    const isSuspicious = detectSuspiciousMapping(
                                      modeloNorm,
                                      comp.bd_info?.modelo_descripcion || ''
                                    )

                                    // Generar ID único para selección (usa staging_item_id si existe, sino usa capacidad_id + index)
                                    const itemId = comp.staging_item_id || `cap-${comp.capacidad_id}-${index}`
                                    const isSelected = selectedChanges.has(itemId)

                                    return (
                                      <Paper
                                        key={itemId}
                                        variant="outlined"
                                        sx={{
                                          p: 2,
                                          borderLeft: 4,
                                          borderLeftColor: isSuspicious
                                            ? 'warning.main'
                                            : comp.change_type === 'INSERT' ? 'success.main'
                                            : comp.change_type === 'UPDATE' ? 'info.main'
                                            : comp.change_type === 'DELETE' ? 'error.main'
                                            : 'grey.300',
                                          bgcolor: isSelected
                                            ? isSuspicious ? 'rgba(255, 152, 0, 0.08)' : 'action.selected'
                                            : 'background.paper'
                                        }}
                                      >
                                        <Grid container spacing={2}>
                                          {/* Checkbox column */}
                                          <Grid size={{ xs: 12, md: 0.5 }}>
                                            <Stack spacing={1} alignItems="center">
                                              <Checkbox
                                                checked={isSelected}
                                                size="small"
                                                onChange={(e) => {
                                                  const newSelected = new Set(selectedChanges)
                                                  if (e.target.checked) {
                                                    newSelected.add(itemId)
                                                  } else {
                                                    newSelected.delete(itemId)
                                                  }
                                                  setSelectedChanges(newSelected)
                                                }}
                                              />

                                              {isSuspicious && (
                                                <>
                                                  <Tooltip title="Modelos diferentes - verificar mapeo">
                                                    <Warning color="warning" fontSize="small" />
                                                  </Tooltip>
                                                  <Tooltip title="Rechazar este mapeo">
                                                    <IconButton
                                                      size="small"
                                                      color="error"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        const newSelected = new Set(selectedChanges)
                                                        newSelected.delete(itemId)
                                                        setSelectedChanges(newSelected)
                                                      }}
                                                    >
                                                      <Close fontSize="small" />
                                                    </IconButton>
                                                  </Tooltip>
                                                  <Tooltip title="Buscar modelo correcto">
                                                    <IconButton
                                                      size="small"
                                                      color="primary"
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleOpenSearchModal(comp)
                                                      }}
                                                    >
                                                      <Search fontSize="small" />
                                                    </IconButton>
                                                  </Tooltip>
                                                </>
                                              )}
                                            </Stack>
                                          </Grid>

                                          {/* External Model Info */}
                                          <Grid size={{ xs: 12, md: 4.5 }}>
                                            <Stack spacing={1}>
                                              <Typography variant="subtitle2" color="primary">
                                                📦 Modelo Externo (Proveedor)
                                              </Typography>
                                              <Box>
                                                <Typography variant="body2">
                                                  <strong>Normalizado:</strong> {comp.likewize_info?.modelo_norm || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2">
                                                  <strong>Marca:</strong> {comp.likewize_info?.marca || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2">
                                                  <strong>Almacenamiento:</strong> {
                                                    extractedCapacity ||
                                                    (comp.likewize_info?.almacenamiento_gb ? `${comp.likewize_info.almacenamiento_gb} GB` : 'N/A')
                                                  }
                                                </Typography>
                                              </Box>
                                            </Stack>
                                          </Grid>

                                          {/* Mapping Arrow & Confidence */}
                                          <Grid size={{ xs: 12, md: 2 }}>
                                            <Stack spacing={1} alignItems="center" sx={{ height: '100%', justifyContent: 'center' }}>
                                              <Typography variant="h6">→</Typography>
                                              {comp.v3_metrics?.confidence_score && (
                                                <Chip
                                                  size="small"
                                                  label={`${(comp.v3_metrics.confidence_score * 100).toFixed(0)}%`}
                                                  color={
                                                    comp.v3_metrics.confidence_score >= 0.9 ? 'success' :
                                                    comp.v3_metrics.confidence_score >= 0.7 ? 'warning' : 'error'
                                                  }
                                                />
                                              )}
                                              <Chip
                                                size="small"
                                                label={comp.change_type}
                                                color={
                                                  comp.change_type === 'INSERT' ? 'success' :
                                                  comp.change_type === 'UPDATE' ? 'info' :
                                                  comp.change_type === 'DELETE' ? 'error' : 'default'
                                                }
                                                variant="outlined"
                                              />
                                            </Stack>
                                          </Grid>

                                          {/* Internal Model Info */}
                                          <Grid size={{ xs: 12, md: 5 }}>
                                            <Stack spacing={1}>
                                              <Typography variant="subtitle2" color="secondary">
                                                🗄️ Modelo BD Interna
                                              </Typography>
                                              <Box>
                                                <Typography variant="body2">
                                                  <strong>Descripción:</strong> {comp.bd_info?.modelo_descripcion || 'Información no disponible'}
                                                </Typography>
                                                <Typography variant="body2">
                                                  <strong>Marca:</strong> {comp.bd_info?.marca || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2">
                                                  <strong>Capacidad:</strong> {comp.bd_info?.capacidad || `ID ${comp.capacidad_id || 'N/A'}`}
                                                </Typography>
                                              </Box>

                                              {/* Price Info */}
                                              {comp.precio_info && (
                                                <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                  <Typography variant="caption" fontWeight={600} gutterBottom>Precios:</Typography>
                                                  <Stack direction="row" spacing={2} alignItems="center">
                                                    <Typography variant="body2" color="text.secondary">
                                                      Actual: {comp.precio_info.precio_actual ? `€${comp.precio_info.precio_actual}` : 'N/A'}
                                                    </Typography>
                                                    {comp.precio_info.precio_nuevo ? (
                                                      <Typography
                                                        variant="body2"
                                                        fontWeight={700}
                                                        sx={{
                                                          color: 'primary.main',
                                                          bgcolor: (theme) => theme.palette.mode === 'dark'
                                                            ? 'rgba(144, 202, 249, 0.16)'
                                                            : 'rgba(25, 118, 210, 0.08)',
                                                          px: 1,
                                                          py: 0.5,
                                                          borderRadius: 1
                                                        }}
                                                      >
                                                        Nuevo: €{comp.precio_info.precio_nuevo}
                                                      </Typography>
                                                    ) : (
                                                      <Typography variant="body2" color="error.main">
                                                        Sin precio nuevo
                                                      </Typography>
                                                    )}
                                                    {comp.precio_info.diferencia !== undefined && comp.precio_info.diferencia !== null && (
                                                      <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        color={comp.precio_info.diferencia > 0 ? 'success.main' : comp.precio_info.diferencia < 0 ? 'error.main' : 'text.secondary'}
                                                      >
                                                        ({comp.precio_info.diferencia > 0 ? '+' : ''}€{comp.precio_info.diferencia.toFixed(2)})
                                                      </Typography>
                                                    )}
                                                  </Stack>
                                                </Box>
                                              )}
                                            </Stack>
                                          </Grid>
                                        </Grid>
                                      </Paper>
                                    )
                                  })}

                                  {diff.data.comparaciones.length > 50 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                      Mostrando los primeros 50 de {diff.data.comparaciones.length} comparaciones
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            </Card>
                          )}
                        </Stack>
                      </Box>
                    </Card>
                  )}

                  {activeTaskId && !diff.data && diff.isLoading && (
                    <Stack spacing={2}>
                      <Typography variant="h6">Cargando cambios de precios...</Typography>
                      <LinearProgress />
                    </Stack>
                  )}

                  {activeTaskId && diff.data && (
                    <>
                      {/* Resumen de cambios */}
                      <Card variant="outlined">
                        <CardHeader
                          title={currentV3TaskId ? "Resumen de Cambios de Precios V3 (IA)" : "Resumen de Cambios de Precios V2"}
                          action={
                            currentV3TaskId && (
                              <Chip
                                label="AUTOAPRENDIZAJE"
                                color="primary"
                                size="small"
                                icon={<Psychology />}
                              />
                            )
                          }
                        />
                        <Box sx={{ p: 2 }}>
                          <Stack direction="row" spacing={2} flexWrap="wrap">
                            <Chip label={`Total: ${diff.data.summary.total}`} color="primary" />
                            <Chip label={`Altas: ${diff.data.summary.inserts}`} color="success" variant="outlined" />
                            <Chip label={`Cambios: ${diff.data.summary.updates}`} color="warning" variant="outlined" />
                            <Chip label={`Bajas: ${diff.data.summary.deletes}`} color="default" variant="outlined" />
                          </Stack>
                        </Box>
                      </Card>

                      {/* Tabla de cambios */}
                      <Card variant="outlined">
                        <CardHeader title="Cambios de Precios Detallados" />
                        <Box sx={{ p: 1, maxHeight: 600, overflow: 'auto' }}>
                          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                            <Box component="thead">
                              <Box component="tr">
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', width: 40 }}>
                                  <Checkbox
                                    size="small"
                                    checked={diff.data?.changes ? diff.data.changes.every((c) => selectedChanges.has(c.id)) : false}
                                    onChange={(e) => {
                                      if (e.target.checked && diff.data?.changes) {
                                        setSelectedChanges(new Set(diff.data.changes.map(c => c.id)))
                                      } else {
                                        setSelectedChanges(new Set())
                                      }
                                    }}
                                  />
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Tipo
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Modelo
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Capacidad
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Precio Antes
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Precio Después
                                </Box>
                                <Box component="th" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                                  Diferencia
                                </Box>
                              </Box>
                            </Box>
                            <Box component="tbody">
                              {diff.data.changes.slice(0, 20).map((cambio, idx) => (
                                <Box component="tr" key={`cambio-${cambio.id}-${idx}`} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}>
                                    <Checkbox
                                      size="small"
                                      checked={selectedChanges.has(cambio.id)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedChanges)
                                        if (e.target.checked) {
                                          newSelected.add(cambio.id)
                                        } else {
                                          newSelected.delete(cambio.id)
                                        }
                                        setSelectedChanges(newSelected)
                                      }}
                                    />
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                    <Chip
                                      size="small"
                                      label={cambio.tipo}
                                      color={cambio.kind === 'INSERT' ? 'success' : cambio.kind === 'UPDATE' ? 'warning' : 'default'}
                                      variant="outlined"
                                    />
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                    <Typography variant="body2" fontWeight={500}>
                                      {cambio.modelo_norm}
                                    </Typography>
                                    {cambio.marca && (
                                      <Typography variant="caption" color="text.secondary">
                                        {cambio.marca}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}>
                                    <Typography variant="body2">
                                      {cambio.almacenamiento_gb ? `${cambio.almacenamiento_gb} GB` : '—'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                      sx={{
                                        color: 'text.primary',
                                        opacity: 0.7
                                      }}
                                    >
                                      {cambio.antes || 'N/A'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={700}
                                      sx={{
                                        color: cambio.despues ? 'primary.main' : 'error.main',
                                        bgcolor: cambio.despues
                                          ? (theme) => theme.palette.mode === 'dark'
                                            ? 'rgba(144, 202, 249, 0.16)'
                                            : 'rgba(25, 118, 210, 0.08)'
                                          : (theme) => theme.palette.mode === 'dark'
                                            ? 'rgba(244, 67, 54, 0.16)'
                                            : 'rgba(211, 47, 47, 0.08)',
                                        px: 1,
                                        py: 0.5,
                                        borderRadius: 1,
                                        display: 'inline-block'
                                      }}
                                    >
                                      {cambio.despues || 'Sin precio'}
                                    </Typography>
                                  </Box>
                                  <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right' }}>
                                    {cambio.delta !== null && cambio.delta !== undefined && (
                                      <Typography
                                        variant="body2"
                                        fontWeight={500}
                                        color={cambio.delta > 0 ? 'success.main' : cambio.delta < 0 ? 'error.main' : 'text.secondary'}
                                      >
                                        {cambio.delta > 0 ? '+' : ''}{Number(cambio.delta).toFixed(2)}€
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          {diff.data.changes.length > 20 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                              Mostrando los primeros 20 de {diff.data.changes.length} cambios
                            </Typography>
                          )}
                        </Box>
                      </Card>
                    </>
                  )}

                  {tareaId && estado.data?.estado === 'ERROR' && (
                    <Alert severity="error">
                      Error al procesar la actualización: {estado.data.error_message || 'Error desconocido'}
                    </Alert>
                  )}
                </Stack>
              </TabPanel>

              {/* Pestaña No Encontrados */}
              <TabPanel value={tabValue} index={3}>
                <Stack spacing={3}>
                  <Alert severity="warning" icon={<Warning />}>
                    <strong>Dispositivos sin mapear</strong>
                    <Typography variant="body2">
                      Estos dispositivos no pudieron ser mapeados automáticamente. Crea el modelo y capacidad manualmente para entrenar el sistema.
                    </Typography>
                  </Alert>

                  {unmappedItems.isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  )}

                  {unmappedItems.data && unmappedItems.data.total_unmapped === 0 && (
                    <Alert severity="success">
                      ✅ Todos los dispositivos fueron mapeados correctamente
                    </Alert>
                  )}

                  {unmappedItems.data && unmappedItems.data.total_unmapped > 0 && (
                    <>
                      <Typography variant="h6">
                        {unmappedItems.data.total_unmapped} dispositivos sin mapear
                      </Typography>

                      <Stack spacing={2}>
                        {unmappedItems.data.items.map((item: any) => (
                          <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                            <Grid container spacing={2} alignItems="center">
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {item.modelo_norm || item.modelo_raw}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {item.marca} • {item.tipo} • {item.almacenamiento_gb} GB
                                </Typography>
                                {item.likewize_model_code && (
                                  <Typography variant="caption" color="text.secondary">
                                    Código: {item.likewize_model_code}
                                  </Typography>
                                )}
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <Typography variant="body2">
                                  <strong>Precio B2B:</strong> €{item.precio_b2b || 'N/A'}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 12, md: 3 }}>
                                <Button
                                  variant="contained"
                                  color="primary"
                                  fullWidth
                                  onClick={() => handleOpenCreateModal(item)}
                                  disabled={createFromUnmappedMutation.isPending}
                                >
                                  Crear Modelo
                                </Button>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}
                      </Stack>
                    </>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                <Stack spacing={3}>
                  <Alert severity="info">
                    El sistema V2 utiliza estrategias específicas optimizadas según el tipo de dispositivo
                    para maximizar la precisión del mapeo automático.
                  </Alert>

                  {/* Estrategias principales */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Estrategias de Mapeo por Dispositivo
                    </Typography>
                    <Stack spacing={3}>
                      <DeviceMappingStrategy
                        deviceType="Mac"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPhone"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPad"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                    </Stack>
                  </Box>

                  {/* Resumen de distribución por algoritmo */}
                  {statistics && (
                    <Card variant="outlined">
                      <CardHeader title="Distribución Actual de Algoritmos" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          {algorithmsBreakdown.map(({ name, count, details }) => (
                            <Box key={name}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight={600}>
                                  {name.charAt(0).toUpperCase() + name.slice(1)}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2">
                                    {count} mappings
                                  </Typography>
                                  {details && (
                                    <Chip
                                      size="small"
                                      label={`${details.avg_confidence.toFixed(1)}% conf.`}
                                      color={details.avg_confidence >= 85 ? 'success' : details.avg_confidence >= 70 ? 'warning' : 'error'}
                                      variant="outlined"
                                    />
                                  )}
                                </Stack>
                              </Stack>
                              {totalMappings > 0 && (
                                <LinearProgress
                                  variant="determinate"
                                  value={(count / totalMappings) * 100}
                                  sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={6}>
                <Stack spacing={3}>
                  <MappingMetrics />

                  {/* Additional metrics components */}
                  {statistics && (
                    <Card variant="outlined">
                      <CardHeader title="Estado Detallado del Sistema" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          <Box>
                            <strong>Tasa de éxito (7 días):</strong> {(successRate * 100).toFixed(1)}%
                          </Box>
                          <Box>
                            <strong>Confianza promedio:</strong> {avgConfidence.toFixed(1)}/100
                          </Box>
                          <Box>
                            <strong>Mappings en revisión:</strong> {needsReview.toLocaleString()}
                          </Box>
                          <Box>
                            <strong>Validaciones de usuario:</strong> {statistics.user_validated.toLocaleString()}
                          </Box>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip size="small" color="success" variant="outlined" label={`Alta: ${highConfidence}`} />
                            <Chip size="small" color="warning" variant="outlined" label={`Media: ${mediumConfidence}`} />
                            <Chip size="small" color="error" variant="outlined" label={`Baja: ${lowConfidence}`} />
                          </Stack>
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <ReviewPanel
                  onReviewCompleted={() => {
                    refetchLearningMetrics()
                    refetchStatistics()
                  }}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={7}>
                <Stack spacing={3}>
                  <Alert severity="info">
                    El sistema V3 utiliza estrategias específicas optimizadas según el tipo de dispositivo
                    para maximizar la precisión del mapeo automático con inteligencia artificial.
                  </Alert>

                  {/* Estrategias principales */}
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Estrategias de Mapeo por Dispositivo
                    </Typography>
                    <Stack spacing={3}>
                      <DeviceMappingStrategy
                        deviceType="Mac"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPhone"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                      <DeviceMappingStrategy
                        deviceType="iPad"
                        successRate={successRate}
                        avgConfidence={avgConfidence}
                      />
                    </Stack>
                  </Box>

                  {/* Learning System Performance */}
                  {learningMetrics?.performance_by_brand && (
                    <Card variant="outlined">
                      <CardHeader title="Rendimiento por Marca (Autoaprendizaje)" />
                      <Box sx={{ p: 2 }}>
                        <Stack spacing={2}>
                          {learningMetrics.performance_by_brand.slice(0, 5).map((brand, index) => (
                            <Box key={index}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight={600}>
                                  {brand.local_modelo__marca}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2">
                                    {brand.total_mappings} mapeos
                                  </Typography>
                                  <ConfidenceIndicator
                                    confidence={brand.avg_confidence}
                                    variant="chip"
                                    size="small"
                                    showPercentage
                                  />
                                </Stack>
                              </Stack>
                              {learningMetrics.knowledge_base_metrics?.total_entries && (
                                <LinearProgress
                                  variant="determinate"
                                  value={(brand.total_mappings / learningMetrics.knowledge_base_metrics.total_entries) * 100}
                                  sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={6}>
                <Stack spacing={3}>
                  <MappingMetrics />

                  {/* V3 Learning Metrics */}
                  {learningMetrics && (
                    <Card variant="outlined">
                      <CardHeader title="Métricas del Sistema de Autoaprendizaje V3" />
                      <Box sx={{ p: 2 }}>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Base de Conocimiento
                            </Typography>
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Entradas totales:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.total_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Alta confianza:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.high_confidence_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Validadas por usuario:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.user_validated_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Aprendidas automáticamente:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.knowledge_base_metrics?.auto_learned_entries?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Correcciones (30 días)
                            </Typography>
                            <Stack spacing={1}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Total correcciones:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {learningMetrics.correction_metrics?.total_corrections?.toLocaleString() || 0}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2">Confianza orig. promedio:</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                  {Math.round((learningMetrics.correction_metrics?.avg_original_confidence || 0) * 100)}%
                                </Typography>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>

                        {/* System Health Recommendations */}
                        {learningMetrics.system_health?.recommendations && learningMetrics.system_health.recommendations.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Recomendaciones del Sistema
                            </Typography>
                            <Stack spacing={1}>
                              {learningMetrics.system_health.recommendations.map((rec, index) => (
                                <Alert key={index} severity="info" variant="outlined">
                                  {rec}
                                </Alert>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    </Card>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={7}>
                <Card variant="outlined">
                  <CardHeader title="Análisis de Calidad de Mappings V3" />
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={3}>
                      <Alert severity="info">
                        Análisis detallado de la calidad de los mappings automáticos.
                        Identifica patrones y oportunidades de mejora.
                      </Alert>

                      {statistics ? (
                        <Stack spacing={2}>
                          <Box>
                            <strong>Distribución de Confianza (7 días):</strong>
                            <Box sx={{ mt: 1, pl: 2 }}>
                              <div>Alta (≥85%): {highConfidence}</div>
                              <div>Media (60-84%): {mediumConfidence}</div>
                              <div>Baja (&lt;60%): {lowConfidence}</div>
                            </Box>
                          </Box>

                          <Box>
                            <strong>Distribución por Algoritmo:</strong>
                            <Stack spacing={0.75} sx={{ mt: 1, pl: 2 }}>
                              {algorithmsBreakdown.length ? (
                                algorithmsBreakdown.map(({ name, count, details }) => (
                                  <Typography key={name} variant="caption" color="text.secondary">
                                    {name}: {count} mappings
                                    {details && ` · Confianza media ${details.avg_confidence.toFixed(1)} · Alta ${details.high_confidence_count}`}
                                  </Typography>
                                ))
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Sin datos recientes.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Box>
                            <strong>Recomendaciones:</strong>
                            <Stack spacing={1} sx={{ mt: 1, pl: 2 }}>
                              {needsReview > 0 && (
                                <Alert severity="warning" variant="outlined">
                                  {needsReview} mappings están pendientes de revisión manual.
                                </Alert>
                              )}
                              {successRate < 0.85 && (
                                <Alert severity="info" variant="outlined">
                                  Considera reforzar la base de conocimiento o validar mappings de baja confianza.
                                </Alert>
                              )}
                              {successRate >= 0.85 && needsReview === 0 && (
                                <Alert severity="success" variant="outlined">
                                  El sistema se encuentra en parámetros saludables.
                                </Alert>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      ) : (
                        <Alert severity="info" variant="outlined">
                          No hay datos de calidad disponibles para el periodo seleccionado.
                        </Alert>
                      )}
                    </Stack>
                  </Box>
                </Card>
              </TabPanel>
            </Card>
          </>
        )}
      </Stack>

      {/* Modal de búsqueda para corrección manual */}
      <Dialog
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Buscar modelo correcto
          {selectedItemForCorrection && (
            <Typography variant="body2" color="text.secondary">
              Buscando reemplazo para: {selectedItemForCorrection.likewize_info?.modelo_norm}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Buscar modelo"
              placeholder="Ej: iPhone XR 256GB"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleSearchCapacidades(e.target.value)
              }}
              disabled={searchLoading}
            />

            {searchLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <List>
                {searchResults.map((capacidad) => (
                  <ListItem key={capacidad.id} disablePadding>
                    <ListItemButton onClick={() => handleApplyCorrection(capacidad)}>
                      <ListItemText
                        primary={`${capacidad.modelo?.descripcion} ${capacidad.tamaño}`}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.secondary">
                              Marca: {capacidad.modelo?.marca} | Tipo: {capacidad.modelo?.tipo}
                            </Typography>
                            {capacidad._b2b && (
                              <Typography component="span" variant="body2" sx={{ ml: 1, fontWeight: 'bold', color: 'success.main' }}>
                                Precio B2B: €{capacidad._b2b}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}

            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <Alert severity="info">
                No se encontraron resultados para &quot;{searchQuery}&quot;
              </Alert>
            )}

            {searchQuery.length < 2 && (
              <Alert severity="info">
                Escribe al menos 2 caracteres para buscar
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchModalOpen(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de creación de dispositivo no mapeado */}
      <Dialog
        open={createDeviceModalOpen}
        onClose={() => setCreateDeviceModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Crear Modelo y Todas sus Capacidades
          {editableDevice.modelo && (
            <Typography variant="body2" color="text.secondary">
              {editableDevice.modelo}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info">
              Revisa y edita la información antes de crear. Se crearán automáticamente <strong>todas las capacidades estándar</strong> para este tipo de dispositivo.
            </Alert>

            <Stack spacing={2}>
              <TextField
                label="Nombre del Modelo"
                fullWidth
                value={editableDevice.modelo}
                onChange={(e) => setEditableDevice({ ...editableDevice, modelo: e.target.value })}
                helperText="Nombre user-friendly (se limpió automáticamente)"
                required
              />

              <TextField
                label="Marca"
                fullWidth
                value={editableDevice.marca}
                onChange={(e) => setEditableDevice({ ...editableDevice, marca: e.target.value })}
                required
              />

              <TextField
                label="Tipo"
                fullWidth
                value={editableDevice.tipo}
                onChange={(e) => setEditableDevice({ ...editableDevice, tipo: e.target.value })}
                helperText="Ej: Mac, iPhone, iPad"
                required
              />

              <TextField
                label="Capacidad (GB)"
                fullWidth
                type="number"
                value={editableDevice.almacenamiento_gb}
                onChange={(e) => setEditableDevice({ ...editableDevice, almacenamiento_gb: e.target.value })}
                helperText="Solo el número en GB"
                required
              />

              <TextField
                label="Código Likewize"
                fullWidth
                value={editableDevice.likewize_model_code}
                onChange={(e) => setEditableDevice({ ...editableDevice, likewize_model_code: e.target.value })}
                helperText="Código del proveedor (se usa modelo_raw por defecto)"
              />

              {selectedUnmappedItem && (
                <Alert severity="success" icon={false}>
                  <Typography variant="body2">
                    <strong>Precio B2B:</strong> €{selectedUnmappedItem.precio_b2b || 'N/A'}
                  </Typography>
                </Alert>
              )}
            </Stack>

            {/* Sección de capacidades que se crearán */}
            {editableDevice.tipo && (() => {
              const standardCapacities = STANDARD_CAPACITIES[editableDevice.tipo] || [256, 512, 1024, 2048]
              const currentCapacity = parseInt(editableDevice.almacenamiento_gb) || 0

              return (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      📦 Capacidades que se crearán automáticamente
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {standardCapacities.map((gb) => {
                        const isCurrentCapacity = gb === currentCapacity
                        return (
                          <Chip
                            key={gb}
                            label={formatCapacity(gb)}
                            size="medium"
                            color={isCurrentCapacity ? 'primary' : 'default'}
                            variant={isCurrentCapacity ? 'filled' : 'outlined'}
                            sx={{
                              fontWeight: isCurrentCapacity ? 'bold' : 'normal',
                              ...(isCurrentCapacity && {
                                borderWidth: 2,
                                borderColor: 'primary.main'
                              })
                            }}
                          />
                        )
                      })}
                    </Box>

                    <Alert severity="success" icon={false}>
                      <Typography variant="body2">
                        ✅ Se crearán <strong>{standardCapacities.length} capacidades</strong> para este modelo
                        {currentCapacity > 0 && (
                          <> (incluye <strong>{formatCapacity(currentCapacity)}</strong> del item actual)</>
                        )}
                      </Typography>
                    </Alert>
                  </Stack>
                </Paper>
              )
            })()}

            {createFromUnmappedMutation.isPending && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDeviceModalOpen(false)} disabled={createFromUnmappedMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateDevice}
            variant="contained"
            color="primary"
            disabled={createFromUnmappedMutation.isPending}
          >
            Crear Dispositivo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EnhancedLikewizePage
