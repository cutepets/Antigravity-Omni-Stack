import { ForbiddenException, Injectable } from '@nestjs/common';
import { resolvePermissions } from '@petshop/auth';
import type { JwtPayload } from '@petshop/shared';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderAccessService {
  resolveUserPermissions(user?: AccessUser): Set<string> {
    return new Set(resolvePermissions(user?.permissions ?? []));
  }

  getAuthorizedBranchIds(user?: AccessUser): string[] {
    return [...new Set([...(user?.authorizedBranchIds ?? []), ...(user?.branchId ? [user.branchId] : [])])];
  }

  shouldRestrictToOrderBranches(user?: AccessUser): boolean {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return false;

    const permissions = this.resolveUserPermissions(user);
    return !permissions.has('branch.access.all');
  }

  assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    if (!this.shouldRestrictToOrderBranches(user)) return;

    const branchIds = this.getAuthorizedBranchIds(user);
    if (!order.branchId || !branchIds.includes(order.branchId)) {
      throw new ForbiddenException('Báº¡n chá»‰ Ä‘Æ°á»£c truy cáº­p dá»¯ liá»‡u thuá»™c chi nhÃ¡nh Ä‘Æ°á»£c phÃ¢n quyá»n');
    }
  }
}
