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

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress role="progressbar" />
      </Box>
    )
  }

  // Error state
  if (isError) {
    return (
      <Alert severity="error">
        Error al cargar dispositivos personalizados. Por favor, intenta de nuevo.
      </Alert>
    )
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Buscar dispositivos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 250 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filtrar por tipo</InputLabel>
          <Select
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

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filtrar por estado</InputLabel>
          <Select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            label="Filtrar por estado"
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="activo">Activos</MenuItem>
            <MenuItem value="inactivo">Inactivos</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreate}
          disabled={!onCreate}
        >
          Crear dispositivo
        </Button>
      </Box>

      {/* Table */}
      {filteredAndSortedData.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No hay dispositivos personalizados que mostrar
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'marca'}
                      direction={orderBy === 'marca' ? orderDirection : 'asc'}
                      onClick={() => handleSort('marca')}
                    >
                      Marca
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'modelo'}
                      direction={orderBy === 'modelo' ? orderDirection : 'asc'}
                      onClick={() => handleSort('modelo')}
                    >
                      Modelo
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Precio B2B</TableCell>
                  <TableCell align="right">Precio B2C</TableCell>
                  <TableCell>Ajustes (%)</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Acciones</TableCell>
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
                      {formatPrice(dispositivo.precio_base_b2b)}
                    </TableCell>
                    <TableCell align="right">
                      {formatPrice(dispositivo.precio_base_b2c)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" component="div">
                        {dispositivo.ajuste_excelente}% / {dispositivo.ajuste_bueno}% / {dispositivo.ajuste_malo}%
                      </Typography>
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
                        aria-label="Editar"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(dispositivo)}
                        color="error"
                        aria-label="Eliminar"
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
          />
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que deseas eliminar el dispositivo{' '}
            <strong>{deviceToDelete?.descripcion_completa}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esta acción marcará el dispositivo como inactivo.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancelar</Button>
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
