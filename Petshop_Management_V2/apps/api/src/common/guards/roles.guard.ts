import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { StaffRole } from '@petshop/database'
import { ROLES_KEY } from '../decorators/roles.decorator.js'
import type { JwtPayload } from '@petshop/shared'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }
    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>()
    
    // Nếu request chưa attach user (quên gắn JwtGuard), thì chặn
    if (!user) {
      return false
    }

    return requiredRoles.includes(user.role as StaffRole)
  }
}
