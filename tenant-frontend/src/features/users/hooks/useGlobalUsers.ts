/**
 * Custom hook for global user management
 *
 * Provides data and mutations for managing users across all tenants
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { UserApiResponse } from '../types'
import { toast } from 'react-toastify'

/**
 * Hook to fetch all users from public schema
 */
export function useGlobalUsers() {
  return useQuery<UserApiResponse[]>({
    queryKey: ['usuarios', 'todos'],
    queryFn: async () => {
      // Fetch ALL users from public schema
      const { data } = await api.get<UserApiResponse[]>(
        '/api/usuarios-tenant/todos/'
      )
      return Array.isArray(data) ? data : []
    },
  })
}

/**
 * Hook to update a user
 */
export function useUpdateUser(tenantSlug?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
      oldTiendaId,
      newTiendaId,
    }: {
      userId: number
      updates: Partial<UserApiResponse>
      oldTiendaId?: number | null
      newTiendaId?: number | null
    }) => {
      const params = tenantSlug ? { schema: tenantSlug } : {}
      const { data } = await api.patch(
        `/api/usuarios-tenant/${userId}/`,
        updates,
        { params }
      )

      // Handle responsable updates for store_manager
      if (tenantSlug) {
        const updatedRol = (updates as { rol?: string }).rol
        const isStoreManager = (updatedRol === 'store_manager') ||
                              (!updatedRol && data.rol_lectura === 'store_manager')

        // If changed to store_manager with a tienda, set as responsable
        if (isStoreManager && newTiendaId) {
          try {
            await api.patch(
              `/api/tiendas/${newTiendaId}/`,
              { responsable: userId },
              { params: { schema: tenantSlug } }
            )
          } catch (error) {
            console.error('Error setting store manager as responsable:', error)
          }
        }

        // If was store_manager and changed tienda, remove from old tienda
        if (oldTiendaId && oldTiendaId !== newTiendaId) {
          try {
            const { data: tiendaData } = await api.get(`/api/tiendas/${oldTiendaId}/`, {
              params: { schema: tenantSlug }
            })
            if (tiendaData.responsable === userId) {
              await api.patch(
                `/api/tiendas/${oldTiendaId}/`,
                { responsable: null },
                { params: { schema: tenantSlug } }
              )
            }
          } catch (error) {
            console.error('Error removing store manager from old tienda:', error)
          }
        }

        // If changed from store_manager to another role, remove as responsable
        if (updatedRol && updatedRol !== 'store_manager' && data.tienda_id_lectura) {
          try {
            const { data: tiendaData } = await api.get(`/api/tiendas/${data.tienda_id_lectura}/`, {
              params: { schema: tenantSlug }
            })
            if (tiendaData.responsable === userId) {
              await api.patch(
                `/api/tiendas/${data.tienda_id_lectura}/`,
                { responsable: null },
                { params: { schema: tenantSlug } }
              )
            }
          } catch (error) {
            console.error('Error removing user as responsable:', error)
          }
        }
      }

      return data
    },
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['usuariosTenant'] })
      queryClient.invalidateQueries({ queryKey: ['tiendas'] })
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
}

/**
 * Hook to toggle user active status
 */
export function useToggleUserActive(tenantSlug?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: number
      isActive: boolean
    }) => {
      const params = tenantSlug ? { schema: tenantSlug } : {}
      const { data } = await api.patch(
        `/api/usuarios-tenant/${userId}/`,
        { is_active: isActive },
        { params }
      )
      return data
    },
    onSuccess: (_, { isActive }) => {
      toast.success(
        isActive ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente'
      )
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['usuariosTenant'] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string; error?: string } } }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Error al cambiar el estado del usuario'
      toast.error(msg)
    },
  })
}

/**
 * Hook to change user password
 */
export function useChangeUserPassword() {
  return useMutation({
    mutationFn: async ({
      userId,
      newPassword,
    }: {
      userId: number
      newPassword: string
    }) => {
      const { data } = await api.post('/api/cambiar-password/', {
        user_id: userId,
        new_password: newPassword,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada correctamente')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string; error?: string } } }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Error al cambiar la contraseña'
      toast.error(msg)
    },
  })
}

/**
 * Hook to create a new user
 */
export function useCreateUser(tenantSlug?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userData: {
      name: string
      email: string
      password: string
      rol: string
      tienda_id?: number | null
      managed_store_ids?: number[]
    }) => {
      const params = tenantSlug ? { schema: tenantSlug } : {}
      const { data } = await api.post('/api/usuarios-tenant/', userData, {
        params,
      })

      // If store_manager, set as responsable of the tienda
      if (userData.rol === 'store_manager' && userData.tienda_id && tenantSlug) {
        try {
          await api.patch(
            `/api/tiendas/${userData.tienda_id}/`,
            { responsable: data.id },
            { params: { schema: tenantSlug } }
          )
        } catch (error) {
          console.error('Error setting store manager as responsable:', error)
          // Don't fail the whole operation if this fails
        }
      }

      return data
    },
    onSuccess: () => {
      toast.success('Usuario creado correctamente')
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      queryClient.invalidateQueries({ queryKey: ['usuariosTenant'] })
      queryClient.invalidateQueries({ queryKey: ['tiendas'] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string; error?: string } } }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Error al crear el usuario'
      toast.error(msg)
    },
  })
}
