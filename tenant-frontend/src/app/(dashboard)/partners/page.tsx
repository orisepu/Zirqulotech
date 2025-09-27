'use client'

import { useRouter } from 'next/navigation'
import api from '@/services/api'
import {
  Typography, Box, Paper, TextField, Snackbar, Alert, Grid, Card, CardContent, CardActions,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Fab, Tooltip,
  Stack, InputAdornment, IconButton, Chip, FormControl, InputLabel, Select, MenuItem,
  Divider, Skeleton, ButtonGroup, FormControlLabel, Switch, Container, Pagination
} from '@mui/material'
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useState, useMemo, useEffect, useCallback } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import StoreIcon from '@mui/icons-material/Store'
import GroupIcon from '@mui/icons-material/Group'
import DashboardIcon from '@mui/icons-material/Dashboard'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import AddIcon from '@mui/icons-material/Add'
import BusinessIcon from '@mui/icons-material/Business'
import ClearIcon from '@mui/icons-material/Clear'
import FilterListIcon from '@mui/icons-material/FilterList'
import { formatoBonito } from '@/context/precios'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PercentIcon from '@mui/icons-material/Percent'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import TableRowsIcon from '@mui/icons-material/TableRows'
import TablaReactiva2 from '@/components/TablaReactiva2'
import { createColumnHelper } from '@tanstack/react-table'
import { toast } from 'react-toastify'

const columnHelper = createColumnHelper<any>()

