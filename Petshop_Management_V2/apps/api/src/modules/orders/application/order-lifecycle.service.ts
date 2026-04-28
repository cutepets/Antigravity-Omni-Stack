import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { CancelOrderDto } from '../dto/cancel-order.dto.js';
import { CompleteOrderDto } from '../dto/complete-order.dto.js';
import { buildOrderCompletionSettlement } from './order-completion.application.js';
import { OrderInventoryService } from './order-inventory.service.js';
import {
  cancelLinkedOrderServices,
  exportCompletedOrderItems,
  loadOrderServiceReadiness,
} from './order-lifecycle.application.js';
import { OrderPaymentIntentService } from './order-payment-intent.service.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderQueryService } from './order-query.service.js';
import { OrderTimelineService } from './order-timeline.service.js';
import {
  assertOrderCanCancel,
  assertOrderCanSettle,
  assertServiceItemsReadyForCompletion,
} from '../policies/order-workflow.policy.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly queryService: OrderQueryService,
    private readonly paymentService: OrderPaymentService,
    private readonly paymentIntentService: OrderPaymentIntentService,
    private readonly inventoryService: OrderInventoryService,
    private readonly timelineService: OrderTimelineService,
  ) {}

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  async completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });
    if (order) this.assertOrderScope(order, user);

    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (order.status === 'COMPLETED') throw new BadRequestException('Don hang da hoan thanh');

    if (!dto.forceComplete) {
      const { groomingSessions, hotelStays } = await loadOrderServiceReadiness(this.prisma as any, order.items);
      assertServiceItemsReadyForCompletion({
        forceComplete: dto.forceComplete,
        groomingSessions,
        hotelStays,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const extraPayments = await this.paymentService.normalizePayments(
        tx as any,
        (dto.payments ?? []).filter((payment) => payment.amount > 0),
      );
      const traceParts = this.paymentService.buildOrderServiceTraceParts(order);
      const now = new Date();

      const exportedProductItems = await exportCompletedOrderItems(tx as any, {
        items: order.items,
        branchId: order.branchId ?? null,
        orderId: order.id,
        orderNumber: order.orderNumber,
        staffId,
        exportedAt: now,
      }, {
        deductProductBranchStock: (transaction, payload) => this.inventoryService.deductProductBranchStock(transaction, payload),
      });

      await this.paymentService.recordOrderPayments(
        tx as any,
        {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId ?? null,
            customerId: order.customerId ?? null,
            customerName: order.customerName,
          },
          payments: extraPayments,
          staffId,
          traceParts,
          defaultNote: dto.settlementNote ?? null,
        },
      );

      await this.paymentIntentService.expirePendingPaymentIntents(tx as any, { orderId: id });

      const settlement = buildOrderCompletionSettlement({
        orderTotal: order.total,
        orderPaidAmount: order.paidAmount,
        extraPayments,
        overpaymentAction: dto.overpaymentAction,
        hasCustomer: Boolean(order.customerId),
      });
      let finalPaidAmount = settlement.finalPaidAmount;
      if (settlement.adjustment?.type === 'REFUND') {
        const refundPaymentAccount = await this.paymentService.resolvePaymentAccount(
          tx as any,
          dto.refundMethod ?? 'CASH',
          dto.refundPaymentAccountId,
        );
        finalPaidAmount = order.total;
        await this.paymentService.createOrderTransaction(tx as any, {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId ?? null,
            customerId: order.customerId ?? null,
            customerName: order.customerName,
          },
          type: 'EXPENSE',
          amount: settlement.adjustment.amount,
          paymentMethod: refundPaymentAccount.paymentMethod ?? dto.refundMethod ?? 'CASH',
          paymentAccountId: refundPaymentAccount.paymentAccountId,
          paymentAccountLabel: dto.refundPaymentAccountLabel?.trim() || refundPaymentAccount.paymentAccountLabel,
          description: `Hoan tien du don hang ${order.orderNumber}`,
          note: dto.settlementNote ?? null,
          source: 'ORDER_ADJUSTMENT',
          staffId,
          traceParts,
        });
      } else if (settlement.adjustment?.type === 'KEEP_CREDIT') {
        await this.paymentService.updateCustomerDebt(tx as any, order.customerId, -settlement.adjustment.amount);
      }

      const hasPhysicalItems = exportedProductItems.length > 0;
      const completed = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED' as any,
          completedAt: now,
          paidAmount: finalPaidAmount,
          remainingAmount: 0,
          paymentStatus: settlement.paymentStatus as any,
          ...(hasPhysicalItems ? { stockExportedAt: now, stockExportedBy: staffId } : {}),
        } as any,
        include: {
          customer: true,
          items: { include: { product: true, service: true } },
          payments: true,
        },
      });

      if (hasPhysicalItems) {
        const pendingTempCount = order.items.filter((item) => (item as any).isTemp).length;
        await this.timelineService.createStockExportTimelineEntry(
          {
            orderId: id,
            performedBy: staffId,
            occurredAt: now,
            exportedItemCount: exportedProductItems.length,
            pendingTempCount,
            metadata: { source: 'POS_COMPLETE' },
          },
          tx as any,
        );
      }

      await this.paymentService.incrementCustomerStats(tx as any, order.customerId, order.total);
      await this.inventoryService.applyCompletedProductSalesDelta(tx as any, {
        completedAt: completed.completedAt ?? now,
        branchId: completed.branchId ?? null,
        items: completed.items.map((item) => ({
          productId: item.productId!,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      });

      return completed;
    });
  }

  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    assertOrderCanCancel(order);

    return this.prisma.$transaction(async (tx) => {
      await cancelLinkedOrderServices(tx as any, order.items);

      const hasService = order.items.some(
        (item) => item.groomingSessionId || item.hotelStayId || item.type === 'grooming' || item.type === 'hotel',
      );
      if (!hasService) {
        for (const item of order.items) {
          if (!item.productId) continue;
          await this.inventoryService.restoreProductBranchStock(tx as any, {
            branchId: order.branchId ?? null,
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            quantity: item.quantity,
            orderId: order.id,
            staffId,
            reason: `Hoan tra do huy don ${order.orderNumber}`,
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED' as any,
          notes: dto.reason ? `[HUY] ${dto.reason}` : order.notes,
        },
        include: { items: true, payments: true },
      });
    });
  }

  async approveOrder(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);
    id = order.id;

    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve order with status ${order.status}. Only PENDING orders can be approved.`);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          approvedAt: now,
          approvedBy: staffId,
        },
      });

      await this.timelineService.createTimelineEntry(
        {
          orderId: id,
          action: 'APPROVED',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          note: dto.note ?? null,
          performedBy: staffId,
        },
        tx as any,
      );
    });

    return this.queryService.findOne(id, user);
  }

  async exportStock(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: {
        items: {
          include: {
            groomingSession: true,
            hotelStay: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);
    id = order.id;

    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED';
    const hasServiceItems = order.items.some((item: any) => (
      item.type === 'service' ||
      item.type === 'grooming' ||
      item.type === 'hotel' ||
      Boolean(item.groomingSession) ||
      Boolean(item.hotelStay)
    ));
    const canExportPendingPaidProductOrder = order.status === 'PENDING' && isPaid && !hasServiceItems;

    if (!['CONFIRMED', 'PROCESSING'].includes(order.status) && !canExportPendingPaidProductOrder) {
      throw new BadRequestException(`Cannot export stock for order with status ${order.status}.`);
    }

    if (hasServiceItems) {
      const groomingSessions = order.items.filter((item: any) => item.groomingSession).map((item: any) => item.groomingSession!);
      const hotelStays = order.items.filter((item: any) => item.hotelStay).map((item: any) => item.hotelStay!);
      const allGroomingCompleted = groomingSessions.every((session: any) =>
        ['COMPLETED', 'RETURNED', 'CANCELLED'].includes(session.status),
      );
      const allHotelCompleted = hotelStays.every((stay: any) => ['CHECKED_OUT', 'CANCELLED'].includes(stay.status));

      if (!allGroomingCompleted || !allHotelCompleted) {
        throw new BadRequestException(
          'Cannot export stock until all grooming sessions are COMPLETED/RETURNED and all hotel stays are CHECKED_OUT.',
        );
      }
    }

    const now = new Date();
    const exportableItems = order.items.filter(
      (item: any) => item.type === 'product' && item.productId && !(item as any).isTemp && !(item as any).stockExportedAt,
    );
    const pendingTempCount = order.items.filter((item: any) => item.type === 'product' && (item as any).isTemp).length;

    if (exportableItems.length === 0 && pendingTempCount === 0 && !hasServiceItems) {
      throw new BadRequestException('Khong co san pham nao can xuat kho.');
    }

    const nextStatus = isPaid ? 'COMPLETED' : 'PROCESSING';

    await this.prisma.$transaction(async (tx) => {
      for (const item of exportableItems) {
        await this.inventoryService.deductProductBranchStock(tx as any, {
          branchId: order.branchId ?? null,
          productId: item.productId!,
          productVariantId: item.productVariantId ?? null,
          quantity: Number(item.quantity ?? 0),
          orderId: id,
          staffId,
          reason: order.linkedReturnId ? `Xuat kho don doi #${order.orderNumber}` : `Xuat kho don #${order.orderNumber}`,
        });
        await (tx as any).orderItem.update({
          where: { id: item.id },
          data: {
            stockExportedAt: now,
            stockExportedBy: staffId,
          } as any,
        });
      }

      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'COMPLETED' ? { completedAt: now } : {}),
          stockExportedAt: now,
          stockExportedBy: staffId,
        },
      });

      await this.timelineService.createStockExportTimelineEntry(
        {
          orderId: id,
          fromStatus: order.status,
          toStatus: nextStatus,
          note: dto.note ?? null,
          performedBy: staffId,
          occurredAt: now,
          exportedItemCount: exportableItems.length,
          pendingTempCount,
          metadata: { hasServiceItems },
        },
        tx as any,
      );
    });

    return this.queryService.findOne(id, user);
  }

  async settleOrder(id: string, dto: { note?: string; additionalPayments?: any[] }, staffId: string, user: AccessUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);
    assertOrderCanSettle(order);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          settledAt: now,
          settledBy: staffId,
          completedAt: now,
        },
      });

      await this.timelineService.createTimelineEntry(
        {
          orderId: id,
          action: 'SETTLED',
          fromStatus: 'PROCESSING',
          toStatus: 'COMPLETED',
          note: dto.note ?? null,
          performedBy: staffId,
        },
        tx as any,
      );
    });

    return this.queryService.findOne(id, user);
  }
}
