import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { OrderCommandService } from './order-command.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderTimelineService {
  constructor(private readonly command: OrderCommandService) {}

  getOrderTimeline(orderId: string, user: AccessUser) {
    return this.command.getOrderTimeline(orderId, user);
  }

  getTimeline(orderId: string) {
    return this.command.getTimeline(orderId);
  }
}
