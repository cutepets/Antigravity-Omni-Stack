'use client'

import React from 'react'
import { useAuthorization, StaffRole } from '@/hooks/useAuthorization'

interface RoleGateProps {
  allowedRoles: StaffRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ allowedRoles, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuthorization()

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
