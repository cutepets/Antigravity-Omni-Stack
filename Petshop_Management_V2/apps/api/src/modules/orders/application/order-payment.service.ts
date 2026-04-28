import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { OrderPaymentHelperService } from '../domain/order-payment-helper.service.js';
import { PayOrderDto } from '../dto/pay-order.dto.js';
import {
  createOrderFinanceTransaction,
  recordOrderPayments,
} from './order-finance.application.js';
import { buildOrderPaymentUpdate } from './order-payment.application.js';
import { createStockExportTimelineEntry } from './order-timeline.application.js';
import { OrderInventoryService } from './order-inventory.service.js';
import {
  assertHasPositivePayments,
  assertOrderCanAcceptPayment,
} from '../policies/order-workflow.policy.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly numberingService: OrderNumberingService,
    private readonly paymentHelperService: OrderPaymentHelperService,
    private readonly inventoryService: OrderInventoryService,
  ) { }

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  buildServiceTraceTags(parts: string[]): string | null {
    if (parts.length === 0) return null;
    return ['POS_ORDER', ...parts].join(',');
  }

  mergeTransactionNotes(baseNote: string | null | undefined, traceParts: string[]): string | null {
    const segments = [baseNote?.trim(), traceParts.length > 0 ? `POS trace: ${traceParts.join(' | ')}` : null].filter(Boolean);
    return segments.length > 0 ? segments.join(' | ') : null;
  }

  buildOrderServiceTraceParts(order: {
    items?: Array<{ groomingSessionId?: string | null; hotelStayId?: string | null }>;
    hotelStays?: Array<{ id: string; stayCode?: string | null }>;
  }): string[] {
    const traceParts: string[] = [];

    for (const item of order.items ?? []) {
      if (item.groomingSessionId) {
        traceParts.push(`GROOMING_SESSION:${item.groomingSessionId}`);
      }

      if (item.hotelStayId) {
        traceParts.push(`HOTEL_STAY:${item.hotelStayId}`);
      }
    }

    for (const stay of order.hotelStays ?? []) {
      if (stay.stayCode) {
        traceParts.push(`HOTEL_CODE:${stay.stayCode}`);
      }
    }

    return [...new Set(traceParts)];
  }

  getPaymentLabel(method: string): string {
    return this.paymentHelperService.getPaymentLabel(method);
  }

  async generateVoucherNumberFor(
    db: Pick<DatabaseService, 'transaction'>,
    type: 'INCOME' | 'EXPENSE',
  ): Promise<string> {
    return this.numberingService.generateFinanceVoucherNumber(db as DatabaseService, type);
  }

  async resolvePaymentAccount(
    db: Pick<DatabaseService, '$queryRaw' | 'paymentMethod'>,
    paymentMethod?: string | null,
    paymentAccountId?: string | null,
  ) {
    const normalizedMethod = paymentMethod?.trim().toUpperCase() || null;
    const normalizedAccountId = paymentAccountId?.trim() || null;

    if (!normalizedAccountId) {
      if (normalizedMethod === 'BANK') {
        throw new BadRequestException('Vui long chon phuong thuc chuyen khoan');
      }

      return {
        paymentMethod: normalizedMethod,
        paymentAccountId: null,
        paymentAccountLabel: null,
      };
    }

    const account = await db.paymentMethod.findUnique({
      where: { id: normalizedAccountId },
      select: { id: true, name: true, type: true, isActive: true, bankName: true, accountNumber: true },
    });

    if (!account || account.isActive !== true) {
      throw new BadRequestException('Phuong thuc thanh toan khong hop le hoac da ngung hoat dong');
    }

    return {
      paymentMethod: account.type as string,
      paymentAccountId: account.id as string,
      paymentAccountLabel: `${account.name} - ${account.bankName} - ${account.accountNumber}` as string,
    };
  }

  async normalizePayments(
    db: Pick<DatabaseService, '$queryRaw' | 'paymentMethod'>,
    payments: Array<{
      method: string;
      amount: number;
      note?: string | null | undefined;
      paymentAccountId?: string | null;
      paymentAccountLabel?: string | null;
    }>,
  ) {
    const normalizedPayments = [];

    for (const payment of payments) {
      const paymentAccount = await this.resolvePaymentAccount(db, payment.method, payment.paymentAccountId);
      normalizedPayments.push({
        method: (paymentAccount.paymentMethod ?? payment.method) as string,
        amount: payment.amount,
        note: payment.note?.trim() || undefined,
        paymentAccountId: paymentAccount.paymentAccountId,
        paymentAccountLabel: payment.paymentAccountLabel?.trim() || paymentAccount.paymentAccountLabel,
      });
    }

    return normalizedPayments;
  }

  async createOrderTransaction(
    tx: DatabaseService,
    params: {
      order: {
        id: string;
        orderNumber: string;
        branchId?: string | null;
        customerId?: string | null;
        customerName?: string | null;
      };
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      paymentMethod?: string | null;
      paymentAccountId?: string | null;
      paymentAccountLabel?: string | null;
      description: string;
      note?: string | null;
      source: 'ORDER_PAYMENT' | 'ORDER_ADJUSTMENT';
      staffId?: string | null;
      traceParts?: string[];
    },
  ) {
    return createOrderFinanceTransaction(
      tx as any,
      {
        generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
        buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
        mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
      },
      params,
    );
  }

  async recordOrderPayments(
    tx: DatabaseService,
    params: {
      order: {
        id: string;
        orderNumber: string;
        branchId?: string | null;
        customerId?: string | null;
        customerName?: string | null;
      };
      payments: Array<{
        method: string;
        amount: number;
        note?: string | null | undefined;
        paymentAccountId?: string | null;
        paymentAccountLabel?: string | null;
      }>;
      staffId?: string | null;
      traceParts?: string[];
      defaultNote?: string | null;
    },
  ) {
    return recordOrderPayments(
      tx as any,
      {
        generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
        buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
        mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
        getPaymentLabel: (method) => this.getPaymentLabel(method),
      },
      params,
    );
  }

  async applyPaymentsToOrder(
    tx: DatabaseService,
    params: {
      order: {
        id: string;
        orderNumber: string;
        total: number;
        paidAmount: number;
        customerId?: string | null;
        customerName?: string | null;
        branchId?: string | null;
        paymentStatus?: string | null;
        status?: string | null;
        stockExportedAt?: Date | null;
        items?: Array<{
          id?: string;
          type?: string | null;
          productId?: string | null;
          productVariantId?: string | null;
          quantity?: number;
          isTemp?: boolean | null;
          stockExportedAt?: Date | null;
          groomingSessionId?: string | null;
          hotelStayId?: string | null;
          groomingSession?: { status?: string | null } | null;
          hotelStay?: { status?: string | null } | null;
        }>;
        hotelStays?: Array<{ id: string; stayCode?: string | null }>;
      };
      payments: Array<{
        method: string;
        amount: number;
        note?: string | null | undefined;
        paymentAccountId?: string | null;
        paymentAccountLabel?: string | null;
      }>;
      staffId?: string | null;
    },
  ) {
    const paymentUpdate = buildOrderPaymentUpdate({
      order: params.order,
      payments: params.payments,
    });
    const paymentsArr = paymentUpdate.acceptedPayments;
    const totalPaid = paymentUpdate.totalPaid;
    const remaining = paymentUpdate.remainingAmount;
    const paymentStatus = paymentUpdate.paymentStatus;
    const traceParts = this.buildOrderServiceTraceParts(params.order as any);

    const pointPaymentTotal = paymentsArr.filter((p) => p.method === 'POINTS').reduce((sum, p) => sum + p.amount, 0);
    if (pointPaymentTotal > 0) {
      if (!params.order.customerId) {
        throw new BadRequestException('Phai khach hang de thanh toan bang diem');
      }
      const customer = await (tx as any).customer.findUnique({
        where: { id: params.order.customerId },
      });
      const sysConfig = await (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } });
      const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
      const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
      if (!customer || customer.points < pointsToDeduct) {
        throw new BadRequestException('Khach hang khong du diem de thanh toan');
      }
      await (tx as any).customer.update({
        where: { id: customer.id },
        data: {
          points: { decrement: pointsToDeduct },
          pointsUsed: { increment: pointsToDeduct },
        },
      });
    }

    await recordOrderPayments(
      tx as any,
      {
        generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
        buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
        mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
        getPaymentLabel: (method) => this.getPaymentLabel(method),
      },
      {
        order: {
          id: params.order.id,
          orderNumber: params.order.orderNumber,
          branchId: params.order.branchId ?? null,
          customerId: params.order.customerId ?? null,
          customerName: params.order.customerName ?? null,
        },
        payments: paymentsArr,
        staffId: params.staffId ?? null,
        traceParts,
      },
    );

    await (tx as any).paymentIntent.updateMany({
      where: {
        orderId: params.order.id,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
        expiresAt: new Date(),
      } as any,
    });

    const now = new Date();
    const orderItems = params.order.items ?? [];
    const hasServiceItems = orderItems.some((item) =>
      item.type === 'service'
      || item.type === 'grooming'
      || item.type === 'hotel'
      || Boolean(item.groomingSessionId)
      || Boolean(item.hotelStayId),
    );
    const hasPhysicalProductItems = orderItems.some((item) =>
      item.type === 'product'
      && Boolean(item.productId)
      && item.isTemp !== true,
    );
    const serviceItemsReady = orderItems.every((item) => {
      if (item.groomingSession?.status) {
        return ['COMPLETED', 'RETURNED', 'CANCELLED'].includes(item.groomingSession.status);
      }

      if (item.hotelStay?.status) {
        return ['CHECKED_OUT', 'CANCELLED'].includes(item.hotelStay.status);
      }

      return true;
    });
    const shouldAutoExportServiceOnly =
      paymentStatus === 'PAID'
      && Boolean(params.staffId)
      && !params.order.stockExportedAt
      && hasServiceItems
      && !hasPhysicalProductItems
      && serviceItemsReady;
    const autoExportItems =
      paymentStatus === 'PAID' && Boolean(params.staffId) && !params.order.stockExportedAt && !hasServiceItems
        ? orderItems.filter(
          (item) =>
            item.type === 'product'
            && Boolean(item.id)
            && Boolean(item.productId)
            && item.isTemp !== true
            && !item.stockExportedAt,
        )
        : [];

    for (const item of autoExportItems) {
      await this.inventoryService.deductProductBranchStock(tx as any, {
        branchId: params.order.branchId ?? null,
        productId: item.productId!,
        productVariantId: item.productVariantId ?? null,
        quantity: Number(item.quantity ?? 0),
        orderId: params.order.id,
        staffId: params.staffId!,
        reason: `Xuat kho don doi #${params.order.orderNumber}`,
      });
      await (tx as any).orderItem.update({
        where: { id: item.id! },
        data: {
          stockExportedAt: now,
          stockExportedBy: params.staffId!,
        } as any,
      });
    }

    const shouldAutoComplete = autoExportItems.length > 0;
    const shouldCompleteExportedOrder =
      paymentStatus === 'PAID'
      && Boolean(params.order.stockExportedAt)
      && params.order.status !== 'COMPLETED';
    const shouldCompleteOrder = shouldAutoComplete || shouldCompleteExportedOrder || shouldAutoExportServiceOnly;
    return tx.order
      .update({
        where: { id: params.order.id },
        data: {
          paidAmount: totalPaid,
          remainingAmount: remaining,
          paymentStatus: paymentStatus as any,
          ...(shouldCompleteOrder
            ? {
              status: 'COMPLETED' as any,
              completedAt: now,
              ...(shouldAutoComplete || shouldAutoExportServiceOnly
                ? {
                  stockExportedAt: now,
                  stockExportedBy: params.staffId ?? null,
                }
                : {}),
            }
            : {}),
        },
        include: { items: true, payments: true, customer: true },
      })
      .then(async (updatedOrder: any) => {
        if (shouldAutoComplete) {
          const pendingTempCount = orderItems.filter((item) => item.type === 'product' && item.isTemp === true).length;
          await createStockExportTimelineEntry(tx.orderTimeline as any, {
            orderId: params.order.id,
            fromStatus: params.order.status ?? null,
            toStatus: 'COMPLETED',
            performedBy: params.staffId!,
            occurredAt: now,
            exportedItemCount: autoExportItems.length,
            pendingTempCount,
            metadata: { source: 'PAYMENT_AUTO_EXPORT' },
          });
        }
        if (shouldCompleteExportedOrder) {
          await (tx as any).orderTimeline.create({
            data: {
              orderId: params.order.id,
              action: 'SETTLED',
              fromStatus: params.order.status ?? null,
              toStatus: 'COMPLETED',
              note: null,
              performedBy: params.staffId ?? null,
              metadata: { source: 'PAYMENT_AUTO_COMPLETE' },
              createdAt: now,
            } as any,
          });
        }
        if (shouldAutoExportServiceOnly) {
          await (tx as any).orderTimeline.create({
            data: {
              orderId: params.order.id,
              action: 'STOCK_EXPORTED',
              fromStatus: params.order.status ?? null,
              toStatus: 'COMPLETED',
              note: null,
              performedBy: params.staffId ?? null,
              metadata: { source: 'PAYMENT_SERVICE_AUTO_EXPORT' },
              createdAt: now,
            } as any,
          });
        }
        return updatedOrder;
      });
  }

  async updateCustomerDebt(tx: DatabaseService, customerId: string | null | undefined, delta: number) {
    if (!customerId || delta === 0) return;

    await tx.customer.update({
      where: { id: customerId },
      data: {
        debt: { increment: delta },
      } as any,
    });
  }

  async incrementCustomerStats(tx: DatabaseService, customerId: string | null | undefined, total: number) {
    if (!customerId) return;
    const pointsEarned = Math.floor(total / 1000);
    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: { increment: total },
        totalOrders: { increment: 1 },
        points: { increment: pointsEarned },
      } as any,
    });
  }

  async payOrder(id: string, dto: PayOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: {
        customer: true,
        items: {
          select: {
            groomingSessionId: true,
            hotelStayId: true,
            id: true,
            type: true,
            productId: true,
            productVariantId: true,
            quantity: true,
            isTemp: true,
            stockExportedAt: true,
            groomingSession: {
              select: {
                status: true,
              },
            },
            hotelStay: {
              select: {
                status: true,
              },
            },
          },
        },
        hotelStays: {
          select: {
            id: true,
            stayCode: true,
          },
        },
      },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    assertOrderCanAcceptPayment(order);

    const paymentsArr = await this.normalizePayments(
      this.prisma as any,
      dto.payments.filter((p) => p.amount > 0),
    );
    assertHasPositivePayments(paymentsArr);

    return this.prisma.$transaction(async (tx) =>
      this.applyPaymentsToOrder(tx as any, {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          stockExportedAt: order.stockExportedAt,
          total: order.total,
          paidAmount: order.paidAmount,
          customerId: order.customerId ?? null,
          customerName: order.customerName,
          branchId: order.branchId ?? null,
          paymentStatus: order.paymentStatus,
          items: order.items,
          hotelStays: order.hotelStays,
        },
        payments: paymentsArr,
        staffId,
      }),
    );
  }
}
