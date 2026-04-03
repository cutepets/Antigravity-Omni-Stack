import { useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export const useAuthorization = () => {
  const user = useAuthStore((state) => state.user)

  const hasRole = useCallback((allowedRoles: StaffRole[]): boolean => {
    if (!user) return false
    const roleCode = typeof user.role === 'object' ? (user.role as any)?.code : user.role
    return allowedRoles.includes(roleCode as StaffRole)
  }, [user])

  const isSuperAdmin = useCallback(() => hasRole(['SUPER_ADMIN']), [hasRole])
  const isAdminOrManager = useCallback(() => hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), [hasRole])

  return {
    user,
    roleCode: user ? (typeof user.role === 'object' ? (user.role as any)?.code : user.role) : undefined,
    hasRole,
    isSuperAdmin,
    isAdminOrManager,
  }
}
