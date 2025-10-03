'use client'

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Checkbox,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  Alert,
  Collapse,
  TablePagination
} from '@mui/material'
import {
  CheckCircle,
  Edit,
  AddCircle,
  Warning,
  ExpandMore,
  ExpandLess,
  FilterList
} from '@mui/icons-material'
import React from 'react'
import { useState, useMemo } from 'react'
import { ConfidenceIndicator } from './ConfidenceIndicator'

// Extraer tipo genérico del nombre del modelo (igual que en CreateDeviceModal)
const extractDeviceType = (modelName: string): string => {
  const lower = modelName.toLowerCase().replace(/\s+/g, ' ')

  if (lower.includes('iphone')) return 'iPhone'

  if (lower.includes('ipad pro') || lower.includes('ipadpro')) return 'iPad Pro'
  if (lower.includes('ipad air') || lower.includes('ipadair')) return 'iPad Air'
  if (lower.includes('ipad mini') || lower.includes('ipadmini')) return 'iPad mini'
  if (lower.includes('ipad')) return 'iPad'

  if (lower.includes('macbook pro') || lower.includes('macbookpro')) return 'MacBook Pro'
  if (lower.includes('macbook air') || lower.includes('macbookair')) return 'MacBook Air'
  if (lower.includes('macbook')) return 'MacBook'

  if (lower.includes('imac')) return 'iMac'
  if (lower.includes('mac mini') || lower.includes('macmini')) return 'Mac mini'
  if (lower.includes('mac pro') || lower.includes('macpro')) return 'Mac Pro'
  if (lower.includes('mac studio') || lower.includes('macstudio')) return 'Mac Studio'

  return 'Mac'
}

export type ValidationItem = {
  id: string | number
  staging_item_id?: string | number

  // Datos de Likewize (extraídos del scraping)
  likewize_info: {
    modelo_raw: string // Nombre original de Likewize
    modelo_norm: string // Nombre normalizado
    tipo: string
    marca: string
    almacenamiento_gb: number | null
    precio_b2b: number
    likewize_model_code?: string
    a_number?: string
    any?: number
    cpu?: string
  }

  // Mapeo actual (puede ser null si no está mapeado)
  mapped_info: {
    capacidad_id: number | null
    modelo_descripcion: string | null
    almacenamiento_text: string | null
    modelo_completo: string | null
    precio_actual: number | null
  } | null

  // Metadatos del mapeo
  mapping_metadata?: {
    confidence_score: number | null
    mapping_algorithm: string | null
    needs_review: boolean
    is_mapped: boolean
  }
}

type FilterType = 'all' | 'mapped_no_change' | 'mapped_price_change' | 'unmapped' | 'low_confidence'
type DeviceTypeFilter = 'all' | 'iPhone' | 'iPad' | 'Mac' | 'MacBook Pro' | 'MacBook Air' | 'iMac'

interface ValidationTableProps {
  items: ValidationItem[]
  onValidate: (itemIds: (string | number)[]) => void
  onCorrect: (item: ValidationItem) => void
  onCreate: (item: ValidationItem) => void
  isLoading?: boolean
  selectedIds?: Set<string | number>
  onSelectionChange?: (selectedIds: Set<string | number>) => void
}

