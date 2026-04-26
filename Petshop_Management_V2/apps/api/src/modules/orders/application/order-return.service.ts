import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto.js';
import { RefundOrderDto } from '../dto/refund-order.dto.js';
import {
  buildCurrentReturnQuantityMap,
  buildExchangeOrderData,
  buildReturnItemSummary,
  buildReturnedQuantityMap,
  calculateExchangeOrderSubtotal,
  calculateReturnCreditBreakdown,
  getReturnableQuantity,
  hasRemainingReturnableProductQuantity,
  isOrderReturnWindowExpired,
  isReturnAction,
  resolveOrderReturnWindowDays,
  resolveReturnRefundAmount,
  validateExchangeOrderItems,
} from './order-return.application.js';
import { OrderInventoryService } from './order-inventory.service.js';
import { OrderTimelineService } from './order-timeline.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderReturnService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly numberingService: OrderNumberingService,
    private readonly orderItemService: OrderItemService,
    private readonly inventoryService: OrderInventoryService,
    private readonly timelineService: OrderTimelineService,
  ) {}

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  private async generateOrderNumber(): Promise<string> {
    return this.numberingService.generateOrderNumber(this.prisma);
  }

  refundOrder(id: string, dto: RefundOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    void staffId;
    return this.prisma.order.findUnique({ where: { id } }).then(async (order) => {
      if (order) this.assertOrderScope(order, user);
      if (!order) throw new NotFoundException('Khong tim thay don hang');

      return this.prisma.$transaction(async (tx) => {
        return tx.order.update({
          where: { id },
          data: {
            status: dto.status as any,
            notes: dto.reason ? `[HOAN TIEN] ${dto.reason}\n${order.notes ?? ''}` : order.notes,
          },
          include: { items: true, payments: true },
        });
      });
    });
  }

  async removeOrderItem(orderId: string, itemId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (order.status === 'COMPLETED') throw new BadRequestException('Khong the sua don da hoan thanh');

    const item = order.items.find((entry) => entry.id === itemId);
    if (!item) throw new NotFoundException('Khong tim thay item trong don');

    return this.prisma.$transaction(async (tx) => {
      if (item.groomingSessionId) {
        await tx.groomingSession.update({
          where: { id: item.groomingSessionId },
          data: { status: 'CANCELLED' },
        });
      }
      if (item.hotelStayId) {
        const stay = await tx.hotelStay.findUnique({ where: { id: item.hotelStayId } });
        if (stay && stay.status !== 'CANCELLED') {
          await tx.hotelStay.update({
            where: { id: item.hotelStayId },
            data: { status: 'CANCELLED' },
          });
        }
      }

      await tx.orderItem.delete({ where: { id: itemId } });

      const remaining = order.items.filter((entry) => entry.id !== itemId);
      const newSubtotal = remaining.reduce((sum, entry) => sum + entry.subtotal, 0);
      const newTotal = newSubtotal + order.shippingFee - order.discount;
      const newRemaining = Math.max(0, newTotal - order.paidAmount);
      const newPaymentStatus = order.paidAmount <= 0 ? 'UNPAID' : newRemaining <= 0 ? 'PAID' : 'PARTIAL';

      return tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          remainingAmount: newRemaining,
          paymentStatus: newPaymentStatus,
        },
        include: {
          items: { include: { product: true, service: true } },
          payments: true,
          customer: true,
        },
      });
    });
  }

  async createReturnRequest(
    orderId: string,
    dto: CreateReturnRequestDto,
    staffId: string,
    user?: AccessUser,
  ): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { items: true, customer: true, branch: true },
    });
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    this.assertOrderScope(order, user);
    orderId = order.id;

    if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Chi co the doi/tra hang cho don da hoan thanh');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phai chon it nhat mot san pham doi/tra');
    }

    const now = new Date();
    const returnConfig = await (this.prisma as any).systemConfig.findFirst({
      select: { orderReturnWindowDays: true },
    });
    const returnWindowDays = resolveOrderReturnWindowDays(returnConfig?.orderReturnWindowDays);
    if (isOrderReturnWindowExpired({
      completedAt: order.completedAt ?? order.createdAt,
      windowDays: returnWindowDays,
      now,
    })) {
      throw new BadRequestException(`Don hang da qua thoi han doi/tra ${returnWindowDays} ngay`);
    }

    const approvedReturnRequests = await (this.prisma as any).orderReturnRequest.findMany({
      where: {
        orderId,
        status: 'APPROVED',
      },
      include: { items: true },
    });
    const returnedQuantityByItemId = buildReturnedQuantityMap(approvedReturnRequests);
    const orderItemMap = new Map(order.items.map((item: any) => [item.id, item]));

    for (const reqItem of dto.items) {
      if (!isReturnAction(reqItem.action)) {
        throw new BadRequestException('Hanh dong doi/tra khong hop le');
      }
      if (!orderItemMap.has(reqItem.orderItemId)) {
        throw new BadRequestException(`San pham ${reqItem.orderItemId} khong thuoc don nay`);
      }
      const orderItem = orderItemMap.get(reqItem.orderItemId) as any;
      const returnableQuantity = getReturnableQuantity(orderItem, returnedQuantityByItemId);
      if (reqItem.quantity > returnableQuantity) {
        throw new BadRequestException(`So luong tra khong the vuot qua so luong da mua (${orderItem.quantity})`);
      }
    }

    const creditBreakdown = calculateReturnCreditBreakdown(dto.items, orderItemMap as any);
    const hasExchange = dto.items.some((item) => item.action === 'EXCHANGE');
    const hasReturn = dto.items.some((item) => item.action === 'RETURN');
    const exchangeItems = Array.isArray(dto.exchangeItems) ? dto.exchangeItems : [];
    if (!hasExchange && exchangeItems.length > 0) {
      throw new BadRequestException('Chi duoc chon san pham doi moi khi co hang doi');
    }
    try {
      validateExchangeOrderItems(exchangeItems);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'San pham doi moi khong hop le');
    }

    const refundAmount = resolveReturnRefundAmount({
      hasReturn,
      requestedRefundAmount: dto.refundAmount,
      returnCredit: creditBreakdown.returnCredit,
    });

    const totalCredit = creditBreakdown.totalCredit;
    const itemSummary = buildReturnItemSummary(dto.items, orderItemMap as any);

    return this.prisma.$transaction(async (tx) => {
      const returnRequest = await (tx as any).orderReturnRequest.create({
        data: {
          orderId,
          type: dto.type,
          reason: dto.reason ?? null,
          refundAmount,
          refundMethod: hasReturn ? (dto.refundMethod ?? null) : null,
          status: 'APPROVED',
          performedBy: staffId,
          items: {
            create: dto.items.map((item) => ({
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              action: item.action,
              reason: item.reason ?? null,
            })),
          },
          updatedAt: now,
        },
        include: { items: true },
      });

      const stockRestoredItems: string[] = [];
      for (const reqItem of dto.items) {
        if (reqItem.action !== 'RETURN') continue;
        const orderItem = orderItemMap.get(reqItem.orderItemId) as any;
        if (!orderItem?.productId) continue;
        await this.inventoryService.restoreProductBranchStock(tx as any, {
          branchId: order.branchId ?? null,
          productId: orderItem.productId,
          productVariantId: orderItem.productVariantId ?? null,
          quantity: reqItem.quantity,
          orderId,
          staffId,
          reason: `Tra hang don #${order.orderNumber}`,
        });
        stockRestoredItems.push(`+${reqItem.quantity} x ${orderItem.description ?? orderItem.sku ?? orderItem.productVariantId}`);
      }

      const currentReturnQuantityByItemId = buildCurrentReturnQuantityMap(dto.items);
      const newStatus = hasRemainingReturnableProductQuantity(order.items as any, returnedQuantityByItemId, currentReturnQuantityByItemId)
        ? 'PARTIALLY_REFUNDED'
        : 'FULLY_REFUNDED';
      await (tx as any).order.update({
        where: { id: orderId },
        data: { status: newStatus, updatedAt: now },
      });

      await this.timelineService.createTimelineEntry(
        {
          orderId,
          action: 'REFUNDED',
          fromStatus: 'COMPLETED',
          toStatus: newStatus,
          note:
            `Doi/tra: ${itemSummary}` +
            (dto.reason ? ` - Ly do: ${dto.reason}` : '') +
            `. Credit: ${totalCredit.toLocaleString('vi-VN')}d` +
            (stockRestoredItems.length > 0 ? ` | Hoan kho: ${stockRestoredItems.join(', ')}` : ''),
          performedBy: staffId,
          metadata: {
            returnRequestId: returnRequest.id,
            returnFlow: 'ORDER_RETURN_EXCHANGE',
            type: dto.type,
            totalCredit,
            returnCredit: creditBreakdown.returnCredit,
            exchangeCredit: creditBreakdown.exchangeCredit,
            refundAmount,
            hasExchange,
            hasReturn,
            stockRestored: stockRestoredItems,
          },
        },
        tx as any,
      );

      let exchangeOrder: any = null;
      if (hasExchange) {
        const exchangeOrderNumber = await this.generateOrderNumber();
        const creditForExchange = creditBreakdown.exchangeCredit;
        const normalizedExchangeItems = exchangeItems.length > 0
          ? await this.orderItemService.validateAndNormalizeCreateItems(tx as any, exchangeItems as any)
          : [];
        const exchangeSubtotal = calculateExchangeOrderSubtotal(normalizedExchangeItems as any);
        const exchangeOrderData = buildExchangeOrderData({
          orderNumber: exchangeOrderNumber,
          sourceOrder: order as any,
          staffId,
          returnRequestId: returnRequest.id,
          creditAmount: creditForExchange,
          subtotal: exchangeSubtotal,
          createdAt: now,
        });

        exchangeOrder = await (tx as any).order.create({
          data: {
            ...exchangeOrderData,
            ...(normalizedExchangeItems.length > 0
              ? { items: { create: normalizedExchangeItems.map((item: any) => this.orderItemService.buildOrderItemData(item)) } }
              : {}),
            orderNumber: exchangeOrderNumber,
            customerId: order.customerId,
            customerName: (order.customer as any)?.fullName ?? (order.customer as any)?.name ?? (order as any).customerName ?? 'Khach le',
            staffId,
            branchId: order.branchId ?? null,
            status: 'PENDING',
            paymentStatus: exchangeOrderData.paymentStatus,
            subtotal: exchangeOrderData.subtotal,
            discount: 0,
            shippingFee: 0,
            total: exchangeOrderData.total,
            paidAmount: creditForExchange,
            remainingAmount: exchangeOrderData.remainingAmount,
            creditAmount: creditForExchange,
            linkedReturnId: returnRequest.id,
            notes: `Don doi hang tu #${order.orderNumber}. Credit duoc ap dung: ${creditForExchange.toLocaleString('vi-VN')}d`,
            createdAt: now,
            updatedAt: now,
          } as any,
          include: { items: true },
        });

        const autoExportExchangeItems = exchangeOrderData.paymentStatus === 'PAID'
          ? (exchangeOrder.items ?? []).filter((item: any) => (
              item.type === 'product' &&
              item.productId &&
              item.isTemp !== true &&
              !item.stockExportedAt
            ))
          : [];

        if (autoExportExchangeItems.length > 0) {
          for (const item of autoExportExchangeItems) {
            await this.inventoryService.deductProductBranchStock(tx as any, {
              branchId: order.branchId ?? null,
              productId: item.productId,
              productVariantId: item.productVariantId ?? null,
              quantity: Number(item.quantity ?? 0),
              orderId: exchangeOrder.id,
              staffId,
              reason: `Xuat kho don doi #${exchangeOrder.orderNumber ?? exchangeOrderNumber}`,
            });
            await (tx as any).orderItem.update({
              where: { id: item.id },
              data: {
                stockExportedAt: now,
                stockExportedBy: staffId,
              } as any,
            });
          }

          await (tx as any).order.update({
            where: { id: exchangeOrder.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              stockExportedAt: now,
              stockExportedBy: staffId,
              updatedAt: now,
            } as any,
          });

          await this.timelineService.createStockExportTimelineEntry(
            {
              orderId: exchangeOrder.id,
              fromStatus: 'PENDING',
              toStatus: 'COMPLETED',
              performedBy: staffId,
              occurredAt: now,
              exportedItemCount: autoExportExchangeItems.length,
              pendingTempCount: 0,
              metadata: { source: 'EXCHANGE_CREDIT_AUTO_EXPORT', returnRequestId: returnRequest.id },
            },
            tx as any,
          );
        }

        if (creditForExchange > 0) {
          await (tx as any).orderPayment.create({
            data: {
              orderId: exchangeOrder.id,
              method: 'ORDER_CREDIT',
              amount: creditForExchange,
              note: `Credit tu don #${order.orderNumber}`,
              paymentAccountId: null,
              paymentAccountLabel: `Doi hang tu DH${order.orderNumber.replace(/^DH/i, '')}`,
              createdAt: now,
            } as any,
          });

          await this.timelineService.createTimelineEntry(
            {
              orderId: exchangeOrder.id,
              action: 'CREATED',
              fromStatus: null,
              toStatus: 'PENDING',
              note: `Don doi hang tu #${order.orderNumber}. Credit ${creditForExchange.toLocaleString('vi-VN')}d da duoc ap dung.`,
              performedBy: staffId,
              metadata: {
                sourceOrderId: orderId,
                sourceOrderNumber: order.orderNumber,
                returnRequestId: returnRequest.id,
                returnFlow: 'ORDER_RETURN_EXCHANGE',
                creditAmount: creditForExchange,
                historyLink: {
                  label: `#${order.orderNumber}`,
                  href: `/orders/${orderId}`,
                },
              },
            },
            tx as any,
          );
        }
      }

      return {
        returnRequest,
        exchangeOrderId: exchangeOrder?.id ?? null,
        exchangeOrderNumber: exchangeOrder?.orderNumber ?? null,
        totalCredit,
        refundAmount,
      };
    });
  }
}
