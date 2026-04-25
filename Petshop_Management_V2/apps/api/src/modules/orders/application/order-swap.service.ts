import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { SwapGroomingServiceDto } from '../dto/swap-grooming-service.dto.js';
import { OrderCommandService } from './order-command.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderSwapService {
  constructor(private readonly command: OrderCommandService) {}

  swapTempItem(
    orderId: string,
    itemId: string,
    dto: Parameters<OrderCommandService['swapTempItem']>[2],
    staffId: string,
    user?: AccessUser,
  ) {
    return this.command.swapTempItem(orderId, itemId, dto, staffId, user);
  }

  swapGroomingService(
    orderId: string,
    itemId: string,
    dto: SwapGroomingServiceDto,
    staffId: string,
    user?: AccessUser,
  ) {
    return this.command.swapGroomingService(orderId, itemId, dto, staffId, user);
  }
}
