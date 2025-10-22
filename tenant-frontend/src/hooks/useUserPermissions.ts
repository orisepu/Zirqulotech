/**
 * Hook para gestionar permisos basados en el rol jerárquico del usuario.
 *
 * Jerarquía de roles (de menor a mayor):
 * - Comercial: Solo ve/edita sus propios datos
 * - Store Manager: Ve/edita todos los datos de su tienda
 * - Manager: Ve/edita datos de tiendas gestionadas (regional o todas si es general)
 * - Auditor: Ve todo pero no edita (read-only)
 */

import { useMemo } from 'react'
import { useUsuarioActual } from './useUsuarioActual'

export type RolType = 'comercial' | 'store_manager' | 'manager' | 'auditor'

interface RolePermissions {
  // Información del rol
  rol: RolType | null
  rolDisplay: string
  tiendaId: number | null
  managedStoreIds: number[]

  // Checks de rol
  isComercial: boolean
  isStoreManager: boolean
  isManager: boolean
  isAuditor: boolean
  isGeneralManager: boolean

  // Permisos generales
  canEdit: boolean  // Puede editar en general (no auditor)
  canEditAll: boolean  // Puede editar todo en su ámbito (store_manager o manager)
  canViewAll: boolean  // Puede ver todo (no limitado a sus propios datos)

  // Métodos helper
  canEditData: (createdBy?: number) => boolean
  canViewTienda: (tiendaId: number) => boolean
  canEditTienda: (tiendaId: number) => boolean
  getRoleDescription: () => string
  getRoleColor: () => 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info'
}

const ROLE_DESCRIPTIONS: Record<RolType, string> = {
  comercial: 'Crea y edita sus propios clientes, contactos y oportunidades. Puede ver el resto de la tienda.',
  store_manager: 'Gestiona todos los datos de su tienda. Puede ver y editar información de toda la tienda.',
  manager: 'Gestiona múltiples tiendas (regional o general). Acceso completo a las tiendas asignadas.',
  auditor: 'Acceso de solo lectura a todos los datos. No puede realizar cambios.'
}

const ROLE_DISPLAY_NAMES: Record<RolType, string> = {
  comercial: 'Comercial',
  store_manager: 'Store Manager',
  manager: 'Manager',
  auditor: 'Auditor'
}

