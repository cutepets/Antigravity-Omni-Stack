'use client'

import React from 'react'
import { useAuthorization, StaffRole } from '@/hooks/useAuthorization'

interface RoleGateProps {
  allowedRoles?: StaffRole[]
  allowedPermissions?: string[]
  anyPermissions?: string[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({
  allowedRoles,
  allowedPermissions,
  anyPermissions,
  children,
  fallback = null,
}: RoleGateProps) {
  const { hasRole, hasAllPermissions, hasAnyPermission } = useAuthorization()

  const allowByRole = !allowedRoles || allowedRoles.length === 0 || hasRole(allowedRoles)
  const allowByAllPermissions =
    !allowedPermissions || allowedPermissions.length === 0 || hasAllPermissions(allowedPermissions)
  const allowByAnyPermissions = !anyPermissions || anyPermissions.length === 0 || hasAnyPermission(anyPermissions)

  if (!allowByRole || !allowByAllPermissions || !allowByAnyPermissions) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
