import { getRolePermissions, resolvePermissions } from '@petshop/auth'
import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'

export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

function normalizeRole(role: unknown): StaffRole | undefined {
  if (!role) return undefined
  if (typeof role === 'object' && role !== null && 'code' in role) {
    return (role as { code?: StaffRole }).code
  }
  return role as StaffRole
}

export const useAuthorization = () => {
  const user = useAuthStore((state) => state.user)
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  
  const isLoading = isAuthLoading || !hasHydrated
  const activeBranchId = useAuthStore((state) => state.activeBranchId)
  const allowedBranches = useAuthStore((state) => state.allowedBranches)

  const roleCode = normalizeRole(user?.role)

  const permissions = useMemo(() => {
    const explicitPermissions = Array.isArray(user?.permissions) ? user.permissions : []
    const rolePermissions = roleCode ? getRolePermissions(roleCode) : []
    const sourcePermissions = [...explicitPermissions, ...rolePermissions]

    return resolvePermissions(sourcePermissions)
  }, [roleCode, user?.permissions])
  const permissionSet = useMemo(() => new Set(permissions), [permissions])
  const allowedBranchIds = useMemo(() => allowedBranches.map((branch) => branch.id), [allowedBranches])

  const hasRole = useCallback((allowedRoles: StaffRole[]): boolean => {
    if (!roleCode) return false
    return allowedRoles.includes(roleCode)
  }, [roleCode])

  const hasPermission = useCallback((permission: string): boolean => {
    return permissionSet.has(permission)
  }, [permissionSet])

  const hasAnyPermission = useCallback((requiredPermissions: string[]): boolean => {
    if (requiredPermissions.length === 0) return true
    return requiredPermissions.some((permission) => permissionSet.has(permission))
  }, [permissionSet])

  const hasAllPermissions = useCallback((requiredPermissions: string[]): boolean => {
    if (requiredPermissions.length === 0) return true
    return requiredPermissions.every((permission) => permissionSet.has(permission))
  }, [permissionSet])

  const hasBranchAccess = useCallback((branchId?: string | null): boolean => {
    if (!branchId) return hasPermission('branch.access.all')
    if (hasPermission('branch.access.all')) return true
    return allowedBranchIds.includes(branchId)
  }, [allowedBranchIds, hasPermission])

  const isSuperAdmin = useCallback(() => hasRole(['SUPER_ADMIN']), [hasRole])
  const isAdminOrManager = useCallback(() => hasRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), [hasRole])

  return {
    user,
    isLoading,
    roleCode,
    permissions,
    activeBranchId,
    allowedBranches,
    allowedBranchIds,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasBranchAccess,
    isSuperAdmin,
    isAdminOrManager,
  }
}
