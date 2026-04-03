import type { StaffRole } from '@petshop/shared'

// Permission constants
export const PERMISSIONS = {
  // Orders
  ORDER_READ: 'order:read',
  ORDER_CREATE: 'order:create',
  ORDER_PAY: 'order:pay',
  ORDER_COMPLETE: 'order:complete',
  ORDER_CANCEL: 'order:cancel',
  ORDER_DELETE: 'order:delete',

  // Customers
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  // Pets
  PET_READ: 'pet:read',
  PET_CREATE: 'pet:create',
  PET_UPDATE: 'pet:update',
  PET_DELETE: 'pet:delete',

  // Inventory
  INVENTORY_READ: 'inventory:read',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',

  // Staff
  STAFF_READ: 'staff:read',
  STAFF_CREATE: 'staff:create',
  STAFF_UPDATE: 'staff:update',
  STAFF_DELETE: 'staff:delete',

  // Reports
  REPORT_READ: 'report:read',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // System (SUPER_ADMIN only)
  SYSTEM_CONFIG: 'system:config',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Role permission map
const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS).filter((p) => p !== 'system:config'),
  MANAGER: [
    PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_PAY,
    PERMISSIONS.ORDER_COMPLETE, PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.CUSTOMER_READ, PERMISSIONS.CUSTOMER_CREATE, PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.PET_READ, PERMISSIONS.PET_CREATE, PERMISSIONS.PET_UPDATE,
    PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.STAFF_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.SETTINGS_READ,
  ],
  STAFF: [
    PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_PAY,
    PERMISSIONS.ORDER_COMPLETE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.PET_READ, PERMISSIONS.PET_CREATE, PERMISSIONS.PET_UPDATE,
    PERMISSIONS.INVENTORY_READ,
  ],
  VIEWER: [
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.PET_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.REPORT_READ,
  ],
}

export const hasPermission = (role: StaffRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] ?? []
  return permissions.includes(permission)
}

export const getRolePermissions = (role: StaffRole): Permission[] => {
  return ROLE_PERMISSIONS[role] ?? []
}
