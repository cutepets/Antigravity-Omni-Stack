import { ALL_PERMISSION_CODES, getSelectedReadScope } from './permission-catalog'
import { getRolePermissions, resolvePermissions } from './permissions'

describe('permission catalog expansion', () => {
  it('expands assigned order read into base read and user scope', () => {
    const permissions = resolvePermissions(['order.read.assigned'])

    expect(permissions).toContain('order.read')
    expect(permissions).toContain('order.read.scope.user')
    expect(getSelectedReadScope(permissions, 'order')).toBe('user')
  })

  it('expands all order read into base read and all scope', () => {
    const permissions = resolvePermissions(['order.read.all'])

    expect(permissions).toContain('order.read')
    expect(permissions).toContain('order.read.scope.all')
    expect(getSelectedReadScope(permissions, 'order')).toBe('all')
  })

  it('gives super admin every catalog permission', () => {
    const superAdminPermissions = resolvePermissions(getRolePermissions('SUPER_ADMIN'))

    for (const permission of ALL_PERMISSION_CODES) {
      expect(superAdminPermissions).toContain(permission)
    }
  })
})
