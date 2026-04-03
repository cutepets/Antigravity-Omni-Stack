import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js'
import type { JwtPayload } from '@petshop/shared'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true
    }
    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>()
    
    if (!user) {
      return false
    }

    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.permissions?.includes('FULL_BRANCH_ACCESS')) {
        return true
    }

    const userPermissions = user.permissions || []
    return requiredPermissions.some(perm => userPermissions.includes(perm))
  }
}
