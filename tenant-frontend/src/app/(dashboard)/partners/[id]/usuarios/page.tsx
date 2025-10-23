"use client"

import { useState, useMemo, useCallback } from 'react'
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Chip,
  Switch,
  Paper,
  Stack,
  OutlinedInput,
  Popover,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import {
  Search,
  Clear,
  Add,
  Edit,
  CheckCircle,
  Cancel,
  ArrowBack,
} from '@mui/icons-material'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import api from '@/services/api'
import TablaReactiva from '@/shared/components/TablaReactiva2'
import { UserEditDialog } from '@/features/users/components/UserEditDialog'
import { useToggleUserActive, useCreateUser } from '@/features/users/hooks/useGlobalUsers'
import type { UserApiResponse } from '@/features/users/types'
import ValidatingTextField from '@/shared/components/forms/inputs/ValidatingTextField'

interface Tenant {
  id: number
  nombre: string
  schema_name: string
}

export default function UsuariosTenantPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Resolve tenant schema
  const rawSchema = searchParams?.get('schema') || ''
  const schema = useMemo(() => {
    const trimmed = rawSchema?.trim()
    if (trimmed) return trimmed
    return params?.id || undefined
  }, [rawSchema, params?.id])

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserApiResponse | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [anchorElStores, setAnchorElStores] = useState<HTMLElement | null>(null)
  const [popoverStores, setPopoverStores] = useState<number[]>([])
  const [nuevoUsuario, setNuevoUsuario] = useState({
    name: '',
    email: '',
    password: '',
    rol: 'comercial',
    tienda_id: null as number | null,
    managed_store_ids: [] as number[],
  })
  const [emailValido, setEmailValido] = useState(true)

  // Fetch tenant info
  const { data: tenant } = useQuery<Tenant>({
    queryKey: ['tenant', schema],
    queryFn: async () => {
      const { data } = await api.get(`/api/tenants/by-schema/${schema}/`)
      return data
    },
    enabled: !!schema,
  })

  // Fetch users for this tenant
  const {
    data: usuarios = [],
    isLoading: loadingUsuarios,
  } = useQuery<UserApiResponse[]>({
    queryKey: ['usuariosTenant', schema],
    queryFn: async () => {
      const { data } = await api.get<UserApiResponse[]>(
        '/api/usuarios-tenant/',
        { params: { schema } }
      )
      return Array.isArray(data) ? data : []
    },
    enabled: !!schema,
  })

  // Fetch tiendas for this tenant
  const { data: tiendas = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['tiendas', schema],
    queryFn: async () => {
      const { data } = await api.get('/api/tiendas/', {
        params: { schema },
      })
      return Array.isArray(data) ? data : []
    },
    enabled: !!schema,
  })

  // Create tienda map for quick lookup
  const tiendaMap = useMemo(() => {
    const map: Record<number, string> = {}
    tiendas.forEach((tienda) => {
      map[tienda.id] = tienda.nombre
    })
    return map
  }, [tiendas])

  // Toggle active mutation
  const toggleActiveMutation = useToggleUserActive(schema)

  // Create user mutation
  const createUserMutation = useCreateUser(schema)

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return usuarios

    const searchLower = searchTerm.toLowerCase().trim()
    return usuarios.filter(
      (user) =>
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
    )
  }, [usuarios, searchTerm])

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('')
  }

  // Handle managed stores popover
  const handleOpenStoresPopover = useCallback((event: React.MouseEvent<HTMLElement>, storeIds: number[]) => {
    setAnchorElStores(event.currentTarget)
    setPopoverStores(storeIds)
  }, [])

  const handleCloseStoresPopover = useCallback(() => {
    setAnchorElStores(null)
    setPopoverStores([])
  }, [])

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

  // Handle create user
  const handleCreateUser = () => {
    if (!emailValido || !nuevoUsuario.name.trim() || !nuevoUsuario.email.trim() || !nuevoUsuario.password.trim()) {
      return
    }

    createUserMutation.mutate(nuevoUsuario, {
      onSuccess: () => {
        setCreateDialogOpen(false)
        setNuevoUsuario({
          name: '',
          email: '',
          password: '',
          rol: 'comercial',
          tienda_id: null,
          managed_store_ids: [],
        })
        setEmailValido(true)
      },
    })
  }

  // Handle toggle active
  const handleToggleActive = useCallback(
    (userId: number, currentStatus: boolean) => {
      toggleActiveMutation.mutate({
        userId,
        isActive: !currentStatus,
      })
    },
    [toggleActiveMutation]
  )

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
        accessorKey: 'tienda_id_lectura',
        header: 'Tienda',
        cell: ({ row }) => {
          const tiendaId = row.original.tienda_id_lectura
          const isManager = row.original.rol_lectura === 'manager'
          const managedStores = row.original.managed_store_ids_lectura || []

          if (isManager && managedStores.length > 0) {
            return (
              <Chip
                label={`${managedStores.length} ${managedStores.length === 1 ? 'tienda' : 'tiendas'}`}
                size="small"
                color="primary"
                onClick={(e) => handleOpenStoresPopover(e, managedStores)}
                sx={{ cursor: 'pointer' }}
              />
            )
          }

          const tiendaNombre = tiendaId ? tiendaMap[tiendaId] : null
          return tiendaNombre || (
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
                handleToggleActive(row.original.id, row.original.is_active)
              }
              color="primary"
              size="small"
              slotProps={{
                input: { 'aria-label': 'Activar/Desactivar usuario' },
              }}
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
    [handleToggleActive, tiendaMap, handleOpenStoresPopover]
  )

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton
          onClick={() => router.push('/partners')}
          aria-label="Volver a partners"
        >
          <ArrowBack />
        </IconButton>
        <Box flex={1}>
          <Typography variant="h4">
            Usuarios de {tenant?.nombre || schema}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona los usuarios asociados a este partner
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Crear Usuario
        </Button>
      </Box>

      {/* Search bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <TextField
            size="small"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ maxWidth: 400 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
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

          {/* Results summary */}
          <Typography variant="body2" color="text.secondary">
            Mostrando {filteredUsers.length} de {usuarios.length} usuarios
          </Typography>
        </Stack>
      </Paper>

      {/* Table */}
      <TablaReactiva
        oportunidades={filteredUsers}
        columnas={columns}
        loading={loadingUsuarios}
        usuarioId={`usuarios-tenant-${schema}`}
        hideColumnSelector={false}
        hideExport={false}
      />

      {/* Edit Dialog */}
      <UserEditDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        user={selectedUser}
        tenantSlug={schema}
      />

      {/* Popover for managed stores */}
      <Popover
        open={Boolean(anchorElStores)}
        anchorEl={anchorElStores}
        onClose={handleCloseStoresPopover}
        anchorReference="none"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            },
          },
        }}
      >
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Tiendas gestionadas
          </Typography>
          <List dense>
            {popoverStores.map((storeId) => {
              const tiendaNombre = tiendaMap[storeId]
              return (
                <ListItem key={storeId} disablePadding>
                  <ListItemText
                    primary={tiendaNombre || `Tienda ID: ${storeId}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              )
            })}
          </List>
        </Box>
      </Popover>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Crear usuario</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={nuevoUsuario.name}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, name: e.target.value })}
            size="small"
            fullWidth
          />
          <ValidatingTextField
            label="Email"
            value={nuevoUsuario.email}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
            kind="email"
            type="email"
            required
            size="small"
            fullWidth
            validateOnChange
            onValidChange={(isValid) => setEmailValido(isValid)}
          />
          <FormControl fullWidth size="small">
            <InputLabel id="nuevo-rol">Rol</InputLabel>
            <Select
              labelId="nuevo-rol"
              label="Rol"
              value={nuevoUsuario.rol}
              onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
            >
              <MenuItem value="comercial">Comercial</MenuItem>
              <MenuItem value="store_manager">Store Manager</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </Select>
          </FormControl>
          {nuevoUsuario.rol !== 'manager' && (
            <FormControl fullWidth size="small">
              <InputLabel id="nuevo-tienda">Tienda</InputLabel>
              <Select
                labelId="nuevo-tienda"
                label="Tienda"
                value={nuevoUsuario.tienda_id || ''}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, tienda_id: e.target.value as number | null })}
                displayEmpty
              >
                <MenuItem value="">Sin tienda</MenuItem>
                {tiendas.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {nuevoUsuario.rol === 'manager' && (
            <FormControl fullWidth size="small">
              <InputLabel id="nuevo-managed-stores">Tiendas gestionadas</InputLabel>
              <Select
                labelId="nuevo-managed-stores"
                label="Tiendas gestionadas"
                multiple
                value={nuevoUsuario.managed_store_ids}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, managed_store_ids: typeof e.target.value === 'string' ? [] : e.target.value })}
                input={<OutlinedInput label="Tiendas gestionadas" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((storeId) => {
                      const tienda = tiendas.find((t) => t.id === storeId)
                      return (
                        <Chip
                          key={storeId}
                          label={tienda?.nombre || `ID: ${storeId}`}
                          size="small"
                        />
                      )
                    })}
                  </Box>
                )}
              >
                {tiendas.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Contraseña"
            type="password"
            value={nuevoUsuario.password}
            onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
            size="small"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={!nuevoUsuario.name || !nuevoUsuario.email || !nuevoUsuario.password || !emailValido || createUserMutation.isPending}
          >
            {createUserMutation.isPending ? 'Creando...' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
