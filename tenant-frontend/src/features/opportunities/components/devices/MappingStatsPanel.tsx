'use client'

import {
  Box,
  Stack,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,Grid
} from '@mui/material'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { TaskStatusV3, RemapCompleteResult, UnmappedItemsResponse } from '../../types/likewize'
import RefreshIcon from '@mui/icons-material/Refresh'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'

interface MappingStatsPanelProps {
  tareaId: string
}

export function MappingStatsPanel({ tareaId }: MappingStatsPanelProps) {
  const queryClient = useQueryClient()
  const [showUnmapped, setShowUnmapped] = useState(false)
  const [showRemapDialog, setShowRemapDialog] = useState(false)
  const [disableLearning, setDisableLearning] = useState(true)
  const [clearKnowledgeBase, setClearKnowledgeBase] = useState(false)
  const [remapResult, setRemapResult] = useState<RemapCompleteResult | null>(null)

  // Fetch task status with mapping statistics
  const taskStatus = useQuery({
    queryKey: ['likewize_v3_task_status', tareaId],
    queryFn: async () => {
      const { data } = await api.get<TaskStatusV3>(`/api/likewize/v3/tareas/${tareaId}/estado/`)
      return data
    },
    enabled: !!tareaId,
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  // Fetch unmapped items
  const unmappedItems = useQuery({
    queryKey: ['likewize_v3_unmapped', tareaId],
    queryFn: async () => {
      const { data } = await api.get<UnmappedItemsResponse>(`/api/likewize/v3/tareas/${tareaId}/no-mapeados/`)
      return data
    },
    enabled: showUnmapped,
  })

  // Re-map complete mutation
  const remapCompleteMutation = useMutation({
    mutationFn: async (params: { disable_learning: boolean; clear_knowledge_base: boolean }) => {
      const { data } = await api.post<RemapCompleteResult>(
        `/api/likewize/v3/tareas/${tareaId}/remapear-completo/`,
        params
      )
      return data
    },
    onSuccess: (data) => {
      setRemapResult(data)
      // Invalidar todas las queries relacionadas con la tarea
      queryClient.invalidateQueries({ queryKey: ['likewize_v3_task_status', tareaId] })
      queryClient.invalidateQueries({ queryKey: ['likewize_v3_unmapped', tareaId] })
      queryClient.invalidateQueries({ queryKey: ['validation_items', tareaId] }) // Para que Validación se actualice
      queryClient.invalidateQueries({ queryKey: ['likewize_diff', tareaId] }) // Para que Cambios de Precios se actualice
      queryClient.invalidateQueries({ queryKey: ['likewize_tarea', tareaId] }) // Para el estado general
      setShowRemapDialog(false)
    },
  })

  const handleRemapClick = () => {
    setShowRemapDialog(true)
  }

  const handleRemapConfirm = () => {
    remapCompleteMutation.mutate({
      disable_learning: disableLearning,
      clear_knowledge_base: clearKnowledgeBase,
    })
  }

  const stats = taskStatus.data?.task.mapping_stats

  if (taskStatus.isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  if (taskStatus.error) {
    return (
      <Alert severity="error">
        Error al cargar estadísticas: {taskStatus.error instanceof Error ? taskStatus.error.message : 'Error desconocido'}
      </Alert>
    )
  }

  return (
    <Stack spacing={3}>
      {/* Task Status Header */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Estado de la Tarea</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                label={taskStatus.data?.task.estado}
                color={
                  taskStatus.data?.task.estado === 'SUCCESS'
                    ? 'success'
                    : taskStatus.data?.task.estado === 'ERROR'
                    ? 'error'
                    : 'warning'
                }
              />
              <IconButton onClick={() => taskStatus.refetch()} size="small">
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Overall Mapping Statistics */}
      {stats && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Estadísticas de Mapeo General
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <CardContent>
                    <Typography variant="h4" align="center">
                      {stats.total}
                    </Typography>
                    <Typography variant="body2" align="center">
                      Total Items
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <CardContent>
                    <Typography variant="h4" align="center">
                      {stats.mapped}
                    </Typography>
                    <Typography variant="body2" align="center">
                      Mapeados
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
                  <CardContent>
                    <Typography variant="h4" align="center">
                      {stats.unmapped}
                    </Typography>
                    <Typography variant="body2" align="center">
                      Sin Mapear
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <CardContent>
                    <Typography variant="h4" align="center">
                      {stats.mapping_rate}
                    </Typography>
                    <Typography variant="body2" align="center">
                      Tasa de Mapeo
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Mapping by Device Type */}
      {stats && stats.by_type.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Estadísticas por Tipo de Dispositivo
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Mapeados</TableCell>
                    <TableCell align="right">Sin Mapear</TableCell>
                    <TableCell align="right">Tasa</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.by_type.map((row) => (
                    <TableRow key={row.tipo}>
                      <TableCell>
                        <Chip label={row.tipo} size="small" />
                      </TableCell>
                      <TableCell align="right">{row.total}</TableCell>
                      <TableCell align="right">{row.mapped}</TableCell>
                      <TableCell align="right">{row.unmapped}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={row.mapping_rate}
                          size="small"
                          color={parseFloat(row.mapping_rate) >= 95 ? 'success' : parseFloat(row.mapping_rate) >= 80 ? 'warning' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Unmapped A-Numbers */}
      {stats && Object.keys(stats.unmapped_anumbers).length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">A-Numbers Sin Mapear</Typography>
              <IconButton onClick={() => setShowUnmapped(!showUnmapped)} size="small">
                {showUnmapped ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={1}>
                {Object.entries(stats.unmapped_anumbers)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([anumber, count]) => (
                    <Grid key={anumber}>
                      <Chip label={`${anumber} (${count})`} variant="outlined" color="error" />
                    </Grid>
                  ))}
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Unmapped Items Details */}
      <Collapse in={showUnmapped}>
        {unmappedItems.isLoading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        )}
        {unmappedItems.data && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Items Sin Mapear ({unmappedItems.data.total_unmapped})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Modelo Raw</TableCell>
                      <TableCell>Tipo</TableCell>
                      <TableCell>Marca</TableCell>
                      <TableCell align="right">Almacenamiento</TableCell>
                      <TableCell align="right">Precio B2B</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unmappedItems.data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                            {item.modelo_raw}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.tipo}</TableCell>
                        <TableCell>{item.marca}</TableCell>
                        <TableCell align="right">{item.almacenamiento_gb ? `${item.almacenamiento_gb} GB` : '-'}</TableCell>
                        <TableCell align="right">{item.precio_b2b}€</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Collapse>

      {/* Remap Complete Result */}
      {remapResult && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Resultado del Re-Mapeo
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Antes
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Chip label={`Mapeados: ${remapResult.stats_before.mapped}`} size="small" />
                  <Chip label={`Sin mapear: ${remapResult.stats_before.unmapped}`} size="small" />
                  <Chip label={remapResult.stats_before.mapping_rate} size="small" color="default" />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Después
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Chip label={`Mapeados: ${remapResult.stats_after.mapped}`} size="small" />
                  <Chip label={`Sin mapear: ${remapResult.stats_after.unmapped}`} size="small" />
                  <Chip label={remapResult.stats_after.mapping_rate} size="small" color="success" />
                </Stack>
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ bgcolor: 'success.light' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TrendingUpIcon color="success" />
                      <div>
                        <Typography variant="h6">{remapResult.changes.improved}</Typography>
                        <Typography variant="body2">Mejorados</Typography>
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ bgcolor: 'error.light' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TrendingDownIcon color="error" />
                      <div>
                        <Typography variant="h6">{remapResult.changes.worsened}</Typography>
                        <Typography variant="body2">Empeorados</Typography>
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ bgcolor: 'warning.light' }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <SwapHorizIcon color="warning" />
                      <div>
                        <Typography variant="h6">{remapResult.changes.remapped}</Typography>
                        <Typography variant="body2">Re-mapeados</Typography>
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {remapResult.details.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detalles de Cambios (mostrando {remapResult.total_details_shown} de {remapResult.total_details_available})
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Modelo Raw</TableCell>
                        <TableCell>Antes</TableCell>
                        <TableCell>Después</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Confianza</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {remapResult.details.map((detail, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {detail.modelo_raw}
                            </Typography>
                          </TableCell>
                          <TableCell>{detail.before || '-'}</TableCell>
                          <TableCell>{detail.after || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={detail.change_type}
                              size="small"
                              icon={
                                detail.change_type === 'improved' ? (
                                  <CheckCircleIcon />
                                ) : detail.change_type === 'worsened' ? (
                                  <ErrorIcon />
                                ) : (
                                  <SwapHorizIcon />
                                )
                              }
                              color={
                                detail.change_type === 'improved'
                                  ? 'success'
                                  : detail.change_type === 'worsened'
                                  ? 'error'
                                  : 'warning'
                              }
                            />
                          </TableCell>
                          <TableCell>{detail.confidence || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Re-map Button */}
      <Box>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleRemapClick}
          disabled={remapCompleteMutation.isPending || taskStatus.data?.task.estado !== 'SUCCESS'}
          startIcon={remapCompleteMutation.isPending ? <CircularProgress size={20} /> : <RefreshIcon />}
        >
          {remapCompleteMutation.isPending ? 'Re-mapeando...' : 'Re-mapear Tarea Completa'}
        </Button>
      </Box>

      {/* Re-map Confirmation Dialog */}
      <Dialog open={showRemapDialog} onClose={() => setShowRemapDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar Re-Mapeo Completo</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Esto re-mapeará TODOS los items de la tarea usando el código de mapeo actualizado.
          </Alert>
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={disableLearning} onChange={(e) => setDisableLearning(e.target.checked)} />}
              label="Deshabilitar aprendizaje automático (recomendado para pruebas)"
            />
            <FormControlLabel
              control={<Switch checked={clearKnowledgeBase} onChange={(e) => setClearKnowledgeBase(e.target.checked)} />}
              label="Limpiar knowledge base antes de re-mapear"
            />
            <Typography variant="body2" color="text.secondary">
              {disableLearning
                ? '✓ El knowledge base NO se actualizará durante este re-mapeo'
                : '⚠️ El sistema aprenderá de los mapeos y actualizará el knowledge base'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRemapDialog(false)}>Cancelar</Button>
          <Button onClick={handleRemapConfirm} variant="contained" color="primary">
            Confirmar Re-Mapeo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Display */}
      {remapCompleteMutation.error && (
        <Alert severity="error">
          Error al re-mapear: {remapCompleteMutation.error instanceof Error ? remapCompleteMutation.error.message : 'Error desconocido'}
        </Alert>
      )}
    </Stack>
  )
}
