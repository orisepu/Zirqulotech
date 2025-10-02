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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Paper
} from '@mui/material'
import { Search, CheckCircle, Warning, AddCircle } from '@mui/icons-material'
import { useState, useEffect } from 'react'
import api from '@/services/api'

interface CapacidadOption {
  id: number
  tamaño: string
  modelo: {
    id: number
    descripcion: string
    tipo: string
    marca: string
  }
  precio_b2b?: number
}

interface CorrectionModalProps {
  open: boolean
  onClose: () => void
  item: {
    id: string | number
    staging_item_id?: string | number
    likewize_info: {
      modelo_norm: string
      tipo: string
      marca: string
      almacenamiento_gb: number | null
      precio_b2b: number
    }
    mapped_info?: {
      capacidad_id: number | null
      modelo_descripcion: string | null
      almacenamiento_text: string | null
    } | null
  } | null
  onApply: (capacidad: CapacidadOption) => void
  onCreateNew?: () => void  // Nueva prop para abrir modal de creación
  isLoading?: boolean
}

export function CorrectionModal({
  open,
  onClose,
  item,
  onApply,
  onCreateNew,
  isLoading = false
}: CorrectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CapacidadOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCapacidad, setSelectedCapacidad] = useState<CapacidadOption | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto-buscar cuando se abre el modal
  useEffect(() => {
    if (open && item) {
      const initialQuery = item.likewize_info.modelo_norm || ''
      setSearchQuery(initialQuery)
      if (initialQuery.length >= 2) {
        handleSearch(initialQuery)
      }
    } else {
      // Reset al cerrar
      setSearchQuery('')
      setSearchResults([])
      setSelectedCapacidad(null)
      setError(null)
    }
  }, [open, item])

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    setError(null)

    try {
      const { data } = await api.get('/api/admin/capacidades/', {
        params: {
          q: query,
          limit: 20,
          tipo: item?.likewize_info.tipo // Filtrar por tipo si está disponible
        }
      })

      const results = (data.results || []) as CapacidadOption[]

      // Ordenar resultados: primero los que coinciden exactamente en almacenamiento
      if (item?.likewize_info.almacenamiento_gb) {
        results.sort((a, b) => {
          const aMatch = a.tamaño.includes(`${item.likewize_info.almacenamiento_gb}`)
          const bMatch = b.tamaño.includes(`${item.likewize_info.almacenamiento_gb}`)
          if (aMatch && !bMatch) return -1
          if (!aMatch && bMatch) return 1
          return 0
        })
      }

      setSearchResults(results)

      // Auto-seleccionar el primero si hay match exacto
      if (results.length > 0 && item?.likewize_info.almacenamiento_gb) {
        const exactMatch = results.find(r =>
          r.tamaño.includes(`${item.likewize_info.almacenamiento_gb}`) &&
          r.modelo.descripcion.toLowerCase().includes(item.likewize_info.modelo_norm.toLowerCase())
        )
        if (exactMatch) {
          setSelectedCapacidad(exactMatch)
        }
      }
    } catch (err: any) {
      console.error('Error buscando capacidades:', err)
      setError(err.response?.data?.detail || 'Error al buscar capacidades')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleApplyCorrection = () => {
    if (!selectedCapacidad) return
    onApply(selectedCapacidad)
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return ''
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price)
  }

  const isCapacityMatch = (capacidad: CapacidadOption) => {
    if (!item?.likewize_info.almacenamiento_gb) return false
    return capacidad.tamaño.includes(`${item.likewize_info.almacenamiento_gb}`)
  }

  if (!item) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '60vh' } }}
    >
      <DialogTitle>
        Corregir Mapeo
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Información del item a corregir */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'grey.50'
            }}
          >
            <Typography variant="subtitle2" gutterBottom color="text.primary">
              Item de Likewize a corregir:
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.primary">
                <strong>Modelo:</strong> {item.likewize_info.modelo_norm}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>Tipo:</strong> {item.likewize_info.tipo} • <strong>Marca:</strong> {item.likewize_info.marca}
              </Typography>
              <Typography variant="body2" color="text.primary">
                <strong>Almacenamiento:</strong> {item.likewize_info.almacenamiento_gb}GB • <strong>Precio:</strong> {formatPrice(item.likewize_info.precio_b2b)}
              </Typography>
            </Stack>

            {item.mapped_info?.modelo_descripcion && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom color="warning.main">
                  Mapeo Actual (Incorrecto):
                </Typography>
                <Typography variant="body2" color="text.primary">
                  {item.mapped_info.modelo_descripcion} - {item.mapped_info.almacenamiento_text}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Búsqueda */}
          <TextField
            fullWidth
            label="Buscar modelo correcto en la BD"
            placeholder="Ej: iPhone 14 Pro, MacBook Air M2, iPad Pro..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            InputProps={{
              endAdornment: searching ? <CircularProgress size={20} /> : <Search />
            }}
            helperText="Escribe al menos 2 caracteres para buscar"
          />

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Resultados ({searchResults.length}):
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {searchResults.map((capacidad) => {
                  const isSelected = selectedCapacidad?.id === capacidad.id
                  const capacityMatches = isCapacityMatch(capacidad)

                  return (
                    <ListItem key={capacidad.id} disablePadding>
                      <ListItemButton
                        selected={isSelected}
                        onClick={() => setSelectedCapacidad(capacidad)}
                        sx={{
                          bgcolor: capacityMatches ? 'success.50' : undefined,
                          '&:hover': {
                            bgcolor: capacityMatches ? 'success.100' : undefined
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'}>
                                {capacidad.modelo.descripcion}
                              </Typography>
                              {capacityMatches && (
                                <Chip
                                  label="Match Almacenamiento"
                                  size="small"
                                  color="success"
                                  icon={<CheckCircle />}
                                />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Chip label={capacidad.tamaño} size="small" />
                              <Chip label={capacidad.modelo.tipo} size="small" variant="outlined" />
                              <Chip label={capacidad.modelo.marca} size="small" variant="outlined" />
                              {capacidad.precio_b2b && (
                                <Chip label={formatPrice(capacidad.precio_b2b)} size="small" color="primary" />
                              )}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Box>
          ) : searchQuery.length >= 2 && !searching ? (
            <Alert
              severity="info"
              action={
                onCreateNew && (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<AddCircle />}
                    onClick={onCreateNew}
                  >
                    Crear Nuevo
                  </Button>
                )
              }
            >
              No se encontraron resultados para "{searchQuery}".
              {onCreateNew ? (
                <> Puedes crear un nuevo dispositivo con el botón "Crear Nuevo".</>
              ) : (
                <> Puedes cerrar este modal y usar "Crear Nuevo" para crear el dispositivo.</>
              )}
            </Alert>
          ) : null}

          {/* Capacidad seleccionada */}
          {selectedCapacidad && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(46, 125, 50, 0.15)'
                  : 'success.50'
              }}
            >
              <Typography variant="subtitle2" gutterBottom color="success.main">
                ✓ Nuevo mapeo seleccionado:
              </Typography>
              <Typography variant="body2" color="text.primary">
                {selectedCapacidad.modelo.descripcion} - {selectedCapacidad.tamaño}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Capacidad ID: {selectedCapacidad.id}
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        {/* Botón "Crear Nuevo" siempre visible cuando onCreateNew está disponible */}
        {onCreateNew && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={onCreateNew}
            startIcon={<AddCircle />}
            disabled={isLoading}
          >
            Crear Nuevo
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleApplyCorrection}
          disabled={!selectedCapacidad || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          {isLoading ? 'Aplicando...' : 'Aplicar Corrección'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
