import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../database/database.service.js';
import { OrderCatalogService } from './application/order-catalog.service.js';
import { OrderCommandService } from './application/order-command.service.js';
import { OrderDeletionService } from './application/order-deletion.service.js';
import { OrderLifecycleService } from './application/order-lifecycle.service.js';
import { OrderPaymentIntentService } from './application/order-payment-intent.service.js';
import { OrderPaymentService } from './application/order-payment.service.js';
import { OrderQueryService } from './application/order-query.service.js';
import { OrderReturnService } from './application/order-return.service.js';
import { OrderSwapService } from './application/order-swap.service.js';
import { OrderTimelineService } from './application/order-timeline.service.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import { CreateReturnRequestDto } from './dto/create-return-request.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { RefundOrderDto } from './dto/refund-order.dto.js';
import { SwapGroomingServiceDto } from './dto/swap-grooming-service.dto.js';
import { OrderNumberingService } from './domain/order-numbering.service.js';
import { OrderPaymentHelperService } from './domain/order-payment-helper.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrdersService {
  private readonly numbering: OrderNumberingService;
  private readonly paymentHelper: OrderPaymentHelperService;

  constructor(
    private readonly prisma: DatabaseService,
    private readonly command: OrderCommandService = new OrderCommandService(prisma),
    private readonly catalog: OrderCatalogService = new OrderCatalogService(prisma),
    private readonly query: OrderQueryService = new OrderQueryService(prisma),
    private readonly payments: OrderPaymentService = new OrderPaymentService(prisma),
    private readonly paymentIntents: OrderPaymentIntentService = new OrderPaymentIntentService(prisma),
    private readonly lifecycle: OrderLifecycleService = new OrderLifecycleService(command),
    private readonly returns: OrderReturnService = new OrderReturnService(command),
    private readonly deletions: OrderDeletionService = new OrderDeletionService(command),
    private readonly swaps: OrderSwapService = new OrderSwapService(command),
    private readonly timeline: OrderTimelineService = new OrderTimelineService(command),
    numbering: OrderNumberingService = new OrderNumberingService(),
    paymentHelper: OrderPaymentHelperService = new OrderPaymentHelperService(),
  ) {
    this.numbering = numbering;
    this.paymentHelper = paymentHelper;
  }

  private calculateRemainingAmount(total: number, paidAmount: number): number {
    return this.paymentHelper.calculateRemainingAmount(total, paidAmount);
  }

  private calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    return this.paymentHelper.calculatePaymentStatus(total, paidAmount);
  }

  private getPaymentLabel(method: string): string {
    return this.paymentHelper.getPaymentLabel(method);
  }

  private generateOrderNumber(): Promise<string> {
    return this.numbering.generateOrderNumber(this.prisma);
  }

  getProducts() {
    return this.catalog.getProducts();
  }

  getServices() {
    return this.catalog.getServices();
  }

  createOrder(data: CreateOrderDto, staffId: string): Promise<any> {
    return this.command.createOrder(data, staffId);
  }

  updateOrder(id: string, data: UpdateOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.command.updateOrder(id, data, staffId, user);
  }

  listPaymentIntents(id: string, user?: AccessUser) {
    return this.paymentIntents.listPaymentIntents(id, user);
  }

  getPaymentIntentByCode(code: string, user?: AccessUser) {
    return this.paymentIntents.getPaymentIntentByCode(code, user);
  }

  createPaymentIntent(id: string, dto: CreatePaymentIntentDto, user?: AccessUser) {
    return this.paymentIntents.createPaymentIntent(id, dto, user);
  }

  confirmPaymentIntentPaidFromWebhook(params: Parameters<OrderPaymentIntentService['confirmPaymentIntentPaidFromWebhook']>[0]) {
    return this.paymentIntents.confirmPaymentIntentPaidFromWebhook(params);
  }

  payOrder(id: string, dto: PayOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.payments.payOrder(id, dto, staffId, user);
  }

  completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.lifecycle.completeOrder(id, dto, staffId, user);
  }

  cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.lifecycle.cancelOrder(id, dto, staffId, user);
  }

  deleteOrderCascade(
    id: string,
    staffId: string,
    user?: AccessUser,
  ): Promise<{ success: true; deletedIds: string[]; deletedOrderNumbers: string[] }> {
    return this.deletions.deleteOrderCascade(id, staffId, user);
  }

  bulkDeleteOrders(ids: string[], staffId: string, user?: AccessUser) {
    return this.deletions.bulkDeleteOrders(ids, staffId, user);
  }

  refundOrder(id: string, dto: RefundOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.returns.refundOrder(id, dto, staffId, user);
  }

  removeOrderItem(orderId: string, itemId: string, user?: AccessUser): Promise<any> {
    return this.returns.removeOrderItem(orderId, itemId, user);
  }

  findAll(params?: Parameters<OrderQueryService['findAll']>[0], user?: AccessUser): Promise<any> {
    return this.query.findAll(params, user);
  }

  findOne(id: string, user?: AccessUser): Promise<any> {
    return this.query.findOne(id, user);
  }

  getOrderTimeline(orderId: string, user: AccessUser) {
    return this.timeline.getOrderTimeline(orderId, user);
  }

  approveOrder(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    return this.lifecycle.approveOrder(id, dto, staffId, user);
  }

  exportStock(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    return this.lifecycle.exportStock(id, dto, staffId, user);
  }

  settleOrder(id: string, dto: { note?: string; additionalPayments?: any[] }, staffId: string, user: AccessUser) {
    return this.lifecycle.settleOrder(id, dto, staffId, user);
  }

  getTimeline(orderId: string) {
    return this.timeline.getTimeline(orderId);
  }

  swapTempItem(
    orderId: string,
    itemId: string,
    dto: Parameters<OrderSwapService['swapTempItem']>[2],
    staffId: string,
    user?: AccessUser,
  ) {
    return this.swaps.swapTempItem(orderId, itemId, dto, staffId, user);
  }

  swapGroomingService(
    orderId: string,
    itemId: string,
    dto: SwapGroomingServiceDto,
    staffId: string,
    user?: AccessUser,
  ) {
    return this.swaps.swapGroomingService(orderId, itemId, dto, staffId, user);
  }

  createReturnRequest(orderId: string, dto: CreateReturnRequestDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.returns.createReturnRequest(orderId, dto, staffId, user);
  }
}
