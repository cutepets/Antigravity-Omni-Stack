import { ExecutionContext } from '@nestjs/common'
import { SuperAdminGuard } from './super-admin.guard.js'

function mockContext(role?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext
}

describe('SuperAdminGuard', () => {
  it('allows SUPER_ADMIN users', () => {
    expect(new SuperAdminGuard().canActivate(mockContext('SUPER_ADMIN'))).toBe(true)
  })

  it.each(['ADMIN', 'MANAGER', 'STAFF', undefined])('rejects %s users', (role) => {
    expect(new SuperAdminGuard().canActivate(mockContext(role))).toBe(false)
  })
})
