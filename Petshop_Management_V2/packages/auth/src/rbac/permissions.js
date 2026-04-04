"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolePermissions = exports.hasPermission = exports.PERMISSIONS = void 0;
// Permission constants
exports.PERMISSIONS = {
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
};
// Role permission map
const ROLE_PERMISSIONS = {
    SUPER_ADMIN: Object.values(exports.PERMISSIONS),
    ADMIN: Object.values(exports.PERMISSIONS).filter((p) => p !== 'system:config'),
    MANAGER: [
        exports.PERMISSIONS.ORDER_READ, exports.PERMISSIONS.ORDER_CREATE, exports.PERMISSIONS.ORDER_PAY,
        exports.PERMISSIONS.ORDER_COMPLETE, exports.PERMISSIONS.ORDER_CANCEL,
        exports.PERMISSIONS.CUSTOMER_READ, exports.PERMISSIONS.CUSTOMER_CREATE, exports.PERMISSIONS.CUSTOMER_UPDATE,
        exports.PERMISSIONS.PET_READ, exports.PERMISSIONS.PET_CREATE, exports.PERMISSIONS.PET_UPDATE,
        exports.PERMISSIONS.INVENTORY_READ, exports.PERMISSIONS.INVENTORY_CREATE, exports.PERMISSIONS.INVENTORY_UPDATE,
        exports.PERMISSIONS.STAFF_READ,
        exports.PERMISSIONS.REPORT_READ,
        exports.PERMISSIONS.SETTINGS_READ,
    ],
    STAFF: [
        exports.PERMISSIONS.ORDER_READ, exports.PERMISSIONS.ORDER_CREATE, exports.PERMISSIONS.ORDER_PAY,
        exports.PERMISSIONS.ORDER_COMPLETE,
        exports.PERMISSIONS.CUSTOMER_READ,
        exports.PERMISSIONS.PET_READ, exports.PERMISSIONS.PET_CREATE, exports.PERMISSIONS.PET_UPDATE,
        exports.PERMISSIONS.INVENTORY_READ,
    ],
    VIEWER: [
        exports.PERMISSIONS.ORDER_READ,
        exports.PERMISSIONS.CUSTOMER_READ,
        exports.PERMISSIONS.PET_READ,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.REPORT_READ,
    ],
};
const hasPermission = (role, permission) => {
    const permissions = ROLE_PERMISSIONS[role] ?? [];
    return permissions.includes(permission);
};
exports.hasPermission = hasPermission;
const getRolePermissions = (role) => {
    return ROLE_PERMISSIONS[role] ?? [];
};
exports.getRolePermissions = getRolePermissions;
//# sourceMappingURL=permissions.js.map