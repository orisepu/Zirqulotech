/**
 * Global User Management Types
 *
 * Types for managing users across all tenants in the system.
 * Used by admin/superuser roles for global user management.
 */

/**
 * Tenant association for a user
 */
export interface TenantAssociation {
  tenant_slug: string
  tenant_name: string
  rol: 'comercial' | 'store_manager' | 'manager'
  tienda_id?: number | null
  tienda_nombre?: string | null
  managed_store_ids?: number[]
  is_active: boolean
}

/**
 * Global user entity with all tenant associations
 */
export interface GlobalUser {
  id: number
  uuid: string
  name: string
  email: string
  is_active: boolean
  is_superadmin: boolean
  is_internal_employee: boolean
  tenants: TenantAssociation[]
  created_at?: string
  last_login?: string
}

/**
 * User data from API response
 */
export interface UserApiResponse {
  id: number
  uuid: string
  name: string
  email: string
  rol_lectura?: string | null
  tienda_id_lectura?: number | null
  tienda_nombre?: string | null
  is_active: boolean
  managed_store_ids?: number[]
  managed_store_ids_lectura?: number[]
}

/**
 * Form data for editing a user
 */
export interface UserEditForm {
  name: string
  email: string
  password?: string
  is_active: boolean
}

/**
 * Form data for creating a new user
 */
export interface UserCreateForm {
  name: string
  email: string
  password: string
  rol: 'comercial' | 'store_manager' | 'manager'
  tienda_id?: number | null
  is_active: boolean
}

/**
 * Tenant assignment form data
 */
export interface TenantAssignmentForm {
  tenant_slug: string
  rol: 'comercial' | 'store_manager' | 'manager'
  tienda_id?: number | null
  managed_store_ids?: number[]
}

/**
 * User filter options
 */
export interface UserFilters {
  search: string
  tenant_slug: string
  rol: string
  is_active: 'all' | 'active' | 'inactive'
}

/**
 * User table row data (for TanStack Table)
 */
export interface UserTableRow extends UserApiResponse {
  tenant_count?: number
  primary_tenant?: string
  primary_rol?: string
}
