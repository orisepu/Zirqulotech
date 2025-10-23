"use client"

import { useState, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Switch,
  Paper,
  Stack,
} from '@mui/material'
import {
  Search,
  Clear,
  Add,
  Edit,
  CheckCircle,
  Cancel,
} from '@mui/icons-material'
import { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import TablaReactiva from '@/shared/components/TablaReactiva2'
import { UserEditDialog } from '@/features/users/components/UserEditDialog'
import { useGlobalUsers, useToggleUserActive } from '@/features/users/hooks/useGlobalUsers'
import { filterUsers } from '@/features/users/utils/userFilters'
import type { UserApiResponse, UserFilters } from '@/features/users/types'

interface Tenant {
  id: number
  nombre: string
  schema_name: string
}

export default function GestionUsuariosPage() {
  // Filter state
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    tenant_slug: '',
    rol: 'all',
    is_active: 'all',
  })

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserApiResponse | null>(null)

  // Fetch ALL users from public schema
  const {
    data: usuarios = [],
    isLoading: loadingUsuarios,
  } = useGlobalUsers()

  // Fetch tenants for filter
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data } = await api.get('/api/tenants/')
      return data
    },
  })

  // Toggle active mutation
  const toggleActiveMutation = useToggleUserActive(
    filters.tenant_slug || undefined
  )

  // Filter users based on criteria
  const filteredUsers = useMemo(
    () => filterUsers(usuarios, filters),
    [usuarios, filters]
  )

  // Clear search
  const handleClearSearch = () => {
    setFilters({ ...filters, search: '' })
  }

  // Handle edit user
  const handleEditUser = (user: UserApiResponse) => {
    setSelectedUser(user)
    setEditDialogOpen(true)
  }

  // Handle close edit dialog
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setSelectedUser(null)
  }

  // Handle toggle active
  const handleToggleActive = useCallback((userId: number, currentStatus: boolean) => {
    toggleActiveMutation.mutate({
      userId,
      isActive: !currentStatus,
    })
  }, [toggleActiveMutation])

  // Table columns
  const columns = useMemo<ColumnDef<UserApiResponse>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Nombre',
        meta: {
          label: 'Nombre',
          minWidth: 180,
        },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        meta: {
          label: 'Email',
          minWidth: 220,
          ellipsis: true,
          ellipsisMaxWidth: 280,
        },
      },
      {
        id: 'rol',
        accessorKey: 'rol_lectura',
        header: 'Rol',
        cell: ({ row }) => {
          const rol = row.original.rol_lectura
          const rolLabels: Record<string, string> = {
            comercial: 'Comercial',
            store_manager: 'Store Manager',
            manager: 'Manager',
          }
          return (
            <Chip
              label={rolLabels[rol || 'comercial'] || rol || 'Sin rol'}
              size="small"
              color={rol === 'manager' ? 'primary' : 'default'}
            />
          )
        },
        meta: {
          label: 'Rol',
          minWidth: 140,
        },
      },
      {
        id: 'tienda',
        accessorKey: 'tienda_nombre',
        header: 'Tienda',
        cell: ({ row }) => {
          return row.original.tienda_nombre || (
            <Typography variant="body2" color="text.secondary">
              Sin asignar
            </Typography>
          )
        },
        meta: {
          label: 'Tienda',
          minWidth: 160,
        },
      },
      {
        id: 'estado',
        accessorKey: 'is_active',
        header: 'Estado',
        cell: ({ row }) => (
          <Box display="flex" alignItems="center" gap={1}>
            <Switch
              checked={!!row.original.is_active}
              onChange={() =>
                handleToggleActive(
                  row.original.id,
                  row.original.is_active
                )
              }
              color="primary"
              size="small"
              slotProps={{ input: { 'aria-label': 'Activar/Desactivar usuario' } }}
            />
            {row.original.is_active ? (
              <CheckCircle color="success" fontSize="small" />
            ) : (
              <Cancel color="disabled" fontSize="small" />
            )}
          </Box>
        ),
        meta: {
          label: 'Estado',
          minWidth: 120,
          align: 'center' as const,
        },
      },
      {
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Edit />}
            onClick={() => handleEditUser(row.original)}
          >
            Editar
          </Button>
        ),
        meta: {
          label: 'Acciones',
          minWidth: 120,
          align: 'center' as const,
        },
      },
    ],
    [handleToggleActive]
  )

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Typography variant="h4">Gestión de Usuarios</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            // TODO: Implement create user dialog
            alert('Funcionalidad de crear usuario - Por implementar')
          }}
        >
          Crear Usuario
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6" gutterBottom>
            Filtros
          </Typography>

          <Box
            display="grid"
            gridTemplateColumns={{
              xs: '1fr',
              sm: '1fr 1fr',
              md: '2fr 1fr 1fr 1fr',
            }}
            gap={2}
          >
            {/* Search */}
            <TextField
              size="small"
              placeholder="Buscar por nombre o email..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                  endAdornment: filters.search && (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="limpiar búsqueda"
                        onClick={handleClearSearch}
                        edge="end"
                        size="small"
                      >
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Tenant filter */}
            <FormControl size="small" fullWidth>
              <InputLabel id="filter-tenant-label">Partner</InputLabel>
              <Select
                labelId="filter-tenant-label"
                label="Partner"
                value={filters.tenant_slug}
                onChange={(e) =>
                  setFilters({ ...filters, tenant_slug: e.target.value })
                }
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.schema_name}>
                    {tenant.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Role filter */}
            <FormControl size="small" fullWidth>
              <InputLabel id="filter-rol-label">Rol</InputLabel>
              <Select
                labelId="filter-rol-label"
                label="Rol"
                value={filters.rol}
                onChange={(e) =>
                  setFilters({ ...filters, rol: e.target.value })
                }
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="comercial">Comercial</MenuItem>
                <MenuItem value="store_manager">Store Manager</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
              </Select>
            </FormControl>

            {/* Status filter */}
            <FormControl size="small" fullWidth>
              <InputLabel id="filter-status-label">Estado</InputLabel>
              <Select
                labelId="filter-status-label"
                label="Estado"
                value={filters.is_active}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    is_active: e.target.value as 'all' | 'active' | 'inactive',
                  })
                }
              >
                <MenuItem value="all">Todos</MenuItem>
                <MenuItem value="active">Activos</MenuItem>
                <MenuItem value="inactive">Inactivos</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Active filters summary */}
          <Box display="flex" gap={1} flexWrap="wrap">
            {filters.search && (
              <Chip
                label={`Búsqueda: "${filters.search}"`}
                size="small"
                onDelete={handleClearSearch}
              />
            )}
            {filters.tenant_slug && (
              <Chip
                label={`Partner: ${
                  tenants.find((t) => t.schema_name === filters.tenant_slug)
                    ?.nombre || filters.tenant_slug
                }`}
                size="small"
                onDelete={() => setFilters({ ...filters, tenant_slug: '' })}
              />
            )}
            {filters.rol !== 'all' && (
              <Chip
                label={`Rol: ${filters.rol}`}
                size="small"
                onDelete={() => setFilters({ ...filters, rol: 'all' })}
              />
            )}
            {filters.is_active !== 'all' && (
              <Chip
                label={`Estado: ${
                  filters.is_active === 'active' ? 'Activos' : 'Inactivos'
                }`}
                size="small"
                onDelete={() => setFilters({ ...filters, is_active: 'all' })}
              />
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Results summary */}
      <Box mb={2}>
        <Typography variant="body2" color="text.secondary">
          Mostrando {filteredUsers.length} de {usuarios.length} usuarios
        </Typography>
      </Box>

      {/* Table */}
      <TablaReactiva
        oportunidades={filteredUsers}
        columnas={columns}
        loading={loadingUsuarios}
        usuarioId="gestion-usuarios"
        hideColumnSelector={false}
        hideExport={false}
      />

      {/* Edit Dialog */}
      <UserEditDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        user={selectedUser}
        tenantSlug={filters.tenant_slug || undefined}
      />
    </Box>
  )
}
