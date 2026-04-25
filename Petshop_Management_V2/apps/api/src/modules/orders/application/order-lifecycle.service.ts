import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { CancelOrderDto } from '../dto/cancel-order.dto.js';
import { CompleteOrderDto } from '../dto/complete-order.dto.js';
import { OrderCommandService } from './order-command.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderLifecycleService {
  constructor(private readonly command: OrderCommandService) {}

  completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser) {
    return this.command.completeOrder(id, dto, staffId, user);
  }

  cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser) {
    return this.command.cancelOrder(id, dto, staffId, user);
  }

  getOrderTimeline(orderId: string, user: AccessUser) {
    return this.command.getOrderTimeline(orderId, user);
  }

  approveOrder(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    return this.command.approveOrder(id, dto, staffId, user);
  }

  exportStock(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    return this.command.exportStock(id, dto, staffId, user);
  }

  settleOrder(id: string, dto: { note?: string; additionalPayments?: any[] }, staffId: string, user: AccessUser) {
    return this.command.settleOrder(id, dto, staffId, user);
  }

  getTimeline(orderId: string) {
    return this.command.getTimeline(orderId);
  }
}
