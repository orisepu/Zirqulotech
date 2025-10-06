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

interface ModeloOption {
  id: number
  descripcion: string
  tipo: string
  marca: string
  likewize_modelo?: string
}

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

interface AutoMappedCapacity {
  capacidad_id: number
  tamaño: string
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
  const [searchResults, setSearchResults] = useState<ModeloOption[]>([])
  const [searching, setSearching] = useState(false)
  const [searchingCapacity, setSearchingCapacity] = useState(false)
  const [selectedModelo, setSelectedModelo] = useState<ModeloOption | null>(null)
  const [autoMappedCapacity, setAutoMappedCapacity] = useState<AutoMappedCapacity | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Helper para normalizar tamaños (TB → GB)
  const normalizarTamaño = (tamañoString: string): number => {
    // "4 TB" → 4096 GB, "512 GB" → 512 GB, "512GB" → 512 GB
    const match = tamañoString.match(/(\d+)\s*(TB|GB)/i)
    if (!match) return 0

    const valor = parseInt(match[1])
    const unidad = match[2].toUpperCase()

    return unidad === 'TB' ? valor * 1024 : valor
  }

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
      setSelectedModelo(null)
      setAutoMappedCapacity(null)
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
    // Reset selección previa
    setSelectedModelo(null)
    setAutoMappedCapacity(null)

    try {
      const { data } = await api.get('/api/admin/modelos/search/', {
        params: {
          q: query,
          limit: 20,
          tipo: item?.likewize_info.tipo,
          marca: item?.likewize_info.marca
        }
      })

      const results = (data || []) as ModeloOption[]
      setSearchResults(results)
    } catch (err: any) {
      console.error('Error buscando modelos:', err)
      setError(err.response?.data?.detail || 'Error al buscar modelos')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectModelo = async (modelo: ModeloOption) => {
    setSelectedModelo(modelo)
    setSearchingCapacity(true)
    setError(null)
    setAutoMappedCapacity(null)

    if (!item) return

    try {
      // Buscar todas las capacidades del modelo seleccionado
      const { data } = await api.get('/api/admin/capacidades/', {
        params: {
          modelo_id: modelo.id,
          limit: 100
        }
      })

      const capacidades = (data.results || []) as CapacidadOption[]
      const almacenamientoLikewize = item.likewize_info.almacenamiento_gb

      if (!almacenamientoLikewize) {
        setError('El item de Likewize no tiene almacenamiento especificado')
        return
      }

      // Buscar capacidad que coincida con el almacenamiento del item de Likewize
      const capacidadMatch = capacidades.find(cap => {
        const tamañoNormalizado = normalizarTamaño(cap.tamaño)
        return tamañoNormalizado === almacenamientoLikewize
      })

      if (capacidadMatch) {
        // ✅ Encontramos la capacidad exacta
        setAutoMappedCapacity({
          capacidad_id: capacidadMatch.id,
          tamaño: capacidadMatch.tamaño,
          precio_b2b: capacidadMatch.precio_b2b
        })
        setError(null)
      } else {
        // ❌ No existe esa capacidad para este modelo
        const capacidadesDisponibles = capacidades.map(c => c.tamaño).join(', ') || 'ninguna'
        setAutoMappedCapacity(null)
        setError(
          `Este modelo no tiene capacidad de ${almacenamientoLikewize}GB disponible. ` +
          `Capacidades disponibles: ${capacidadesDisponibles}`
        )
      }
    } catch (err: any) {
      console.error('Error buscando capacidades del modelo:', err)
      setError(err.response?.data?.detail || 'Error al buscar capacidades del modelo')
      setAutoMappedCapacity(null)
    } finally {
      setSearchingCapacity(false)
    }
  }

  const handleApplyCorrection = () => {
    if (!selectedModelo || !autoMappedCapacity) return

    // Construir el objeto CapacidadOption compatible con el callback
    const capacidadToApply: CapacidadOption = {
      id: autoMappedCapacity.capacidad_id,
      tamaño: autoMappedCapacity.tamaño,
      modelo: {
        id: selectedModelo.id,
        descripcion: selectedModelo.descripcion,
        tipo: selectedModelo.tipo,
        marca: selectedModelo.marca
      },
      precio_b2b: autoMappedCapacity.precio_b2b
    }

    onApply(capacidadToApply)
  }

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return ''
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(price)
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

          {/* Resultados de búsqueda de modelos */}
          {searchResults.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Modelos encontrados ({searchResults.length}):
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {searchResults.map((modelo) => {
                  const isSelected = selectedModelo?.id === modelo.id

                  return (
                    <ListItem key={modelo.id} disablePadding>
                      <ListItemButton
                        selected={isSelected}
                        onClick={() => handleSelectModelo(modelo)}
                        disabled={searchingCapacity && selectedModelo?.id === modelo.id}
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" fontWeight={isSelected ? 'bold' : 'normal'}>
                                {modelo.descripcion}
                              </Typography>
                              {searchingCapacity && selectedModelo?.id === modelo.id && (
                                <CircularProgress size={16} />
                              )}
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                              <Chip label={modelo.tipo} size="small" variant="outlined" />
                              <Chip label={modelo.marca} size="small" variant="outlined" />
                              {modelo.likewize_modelo && (
                                <Chip label={`Likewize: ${modelo.likewize_modelo}`} size="small" color="info" variant="outlined" />
                              )}
                            </Stack>
                          }
                          slotProps={{
                            primary: { component: 'div' },
                            secondary: { component: 'div' }
                          }}
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

          {/* Modelo y capacidad auto-mapeada */}
          {selectedModelo && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: (theme) => autoMappedCapacity
                  ? (theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.15)' : 'success.50')
                  : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50')
              }}
            >
              <Typography variant="subtitle2" gutterBottom color={autoMappedCapacity ? "success.main" : "text.primary"}>
                {autoMappedCapacity ? '✅ Modelo y Capacidad Mapeada:' : '📋 Modelo Seleccionado:'}
              </Typography>

              <Stack spacing={1}>
                <Typography variant="body2" color="text.primary">
                  <strong>Modelo:</strong> {selectedModelo.descripcion}
                </Typography>

                {autoMappedCapacity && (
                  <>
                    <Typography variant="body2" color="text.primary">
                      <strong>Capacidad:</strong> {autoMappedCapacity.tamaño}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Capacidad ID: {autoMappedCapacity.capacidad_id}
                      {autoMappedCapacity.precio_b2b && ` • Precio: ${formatPrice(autoMappedCapacity.precio_b2b)}`}
                    </Typography>
                  </>
                )}

                {searchingCapacity && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Buscando capacidad que coincida con {item.likewize_info.almacenamiento_gb}GB...
                    </Typography>
                  </Box>
                )}
              </Stack>
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
          disabled={!autoMappedCapacity || isLoading || searchingCapacity}
          startIcon={isLoading ? <CircularProgress size={16} /> : <CheckCircle />}
        >
          {isLoading ? 'Aplicando...' : 'Aplicar Corrección'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
