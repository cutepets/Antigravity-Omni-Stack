import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { OrderCommandService } from './order-command.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderDeletionService {
  constructor(private readonly command: OrderCommandService) {}

  deleteOrderCascade(id: string, staffId: string, user?: AccessUser) {
    return this.command.deleteOrderCascade(id, staffId, user);
  }

  bulkDeleteOrders(ids: string[], staffId: string, user?: AccessUser) {
    return this.command.bulkDeleteOrders(ids, staffId, user);
  }
}
