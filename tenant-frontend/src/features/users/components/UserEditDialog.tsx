"use client"

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Box,
  Alert,
  CircularProgress,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import ValidatingTextField from '@/shared/components/forms/inputs/ValidatingTextField'
import type { UserApiResponse, UserEditForm } from '../types'
import { toast } from 'react-toastify'

interface UserEditDialogProps {
  open: boolean
  onClose: () => void
  user: UserApiResponse | null
  tenantSlug?: string
}

interface Tienda {
  id: number
  nombre: string
}

export function UserEditDialog({
  open,
  onClose,
  user,
  tenantSlug,
}: UserEditDialogProps) {
  const queryClient = useQueryClient()

  // Form state
  const [formData, setFormData] = useState<UserEditForm>({
    name: '',
    email: '',
    password: '',
    is_active: true,
  })

  const [selectedTienda, setSelectedTienda] = useState<number | ''>('')
  const [selectedRol, setSelectedRol] = useState<string>('comercial')
  const [managedStoreIds, setManagedStoreIds] = useState<number[]>([])
  const [emailValido, setEmailValido] = useState(true)

  // Load tiendas for the tenant
  const { data: tiendas = [] } = useQuery<Tienda[]>({
    queryKey: ['tiendas', tenantSlug],
    queryFn: async () => {
      if (!tenantSlug) return []
      const { data } = await api.get('/api/tiendas/', {
        params: { schema: tenantSlug },
      })
      return data
    },
    enabled: !!tenantSlug && open,
  })

  // Initialize form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        is_active: user.is_active,
      })
      setSelectedTienda(user.tienda_id_lectura || '')
      setSelectedRol(user.rol_lectura || 'comercial')
      setManagedStoreIds(user.managed_store_ids_lectura || [])
    }
  }, [user])

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user selected')

      const updates: Record<string, unknown> = {}

      // Only send changed fields
      if (formData.name !== user.name) {
        updates.name = formData.name
      }
      if (formData.email !== user.email) {
        updates.email = formData.email
      }
      if (formData.is_active !== user.is_active) {
        updates.is_active = formData.is_active
      }
      if (selectedRol !== user.rol_lectura) {
        updates.rol = selectedRol
      }
      if (selectedTienda !== user.tienda_id_lectura) {
        updates.tienda_id = selectedTienda === '' ? null : selectedTienda
      }

      // Add managed_store_ids if role is manager
      if (selectedRol === 'manager') {
        const currentManagedStores = user.managed_store_ids_lectura || []
        const managedStoresChanged =
          managedStoreIds.length !== currentManagedStores.length ||
          !managedStoreIds.every(id => currentManagedStores.includes(id))

        if (managedStoresChanged) {
          updates.managed_store_ids = managedStoreIds
        }
      }

      // Update user data
      if (Object.keys(updates).length > 0) {
        const params = tenantSlug ? { schema: tenantSlug } : {}
        await api.patch(`/api/usuarios-tenant/${user.id}/`, updates, { params })
      }

      // Change password if provided
      if (formData.password && formData.password.trim()) {
        await api.post('/api/cambiar-password/', {
          user_id: user.id,
          new_password: formData.password,
        })
      }

      // Handle responsable updates for store_manager
      if (tenantSlug) {
        const isStoreManager = selectedRol === 'store_manager'
        const tiendaChanged = selectedTienda !== user.tienda_id_lectura
        const rolChanged = selectedRol !== user.rol_lectura

        // If store_manager with tienda, set as responsable
        if (isStoreManager && selectedTienda) {
          try {
            await api.patch(
              `/api/tiendas/${selectedTienda}/`,
              { responsable: user.id },
              { params: { schema: tenantSlug } }
            )
          } catch (error) {
            console.error('Error setting store manager as responsable:', error)
          }
        }

        // If changed tienda and old tienda had this user as responsable, remove it
        if (tiendaChanged && user.tienda_id_lectura) {
          try {
            const { data: tiendaData } = await api.get(`/api/tiendas/${user.tienda_id_lectura}/`, {
              params: { schema: tenantSlug }
            })
            if (tiendaData.responsable === user.id) {
              await api.patch(
                `/api/tiendas/${user.tienda_id_lectura}/`,
                { responsable: null },
                { params: { schema: tenantSlug } }
              )
            }
          } catch (error) {
            console.error('Error removing old responsable:', error)
          }
        }

        // If changed from store_manager to another role, remove as responsable
        if (rolChanged && user.rol_lectura === 'store_manager' && selectedRol !== 'store_manager' && user.tienda_id_lectura) {
          try {
            const { data: tiendaData } = await api.get(`/api/tiendas/${user.tienda_id_lectura}/`, {
              params: { schema: tenantSlug }
            })
            if (tiendaData.responsable === user.id) {
              await api.patch(
                `/api/tiendas/${user.tienda_id_lectura}/`,
                { responsable: null },
                { params: { schema: tenantSlug } }
              )
            }
          } catch (error) {
            console.error('Error removing user as responsable:', error)
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['usuariosTenant'] })
      queryClient.invalidateQueries({ queryKey: ['tiendas'] })
      onClose()
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string; error?: string } } }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Error al actualizar el usuario'
      toast.error(msg)
    },
  })

  const handleManagedStoresChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value
    setManagedStoreIds(typeof value === 'string' ? [] : value)
  }

  const handleSave = () => {
    if (!emailValido) {
      toast.error('El email no es válido')
      return
    }
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (!formData.email.trim()) {
      toast.error('El email es requerido')
      return
    }

    updateUserMutation.mutate()
  }

  const handleClose = () => {
    if (!updateUserMutation.isPending) {
      onClose()
    }
  }

  if (!user) return null

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle>Editar Usuario</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
          {updateUserMutation.isError && (
            <Alert severity="error">
              Error al actualizar el usuario. Inténtalo de nuevo.
            </Alert>
          )}

          <TextField
            label="Nombre"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            fullWidth
            required
            disabled={updateUserMutation.isPending}
          />

          <ValidatingTextField
            label="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            kind="email"
            type="email"
            required
            fullWidth
            validateOnChange
            onValidChange={(isValid) => setEmailValido(isValid)}
            disabled={updateUserMutation.isPending}
          />

          <FormControl fullWidth>
            <InputLabel id="edit-rol-label">Rol</InputLabel>
            <Select
              labelId="edit-rol-label"
              label="Rol"
              value={selectedRol}
              onChange={(e) => setSelectedRol(e.target.value)}
              disabled={updateUserMutation.isPending}
            >
              <MenuItem value="comercial">Comercial</MenuItem>
              <MenuItem value="store_manager">Store Manager</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </Select>
          </FormControl>

          {tiendas.length > 0 && selectedRol !== 'manager' && (
            <FormControl fullWidth>
              <InputLabel id="edit-tienda-label">Tienda</InputLabel>
              <Select
                labelId="edit-tienda-label"
                label="Tienda"
                value={selectedTienda}
                onChange={(e) =>
                  setSelectedTienda(e.target.value as number | '')
                }
                disabled={updateUserMutation.isPending}
                displayEmpty
              >
                <MenuItem value="">
                  <em>Sin asignar</em>
                </MenuItem>
                {tiendas.map((tienda) => (
                  <MenuItem key={tienda.id} value={tienda.id}>
                    {tienda.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {tiendas.length > 0 && selectedRol === 'manager' && (
            <FormControl fullWidth>
              <InputLabel id="edit-managed-stores-label">Tiendas gestionadas</InputLabel>
              <Select
                labelId="edit-managed-stores-label"
                label="Tiendas gestionadas"
                multiple
                value={managedStoreIds}
                onChange={handleManagedStoresChange}
                disabled={updateUserMutation.isPending}
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
                {tiendas.map((tienda) => (
                  <MenuItem key={tienda.id} value={tienda.id}>
                    {tienda.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Nueva contraseña (opcional)"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            fullWidth
            helperText="Déjalo vacío para mantener la contraseña actual"
            disabled={updateUserMutation.isPending}
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                disabled={updateUserMutation.isPending}
              />
            }
            label="Usuario activo"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={updateUserMutation.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={
            updateUserMutation.isPending ||
            !emailValido ||
            !formData.name.trim() ||
            !formData.email.trim()
          }
          startIcon={
            updateUserMutation.isPending ? (
              <CircularProgress size={20} />
            ) : undefined
          }
        >
          {updateUserMutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