export function useUserPermissions(): RolePermissions {
  const { usuario, tenant } = useUsuarioActual()

  return useMemo(() => {
    // Si no hay usuario o tenant, sin permisos
    if (!usuario || !tenant) {
      return {
        rol: null,
        rolDisplay: 'Sin rol',
        tiendaId: null,
        managedStoreIds: [],
        isComercial: false,
        isStoreManager: false,
        isManager: false,
        isAuditor: false,
        isGeneralManager: false,
        canEdit: false,
        canEditAll: false,
        canViewAll: false,
        canEditData: () => false,
        canViewTienda: () => false,
        canEditTienda: () => false,
        getRoleDescription: () => 'No tiene rol asignado',
        getRoleColor: () => 'default'
      }
    }

    // Extraer rol del tenant actual
    // Asumimos que el rol viene en usuario.rol o tenant.user_role
    const rol = (usuario.rol || tenant.user_role) as RolType
    const tiendaId = usuario.tienda_id || tenant.tienda_id || null
    const managedStoreIds = usuario.managed_store_ids || tenant.managed_store_ids || []

    // Checks de rol
    const isComercial = rol === 'comercial'
    const isStoreManager = rol === 'store_manager'
    const isManager = rol === 'manager'
    const isAuditor = rol === 'auditor'
    const isGeneralManager = isManager && managedStoreIds.length === 0

    // Permisos generales
    const canEdit = !isAuditor
    const canEditAll = isStoreManager || isManager
    const canViewAll = !isComercial  // Comercial solo ve lo suyo

    // Método para verificar si puede editar datos propios
    const canEditData = (createdBy?: number): boolean => {
      if (isAuditor) return false
      if (canEditAll) return true
      if (isComercial) {
        // Comercial solo edita lo que creó
        return createdBy === usuario.id
      }
      return false
    }

    // Método para verificar si puede ver una tienda
    const canViewTienda = (targetTiendaId: number): boolean => {
      if (isAuditor) return true  // Auditor ve todo
      if (isGeneralManager) return true  // General Manager ve todas
      if (isManager) {
        // Regional Manager ve sus tiendas asignadas
        return managedStoreIds.includes(targetTiendaId)
      }
      if (isStoreManager || isComercial) {
        // Store Manager y Comercial ven solo su tienda
        return tiendaId === targetTiendaId
      }
      return false
    }

    // Método para verificar si puede editar una tienda
    const canEditTienda = (targetTiendaId: number): boolean => {
      if (isAuditor) return false  // Auditor no edita
      if (isGeneralManager) return true  // General Manager edita todas
      if (isManager) {
        // Regional Manager edita sus tiendas asignadas
        return managedStoreIds.includes(targetTiendaId)
      }
      if (isStoreManager) {
        // Store Manager edita solo su tienda
        return tiendaId === targetTiendaId
      }
      if (isComercial) {
        // Comercial NO puede editar configuración de tienda
        return false
      }
      return false
    }

    // Descripción del rol
    const getRoleDescription = (): string => {
      if (!rol) return 'No tiene rol asignado'
      return ROLE_DESCRIPTIONS[rol] || 'Rol desconocido'
    }

    // Color del rol para badges/chips
    const getRoleColor = (): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' => {
      if (isManager) return 'primary'
      if (isStoreManager) return 'success'
      if (isComercial) return 'info'
      if (isAuditor) return 'warning'
      return 'default'
    }

    return {
      rol,
      rolDisplay: rol ? ROLE_DISPLAY_NAMES[rol] : 'Sin rol',
      tiendaId,
      managedStoreIds,
      isComercial,
      isStoreManager,
      isManager,
      isAuditor,
      isGeneralManager,
      canEdit,
      canEditAll,
      canViewAll,
      canEditData,
      canViewTienda,
      canEditTienda,
      getRoleDescription,
      getRoleColor
    }
  }, [usuario, tenant])
}

/**
 * Hook simplificado para verificar si el usuario puede editar un recurso específico.
 */
export function useCanEdit(createdBy?: number): boolean {
  const { canEditData } = useUserPermissions()
  return canEditData(createdBy)
}

/**
 * Hook simplificado para verificar si el usuario puede ver una tienda.
 */
export function useCanViewTienda(tiendaId: number): boolean {
  const { canViewTienda } = useUserPermissions()
  return canViewTienda(tiendaId)
}

/**
 * Hook simplificado para verificar si el usuario puede editar una tienda.
 */
export function useCanEditTienda(tiendaId: number): boolean {
  const { canEditTienda } = useUserPermissions()
  return canEditTienda(tiendaId)
}

/**
 * Componente helper para mostrar badge de rol
 */
export function getRoleBadgeProps(rol: RolType | null) {
  if (!rol) {
    return {
      label: 'Sin rol',
      color: 'default' as const,
      description: 'No tiene rol asignado'
    }
  }

  const colors: Record<RolType, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
    manager: 'primary',
    store_manager: 'success',
    comercial: 'info',
    auditor: 'warning'
  }

  return {
    label: ROLE_DISPLAY_NAMES[rol],
    color: colors[rol],
    description: ROLE_DESCRIPTIONS[rol]
  }
}

/**
 * Utilidad para obtener permisos de comisión por rol
 */
export function getCommissionInfo(rol: RolType | null) {
  if (!rol) return null

  const commissions: Record<RolType, { individual: number; store?: number; description: string }> = {
    comercial: {
      individual: 2,
      description: '2% de comisión sobre sus operaciones'
    },
    store_manager: {
      individual: 2,
      store: 1,
      description: '2% comisión individual + 1% sobre la tienda'
    },
    manager: {
      individual: 0,
      description: 'Comisiones del equipo comercial y Store Managers'
    },
    auditor: {
      individual: 0,
      description: 'Sin comisiones (rol de auditoría)'
    }
  }

  return commissions[rol]
}
