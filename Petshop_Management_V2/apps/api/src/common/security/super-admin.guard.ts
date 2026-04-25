import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { JwtPayload } from '@petshop/shared'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>()
    return user?.role === 'SUPER_ADMIN'
  }
}