export function ValidationTable({
  items,
  onValidate,
  onCorrect,
  onCreate,
  isLoading = false,
  selectedIds = new Set(),
  onSelectionChange
}: ValidationTableProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<DeviceTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Helper: Detectar si hay cambio de precio
  const hasPriceChange = (item: ValidationItem): boolean => {
    if (!item.mapping_metadata?.is_mapped || !item.mapped_info) return false

    const precioLikewize = item.likewize_info.precio_b2b
    const precioActual = item.mapped_info.precio_actual

    // Si no hay precio actual, consideramos que hay cambio
    if (precioActual === null || precioActual === undefined) return true

    // Comparar precios (tolerancia de 0.01€ para errores de redondeo)
    return Math.abs(precioLikewize - precioActual) > 0.01
  }

  // Estadísticas
  const stats = useMemo(() => {
    const total = items.length
    const mapped = items.filter(i => i.mapping_metadata?.is_mapped).length
    const mappedNoChange = items.filter(i => i.mapping_metadata?.is_mapped && !hasPriceChange(i)).length
    const mappedPriceChange = items.filter(i => i.mapping_metadata?.is_mapped && hasPriceChange(i)).length
    const unmapped = items.filter(i => !i.mapping_metadata?.is_mapped).length
    const lowConfidence = items.filter(i =>
      i.mapping_metadata?.confidence_score !== null &&
      i.mapping_metadata?.confidence_score !== undefined &&
      i.mapping_metadata.confidence_score < 70
    ).length
    const needsReview = items.filter(i => i.mapping_metadata?.needs_review).length

    return { total, mapped, mappedNoChange, mappedPriceChange, unmapped, lowConfidence, needsReview }
  }, [items])

  // Items filtrados
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Filtro por estado de mapeo
      if (filter === 'mapped_no_change') {
        if (!item.mapping_metadata?.is_mapped) return false
        if (hasPriceChange(item)) return false
      }
      if (filter === 'mapped_price_change') {
        if (!item.mapping_metadata?.is_mapped) return false
        if (!hasPriceChange(item)) return false
      }
      if (filter === 'unmapped' && item.mapping_metadata?.is_mapped) return false
      if (filter === 'low_confidence') {
        const confidence = item.mapping_metadata?.confidence_score
        if (!confidence || confidence >= 70) return false
      }

      // Filtro por tipo de dispositivo
      if (deviceTypeFilter !== 'all') {
        const extractedType = extractDeviceType(item.likewize_info.modelo_raw || item.likewize_info.modelo_norm)
        if (extractedType !== deviceTypeFilter) {
          return false
        }
      }

      // Búsqueda por texto
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchLikewize = item.likewize_info.modelo_raw?.toLowerCase().includes(query) ||
                             item.likewize_info.modelo_norm?.toLowerCase().includes(query)
        const matchMapped = item.mapped_info?.modelo_descripcion?.toLowerCase().includes(query)
        if (!matchLikewize && !matchMapped) return false
      }

      return true
    })
  }, [items, filter, deviceTypeFilter, searchQuery])

  // Selección
  const handleSelectAll = () => {
    if (!onSelectionChange) return

    if (selectedIds.size === filteredItems.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleSelectItem = (itemId: string | number) => {
    if (!onSelectionChange) return

    const newSelection = new Set(selectedIds)
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId)
    } else {
      newSelection.add(itemId)
    }
    onSelectionChange(newSelection)
  }

  const toggleRowExpanded = (itemId: string | number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedRows(newExpanded)
  }

  const getConfidenceColor = (confidence: number | null | undefined) => {
    if (confidence === null || confidence === undefined) return 'default'
    if (confidence >= 80) return 'success'
    if (confidence >= 60) return 'warning'
    return 'error'
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-'
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price)
  }

  const formatAlgorithm = (algorithm: string | null | undefined) => {
    if (!algorithm) return 'N/A'

    // Map algorithm codes to readable names
    const algorithmNames: Record<string, string> = {
      'a_number_direct': 'A-Number Directo',
      'exact_name_match': 'Coincidencia Exacta',
      'fuzzy_match': 'Coincidencia Aproximada',
      'capacity_inference': 'Inferencia de Capacidad',
      'heuristic': 'Heurística',
      'cache': 'Caché',
      'manual': 'Manual',
      'enrichment': 'Enriquecimiento'
    }

    return algorithmNames[algorithm] || algorithm
  }

  const allSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredItems.length

  return (
    <Box>
      {/* Estadísticas y Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip
            label={`Total: ${stats.total}`}
            color="default"
            variant={filter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilter('all')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label={`✓ Sin cambios: ${stats.mappedNoChange}`}
            color="success"
            variant={filter === 'mapped_no_change' ? 'filled' : 'outlined'}
            onClick={() => setFilter('mapped_no_change')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label={`⚠ Cambio precio: ${stats.mappedPriceChange}`}
            color="warning"
            variant={filter === 'mapped_price_change' ? 'filled' : 'outlined'}
            onClick={() => setFilter('mapped_price_change')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label={`No Mapeados: ${stats.unmapped}`}
            color="error"
            variant={filter === 'unmapped' ? 'filled' : 'outlined'}
            onClick={() => setFilter('unmapped')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label={`Baja Confianza: ${stats.lowConfidence}`}
            color="info"
            variant={filter === 'low_confidence' ? 'filled' : 'outlined'}
            onClick={() => setFilter('low_confidence')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label={`Requieren Revisión: ${stats.needsReview}`}
            color="info"
            variant="outlined"
          />

          <Box sx={{ flexGrow: 1 }} />

          <Button
            size="small"
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
            endIcon={showFilters ? <ExpandLess /> : <ExpandMore />}
          >
            Filtros
          </Button>
        </Stack>

        <Collapse in={showFilters}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              select
              size="small"
              label="Estado"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="mapped_no_change">✓ Sin cambios de precio</MenuItem>
              <MenuItem value="mapped_price_change">⚠ Con cambio de precio</MenuItem>
              <MenuItem value="unmapped">No Mapeados</MenuItem>
              <MenuItem value="low_confidence">Baja Confianza</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Tipo"
              value={deviceTypeFilter}
              onChange={(e) => setDeviceTypeFilter(e.target.value as DeviceTypeFilter)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="iPhone">iPhone</MenuItem>
              <MenuItem value="iPad">iPad</MenuItem>
              <MenuItem value="Mac">Mac</MenuItem>
              <MenuItem value="MacBook Pro">MacBook Pro</MenuItem>
              <MenuItem value="MacBook Air">MacBook Air</MenuItem>
              <MenuItem value="iMac">iMac</MenuItem>
            </TextField>

            <TextField
              size="small"
              placeholder="Buscar por modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
          </Stack>
        </Collapse>
      </Paper>

      {/* Acciones en lote */}
      {selectedIds.size > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2">
              {selectedIds.size} elemento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </Typography>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={() => onValidate(Array.from(selectedIds))}
            >
              Validar Seleccionados
            </Button>
          </Stack>
        </Alert>
      )}

      {/* Tabla */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Expand</TableCell>
              <TableCell>Likewize (Extraído)</TableCell>
              <TableCell>Mi BD (Mapeado)</TableCell>
              <TableCell>Confianza</TableCell>
              <TableCell>Precio</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No hay items con estos filtros
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => {
                const isExpanded = expandedRows.has(item.id)
                const isMapped = item.mapping_metadata?.is_mapped ?? false
                const confidence = item.mapping_metadata?.confidence_score
                const needsReview = item.mapping_metadata?.needs_review

                return (
                  <React.Fragment key={item.id}>
                    <TableRow
                      hover
                      sx={{
                        bgcolor: needsReview ? 'warning.50' : undefined,
                        '&:hover': { bgcolor: needsReview ? 'warning.100' : undefined }
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <IconButton size="small" onClick={() => toggleRowExpanded(item.id)}>
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>

                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" fontWeight="medium">
                            {item.likewize_info.modelo_norm}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {extractDeviceType(item.likewize_info.modelo_raw || item.likewize_info.modelo_norm)} • {item.likewize_info.almacenamiento_gb}GB
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        {isMapped ? (
                          <Stack spacing={0.5}>
                            <Typography variant="body2">
                              {item.mapped_info?.modelo_descripcion || '-'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.mapped_info?.almacenamiento_text || '-'}
                            </Typography>
                          </Stack>
                        ) : (
                          <Chip label="No Mapeado" size="small" color="warning" />
                        )}
                      </TableCell>

                      <TableCell>
                        {confidence !== null && confidence !== undefined ? (
                          <Chip
                            label={`${confidence.toFixed(0)}%`}
                            size="small"
                            color={getConfidenceColor(confidence)}
                          />
                        ) : (
                          <Chip label="N/A" size="small" color="default" />
                        )}
                      </TableCell>

                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            {formatPrice(item.likewize_info.precio_b2b)}
                          </Typography>
                          {isMapped && item.mapped_info?.precio_actual && (
                            <Typography variant="caption" color="text.secondary">
                              Actual: {formatPrice(item.mapped_info.precio_actual)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {isMapped ? (
                            <>
                              <Tooltip title="Validar mapeo correcto">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => onValidate([item.id])}
                                >
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Corregir mapeo">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => onCorrect(item)}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip title="Crear nuevo dispositivo">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => onCreate(item)}
                              >
                                <AddCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {needsReview && (
                            <Tooltip title="Requiere revisión">
                              <Warning fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>

                    {/* Fila expandida con detalles */}
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 0, px: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{
                            p: 2,
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
                          }}>
                            <Stack direction="row" spacing={4}>
                              {/* Detalles Likewize */}
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Datos de Likewize:
                                </Typography>
                                <Stack spacing={0.5}>
                                  <Typography variant="caption">
                                    <strong>Nombre Original:</strong> {item.likewize_info.modelo_raw}
                                  </Typography>
                                  <Typography variant="caption">
                                    <strong>Código Likewize:</strong> {item.likewize_info.likewize_model_code || 'N/A'}
                                  </Typography>
                                  <Typography variant="caption">
                                    <strong>A-Number:</strong> {item.likewize_info.a_number || 'N/A'}
                                  </Typography>
                                  <Typography variant="caption">
                                    <strong>Año:</strong> {item.likewize_info.any || 'N/A'}
                                  </Typography>
                                  <Typography variant="caption">
                                    <strong>CPU:</strong> {item.likewize_info.cpu || 'N/A'}
                                  </Typography>
                                </Stack>
                              </Box>

                              {/* Detalles del Mapeo */}
                              {isMapped && (
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Detalles del Mapeo:
                                  </Typography>
                                  <Stack spacing={0.5}>
                                    <Typography variant="caption">
                                      <strong>Modelo:</strong> {item.mapped_info?.modelo_completo || item.mapped_info?.modelo_descripcion || 'N/A'}
                                    </Typography>
                                    <Typography variant="caption">
                                      <strong>Capacidad ID:</strong> {item.mapped_info?.capacidad_id || 'N/A'}
                                    </Typography>
                                    <Typography variant="caption">
                                      <strong>Algoritmo:</strong> {formatAlgorithm(item.mapping_metadata?.mapping_algorithm)}
                                    </Typography>
                                    <Typography variant="caption">
                                      <strong>Confianza:</strong> {confidence !== null && confidence !== undefined ? `${confidence.toFixed(2)}%` : 'N/A'}
                                    </Typography>
                                    {(!item.mapping_metadata?.mapping_algorithm && !item.mapping_metadata?.confidence_score) && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                        ℹ️ Mapeo creado con sistema v1 (sin metadatos)
                                      </Typography>
                                    )}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredItems.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10))
            setPage(0)
          }}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </TableContainer>
    </Box>
  )
}