export default function PartnerListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [nuevoPartner, setNuevoPartner] = useState({
    name: "", schema: "", cif: "",
    direccion_calle: "", direccion_cp: "",
    direccion_poblacion: "", direccion_provincia: "", direccion_pais: "España",
    comision_pct: 10 as number,
    solo_empresas: false,
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; mensaje: string; tipo?: 'success' | 'error' }>({
    open: false,
    mensaje: '',
    tipo: 'error',
  })
  const formatPct = (n?: number) => {
    if (n === null || n === undefined || Number.isNaN(n)) return '—'
    return `${Number(n).toFixed(1)}%`
  }
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo' | 'pendiente'>('todos')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<'nombre' | 'fecha_creacion' | 'tiendas' | 'comision_pct'>('nombre')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filtroComision, setFiltroComision] = useState<{ min: number; max: number }>({ min: 0, max: 100 })

  const { data: partners = [], isLoading } = useQuery<any[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get('/api/tenants/')
      const d = res.data as any
      if (Array.isArray(d)) return d
      if (Array.isArray(d?.results)) return d.results
      if (Array.isArray(d?.items)) return d.items
      if (Array.isArray(d?.tenants)) return d.tenants
      return []
    },
  })

  const filteredPartners = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (Array.isArray(partners) ? partners : [])
      .filter((p: any) => {
        const matchTerm = !term || `${p.nombre ?? ''} ${p.schema ?? ''} ${p.direccion_poblacion ?? ''} ${p.direccion_provincia ?? ''}`.toLowerCase().includes(term)
        const matchEstado = filtroEstado === 'todos' ? true : (p.estado ?? '').toLowerCase() === filtroEstado
        const comision = p.comision_pct ?? 0
        const matchComision = comision >= filtroComision.min && comision <= filtroComision.max
        return matchTerm && matchEstado && matchComision
      })
      .sort((a: any, b: any) => {
        let aVal, bVal
        switch (sortBy) {
          case 'nombre':
            aVal = (a.nombre ?? '').toLowerCase()
            bVal = (b.nombre ?? '').toLowerCase()
            break
          case 'fecha_creacion':
            aVal = new Date(a.fecha_creacion ?? 0).getTime()
            bVal = new Date(b.fecha_creacion ?? 0).getTime()
            break
          case 'tiendas':
            aVal = a.tiendas ?? 0
            bVal = b.tiendas ?? 0
            break
          case 'comision_pct':
            aVal = a.comision_pct ?? 0
            bVal = b.comision_pct ?? 0
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
  }, [partners, search, filtroEstado, filtroComision, sortBy, sortOrder])

  // Auto-switch to table view when there are many partners
  const shouldUseTableView = filteredPartners.length > 20
  const effectiveViewMode = shouldUseTableView ? 'table' : viewMode

  // Pagination for cards view
  const paginatedPartners = useMemo(() => {
    if (effectiveViewMode === 'table') {
      return filteredPartners // TanStack Table handles its own pagination
    }
    const startIndex = page * pageSize
    return filteredPartners.slice(startIndex, startIndex + pageSize)
  }, [filteredPartners, page, pageSize, effectiveViewMode])

  const totalPages = Math.ceil(filteredPartners.length / pageSize)

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [search, filtroEstado, filtroComision, sortBy, sortOrder])

  // Stats for summary cards
  const stats = useMemo(() => {
    const partnersArray = Array.isArray(partners) ? partners : []
    const total = partnersArray.length
    const activos = partnersArray.filter(p => (p.estado ?? '').toLowerCase() === 'activo').length
    const inactivos = partnersArray.filter(p => (p.estado ?? '').toLowerCase() === 'inactivo').length
    const totalTiendas = partnersArray.reduce((acc, p) => acc + (p.tiendas ?? 0), 0)
    return { total, activos, inactivos, totalTiendas }
  }, [partners])

  // Table columns definition
  const columns = useMemo(() => [
    {
      accessorKey: 'nombre',
      header: 'Partner',
      cell: ({ row }: any) => (
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <BusinessIcon />
          </Avatar>
          <Box>
            <Typography variant="body1" fontWeight={500}>
              {row.original.nombre}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Schema: {row.original.schema}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }: any) => {
        const estado = row.original.estado?.toLowerCase()
        const color = estado === 'activo' ? 'success' : estado === 'inactivo' ? 'error' : 'default'
        const icon = estado === 'activo' ? <CheckCircleOutlineIcon /> :
                     estado === 'inactivo' ? <DoNotDisturbOnOutlinedIcon /> : null
        return (
          <Chip
            label={row.original.estado || 'Pendiente'}
            color={color}
            size="small"
            icon={icon}
            variant="outlined"
          />
        )
      },
    },
    {
      accessorKey: 'tiendas',
      header: 'Tiendas',
      cell: ({ row }: any) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <StoreIcon fontSize="small" color="action" />
          <Typography variant="body2">
            {row.original.tiendas ?? 0}
          </Typography>
        </Stack>
      ),
    },
    {
      accessorKey: 'comision_pct',
      header: 'Comisión',
      cell: ({ row }: any) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <PercentIcon fontSize="small" color="action" />
          <Typography variant="body2">
            {formatPct(row.original.comision_pct)}
          </Typography>
        </Stack>
      ),
    },
    {
      accessorKey: 'goal',
      header: 'Objetivo',
      cell: ({ row }: any) => {
        const goal = row.original.goal
        const progress = row.original.progress_percent || 0
        return goal ? (
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {Math.round(progress)}%
            </Typography>
            <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1, height: 4 }}>
              <Box
                sx={{
                  width: `${Math.min(progress, 100)}%`,
                  bgcolor: progress >= 100 ? 'success.main' : progress >= 75 ? 'warning.main' : 'primary.main',
                  height: 4,
                  borderRadius: 1,
                }}
              />
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }: any) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Ver dashboard">
            <IconButton
              size="small"
              onClick={() => router.push(`/partners/${row.original.id}`)}
            >
              <DashboardIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Gestionar usuarios">
            <IconButton
              size="small"
              onClick={() => router.push(`/partners/${row.original.id}/usuarios?schema=${row.original.schema}`)}
            >
              <GroupIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Gestionar tiendas">
            <IconButton
              size="small"
              onClick={() => router.push(`/partners/${row.original.id}/tiendas?schema=${row.original.schema}`)}
            >
              <StoreIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [router])

  const crearPartnerMutation = useMutation({
    mutationFn: async (payload: typeof nuevoPartner) => {
      return api.post("/api/crear-company/", payload)
    },
    onSuccess: async () => {
      setModalOpen(false)
      setNuevoPartner({
        name: "", schema: "", cif: "",
        direccion_calle: "", direccion_cp: "",
        direccion_poblacion: "", direccion_provincia: "", direccion_pais: "España",
        comision_pct: 10,
        solo_empresas: false,
      })
      await queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setSnackbar({ open: true, mensaje: 'Partner creado correctamente.', tipo: 'success' })
    },
    onError: (err: any) => {
      setSnackbar({
        open: true,
        tipo: 'error',
        mensaje: "Error al crear partner: " + (err?.response?.data?.error || "Error desconocido"),
      })
    }
  })

  const toggleEstadoMutation = useMutation({
    mutationFn: async ({ id, next }: { id: number, next: 'activo' | 'inactivo' }) => {
      return api.patch(`/api/tenants/${id}/`, { estado: next })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
    onError: () => setSnackbar({ open: true, tipo: 'error', mensaje: 'No se pudo cambiar el estado.' })
  })

  function slugify(input: string) {
    return input
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 30)
  }

  const estadoChip = (estado?: string) => {
    const e = (estado ?? '').toLowerCase()
    if (e === 'activo') return <Chip size="small" color="success" variant="filled" icon={<CheckCircleOutlineIcon fontSize="small" />} label="Activo" />
    if (e === 'inactivo') return <Chip size="small" color="default" variant="outlined" icon={<DoNotDisturbOnOutlinedIcon fontSize="small" />} label="Inactivo" />
    if (e === 'default') return <Chip size="small" color="info" variant="outlined" icon={<StarBorderIcon fontSize="small" />} label="Predeterminado" />
    if (e === 'autoadmin') return <Chip size="small" color="secondary" variant="outlined" icon={<ManageAccountsOutlinedIcon fontSize="small" />} label="Autogestionado" />
    return <Chip size="small" color="warning" label={estado || 'Pendiente'} />
  }

  const handleCrearPartner = () => {
    if (!nuevoPartner.name || !nuevoPartner.schema || !nuevoPartner.cif) {
      setSnackbar({ open: true, tipo: 'error', mensaje: 'Nombre, Schema y CIF son obligatorios.' })
      return
    }
    const c = Number(nuevoPartner.comision_pct)
    if (Number.isNaN(c) || c < 0 || c > 100) {
      setSnackbar({ open: true, tipo: 'error', mensaje: 'La comisión debe estar entre 0 y 100.' })
      return
    }
    crearPartnerMutation.mutate(nuevoPartner)
  }

  const clearSearch = useCallback(() => {
    setSearch('')
    setFiltroEstado('todos')
    setFiltroComision({ min: 0, max: 100 })
    setSortBy('nombre')
    setSortOrder('asc')
  }, [])

  // Memoized handlers for performance
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }, [])

  const handleStateFilterChange = useCallback((value: string) => {
    setFiltroEstado(value as any)
  }, [])

  const handleViewModeChange = useCallback((mode: 'cards' | 'table') => {
    setViewMode(mode)
  }, [])

  const handlePageChange = useCallback((_: any, newPage: number) => {
    setPage(newPage - 1)
  }, [])

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize)
    setPage(0)
  }, [])

  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 3 }}>
          <Typography variant="h4" gutterBottom>Partners</Typography>
          <Grid container spacing={3}>
            {[...Array(6)].map((_, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" height={32} />
                    <Skeleton variant="text" height={24} />
                    <Skeleton variant="rectangular" height={40} sx={{ mt: 1 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" gutterBottom>Partners</Typography>
            <Typography variant="body1" color="text.secondary">
              Gestiona tus partners y su configuración • {filteredPartners.length} partners
              {shouldUseTableView && (
                <Chip
                  label="Vista de tabla activada automáticamente"
                  size="small"
                  variant="outlined"
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            {!shouldUseTableView && (
              <ButtonGroup size="small" variant="outlined">
                <Tooltip title="Vista de tarjetas">
                  <Button
                    onClick={() => handleViewModeChange('cards')}
                    variant={effectiveViewMode === 'cards' ? 'contained' : 'outlined'}
                  >
                    <ViewModuleIcon />
                  </Button>
                </Tooltip>
                <Tooltip title="Vista de tabla">
                  <Button
                    onClick={() => handleViewModeChange('table')}
                    variant={effectiveViewMode === 'table' ? 'contained' : 'outlined'}
                  >
                    <TableRowsIcon />
                  </Button>
                </Tooltip>
              </ButtonGroup>
            )}

            <Fab
              variant="extended"
              color="primary"
              onClick={() => setModalOpen(true)}
            >
              <AddIcon sx={{ mr: 1 }} />
              Nuevo Partner
            </Fab>
          </Stack>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h3" color="primary.main">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total Partners</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h3" color="success.main">{stats.activos}</Typography>
              <Typography variant="body2" color="text.secondary">Activos</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h3" color="error.main">{stats.inactivos}</Typography>
              <Typography variant="body2" color="text.secondary">Inactivos</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h3" color="info.main">{stats.totalTiendas}</Typography>
              <Typography variant="body2" color="text.secondary">Total Tiendas</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Advanced Search and Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon />
            Búsqueda y Filtros
          </Typography>

          <Grid container spacing={2} alignItems="center">
            {/* Search */}
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                value={search}
                onChange={handleSearchChange}
                placeholder="Buscar por nombre, schema, ubicación..."
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: search && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}>
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </Grid>

            {/* Estado Filter */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Estado</InputLabel>
                <Select
                  label="Estado"
                  value={filtroEstado}
                  onChange={(e) => handleStateFilterChange(e.target.value as string)}
                >
                  <MenuItem value="todos">Todos</MenuItem>
                  <MenuItem value="activo">Activos</MenuItem>
                  <MenuItem value="inactivo">Inactivos</MenuItem>
                  <MenuItem value="pendiente">Pendientes</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort By */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Ordenar por</InputLabel>
                <Select
                  label="Ordenar por"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <MenuItem value="nombre">Nombre</MenuItem>
                  <MenuItem value="fecha_creacion">Fecha creación</MenuItem>
                  <MenuItem value="tiendas">Nº Tiendas</MenuItem>
                  <MenuItem value="comision_pct">Comisión</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort Order */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <ButtonGroup size="small" fullWidth>
                <Button
                  variant={sortOrder === 'asc' ? 'contained' : 'outlined'}
                  onClick={() => setSortOrder('asc')}
                >
                  ↑ ASC
                </Button>
                <Button
                  variant={sortOrder === 'desc' ? 'contained' : 'outlined'}
                  onClick={() => setSortOrder('desc')}
                >
                  ↓ DESC
                </Button>
              </ButtonGroup>
            </Grid>

            {/* Results Count */}
            <Grid size={{ xs: 12, md: 2 }}>
              <Box textAlign={{ xs: 'left', md: 'right' }}>
                <Typography variant="body2" color="text.secondary">
                  {filteredPartners.length} de {Array.isArray(partners) ? partners.length : 0} partners
                </Typography>
                {filteredPartners.length !== (Array.isArray(partners) ? partners.length : 0) && (
                  <Typography variant="caption" color="primary">
                    Filtros aplicados
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Commission Range Filter */}
            <Grid size={{ xs: 12 }}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Rango de comisión: {filtroComision.min}% - {filtroComision.max}%
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    label="Min %"
                    type="number"
                    size="small"
                    value={filtroComision.min}
                    onChange={(e) => setFiltroComision(prev => ({ ...prev, min: Number(e.target.value) }))}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    sx={{ width: 100 }}
                  />
                  <TextField
                    label="Max %"
                    type="number"
                    size="small"
                    value={filtroComision.max}
                    onChange={(e) => setFiltroComision(prev => ({ ...prev, max: Number(e.target.value) }))}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    sx={{ width: 100 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setFiltroComision({ min: 0, max: 100 })}
                  >
                    Restablecer
                  </Button>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Hybrid View: Cards or Table */}
        {effectiveViewMode === 'table' ? (
          <TablaReactiva2
            oportunidades={filteredPartners}
            columnas={columns}
            loading={isLoading}
            hideColumnSelector
            hideExport
          />
        ) : (
          <>
            <Grid container spacing={3}>
              {paginatedPartners.map((partner: any) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={partner.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 4,
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    {/* Header */}
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                        <BusinessIcon />
                      </Avatar>
                      {estadoChip(partner.estado)}
                    </Box>

                    {/* Partner Info */}
                    <Typography variant="h6" gutterBottom noWrap title={partner.nombre}>
                      {partner.nombre}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Schema: {partner.schema}
                    </Typography>

                    {/* Stats */}
                    <Box display="flex" gap={2} my={2}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <StoreIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {partner.tiendas ?? 0} tienda{(partner.tiendas ?? 0) !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                      {partner.comision_pct && (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PercentIcon fontSize="small" color="action" />
                          <Typography variant="body2">
                            {formatPct(partner.comision_pct)}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* Location */}
                    {partner.direccion_poblacion && (
                      <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                        <LocationOnIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {partner.direccion_poblacion}
                          {partner.direccion_provincia && `, ${partner.direccion_provincia}`}
                        </Typography>
                      </Box>
                    )}

                    {/* Mode */}
                    {partner.modo && (
                      <Box mt={1}>
                        {estadoChip(formatoBonito(partner.modo))}
                      </Box>
                    )}
                  </CardContent>

                  <Divider />
                  <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => router.push(`/partners/${partner.schema}`)}
                    >
                      Ver
                    </Button>

                    <ButtonGroup size="small" variant="outlined">
                      <Tooltip title="Tiendas">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/partners/${partner.schema}/tiendas`)}
                        >
                          <StoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Usuarios">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/partners/${partner.schema}/usuarios`)}
                        >
                          <GroupIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dashboard">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/partners/${partner.schema}/dashboard`)}
                        >
                          <DashboardIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={(partner.estado ?? '').toLowerCase() === 'activo' ? 'Desactivar' : 'Activar'}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const next = ((partner.estado ?? '').toLowerCase() === 'activo') ? 'inactivo' : 'activo'
                            toggleEstadoMutation.mutate({ id: partner.id, next })
                          }}
                          color={(partner.estado ?? '').toLowerCase() === 'activo' ? 'error' : 'success'}
                        >
                          <PowerSettingsNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ButtonGroup>
                  </CardActions>
                </Card>
              </Grid>
              ))}
            </Grid>

            {/* Pagination for Cards View */}
            {filteredPartners.length > 0 && (
              <Box mt={4}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                >
                  <FormControl size="small">
                    <InputLabel>Por página</InputLabel>
                    <Select
                      label="Por página"
                      value={pageSize}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value={12}>12</MenuItem>
                      <MenuItem value={24}>24</MenuItem>
                      <MenuItem value={48}>48</MenuItem>
                      <MenuItem value={96}>96</MenuItem>
                    </Select>
                  </FormControl>

                  {totalPages > 1 && (
                    <Pagination
                      count={totalPages}
                      page={page + 1}
                      onChange={handlePageChange}
                      color="primary"
                      size={{ xs: 'medium', sm: 'large' }}
                      showFirstButton
                      showLastButton
                    />
                  )}

                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredPartners.length)} de {filteredPartners.length}
                  </Typography>
                </Stack>
              </Box>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && filteredPartners.length === 0 && (
          <Box textAlign="center" py={8}>
            <BusinessIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No se encontraron partners
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {search || filtroEstado !== 'todos'
                ? 'Prueba a cambiar los filtros de búsqueda'
                : 'Comienza creando tu primer partner'
              }
            </Typography>
            {search || filtroEstado !== 'todos' ? (
              <Button variant="outlined" onClick={clearSearch} startIcon={<ClearIcon />}>
                Limpiar filtros
              </Button>
            ) : (
              <Button variant="contained" onClick={() => setModalOpen(true)} startIcon={<AddIcon />}>
                Crear primer partner
              </Button>
            )}
          </Box>
        )}

        {/* Create Partner Dialog */}
        <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={1}>
              <BusinessIcon />
              Crear nuevo Partner
            </Box>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Nombre *"
                  fullWidth
                  value={nuevoPartner.name}
                  onChange={e => {
                    const name = e.target.value
                    setNuevoPartner(prev => ({ ...prev, name, schema: prev.schema || slugify(name) }))
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Schema *"
                  fullWidth
                  helperText="Minúsculas, sin espacios ni acentos"
                  value={nuevoPartner.schema}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, schema: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="CIF *"
                  fullWidth
                  value={nuevoPartner.cif}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, cif: (e.target.value || '').toUpperCase() })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Comisión (%)"
                  type="number"
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                  fullWidth
                  value={nuevoPartner.comision_pct}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, comision_pct: Number(e.target.value) })}
                  helperText="Porcentaje aplicado a este partner"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(nuevoPartner.solo_empresas)}
                      onChange={(_, checked) => setNuevoPartner({ ...nuevoPartner, solo_empresas: checked })}
                      color="primary"
                    />
                  }
                  label="Solo para empresas (B2B)"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  Si está activo, este partner solo estará disponible para clientes empresa o autónomos.
                </Typography>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }}>
                  <Typography variant="body2" color="text.secondary">Dirección (opcional)</Typography>
                </Divider>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Calle"
                  fullWidth
                  value={nuevoPartner.direccion_calle}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_calle: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Código Postal"
                  fullWidth
                  value={nuevoPartner.direccion_cp}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_cp: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Población"
                  fullWidth
                  value={nuevoPartner.direccion_poblacion}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_poblacion: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Provincia"
                  fullWidth
                  value={nuevoPartner.direccion_provincia}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_provincia: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="País"
                  fullWidth
                  value={nuevoPartner.direccion_pais}
                  onChange={e => setNuevoPartner({ ...nuevoPartner, direccion_pais: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handleCrearPartner}
              disabled={crearPartnerMutation.isPending}
              startIcon={crearPartnerMutation.isPending ? undefined : <AddIcon />}
            >
              {crearPartnerMutation.isPending ? 'Creando…' : 'Crear Partner'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={5000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={snackbar.tipo || 'error'}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            sx={{ width: '100%' }}
          >
            {snackbar.mensaje}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  )
}