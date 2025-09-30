'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import {
  RateReview,
  CheckCircle,
  Cancel,
  ExpandMore,
  ExpandLess,
  Info,
  Search,
  FilterList,
  Save,
  Refresh,
  Psychology,
  Edit,
  Visibility,
  VisibilityOff
} from '@mui/icons-material'
import { ItemForReview, ReviewMappingRequest } from '@/types/autoaprendizaje-v3'
import { useReviewMappings, useApplyCorrections, useCapacidades } from '@/hooks/useLearningV3'
import { ConfidenceIndicator } from './ConfidenceIndicator'

interface ReviewPanelProps {
  onReviewCompleted?: () => void
}

interface CorrectionItem extends ItemForReview {
  selected: boolean
  newCapacidadId?: number
  correctionReason?: string
  expanded?: boolean
}

export function ReviewPanel({ onReviewCompleted }: ReviewPanelProps) {
  const [items, setItems] = useState<CorrectionItem[]>([])
  const [confidenceFilter, setConfidenceFilter] = useState<number>(0.7)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFeatures, setShowFeatures] = useState<Record<number, boolean>>({})
  const [correctionDialog, setCorrectionDialog] = useState<{
    open: boolean
    item?: CorrectionItem
  }>({ open: false })

  const { data: reviewData, isLoading: reviewLoading, refetch: refetchReview } = useReviewMappings({
    confidence: confidenceFilter,
    limit: 50
  })

  const { data: capacidades } = useCapacidades()
  const { mutate: applyCorrections, isPending: applyingCorrections } = useApplyCorrections()

  // Load review items when data changes
  useEffect(() => {
    if (reviewData?.items_for_review) {
      setItems(reviewData.items_for_review.map(item => ({
        ...item,
        selected: false,
        expanded: false
      })))
    }
  }, [reviewData])

  const handleSelectItem = (itemId: number, selected: boolean) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, selected } : item
    ))
  }

  const handleSelectAll = (selected: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected })))
  }

  const handleToggleFeatures = (itemId: number) => {
    setShowFeatures(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  const handleOpenCorrection = (item: CorrectionItem) => {
    setCorrectionDialog({
      open: true,
      item: { ...item }
    })
  }

  const handleCloseCorrection = () => {
    setCorrectionDialog({ open: false })
  }

  const handleSaveCorrection = (newCapacidadId: number, reason: string) => {
    if (!correctionDialog.item) return

    setItems(prev => prev.map(item =>
      item.id === correctionDialog.item!.id
        ? {
          ...item,
          newCapacidadId,
          correctionReason: reason,
          selected: true
        }
        : item
    ))

    setCorrectionDialog({ open: false })
  }

  const handleApplyCorrections = useCallback(() => {
    const selectedItems = items.filter(item => item.selected && item.newCapacidadId)

    if (selectedItems.length === 0) {
      return
    }

    const corrections: ReviewMappingRequest = {
      corrections: selectedItems.map(item => ({
        kb_entry_id: item.id,
        capacidad_id: item.newCapacidadId!,
        reason: item.correctionReason || 'Corrección manual desde panel de revisión'
      }))
    }

    applyCorrections(corrections, {
      onSuccess: () => {
        refetchReview()
        onReviewCompleted?.()
        setItems([])
      }
    })
  }, [items, applyCorrections, refetchReview, onReviewCompleted])

  const filteredItems = items.filter(item =>
    item.confidence_score <= confidenceFilter &&
    (searchTerm === '' ||
      item.provider_model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.current_mapping.modelo.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const selectedCount = filteredItems.filter(item => item.selected).length

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RateReview color="primary" />
          Panel de Revisión
          {selectedCount > 0 && (
            <Badge badgeContent={selectedCount} color="primary">
              <Psychology />
            </Badge>
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Actualizar lista">
            <IconButton onClick={() => refetchReview()} disabled={reviewLoading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleApplyCorrections}
            disabled={selectedCount === 0 || applyingCorrections}
          >
            Aplicar Correcciones ({selectedCount})
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Buscar modelo"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
          }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Confianza máxima</InputLabel>
          <Select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as number)}
            label="Confianza máxima"
          >
            <MenuItem value={1.0}>Todas las entradas</MenuItem>
            <MenuItem value={0.9}>Menos de 90%</MenuItem>
            <MenuItem value={0.7}>Menos de 70%</MenuItem>
            <MenuItem value={0.5}>Menos de 50%</MenuItem>
            <MenuItem value={0.3}>Menos de 30%</MenuItem>
          </Select>
        </FormControl>

        <Chip
          icon={<FilterList />}
          label={`${filteredItems.length} entradas`}
          color={filteredItems.length > 0 ? 'primary' : 'default'}
        />
      </Box>

      {/* Loading State */}
      {reviewLoading && (
        <Box>
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      )}

      {/* No Items */}
      {!reviewLoading && filteredItems.length === 0 && (
        <Alert severity="info">
          No se encontraron elementos que requieran revisión con los filtros actuales.
        </Alert>
      )}

      {/* Review Table */}
      {!reviewLoading && filteredItems.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedCount === filteredItems.length && filteredItems.length > 0}
                    indeterminate={selectedCount > 0 && selectedCount < filteredItems.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Modelo Externo</TableCell>
                <TableCell>Mapeo Actual</TableCell>
                <TableCell>Confianza</TableCell>
                <TableCell>Estadísticas</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.map((item) => (
                <>
                  <TableRow key={item.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={item.selected}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      />
                    </TableCell>

                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {item.provider_model_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.provider_capacity}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {item.current_mapping.modelo}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.current_mapping.capacidad}
                        </Typography>
                        {item.newCapacidadId && (
                          <Chip
                            label="Corrección pendiente"
                            size="small"
                            color="warning"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    <TableCell>
                      <ConfidenceIndicator
                        confidence={item.confidence_score}
                        variant="chip"
                        size="small"
                        showPercentage
                      />
                    </TableCell>

                    <TableCell>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Usado {item.times_used} veces
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(item.success_rate * 100)}% éxito
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Corregir mapeo">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCorrection(item)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title={showFeatures[item.id] ? "Ocultar características" : "Ver características"}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleFeatures(item.id)}
                          >
                            {showFeatures[item.id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>

                  {/* Features Row */}
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 0 }}>
                      <Collapse in={showFeatures[item.id]}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Características Extraídas:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {Object.entries(item.features).map(([key, value]) => (
                              <Chip
                                key={key}
                                label={`${key}: ${value}`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Correction Dialog */}
      <Dialog
        open={correctionDialog.open}
        onClose={handleCloseCorrection}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Corregir Mapeo: {correctionDialog.item?.provider_model_name}
        </DialogTitle>
        <DialogContent>
          {correctionDialog.item && (
            <CorrectionForm
              item={correctionDialog.item}
              capacidades={capacidades || []}
              onSave={handleSaveCorrection}
              onCancel={handleCloseCorrection}
            />
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  )
}

// Correction Form Component
function CorrectionForm({
  item,
  capacidades,
  onSave,
  onCancel
}: {
  item: CorrectionItem
  capacidades: any[]
  onSave: (capacidadId: number, reason: string) => void
  onCancel: () => void
}) {
  const [selectedCapacidad, setSelectedCapacidad] = useState<any | null>(null)
  const [reason, setReason] = useState('')

  const handleSave = () => {
    if (selectedCapacidad) {
      onSave(selectedCapacidad.id, reason)
    }
  }

  return (
    <Box sx={{ pt: 2 }}>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Modelo Externo:</strong> {item.provider_model_name} ({item.provider_capacity})
          <br />
          <strong>Mapeo Actual:</strong> {item.current_mapping.modelo} - {item.current_mapping.capacidad}
          <br />
          <strong>Confianza:</strong> {Math.round(item.confidence_score * 100)}%
        </Typography>
      </Alert>

      <Box sx={{ mb: 3 }}>
        <Autocomplete
          options={capacidades}
          getOptionLabel={(option) => `${option.modelo?.descripcion || 'N/A'} - ${option.tamaño}`}
          value={selectedCapacidad}
          onChange={(_, newValue) => setSelectedCapacidad(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Nueva capacidad correcta"
              fullWidth
              required
            />
          )}
          renderOption={(props, option) => (
            <li {...props}>
              <Box>
                <Typography variant="body2">
                  {option.modelo?.descripcion || 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.tamaño}
                </Typography>
              </Box>
            </li>
          )}
        />
      </Box>

      <TextField
        label="Razón de la corrección (opcional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        fullWidth
        multiline
        rows={3}
        sx={{ mb: 3 }}
        placeholder="Explica por qué este mapeo es incorrecto..."
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!selectedCapacidad}
        >
          Guardar Corrección
        </Button>
      </Box>
    </Box>
  )
}