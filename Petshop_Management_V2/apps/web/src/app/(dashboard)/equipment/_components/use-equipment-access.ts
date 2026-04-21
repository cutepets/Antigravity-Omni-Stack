'use client'

import { useAuthorization } from '@/hooks/useAuthorization'
import { useModuleConfig } from '@/hooks/useModuleConfig'

export function useEquipmentAccess() {
  const authorization = useAuthorization()
  const { isModuleActive } = useModuleConfig()

  const canRead = authorization.hasPermission('equipment.read')
  const canCreate = authorization.hasPermission('equipment.create')
  const canUpdate = authorization.hasPermission('equipment.update')
  const canArchive = authorization.hasPermission('equipment.archive')
  const canScan = authorization.hasPermission('equipment.scan')
  const canConfig = authorization.hasPermission('equipment.config')
  const canReadBranches = authorization.hasPermission('branch.read')
  const moduleActive = isModuleActive('equipment')

  return {
    ...authorization,
    moduleActive,
    canRead,
    canCreate,
    canUpdate,
    canArchive,
    canScan,
    canConfig,
    canReadBranches,
    canAccessWorkspace: moduleActive && (canRead || canCreate || canConfig),
    canAccessDetail: moduleActive && canRead,
    canAccessScan: moduleActive && (canScan || canRead || canCreate),
  }
}
