import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto.js';
import { RefundOrderDto } from '../dto/refund-order.dto.js';
import { OrderCommandService } from './order-command.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderReturnService {
  constructor(private readonly command: OrderCommandService) {}

  refundOrder(id: string, dto: RefundOrderDto, staffId: string, user?: AccessUser) {
    return this.command.refundOrder(id, dto, staffId, user);
  }

  removeOrderItem(orderId: string, itemId: string, user?: AccessUser) {
    return this.command.removeOrderItem(orderId, itemId, user);
  }

  createReturnRequest(orderId: string, dto: CreateReturnRequestDto, staffId: string, user?: AccessUser) {
    return this.command.createReturnRequest(orderId, dto, staffId, user);
  }
}
