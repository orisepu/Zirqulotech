'use client'

import React, { useState, useMemo } from 'react'
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Button,
  IconButton,
  Chip,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination,
  TableSortLabel,
} from '@mui/material'
import { Edit, Delete, Add } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { toast } from 'react-toastify'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

interface DispositivosPersonalizadosTableProps {
  onEdit?: (dispositivo: DispositivoPersonalizado) => void
  onCreate?: () => void
}

export default function DispositivosPersonalizadosTable({
  onEdit,
  onCreate,
}: DispositivosPersonalizadosTableProps) {
  const queryClient = useQueryClient()

  // Estados
  const [searchTerm, setSearchTerm] = useState('')
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [estadoFilter, setEstadoFilter] = useState<string>('todos')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [orderBy, setOrderBy] = useState<keyof DispositivoPersonalizado>('marca')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('asc')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<DispositivoPersonalizado | null>(null)

  // Fetch dispositivos
  const { data: dispositivos = [], isLoading, isError } = useQuery({
    queryKey: ['dispositivos-personalizados'],
    queryFn: async () => {
      const { data } = await api.get('/api/dispositivos-personalizados/')
      return data as DispositivoPersonalizado[]
    },
  })

  // Mutation para eliminar
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/dispositivos-personalizados/${id}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispositivos-personalizados'] })
      toast.success('Dispositivo eliminado correctamente')
      setDeleteDialogOpen(false)
      setDeviceToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Error al eliminar dispositivo')
    },
  })

  // Filtrado y ordenamiento
  const filteredAndSortedData = useMemo(() => {
    let filtered = dispositivos

    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((d) =>
        d.marca.toLowerCase().includes(term) ||
        d.modelo.toLowerCase().includes(term) ||
        d.descripcion_completa.toLowerCase().includes(term)
      )
    }

    // Filtro por tipo
    if (tipoFilter !== 'todos') {
      filtered = filtered.filter((d) => d.tipo === tipoFilter)
    }

    // Filtro por estado
    if (estadoFilter === 'activo') {
      filtered = filtered.filter((d) => d.activo === true)
    } else if (estadoFilter === 'inactivo') {
      filtered = filtered.filter((d) => d.activo === false)
    }

    // Ordenamiento
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[orderBy]
      const bVal = b[orderBy]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return orderDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return orderDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })

    return filtered
  }, [dispositivos, searchTerm, tipoFilter, estadoFilter, orderBy, orderDirection])

  // Paginación
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage
    return filteredAndSortedData.slice(start, start + rowsPerPage)
  }, [filteredAndSortedData, page, rowsPerPage])

  // Handlers
  const handleSort = (column: keyof DispositivoPersonalizado) => {
    if (orderBy === column) {
      setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(column)
      setOrderDirection('asc')
    }
  }

  const handleDeleteClick = (dispositivo: DispositivoPersonalizado) => {
    setDeviceToDelete(dispositivo)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (deviceToDelete) {
      deleteMutation.mutate(deviceToDelete.id)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setDeviceToDelete(null)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(price)
  }

  // Loading state - ACCESIBILIDAD MEJORADA
  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}
        role="status"
        aria-live="polite"
      >
        <CircularProgress aria-label="Cargando dispositivos personalizados" />
        <Typography sx={{ mt: 2, position: 'absolute', left: '-10000px' }}>
          Cargando dispositivos personalizados. Por favor, espere.
        </Typography>
      </Box>
    )
  }

  // Error state - ACCESIBILIDAD MEJORADA
  if (isError) {
    return (
      <Alert
        severity="error"
        role="alert"
        aria-live="assertive"
      >
        <strong>Error al cargar dispositivos personalizados.</strong>
        <br />
        Verifique su conexión a internet e intente recargar la página (presione F5).
        Si el problema persiste, contacte con soporte técnico.
      </Alert>
    )
  }

  return (
    <Box>
      {/* Toolbar - ACCESIBILIDAD MEJORADA */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreate}
          disabled={!onCreate}
          sx={{ order: { xs: -1, md: 2 } }}
        >
          Crear dispositivo
        </Button>

        <TextField
          label="Buscar dispositivos"
          placeholder="Buscar por marca, modelo o descripción"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 250, order: 1 }}
          inputProps={{
            'aria-label': 'Campo de búsqueda de dispositivos',
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150, order: 1 }}>
          <InputLabel id="tipo-filter-label">Filtrar por tipo</InputLabel>
          <Select
            labelId="tipo-filter-label"
            id="tipo-filter"
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            label="Filtrar por tipo"
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="movil">Móvil</MenuItem>
            <MenuItem value="portatil">Portátil</MenuItem>
            <MenuItem value="tablet">Tablet</MenuItem>
            <MenuItem value="monitor">Monitor</MenuItem>
            <MenuItem value="otro">Otro</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150, order: 1 }}>
          <InputLabel id="estado-filter-label">Filtrar por estado</InputLabel>
          <Select
            labelId="estado-filter-label"
            id="estado-filter"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            label="Filtrar por estado"
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="activo">Activos</MenuItem>
            <MenuItem value="inactivo">Inactivos</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Table - ACCESIBILIDAD MEJORADA */}
      {filteredAndSortedData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }} role="status">
          <Typography color="text.secondary">
            No hay dispositivos personalizados que mostrar
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table aria-label="Tabla de dispositivos personalizados">
              <caption style={{ position: 'absolute', left: '-10000px' }}>
                Tabla de dispositivos personalizados con {filteredAndSortedData.length} resultados.
                {filteredAndSortedData.length > rowsPerPage &&
                  ` Mostrando página ${page + 1} de ${Math.ceil(filteredAndSortedData.length / rowsPerPage)}.`
                }
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">
                    <TableSortLabel
                      active={orderBy === 'marca'}
                      direction={orderBy === 'marca' ? orderDirection : 'asc'}
                      onClick={() => handleSort('marca')}
                      sx={{
                        '&:focus-visible': {
                          outline: '2px solid #1976d2',
                          outlineOffset: '2px',
                          borderRadius: '4px',
                        }
                      }}
                    >
                      Marca
                    </TableSortLabel>
                  </TableCell>
                  <TableCell scope="col">
                    <TableSortLabel
                      active={orderBy === 'modelo'}
                      direction={orderBy === 'modelo' ? orderDirection : 'asc'}
                      onClick={() => handleSort('modelo')}
                      sx={{
                        '&:focus-visible': {
                          outline: '2px solid #1976d2',
                          outlineOffset: '2px',
                          borderRadius: '4px',
                        }
                      }}
                    >
                      Modelo
                    </TableSortLabel>
                  </TableCell>
                  <TableCell scope="col">Tipo</TableCell>
                  <TableCell scope="col" align="right">Precio B2B Vigente</TableCell>
                  <TableCell scope="col" align="right">Precio B2C Vigente</TableCell>
                  <TableCell scope="col">Penalizaciones (A/B/C)</TableCell>
                  <TableCell scope="col" align="right">Precio Suelo</TableCell>
                  <TableCell scope="col">Estado</TableCell>
                  <TableCell scope="col" align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((dispositivo) => (
                  <TableRow key={dispositivo.id} hover>
                    <TableCell>{dispositivo.marca}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {dispositivo.modelo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dispositivo.capacidad}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={dispositivo.tipo}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {dispositivo.precio_b2b_vigente ? formatPrice(dispositivo.precio_b2b_vigente) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {dispositivo.precio_b2c_vigente ? formatPrice(dispositivo.precio_b2c_vigente) : '—'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" component="div">
                        {(dispositivo.pp_A * 100).toFixed(0)}% / {(dispositivo.pp_B * 100).toFixed(0)}% / {(dispositivo.pp_C * 100).toFixed(0)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatPrice(dispositivo.precio_suelo)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={dispositivo.activo ? 'Activo' : 'Inactivo'}
                        color={dispositivo.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => onEdit?.(dispositivo)}
                        disabled={!onEdit}
                        aria-label={`Editar ${dispositivo.descripcion_completa}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '2px solid #1976d2',
                            outlineOffset: '2px',
                          }
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(dispositivo)}
                        color="error"
                        aria-label={`Eliminar ${dispositivo.descripcion_completa}`}
                        sx={{
                          '&:focus-visible': {
                            outline: '2px solid #d32f2f',
                            outlineOffset: '2px',
                          }
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredAndSortedData.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
            labelRowsPerPage="Filas por página:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} de ${count}`
            }
            aria-label="Paginación de la tabla de dispositivos"
          />
        </>
      )}

      {/* Delete Confirmation Dialog - ACCESIBILIDAD MEJORADA */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirmar eliminación
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            ¿Estás seguro de que deseas eliminar el dispositivo{' '}
            <strong>{deviceToDelete?.descripcion_completa}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción marcará el dispositivo como inactivo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} autoFocus>
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
