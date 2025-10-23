/**
 * User filtering utilities
 *
 * Pure functions for filtering and searching users
 */

import type { UserApiResponse, UserFilters } from '../types'

/**
 * Filter users based on search criteria
 */
export function filterUsers(
  users: UserApiResponse[],
  filters: UserFilters
): UserApiResponse[] {
  let filtered = users

  // Search filter (name or email)
  if (filters.search.trim()) {
    const searchLower = filters.search.toLowerCase().trim()
    filtered = filtered.filter(
      (user) =>
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
    )
  }

  // Role filter
  if (filters.rol && filters.rol !== 'all') {
    filtered = filtered.filter((user) => user.rol_lectura === filters.rol)
  }

  // Active status filter
  if (filters.is_active !== 'all') {
    const isActive = filters.is_active === 'active'
    filtered = filtered.filter((user) => user.is_active === isActive)
  }

  return filtered
}

/**
 * Sort users by name (alphabetically)
 */
export function sortUsersByName(users: UserApiResponse[]): UserApiResponse[] {
  return [...users].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/**
 * Sort users by email (alphabetically)
 */
export function sortUsersByEmail(users: UserApiResponse[]): UserApiResponse[] {
  return [...users].sort((a, b) => a.email.localeCompare(b.email, 'es'))
}

/**
 * Sort users by status (active first)
 */
export function sortUsersByStatus(
  users: UserApiResponse[]
): UserApiResponse[] {
  return [...users].sort((a, b) => {
    if (a.is_active === b.is_active) return 0
    return a.is_active ? -1 : 1
  })
}
