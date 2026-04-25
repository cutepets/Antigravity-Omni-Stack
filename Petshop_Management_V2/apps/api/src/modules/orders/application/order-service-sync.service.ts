import { Injectable } from '@nestjs/common';
import { OrderCommandService } from './order-command.service.js';

@Injectable()
export class OrderServiceSyncService {
  constructor(private readonly command: OrderCommandService) {}
}
