import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { resolvePermissions } from '@petshop/auth';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../database/database.service.js';
import { buildOrderCompletionSettlement } from './application/order-completion.application.js';
import { applyCreateOrderPostActions } from './application/order-create.application.js';
import {
  createOrderFinanceTransaction,
  recordOrderPayments,
} from './application/order-finance.application.js';
import {
  createOrderTimelineEntry,
  createStockExportTimelineEntry,
} from './application/order-timeline.application.js';
import { buildOrderPaymentUpdate } from './application/order-payment.application.js';
import { buildCreateOrderDraft } from './application/order-workflow.application.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import { RefundOrderDto } from './dto/refund-order.dto.js';
import {
  generateGroomingSessionCode as formatGroomingSessionCode,
  generateHotelStayCode as formatHotelStayCode,
  generateOrderNumber as formatOrderNumber,
  POINTS_REDEMPTION_RATE,
} from '@petshop/shared';
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js';
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js';
import { buildVietQrDataUrl, buildVietQrPayload } from '../../common/utils/vietqr.util.js';
import { resolveInventoryLedgerMovement } from '../../common/utils/inventory-ledger.util.js';
import { mapOrderPaymentIntentView } from './mappers/payment-intent.mapper.js';
import {
  assertHasPositivePayments,
  assertOrderCanAcceptPayment,
  assertOrderCanCancel,
  assertOrderCanCreatePaymentIntent,
  assertOrderCanSettle,
  assertServiceItemsReadyForCompletion,
  resolveRequestedPaymentIntentAmount,
} from './policies/order-workflow.policy.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const PAYMENT_INTENT_TTL_MS = 15 * 60 * 1000;

function normalizeHotelLineType(value?: string | null): 'REGULAR' | 'HOLIDAY' {
  return value === 'HOLIDAY' ? 'HOLIDAY' : 'REGULAR';
}

function buildHotelOrderItemPricingSnapshot(item: {
  description: string;
  quantity: number;
  unitPrice: number;
  discountItem?: number;
  hotelDetails?: any;
}) {
  if (!item.hotelDetails) return undefined;

  const details = item.hotelDetails;
  const subtotal = details.chargeSubtotal ?? item.unitPrice * item.quantity - (item.discountItem ?? 0);

  return {
    source: 'POS_HOTEL_CHARGE_LINE',
    bookingGroupKey: details.bookingGroupKey ?? null,
    chargeLine: {
      index: details.chargeLineIndex ?? null,
      label: details.chargeLineLabel ?? item.description,
      dayType: normalizeHotelLineType(details.chargeDayType ?? details.lineType),
      quantityDays: details.chargeQuantityDays ?? item.quantity,
      unitPrice: details.chargeUnitPrice ?? item.unitPrice,
      subtotal,
      weightBandId: details.chargeWeightBandId || null,
      weightBandLabel: details.chargeWeightBandLabel ?? null,
    },
  };
}

function buildGroomingOrderItemPricingSnapshot(item: {
  description: string;
  quantity: number;
  unitPrice: number;
  discountItem?: number;
  groomingDetails?: any;
}) {
  if (!item.groomingDetails?.packageCode && !item.groomingDetails?.pricingSnapshot) return undefined;

  const details = item.groomingDetails;

  return {
    source: 'POS_GROOMING_PRICE',
    packageCode: details.packageCode ?? null,
    weightAtBooking: details.weightAtBooking ?? null,
    weightBandId: details.weightBandId ?? null,
    weightBandLabel: details.weightBandLabel ?? null,
    price: details.pricingPrice ?? item.unitPrice * item.quantity,
    discountItem: item.discountItem ?? 0,
    pricingSnapshot: details.pricingSnapshot ?? null,
  };
}

type OrderPaymentIntentView = {
  id: string;
  code: string;
  orderId?: string | null;
  paymentMethodId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  provider?: 'VIETQR' | null;
  transferContent: string;
  qrUrl?: string | null;
  qrPayload?: string | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  paymentMethod: {
    id: string;
    name: string;
    type: string;
    colorKey?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
    qrTemplate?: string | null;
  };
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    customerName?: string | null;
  } | null;
};

// Payment method labels
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  EWALLET: 'Ví điện tử',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CARD: 'Thẻ',
  POINTS: 'Điểm tích lũy',
};

@Injectable()
export class OrdersService {
  constructor(private prisma: DatabaseService) { }

  private resolveUserPermissions(user?: AccessUser): Set<string> {
    return new Set(resolvePermissions(user?.permissions ?? []));
  }

  private getAuthorizedBranchIds(user?: AccessUser): string[] {
    return [...new Set([...(user?.authorizedBranchIds ?? []), ...(user?.branchId ? [user.branchId] : [])])];
  }

  private shouldRestrictToOrderBranches(user?: AccessUser): boolean {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return false;

    const permissions = this.resolveUserPermissions(user);
    return !permissions.has('branch.access.all');
  }

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    if (!this.shouldRestrictToOrderBranches(user)) return;

    const authorizedBranchIds = this.getAuthorizedBranchIds(user);
    if (!order.branchId || !authorizedBranchIds.includes(order.branchId)) {
      throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền');
    }
  }

  // Helpers

  /** Generate order number: DH202604060001 */
  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const count = await this.prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return formatOrderNumber(today, count + 1);
  }

  /** Generate voucher number for transactions: VCH-YYYYMMDD-XXXX */
  private async generateVoucherNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const count = await this.prisma.transaction.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return `VCH-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  /** Generate hotel stay code: H2604TH001 */
  private async generateHotelStayCode(
    db: Pick<DatabaseService, 'hotelStay'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    const startOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    const endOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
    const codePrefix = formatHotelStayCode(createdAt, branchCode, 0).slice(0, -3);
    const count = await db.hotelStay.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
        stayCode: {
          startsWith: codePrefix,
        } as any,
      },
    });
    return formatHotelStayCode(createdAt, branchCode, count + 1);
  }

  /** Generate grooming session code: S2604TH001 */
  private async generateGroomingSessionCode(
    db: Pick<DatabaseService, 'groomingSession'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    const startOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
    const endOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 1);
    const codePrefix = formatGroomingSessionCode(createdAt, branchCode, 0).slice(0, -3);
    const count = await db.groomingSession.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
        sessionCode: {
          startsWith: codePrefix,
        } as any,
      },
    });
    return formatGroomingSessionCode(createdAt, branchCode, count + 1);
  }

  private buildServiceTraceTags(parts: string[]): string | null {
    if (parts.length === 0) return null;
    return ['POS_ORDER', ...parts].join(',');
  }

  private mergeTransactionNotes(baseNote: string | null | undefined, traceParts: string[]): string | null {
    const segments = [baseNote?.trim(), traceParts.length > 0 ? `POS trace: ${traceParts.join(' | ')}` : null].filter(Boolean);
    return segments.length > 0 ? segments.join(' | ') : null;
  }

  private buildOrderServiceTraceParts(order: {
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

  private getPaymentLabel(method: string): string {
    if (method === 'TRANSFER') return 'Chuyển khoản';
    if (method === 'MIXED') return 'Nhiều hình thức';
    return METHOD_LABELS[method] ?? method;
  }

  private calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    if (paidAmount <= 0) return 'UNPAID';
    if (paidAmount >= total) return 'PAID';
    return 'PARTIAL';
  }

  private calculateRemainingAmount(total: number, paidAmount: number): number {
    return Math.max(0, total - paidAmount);
  }

  private getVietnamNow(date = new Date()) {
    return new Date(date.toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE }));
  }

  private getMinutesFromTime(time?: string | null) {
    const normalized = String(time ?? '').trim();
    if (!normalized) return null;

    const parts = normalized.split(':');
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    return hours * 60 + minutes;
  }

  private isPaymentMethodAvailableForIntent(
    method: {
      isActive: boolean;
      branchIds: string[];
      minAmount?: number | null;
      maxAmount?: number | null;
      weekdays: number[];
      timeFrom?: string | null;
      timeTo?: string | null;
    },
    params: { branchId?: string | null; amount: number; now?: Date },
  ) {
    if (!method.isActive) return false;

    if (method.branchIds.length > 0) {
      if (!params.branchId || !method.branchIds.includes(params.branchId)) {
        return false;
      }
    }

    if (method.minAmount !== null && method.minAmount !== undefined && params.amount < method.minAmount) {
      return false;
    }

    if (method.maxAmount !== null && method.maxAmount !== undefined && params.amount > method.maxAmount) {
      return false;
    }

    const now = params.now ?? this.getVietnamNow();
    if (method.weekdays.length > 0 && !method.weekdays.includes(now.getDay())) {
      return false;
    }

    const fromMinutes = this.getMinutesFromTime(method.timeFrom);
    const toMinutes = this.getMinutesFromTime(method.timeTo);
    if (fromMinutes !== null && toMinutes !== null) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (fromMinutes <= toMinutes) {
        return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
      }

      return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
    }

    return true;
  }

  private generatePaymentIntentCode() {
    return `PI${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private sanitizeTransferContentPart(value: string | null | undefined, maxLength: number) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, maxLength);
  }

  private buildTransferContent(params: {
    prefix?: string | null;
    branchCode?: string | null;
    orderNumber?: string | null;
    paymentAccountName?: string | null;
    fallbackId: string;
  }) {
    let prefix = this.sanitizeTransferContentPart(params.prefix, 5) || 'PET';
    let branchCode = this.sanitizeTransferContentPart(params.branchCode, 4) || 'CN';
    const orderToken =
      this.sanitizeTransferContentPart(params.orderNumber ?? params.fallbackId, 14) || 'MADON';
    const paymentAccountName = this.sanitizeTransferContentPart(params.paymentAccountName, 6) || 'TK';

    let base = `${prefix}${branchCode}${orderToken}`;
    if (base.length > 23 && prefix.length > 3) {
      const overflow = base.length - 23;
      prefix = prefix.slice(0, Math.max(3, prefix.length - overflow));
      base = `${prefix}${branchCode}${orderToken}`;
    }

    if (base.length > 23 && branchCode.length > 2) {
      const overflow = base.length - 23;
      branchCode = branchCode.slice(0, Math.max(2, branchCode.length - overflow));
      base = `${prefix}${branchCode}${orderToken}`;
    }

    const remaining = Math.max(0, 25 - base.length);
    const transferContent = `${base}${paymentAccountName.slice(0, remaining)}`.slice(0, 25);

    if (!transferContent) {
      throw new BadRequestException('Khong the tao noi dung chuyen khoan cho QR');
    }

    return transferContent;
  }

  private async expirePendingPaymentIntents(
    db: Pick<DatabaseService, 'paymentIntent'>,
    params: { orderId: string; paymentMethodId?: string },
  ) {
    await db.paymentIntent.updateMany({
      where: {
        orderId: params.orderId,
        status: 'PENDING',
        ...(params.paymentMethodId ? { paymentMethodId: params.paymentMethodId } : {}),
      },
      data: {
        status: 'EXPIRED',
        expiresAt: new Date(),
      } as any,
    });
  }

  private async hydratePaymentIntent(intentId: string): Promise<OrderPaymentIntentView> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
      include: {
        paymentMethod: {
          select: {
            id: true,
            name: true,
            type: true,
            colorKey: true,
            bankName: true,
            accountNumber: true,
            accountHolder: true,
            qrTemplate: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paidAmount: true,
            remainingAmount: true,
            customerName: true,
          },
        },
      },
    });

    if (!paymentIntent) {
      throw new NotFoundException('Khong tim thay payment intent');
    }

    return this.mapPaymentIntentView(paymentIntent);
  }

  private mapPaymentIntentView(paymentIntent: any): OrderPaymentIntentView {
    return mapOrderPaymentIntentView(paymentIntent);
  }

  private async generateVoucherNumberFor(
    db: Pick<DatabaseService, 'transaction'>,
    type: 'INCOME' | 'EXPENSE',
  ): Promise<string> {
    return generateFinanceVoucherNumber(db, type);
  }

  private async resolvePaymentAccount(
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
      paymentAccountLabel: `${account.name} ? ${account.bankName} ? ${account.accountNumber}` as string,
    };
  }

  private async normalizePayments(
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

  private async createOrderTransaction(
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
    return createOrderFinanceTransaction(tx as any, {
      generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
      buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
      mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
    }, params)
  }

  private async applyPaymentsToOrder(
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
        items?: Array<{ groomingSessionId?: string | null; hotelStayId?: string | null }>;
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
        throw new BadRequestException('Phải khách hàng để thanh toán bằng điểm');
      }
      const customer = await (tx as any).customer.findUnique({
        where: { id: params.order.customerId },
      });
      const sysConfig = await (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } });
      const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
      const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
      if (!customer || customer.points < pointsToDeduct) {
        throw new BadRequestException('Khách hàng không đủ điểm để thanh toán');
      }
      await (tx as any).customer.update({
        where: { id: customer.id },
        data: {
          points: { decrement: pointsToDeduct },
          pointsUsed: { increment: pointsToDeduct },
        },
      });
    }

    await recordOrderPayments(tx as any, {
      generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
      buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
      mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
      getPaymentLabel: (method) => this.getPaymentLabel(method),
    }, {
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
    })

    await this.expirePendingPaymentIntents(tx as any, { orderId: params.order.id });

    return tx.order.update({
      where: { id: params.order.id },
      data: {
        paidAmount: totalPaid,
        remainingAmount: remaining,
        paymentStatus: paymentStatus as any,
      },
      include: { items: true, payments: true, customer: true },
    });
  }

  private async updateCustomerDebt(tx: DatabaseService, customerId: string | null | undefined, delta: number) {
    if (!customerId || delta === 0) return;

    await tx.customer.update({
      where: { id: customerId },
      data: {
        debt: { increment: delta },
      } as any,
    });
  }


  private async incrementCustomerStats(tx: DatabaseService, customerId: string | null | undefined, total: number) {
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

  private getCompletedSalesBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setHours(0, 0, 0, 0);
    return bucket;
  }

  private getCompletedSalesBranchScope(branchId?: string | null): string {
    return branchId ?? 'UNASSIGNED';
  }

  private getCompletedSalesKey(productId: string, productVariantId?: string | null): string {
    return productVariantId ? `variant:${productVariantId}` : `product:${productId}`;
  }

  private createEmptySalesMetrics() {
    return {
      totalQuantitySold: 0,
      totalRevenue: 0,
      weekQuantitySold: 0,
      weekRevenue: 0,
      monthQuantitySold: 0,
      monthRevenue: 0,
      yearQuantitySold: 0,
      yearRevenue: 0,
    };
  }

  private async applyCompletedProductSalesDelta(
    tx: Pick<DatabaseService, 'productSalesDaily'>,
    params: {
      completedAt: Date;
      branchId?: string | null;
      items: Array<{
        productId?: string | null;
        productVariantId?: string | null;
        quantity: number;
        subtotal: number;
      }>;
      multiplier?: 1 | -1;
    },
  ) {
    const multiplier = params.multiplier ?? 1;
    const date = this.getCompletedSalesBucket(params.completedAt);
    const branchScope = this.getCompletedSalesBranchScope(params.branchId);
    const grouped = new Map<
      string,
      {
        productId: string;
        productVariantId: string | null;
        quantitySold: number;
        revenue: number;
      }
    >();

    for (const item of params.items) {
      if (!item.productId) continue;

      const salesKey = this.getCompletedSalesKey(item.productId, item.productVariantId ?? null);
      const current = grouped.get(salesKey) ?? {
        productId: item.productId,
        productVariantId: item.productVariantId ?? null,
        quantitySold: 0,
        revenue: 0,
      };

      current.quantitySold += item.quantity * multiplier;
      current.revenue += item.subtotal * multiplier;
      grouped.set(salesKey, current);
    }

    for (const [salesKey, value] of grouped.entries()) {
      if (value.quantitySold === 0 && value.revenue === 0) continue;

      await tx.productSalesDaily.upsert({
        where: {
          date_branchScope_salesKey: {
            date,
            branchScope,
            salesKey,
          },
        },
        create: {
          date,
          branchId: params.branchId ?? null,
          branchScope,
          productId: value.productId,
          productVariantId: value.productVariantId,
          salesKey,
          quantitySold: value.quantitySold,
          revenue: value.revenue,
        },
        update: {
          branchId: params.branchId ?? null,
          productId: value.productId,
          productVariantId: value.productVariantId,
          quantitySold: { increment: value.quantitySold },
          revenue: { increment: value.revenue },
        },
      });
    }
  }

  private async loadProductSalesMetrics(productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueProductIds.length === 0) {
      return {
        byProductId: new Map<string, ReturnType<OrdersService['createEmptySalesMetrics']>>(),
        byVariantId: new Map<string, ReturnType<OrdersService['createEmptySalesMetrics']>>(),
      };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const whereBase = { productId: { in: uniqueProductIds } };

    const [totalRows, weekRows, monthRows, yearRows] = await Promise.all([
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: whereBase,
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfWeek },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfMonth },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfYear },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
    ]);

    const byProductId = new Map<string, ReturnType<OrdersService['createEmptySalesMetrics']>>();
    const byVariantId = new Map<string, ReturnType<OrdersService['createEmptySalesMetrics']>>();

    const mergeRows = (
      rows: Array<{
        productId: string | null;
        productVariantId: string | null;
        _sum: { quantitySold: number | null; revenue: number | null };
      }>,
      quantityKey: 'totalQuantitySold' | 'weekQuantitySold' | 'monthQuantitySold' | 'yearQuantitySold',
      revenueKey: 'totalRevenue' | 'weekRevenue' | 'monthRevenue' | 'yearRevenue',
    ) => {
      for (const row of rows) {
        if (!row.productId) continue;

        const productMetrics = byProductId.get(row.productId) ?? this.createEmptySalesMetrics();
        productMetrics[quantityKey] += row._sum.quantitySold ?? 0;
        productMetrics[revenueKey] += row._sum.revenue ?? 0;
        byProductId.set(row.productId, productMetrics);

        if (!row.productVariantId) continue;

        const variantMetrics = byVariantId.get(row.productVariantId) ?? this.createEmptySalesMetrics();
        variantMetrics[quantityKey] += row._sum.quantitySold ?? 0;
        variantMetrics[revenueKey] += row._sum.revenue ?? 0;
        byVariantId.set(row.productVariantId, variantMetrics);
      }
    };

    mergeRows(totalRows as any, 'totalQuantitySold', 'totalRevenue');
    mergeRows(weekRows as any, 'weekQuantitySold', 'weekRevenue');
    mergeRows(monthRows as any, 'monthQuantitySold', 'monthRevenue');
    mergeRows(yearRows as any, 'yearQuantitySold', 'yearRevenue');

    return { byProductId, byVariantId };
  }

  private async restoreProductBranchStock(
    tx: DatabaseService,
    params: {
      branchId?: string | null;
      productId: string;
      productVariantId?: string | null;
      quantity: number;
      orderId: string;
      reason: string;
      staffId?: string | null;
    },
  ) {
    const movement = await resolveInventoryLedgerMovement(tx, {
      productId: params.productId,
      productVariantId: params.productVariantId,
      quantity: params.quantity,
      quantityLabel: 'So luong hoan ton',
    });
    const effectiveVariantId = movement.sourceVariantId;
    const effectiveQuantity = movement.sourceQuantity;

    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    const branchStock = await tx.branchStock.findFirst({
      where: {
        branchId: branch.id,
        productId: params.productId,
        productVariantId: effectiveVariantId,
      },
    });

    if (branchStock) {
      await tx.branchStock.update({
        where: { id: branchStock.id },
        data: {
          stock: { increment: effectiveQuantity },
        },
      });
    } else {
      await tx.branchStock.create({
        data: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: effectiveVariantId,
          stock: Math.max(0, effectiveQuantity),
          reservedStock: 0,
          minStock: 5,
        } as any,
      });
    }

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: movement.actionVariantId,
        sourceProductVariantId: movement.sourceVariantId,
        branchId: branch.id ?? null,
        staffId: params.staffId ?? null,
        type: 'IN',
        quantity: Math.abs(movement.sourceQuantity),
        actionQuantity: movement.actionQuantity,
        sourceQuantity: movement.sourceQuantity,
        conversionRate: movement.conversionRate,
        reason: params.reason,
        referenceId: params.orderId,
        referenceType: 'ORDER',
      } as any,
    });
  }

  private async deductProductBranchStock(

    tx: DatabaseService,
    params: {
      branchId?: string | null;
      productId: string;
      productVariantId?: string | null;
      quantity: number;
      orderId: string;
      reason: string;
      staffId?: string | null;
    },
  ) {
    const movement = await resolveInventoryLedgerMovement(tx, {
      productId: params.productId,
      productVariantId: params.productVariantId,
      quantity: params.quantity,
      quantityLabel: 'So luong xuat ton',
    });
    const effectiveVariantId = movement.sourceVariantId;
    const effectiveQuantity = movement.sourceQuantity;

    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    const productDisplayLabel = effectiveVariantId
      ? await tx.productVariant
        .findUnique({
          where: { id: effectiveVariantId },
          select: {
            name: true,
            sku: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        })
        .then((variant) => {
          const productName = variant?.product?.name || variant?.name || params.productId;
          return variant?.sku ? `${productName} (${variant.sku})` : productName;
        })
      : await tx.product
        .findUnique({
          where: { id: params.productId },
          select: {
            name: true,
            sku: true,
          },
        })
        .then((product) => {
          const productName = product?.name || params.productId;
          return product?.sku ? `${productName} (${product.sku})` : productName;
        });
    const branchStock = await tx.branchStock.findFirst({
      where: {
        branchId: branch.id,
        productId: params.productId,
        productVariantId: effectiveVariantId,
      },
    });

    if (!branchStock) {
      throw new BadRequestException(`San pham ${productDisplayLabel} chua co ton kho tai chi nhanh ${branch.name}`);
    }

    if (branchStock.stock < effectiveQuantity) {
      throw new BadRequestException(
        `Ton kho khong du cho san pham ${productDisplayLabel} tai chi nhanh ${branch.name}. Con ${branchStock.stock}, can ${effectiveQuantity} (${params.quantity} x ${movement.conversionRate ?? 1}).`,
      );
    }

    await tx.branchStock.update({
      where: { id: branchStock.id },
      data: {
        stock: { decrement: effectiveQuantity },
      },
    });

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: movement.actionVariantId,
        sourceProductVariantId: movement.sourceVariantId,
        branchId: branch.id ?? null,
        staffId: params.staffId ?? null,
        type: 'OUT',
        quantity: Math.abs(movement.sourceQuantity),
        actionQuantity: movement.actionQuantity,
        sourceQuantity: movement.sourceQuantity,
        conversionRate: movement.conversionRate,
        reason: params.reason,
        referenceId: params.orderId,
        referenceType: 'ORDER',
      } as any,
    });
  }

  private calculateOrderSubtotal(items: Array<{ unitPrice: number; quantity: number; discountItem?: number }>) {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity - (item.discountItem ?? 0), 0);
  }

  private async validateAndNormalizeCreateItems<
    T extends {
      productId?: string;
      productVariantId?: string;
      serviceId?: string;
      serviceVariantId?: string;
      description: string;
      type: string;
      quantity: number;
      isTemp?: boolean;
    },
  >(
    tx: Pick<DatabaseService, 'product' | 'productVariant' | 'service' | 'serviceVariant'>,
    items: T[],
  ): Promise<T[]> {
    const productIds = [...new Set(items.map((item) => item.productId).filter((value): value is string => Boolean(value)))];
    const productVariantIds = [
      ...new Set(items.map((item) => item.productVariantId).filter((value): value is string => Boolean(value))),
    ];
    const serviceIds = [...new Set(items.map((item) => item.serviceId).filter((value): value is string => Boolean(value)))];
    const serviceVariantIds = [
      ...new Set(items.map((item) => item.serviceVariantId).filter((value): value is string => Boolean(value))),
    ];

    const [directProducts, productVariants, directServices, serviceVariants] = await Promise.all([
      productIds.length > 0 ? tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } }) : [],
      productVariantIds.length > 0
        ? tx.productVariant.findMany({ where: { id: { in: productVariantIds } }, select: { id: true, productId: true } })
        : [],
      serviceIds.length > 0 ? tx.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true } }) : [],
      serviceVariantIds.length > 0
        ? tx.serviceVariant.findMany({ where: { id: { in: serviceVariantIds } }, select: { id: true, serviceId: true } })
        : [],
    ]);

    const inferredProductIds = [
      ...new Set(productVariants.map((item) => item.productId).filter((id) => !productIds.includes(id))),
    ];
    const inferredServiceIds = [
      ...new Set(serviceVariants.map((item) => item.serviceId).filter((id) => !serviceIds.includes(id))),
    ];

    const [inferredProducts, inferredServices] = await Promise.all([
      inferredProductIds.length > 0
        ? tx.product.findMany({ where: { id: { in: inferredProductIds } }, select: { id: true } })
        : [],
      inferredServiceIds.length > 0
        ? tx.service.findMany({ where: { id: { in: inferredServiceIds } }, select: { id: true } })
        : [],
    ]);

    const products = [...directProducts, ...inferredProducts];
    const services = [...directServices, ...inferredServices];

    const productSet = new Set(products.map((item) => item.id));
    const serviceSet = new Set(services.map((item) => item.id));
    const productVariantMap = new Map(productVariants.map((item) => [item.id, item]));
    const serviceVariantMap = new Map(serviceVariants.map((item) => [item.id, item]));

    return items.map((item, index) => {
      const itemLabel = item.description?.trim() ? `"${item.description}"` : `muc ${index + 1}`;
      let productId = item.productId;
      let serviceId = item.serviceId;

      if (item.productVariantId) {
        const variant = productVariantMap.get(item.productVariantId);
        if (!variant) {
          throw new BadRequestException(`Bien the san pham cua ${itemLabel} khong ton tai`);
        }

        if (!productId) {
          productId = variant.productId;
        } else if (productId !== variant.productId) {
          throw new BadRequestException(`San pham va bien the cua ${itemLabel} khong khop nhau`);
        }
      }

      if (item.serviceVariantId) {
        const variant = serviceVariantMap.get(item.serviceVariantId);
        if (!variant) {
          throw new BadRequestException(`Bien the dich vu cua ${itemLabel} khong ton tai`);
        }

        if (!serviceId) {
          serviceId = variant.serviceId;
        } else if (serviceId !== variant.serviceId) {
          throw new BadRequestException(`Dich vu va bien the cua ${itemLabel} khong khop nhau`);
        }
      }

      if (productId && !productSet.has(productId)) {
        throw new BadRequestException(`San pham cua ${itemLabel} khong ton tai hoac da bi xoa`);
      }

      if (serviceId && !serviceSet.has(serviceId)) {
        throw new BadRequestException(`Dich vu cua ${itemLabel} khong ton tai hoac da bi xoa`);
      }

      if (item.type === 'product' && !productId && !item.isTemp) {
        throw new BadRequestException(`Muc ${itemLabel} dang la san pham nhung thieu productId`);
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`So luong cua ${itemLabel} khong hop le`);
      }

      if ((item.type === 'product' || productId) && !Number.isInteger(quantity)) {
        throw new BadRequestException(`So luong san pham cua ${itemLabel} phai la so nguyen`);
      }

      if (item.type === 'service' && !serviceId) {
        throw new BadRequestException(`Muc ${itemLabel} dang la dich vu nhung thieu serviceId`);
      }

      const normalizedItem = { ...item } as T;

      if (productId) {
        normalizedItem.productId = productId;
      } else {
        delete normalizedItem.productId;
      }

      if (serviceId) {
        normalizedItem.serviceId = serviceId;
      } else {
        delete normalizedItem.serviceId;
      }

      return normalizedItem;
    });
  }

  private buildOrderItemData(item: CreateOrderDto['items'][number] | UpdateOrderItemDto) {
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountItem: item.discountItem ?? 0,
      vatRate: item.vatRate ?? 0,
      subtotal: item.unitPrice * item.quantity - (item.discountItem ?? 0),
      pricingSnapshot: (buildHotelOrderItemPricingSnapshot(item) ?? buildGroomingOrderItemPricingSnapshot(item)) as any,
      type: item.type,
      productId: item.productId ?? null,
      productVariantId: item.productVariantId ?? null,
      sku: 'sku' in item ? item.sku ?? null : null,
      serviceId: item.serviceId ?? null,
      serviceVariantId: item.serviceVariantId ?? null,
      petId: item.petId ?? null,
      isTemp: item.isTemp ?? false,
      tempLabel: item.tempLabel ?? null,
    };
  }

  private async syncGroomingSession(
    tx: DatabaseService,
    params: {
      orderId: string;
      orderItemId: string;
      customerId?: string | null;
      branchId?: string | null;
      serviceId?: string | null;
      orderCreatedAt?: Date;
      staffId?: string | null;
      item: CreateOrderDto['items'][number] | UpdateOrderItemDto;
      existingSessionId?: string | null;
    },
  ) {
    const details = params.item.groomingDetails;
    if (!details) {
      if (params.existingSessionId) {
        const session = await tx.groomingSession.findUnique({ where: { id: params.existingSessionId } });
        if (session && !['PENDING', 'IN_PROGRESS', 'CANCELLED'].includes(session.status)) {
          throw new BadRequestException(`Phiên spa ${session.sessionCode ?? session.id} đã hoàn thành, không thể bỏ khỏi đơn đang giao dịch.`);
        }
        await tx.groomingSession.update({
          where: { id: params.existingSessionId },
          data: { status: 'CANCELLED' },
        });
        await tx.orderItem.update({
          where: { id: params.orderItemId },
          data: { groomingSessionId: null },
        });
      }
      return null;
    }

    const pet = await tx.pet.findUnique({ where: { id: details.petId } });
    const branch = await resolveBranchIdentity(tx as any, params.branchId);

    // Auto-resolve serviceId from item description if not provided
    let resolvedServiceId = params.serviceId ?? null;
    if (!resolvedServiceId && params.item.serviceId) {
      resolvedServiceId = params.item.serviceId;
    }
    if (!resolvedServiceId && params.item.description) {
      const matchingService = await tx.service.findFirst({
        where: {
          type: 'GROOMING',
          isActive: true,
          name: { contains: params.item.description, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (matchingService) resolvedServiceId = matchingService.id;
    }

    const payload = {
      petId: details.petId,
      petName: pet?.name ?? '',
      customerId: params.customerId ?? null,
      branchId: branch.id,
      staffId: details.performerId ?? null,
      serviceId: resolvedServiceId,
      orderId: params.orderId,
      startTime: details.startTime ? new Date(details.startTime) : null,
      scheduledDate: details.scheduledDate ? new Date(details.scheduledDate) : null,
      notes: details.notes ?? null,
      price: params.item.unitPrice * params.item.quantity,
      packageCode: details.packageCode ?? null,
      weightAtBooking: details.weightAtBooking ?? null,
      weightBandId: details.weightBandId ?? null,
      pricingSnapshot: (buildGroomingOrderItemPricingSnapshot(params.item) ?? details.pricingSnapshot) as any,
    };

    if (params.existingSessionId) {
      const current = await tx.groomingSession.findUnique({ where: { id: params.existingSessionId } });
      if (current && current.status === 'CANCELLED') {
        throw new BadRequestException(`Phiên spa ${current.sessionCode ?? current.id} đã bị hủy, không thể cập nhật lại từ POS.`);
      }

      await tx.groomingSession.update({
        where: { id: params.existingSessionId },
        data: payload,
      });

      return params.existingSessionId;
    }

    const codeDate = params.orderCreatedAt ?? new Date();
    const sessionCode = await this.generateGroomingSessionCode(tx as any, codeDate, branch.code);
    const created = await tx.groomingSession.create({
      data: {
        ...payload,
        sessionCode,
        status: 'PENDING',
        ...(params.staffId ? {
          timeline: {
            create: {
              action: 'Tạo phiếu từ đơn',
              toStatus: 'PENDING',
              note: `Từ đơn ${params.orderId}`,
              performedBy: params.staffId,
            },
          },
        } : {}),
      },
    });

    await tx.orderItem.update({
      where: { id: params.orderItemId },
      data: { groomingSessionId: created.id },
    });

    return created.id;
  }

  private async syncHotelStay(
    tx: DatabaseService,
    params: {
      orderId: string;
      orderItemId: string;
      customerId?: string | null;
      branchId?: string | null;
      orderCreatedAt?: Date;
      item: CreateOrderDto['items'][number] | UpdateOrderItemDto;
      existingStayId?: string | null;
    },
  ) {
    const details = params.item.hotelDetails;
    if (!details) {
      if (params.existingStayId) {
        const stay = await tx.hotelStay.findUnique({ where: { id: params.existingStayId } });
        if (stay && !['BOOKED', 'CANCELLED'].includes(stay.status)) {
          throw new BadRequestException(`Lượt lưu trú ${stay.stayCode ?? stay.id} đã bắt đầu, không thể bỏ khỏi đơn đang giao dịch.`);
        }
        await tx.hotelStay.update({
          where: { id: params.existingStayId },
          data: { status: 'CANCELLED' },
        });
        await tx.orderItem.update({
          where: { id: params.orderItemId },
          data: { hotelStayId: null },
        });
      }
      return null;
    }

    const pet = await tx.pet.findUnique({ where: { id: details.petId } });
    const checkInDate = new Date(details.checkInDate);
    const checkOutDate = new Date(details.checkOutDate);
    const branch = await resolveBranchIdentity(tx as any, details.branchId ?? params.branchId ?? null);
    const totalPrice = params.item.unitPrice * params.item.quantity - (params.item.discountItem ?? 0);
    const payload = {
      petId: details.petId,
      petName: pet?.name ?? '',
      customerId: params.customerId ?? null,
      branchId: branch.id,
      cageId: details.cageId ?? null,
      checkIn: checkInDate,
      estimatedCheckOut: checkOutDate,
      lineType: (details.lineType as any) ?? 'REGULAR',
      price: totalPrice,
      dailyRate: details.dailyRate ?? params.item.unitPrice,
      depositAmount: details.depositAmount ?? 0,
      promotion: details.promotion ?? 0,
      surcharge: details.surcharge ?? 0,
      totalPrice,
      rateTableId: details.rateTableId ?? null,
      notes: details.notes ?? null,
      orderId: params.orderId,
    };

    if (params.existingStayId) {
      const current = await tx.hotelStay.findUnique({ where: { id: params.existingStayId } });
      if (current && !['BOOKED', 'CHECKED_IN'].includes(current.status)) {
        throw new BadRequestException(`Lượt lưu trú ${current.id} đã checkout hoặc hủy, không thể cập nhật lại từ POS.`);
      }

      await tx.hotelStay.update({
        where: { id: params.existingStayId },
        data: payload as any,
      });

      return params.existingStayId;
    }

    const codeDate = params.orderCreatedAt ?? new Date();
    const stayCode = await this.generateHotelStayCode(tx as any, codeDate, branch.code);
    const created = await tx.hotelStay.create({
      data: {
        stayCode,
        ...payload,
        status: 'BOOKED',
        paymentStatus: 'UNPAID',
      } as any,
    });

    await tx.orderItem.update({
      where: { id: params.orderItemId },
      data: { hotelStayId: created.id },
    });

    return created.id;
  }

  private async syncGroupedHotelStay(
    tx: DatabaseService,
    params: {
      entries: Array<{ item: any; orderItem: any }>;
      order: { id: string; createdAt: Date };
      customerId?: string | null;
      branchId?: string | null;
    },
  ) {
    const sortedGroupItems = [...params.entries].sort((left, right) => {
      const leftIndex = left.item.hotelDetails?.chargeLineIndex;
      const rightIndex = right.item.hotelDetails?.chargeLineIndex;
      return (leftIndex ?? 0) - (rightIndex ?? 0);
    });
    const first = sortedGroupItems[0];
    if (!first?.item.hotelDetails) return [];

    const firstDetails = first.item.hotelDetails;
    const checkInDate = new Date(firstDetails.checkInDate);
    const checkOutDate = new Date(firstDetails.checkOutDate);
    const branch = await resolveBranchIdentity(tx as any, firstDetails.branchId ?? params.branchId ?? null);
    const stayCode = await this.generateHotelStayCode(tx as any, params.order.createdAt, branch.code);
    const totalPrice = sortedGroupItems.reduce(
      (sum, entry) => sum + entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
      0,
    );
    const totalDays = sortedGroupItems.reduce(
      (sum, entry) => sum + Number(entry.item.hotelDetails?.chargeQuantityDays ?? entry.item.quantity ?? 0),
      0,
    );
    const chargeLineTypes = sortedGroupItems.map((entry) =>
      normalizeHotelLineType(entry.item.hotelDetails?.chargeDayType ?? entry.item.hotelDetails?.lineType),
    );
    const displayLineType = chargeLineTypes.length > 0 && chargeLineTypes.every((lineType) => lineType === 'HOLIDAY')
      ? 'HOLIDAY'
      : 'REGULAR';
    const chargeLines = sortedGroupItems.map((entry, index) => {
      const details = entry.item.hotelDetails;
      const quantityDays = Number(details.chargeQuantityDays ?? entry.item.quantity ?? 0);
      const unitPrice = Number(details.chargeUnitPrice ?? entry.item.unitPrice ?? 0);
      const subtotal = Number(
        details.chargeSubtotal ?? entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
      );

      return {
        label: details.chargeLineLabel ?? entry.item.description,
        dayType: normalizeHotelLineType(details.chargeDayType ?? details.lineType),
        quantityDays,
        unitPrice,
        subtotal,
        sortOrder: details.chargeLineIndex ?? index,
        weightBandId: details.chargeWeightBandId || null,
        pricingSnapshot: {
          source: 'POS_HOTEL_CHARGE_LINE',
          bookingGroupKey: details.bookingGroupKey ?? null,
          weightBandLabel: details.chargeWeightBandLabel ?? null,
          orderItemId: entry.orderItem.id,
        },
      };
    });
    const pricingSnapshot = {
      source: 'POS_HOTEL_CHARGE_LINES',
      bookingGroupKey: firstDetails.bookingGroupKey ?? null,
      chargeLines: chargeLines.map((line) => ({
        label: line.label,
        dayType: line.dayType,
        quantityDays: line.quantityDays,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
        weightBandId: line.weightBandId,
      })),
    };
    const breakdownSnapshot = {
      totalDays,
      totalPrice,
      chargeLines: pricingSnapshot.chargeLines,
    };
    const pet = await tx.pet.findUnique({ where: { id: firstDetails.petId } });

    const stay = await tx.hotelStay.create({
      data: {
        stayCode,
        petId: firstDetails.petId,
        petName: pet?.name ?? '',
        customerId: params.customerId ?? null,
        branchId: branch.id,
        cageId: firstDetails.cageId ?? null,
        checkIn: checkInDate,
        estimatedCheckOut: checkOutDate,
        status: 'BOOKED',
        lineType: displayLineType as any,
        price: totalPrice,
        dailyRate: firstDetails.dailyRate ?? (totalDays > 0 ? totalPrice / totalDays : first.item.unitPrice),
        depositAmount: firstDetails.depositAmount ?? 0,
        paymentStatus: 'UNPAID',
        promotion: firstDetails.promotion ?? 0,
        surcharge: firstDetails.surcharge ?? 0,
        totalPrice,
        rateTableId: firstDetails.rateTableId ?? null,
        notes: firstDetails.notes ?? null,
        orderId: params.order.id,
        weightBandId: chargeLines.find((line) => line.weightBandId)?.weightBandId ?? null,
        pricingSnapshot: pricingSnapshot as any,
        breakdownSnapshot: breakdownSnapshot as any,
      } as any,
    });

    if (chargeLines.length > 0) {
      await tx.hotelStayChargeLine.createMany({
        data: chargeLines.map((line) => ({
          hotelStayId: stay.id,
          weightBandId: line.weightBandId,
          label: line.label,
          dayType: line.dayType as any,
          quantityDays: line.quantityDays,
          unitPrice: line.unitPrice,
          subtotal: line.subtotal,
          sortOrder: line.sortOrder,
          pricingSnapshot: line.pricingSnapshot as any,
        })),
      });
    }

    for (const entry of sortedGroupItems) {
      await tx.orderItem.update({
        where: { id: entry.orderItem.id },
        data: {
          hotelStayId: stay.id,
          pricingSnapshot: buildHotelOrderItemPricingSnapshot(entry.item) as any,
        },
      });
    }

    return [`HOTEL_STAY:${stay.id}`, `HOTEL_CODE:${stayCode}`];
  }

  private async loadOrderOrThrow(id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderNumber: id },
        ],
      },
      include: {
        customer: true,
        payments: true,
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
        items: {
          include: {
            product: true,
            service: true,
            productVariant: true,
            serviceVariant: true,
            hotelStay: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  // Catalog (POS quick access)

  async getProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        variants: {
          where: { isActive: true, deletedAt: null },
          include: {
            branchStocks: { include: { branch: { select: { name: true } } } }
          }
        },
        branchStocks: { include: { branch: { select: { name: true } } } }
      },
      orderBy: { name: 'asc' },
    });

    const { byProductId, byVariantId } = await this.loadProductSalesMetrics(products.map((product) => product.id));

    return products.map((product) => {
      const productMetrics = byProductId.get(product.id) ?? this.createEmptySalesMetrics();

      return {
        ...product,
        soldCount: productMetrics.totalQuantitySold,
        salesMetrics: productMetrics,
        variants: product.variants.map((variant) => {
          const variantMetrics = byVariantId.get(variant.id) ?? this.createEmptySalesMetrics();

          return {
            ...variant,
            soldCount: variantMetrics.totalQuantitySold,
            salesMetrics: variantMetrics,
          };
        }),
      };
    });
  }

  async getServices() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // createOrder
  // Auto-classify: QUICK (product only) vs SERVICE (has grooming/hotel)
  // QUICK: deduct stock immediately, status -> PAID/PARTIAL
  // SERVICE: reserve stock, status -> PENDING, pay later
  async createOrder(data: CreateOrderDto, staffId: string): Promise<any> {
    const { items, payments = [], discount = 0, shippingFee = 0 } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    const orderNumber = await this.generateOrderNumber();

    // Classify order type
    const normalizedPayments = await this.normalizePayments(this.prisma as any, payments);

    // Financial calculations
    const {
      orderType,
      orderStatus,
      paymentStatus,
      subtotal,
      total,
      totalPaid,
      remainingAmount,
    } = buildCreateOrderDraft({
      items,
      payments: normalizedPayments,
      discount,
      shippingFee,
    });
    return this.prisma.$transaction(async (tx) => {
      const normalizedItems = await this.validateAndNormalizeCreateItems(tx as any, items);

      // 1. Create order with items and payments
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          customerId: data.customerId ?? null,
          staffId,
          branchId: data.branchId ?? null,
          status: orderStatus as any,
          paymentStatus: paymentStatus as any,
          completedAt: orderStatus === 'COMPLETED' ? new Date() : null,
          stockExportedAt: orderStatus === 'COMPLETED' ? new Date() : null,
          stockExportedBy: orderStatus === 'COMPLETED' ? staffId : null,
          subtotal,
          discount,
          shippingFee,
          total,
          paidAmount: totalPaid,
          remainingAmount,
          notes: data.notes ?? null,
          items: {
            create: normalizedItems.map((item) => this.buildOrderItemData(item)),
          },
          payments: {
            create: normalizedPayments.map((p) => ({
              method: p.method,
              amount: p.amount,
              note: p.note ?? null,
              paymentAccountId: p.paymentAccountId ?? null,
              paymentAccountLabel: p.paymentAccountLabel ?? null,
            })),
          },
        },
        include: {
          items: true,
          payments: true,
          customer: true,
        },
      });

      await applyCreateOrderPostActions(
        {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            createdAt: order.createdAt,
            completedAt: order.completedAt,
            branchId: order.branchId ?? null,
            items: order.items.map((item) => ({
              id: item.id,
              productId: item.productId ?? null,
              productVariantId: item.productVariantId ?? null,
              quantity: item.quantity,
              subtotal: item.subtotal,
            })),
          },
          normalizedItems,
          orderType,
          orderStatus,
          paymentStatus,
          normalizedPayments,
          customerId: data.customerId ?? null,
          branchId: data.branchId ?? null,
          total,
          notes: data.notes ?? null,
          staffId,
        },
        {
          handleQuickProductItem: async ({ item, orderItem, order, branchId, orderStatus, staffId }) => {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (!product) throw new BadRequestException(`San pham ${item.productId} khong ton tai`);

            await this.deductProductBranchStock(tx as any, {
              branchId,
              productId: item.productId,
              productVariantId: item.productVariantId ?? null,
              quantity: item.quantity,
              orderId: order.id,
              staffId,
              reason: `Ban hang don ${order.orderNumber}`,
            });

            if (orderStatus === 'COMPLETED') {
              await tx.orderItem.update({
                where: { id: orderItem.id },
                data: { stockExportedAt: order.completedAt ?? new Date(), stockExportedBy: staffId } as any,
              });
            }
          },
          syncGroomingSession: ({ item, orderItem, order, customerId, branchId, staffId }) =>
            this.syncGroomingSession(tx as any, {
              orderId: order.id,
              orderItemId: orderItem.id,
              customerId,
              branchId,
              serviceId: item.serviceId ?? null,
              orderCreatedAt: order.createdAt,
              staffId,
              item,
            }),
          syncHotelStay: ({ item, orderItem, order, customerId, branchId }) =>
            this.syncHotelStay(tx as any, {
              orderId: order.id,
              orderItemId: orderItem.id,
              customerId,
              branchId,
              orderCreatedAt: order.createdAt,
              item,
            }),
          syncGroupedHotelStay: ({ entries, order, customerId, branchId }) =>
            this.syncGroupedHotelStay(tx as any, {
              entries,
              order,
              customerId,
              branchId,
            }),
          recordInitialPayments: async ({ order, normalizedPayments, notes, staffId, serviceTraceParts }) => {
            const pointPaymentTotal = normalizedPayments.filter((p) => p.method === 'POINTS').reduce((sum, p) => sum + p.amount, 0);
            if (pointPaymentTotal > 0) {
              if (!data.customerId) {
                throw new BadRequestException('Phải thiết lập khách hàng để thanh toán bằng điểm');
              }
              const customer = await (tx as any).customer.findUnique({
                where: { id: data.customerId },
              });
              const sysConfig = await (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } });
              const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
              const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
              if (!customer || customer.points < pointsToDeduct) {
                throw new BadRequestException('Khách hàng không đủ điểm để thanh toán');
              }
              await (tx as any).customer.update({
                where: { id: customer.id },
                data: {
                  points: { decrement: pointsToDeduct },
                  pointsUsed: { increment: pointsToDeduct },
                },
              });
            }

            for (const pay of normalizedPayments) {
              if (pay.amount <= 0) continue;

              if (pay.method !== 'POINTS') {
                const label = this.getPaymentLabel(pay.method);
                await createOrderFinanceTransaction(
                  tx as any,
                  {
                    getPaymentLabel: (method) => this.getPaymentLabel(method),
                    buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
                    mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
                    generateVoucherNumber: () => this.generateVoucherNumberFor(tx as any, 'INCOME'),
                  },
                  {
                    order: {
                      id: order.id,
                      orderNumber: order.orderNumber,
                      branchId: data.branchId ?? null,
                      customerId: data.customerId ?? null,
                      customerName: data.customerName,
                    },
                    type: 'INCOME',
                    amount: pay.amount,
                    paymentMethod: pay.method,
                    paymentAccountId: pay.paymentAccountId ?? null,
                    paymentAccountLabel: pay.paymentAccountLabel ?? null,
                    description: `Thu tu don hang ${order.orderNumber} - ${label}`,
                    note: pay.note ?? notes ?? null,
                    source: 'ORDER_PAYMENT',
                    staffId,
                    traceParts: serviceTraceParts,
                  },
                );
              }

              // Since QUICK orders bypass recordOrderPayments entirely right now in this codebase,
              // we must manually record the OrderPayment history entry for POINTS
              // (and for other methods as well if we wanted full consistency, but we keep existing behavior)
              if (pay.method === 'POINTS') {
                await (tx as any).orderPayment.create({
                  data: {
                    orderId: order.id,
                    method: pay.method,
                    amount: pay.amount,
                    note: pay.note ?? notes ?? null,
                    paymentAccountId: pay.paymentAccountId ?? null,
                    paymentAccountLabel: pay.paymentAccountLabel ?? null,
                  },
                });
              }
            }
          },
          incrementCustomerStats: (customerId, total) => this.incrementCustomerStats(tx as any, customerId, total),
          applyCompletedProductSalesDelta: ({ order }) =>
            this.applyCompletedProductSalesDelta(tx as any, {
              completedAt: order.completedAt ?? order.createdAt,
              branchId: order.branchId ?? null,
              items: order.items.map((item) => ({
                productId: item.productId ?? null,
                productVariantId: item.productVariantId ?? null,
                quantity: item.quantity,
                subtotal: item.subtotal,
              })),
            }),
          createQuickStockExportTimeline: async ({ order, physicalItemCount, staffId }) => {
            await createStockExportTimelineEntry(tx.orderTimeline as any, {
              orderId: order.id,
              performedBy: staffId,
              occurredAt: order.completedAt ?? new Date(),
              exportedItemCount: physicalItemCount,
              metadata: { source: 'POS_CREATE' },
            });
          },
        },
      );

      return order;
    });
  }

  // payOrder
  // Collect additional payment for SERVICE orders (multi-payment support)
  async updateOrder(id: string, data: UpdateOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderNumber: id },
        ],
      },
      include: {
        items: true,
        customer: true,
      },
    });
    if (order) this.assertOrderScope(order, user);

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    id = order.id; // Resolve to internal UUID

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Không thể sửa đơn đã hoàn tất hoặc đã hủy');
    }
    if (!data.items?.length) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm hoặc dịch vụ');
    }

    for (const item of data.items) {
      if (item.groomingDetails && item.hotelDetails) {
        throw new BadRequestException(`Item "${item.description}" không thể vừa là spa vừa là hotel`);
      }
    }

    const discount = data.discount ?? 0;
    const shippingFee = data.shippingFee ?? 0;
    const subtotal = this.calculateOrderSubtotal(data.items);
    const total = subtotal + shippingFee - discount;
    const paymentStatus = this.calculatePaymentStatus(total, order.paidAmount);

    await this.prisma.$transaction(async (tx) => {
      const normalizedItems = await this.validateAndNormalizeCreateItems(tx as any, data.items);
      const existingItems = await tx.orderItem.findMany({
        where: { orderId: id },
      });
      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const incomingIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean) as string[]);
      const incomingHotelStayIds = new Set(
        normalizedItems
          .map((item) => (item.id ? existingById.get(item.id)?.hotelStayId : null))
          .filter((value): value is string => Boolean(value)),
      );
      const hotelStayGroups = new Map<string, Array<{ item: any; orderItem: any; existingStayId?: string | null }>>();

      for (const currentItem of existingItems) {
        if (incomingIds.has(currentItem.id)) continue;

        await this.syncGroomingSession(tx as any, {
          orderId: id,
          orderItemId: currentItem.id,
          branchId: data.branchId ?? null,
          orderCreatedAt: order.createdAt,
          staffId,
          item: {
            description: currentItem.description,
            quantity: currentItem.quantity,
            unitPrice: currentItem.unitPrice,
            discountItem: currentItem.discountItem,
            type: currentItem.type,
          } as any,
          existingSessionId: currentItem.groomingSessionId,
        });
        await this.syncHotelStay(tx as any, {
          orderId: id,
          orderItemId: currentItem.id,
          branchId: data.branchId ?? null,
          orderCreatedAt: order.createdAt,
          item: {
            description: currentItem.description,
            quantity: currentItem.quantity,
            unitPrice: currentItem.unitPrice,
            discountItem: currentItem.discountItem,
            type: currentItem.type,
          } as any,
          existingStayId: incomingHotelStayIds.has(currentItem.hotelStayId ?? '') ? null : currentItem.hotelStayId,
        });
        await tx.orderItem.delete({ where: { id: currentItem.id } });
      }

      for (const item of normalizedItems) {
        const itemData = this.buildOrderItemData(item);
        const existingItem = item.id ? existingById.get(item.id) : null;

        if (existingItem) {
          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: itemData,
          });

          await this.syncGroomingSession(tx as any, {
            orderId: id,
            orderItemId: existingItem.id,
            customerId: data.customerId ?? null,
            branchId: data.branchId ?? null,
            serviceId: item.serviceId ?? null,
            orderCreatedAt: order.createdAt,
            staffId,
            item,
            existingSessionId: existingItem.groomingSessionId,
          });
          if (item.hotelDetails?.bookingGroupKey) {
            const group = hotelStayGroups.get(item.hotelDetails.bookingGroupKey) ?? [];
            group.push({ item, orderItem: existingItem, existingStayId: existingItem.hotelStayId });
            hotelStayGroups.set(item.hotelDetails.bookingGroupKey, group);
          } else {
            await this.syncHotelStay(tx as any, {
              orderId: id,
              orderItemId: existingItem.id,
              customerId: data.customerId ?? null,
              branchId: data.branchId ?? null,
              orderCreatedAt: order.createdAt,
              item,
              existingStayId: existingItem.hotelStayId,
            });
          }
          continue;
        }

        const createdItem = await tx.orderItem.create({
          data: {
            orderId: id,
            ...itemData,
          },
        });

        await this.syncGroomingSession(tx as any, {
          orderId: id,
          orderItemId: createdItem.id,
          customerId: data.customerId ?? null,
          branchId: data.branchId ?? null,
          serviceId: item.serviceId ?? null,
          orderCreatedAt: order.createdAt,
          staffId,
          item,
        });
        if (item.hotelDetails?.bookingGroupKey) {
          const group = hotelStayGroups.get(item.hotelDetails.bookingGroupKey) ?? [];
          group.push({ item, orderItem: createdItem, existingStayId: null });
          hotelStayGroups.set(item.hotelDetails.bookingGroupKey, group);
        } else {
          await this.syncHotelStay(tx as any, {
            orderId: id,
            orderItemId: createdItem.id,
            customerId: data.customerId ?? null,
            branchId: data.branchId ?? null,
            orderCreatedAt: order.createdAt,
            item,
          });
        }
      }

      for (const groupItems of hotelStayGroups.values()) {
        const sortedGroupItems = [...groupItems].sort((left, right) => {
          const leftIndex = left.item.hotelDetails?.chargeLineIndex;
          const rightIndex = right.item.hotelDetails?.chargeLineIndex;
          return (leftIndex ?? 0) - (rightIndex ?? 0);
        });
        const first = sortedGroupItems[0]!;
        const firstDetails = first.item.hotelDetails;
        const existingStayId = sortedGroupItems.find((entry) => entry.existingStayId)?.existingStayId ?? null;
        const checkInDate = new Date(firstDetails.checkInDate);
        const checkOutDate = new Date(firstDetails.checkOutDate);
        const branch = await resolveBranchIdentity(tx as any, firstDetails.branchId ?? data.branchId ?? null);
        const totalPrice = sortedGroupItems.reduce(
          (sum, entry) => sum + entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
          0,
        );
        const totalDays = sortedGroupItems.reduce(
          (sum, entry) => sum + Number(entry.item.hotelDetails?.chargeQuantityDays ?? entry.item.quantity ?? 0),
          0,
        );
        const chargeLineTypes = sortedGroupItems.map((entry) =>
          normalizeHotelLineType(entry.item.hotelDetails?.chargeDayType ?? entry.item.hotelDetails?.lineType),
        );
        const displayLineType = chargeLineTypes.length > 0 && chargeLineTypes.every((lineType) => lineType === 'HOLIDAY')
          ? 'HOLIDAY'
          : 'REGULAR';
        const chargeLines = sortedGroupItems.map((entry, index) => {
          const details = entry.item.hotelDetails;
          const quantityDays = Number(details.chargeQuantityDays ?? entry.item.quantity ?? 0);
          const unitPrice = Number(details.chargeUnitPrice ?? entry.item.unitPrice ?? 0);
          const subtotal = Number(
            details.chargeSubtotal ?? entry.item.unitPrice * entry.item.quantity - (entry.item.discountItem ?? 0),
          );

          return {
            label: details.chargeLineLabel ?? entry.item.description,
            dayType: normalizeHotelLineType(details.chargeDayType ?? details.lineType),
            quantityDays,
            unitPrice,
            subtotal,
            sortOrder: details.chargeLineIndex ?? index,
            weightBandId: details.chargeWeightBandId || null,
            pricingSnapshot: {
              source: 'POS_HOTEL_CHARGE_LINE',
              bookingGroupKey: details.bookingGroupKey ?? null,
              weightBandLabel: details.chargeWeightBandLabel ?? null,
              orderItemId: entry.orderItem.id,
            },
          };
        });
        const pricingSnapshot = {
          source: 'POS_HOTEL_CHARGE_LINES',
          bookingGroupKey: firstDetails.bookingGroupKey ?? null,
          chargeLines: chargeLines.map((line) => ({
            label: line.label,
            dayType: line.dayType,
            quantityDays: line.quantityDays,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            weightBandId: line.weightBandId,
          })),
        };
        const breakdownSnapshot = { totalDays, totalPrice, chargeLines: pricingSnapshot.chargeLines };
        const pet = await tx.pet.findUnique({ where: { id: firstDetails.petId } });
        const stayPayload = {
          petId: firstDetails.petId,
          petName: pet?.name ?? '',
          customerId: data.customerId ?? null,
          branchId: branch.id,
          cageId: firstDetails.cageId ?? null,
          checkIn: checkInDate,
          estimatedCheckOut: checkOutDate,
          lineType: displayLineType as any,
          price: totalPrice,
          dailyRate: firstDetails.dailyRate ?? (totalDays > 0 ? totalPrice / totalDays : first.item.unitPrice),
          depositAmount: firstDetails.depositAmount ?? 0,
          promotion: firstDetails.promotion ?? 0,
          surcharge: firstDetails.surcharge ?? 0,
          totalPrice,
          rateTableId: firstDetails.rateTableId ?? null,
          notes: firstDetails.notes ?? null,
          orderId: id,
          weightBandId: chargeLines.find((line) => line.weightBandId)?.weightBandId ?? null,
          pricingSnapshot: pricingSnapshot as any,
          breakdownSnapshot: breakdownSnapshot as any,
        };

        if (existingStayId) {
          const currentStay = await tx.hotelStay.findUnique({ where: { id: existingStayId } });
          if (currentStay && !['BOOKED', 'CHECKED_IN'].includes(currentStay.status)) {
            throw new BadRequestException(`Lượt lưu trú ${currentStay.id} đã checkout hoặc hủy, không thể cập nhật lại từ POS.`);
          }
        }

        const stay = existingStayId
          ? await tx.hotelStay.update({
            where: { id: existingStayId },
            data: stayPayload as any,
          })
          : await tx.hotelStay.create({
            data: {
              stayCode: await this.generateHotelStayCode(tx as any, order.createdAt, branch.code),
              ...stayPayload,
              status: 'CHECKED_IN',
              paymentStatus: 'UNPAID',
            } as any,
          });

        await tx.hotelStayChargeLine.deleteMany({ where: { hotelStayId: stay.id } });
        if (chargeLines.length > 0) {
          await tx.hotelStayChargeLine.createMany({
            data: chargeLines.map((line) => ({
              hotelStayId: stay.id,
              weightBandId: line.weightBandId,
              label: line.label,
              dayType: line.dayType as any,
              quantityDays: line.quantityDays,
              unitPrice: line.unitPrice,
              subtotal: line.subtotal,
              sortOrder: line.sortOrder,
              pricingSnapshot: line.pricingSnapshot as any,
            })),
          });
        }

        for (const entry of sortedGroupItems) {
          await tx.orderItem.update({
            where: { id: entry.orderItem.id },
            data: {
              hotelStayId: stay.id,
              pricingSnapshot: buildHotelOrderItemPricingSnapshot(entry.item) as any,
            },
          });
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          customerName: data.customerName,
          customerId: data.customerId ?? null,
          staffId,
          branchId: data.branchId ?? null,
          subtotal,
          discount,
          shippingFee,
          total,
          paymentStatus: paymentStatus as any,
          remainingAmount: this.calculateRemainingAmount(total, order.paidAmount),
          notes: data.notes ?? null,
        },
      });
    });

    return this.findOne(id);
  }

  async listPaymentIntents(id: string, user?: AccessUser): Promise<OrderPaymentIntentView[]> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');

    const paymentIntents = await this.prisma.paymentIntent.findMany({
      where: { orderId: order.id },
      include: {
        paymentMethod: {
          select: {
            id: true,
            name: true,
            type: true,
            colorKey: true,
            bankName: true,
            accountNumber: true,
            accountHolder: true,
            qrTemplate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return paymentIntents.map((paymentIntent) => this.mapPaymentIntentView(paymentIntent));
  }

  async getPaymentIntentByCode(code: string, user?: AccessUser): Promise<OrderPaymentIntentView> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { code },
      include: {
        paymentMethod: {
          select: {
            id: true,
            name: true,
            type: true,
            colorKey: true,
            bankName: true,
            accountNumber: true,
            accountHolder: true,
            qrTemplate: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paidAmount: true,
            remainingAmount: true,
            customerName: true,
            branchId: true,
          },
        },
      },
    });

    if (!paymentIntent) {
      throw new NotFoundException('Khong tim thay payment intent');
    }

    if (paymentIntent.order) {
      this.assertOrderScope(paymentIntent.order, user);
    }

    return this.mapPaymentIntentView(paymentIntent);
  }

  async createPaymentIntent(id: string, dto: CreatePaymentIntentDto, user?: AccessUser): Promise<OrderPaymentIntentView> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        branchId: true,
        customerName: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,
        status: true,
      },
    });

    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    assertOrderCanCreatePaymentIntent(order);
    const requestedAmount = resolveRequestedPaymentIntentAmount(order, dto.amount);

    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: dto.paymentMethodId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        colorKey: true,
        branchIds: true,
        minAmount: true,
        maxAmount: true,
        timeFrom: true,
        timeTo: true,
        weekdays: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        qrEnabled: true,
        qrProvider: true,
        qrBankBin: true,
        qrTemplate: true,
        transferNotePrefix: true,
      },
    });

    if (!paymentMethod || paymentMethod.type !== 'BANK') {
      throw new BadRequestException('Phuong thuc thanh toan khong hop le cho QR chuyen khoan');
    }

    if (!paymentMethod.qrEnabled || paymentMethod.qrProvider !== 'VIETQR') {
      throw new BadRequestException('Phuong thuc nay chua bat VietQR');
    }

    if (!paymentMethod.qrBankBin || !paymentMethod.accountNumber || !paymentMethod.accountHolder) {
      throw new BadRequestException('Phuong thuc thanh toan thieu cau hinh QR bat buoc');
    }

    if (
      !this.isPaymentMethodAvailableForIntent(paymentMethod, {
        branchId: order.branchId ?? null,
        amount: requestedAmount,
      })
    ) {
      throw new BadRequestException('Phuong thuc thanh toan hien khong du dieu kien ap dung cho don hang nay');
    }

    const branch = await resolveBranchIdentity(this.prisma as any, order.branchId ?? null);
    const code = this.generatePaymentIntentCode();
    const transferContent = this.buildTransferContent({
      prefix: paymentMethod.transferNotePrefix,
      branchCode: branch.code,
      orderNumber: order.orderNumber,
      paymentAccountName: paymentMethod.name,
      fallbackId: order.id,
    });
    const qrPayload = buildVietQrPayload({
      bankBin: paymentMethod.qrBankBin,
      accountNumber: paymentMethod.accountNumber,
      amount: requestedAmount,
      transferContent,
    });
    const qrUrl = await buildVietQrDataUrl(qrPayload);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PAYMENT_INTENT_TTL_MS);

    const created = await this.prisma.$transaction(async (tx) => {
      await this.expirePendingPaymentIntents(tx as any, {
        orderId: id,
        paymentMethodId: paymentMethod.id,
      });

      return tx.paymentIntent.create({
        data: {
          code,
          orderId: order.id,
          branchId: order.branchId ?? null,
          paymentMethodId: paymentMethod.id,
          amount: requestedAmount,
          currency: 'VND',
          status: 'PENDING',
          provider: 'VIETQR',
          transferContent,
          qrUrl,
          qrPayload,
          expiresAt,
          metadata: {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            paymentMethodName: paymentMethod.name,
            branchCode: branch.code,
            template: paymentMethod.qrTemplate ?? null,
          },
        } as any,
      });
    });

    return this.hydratePaymentIntent(created.id);
  }

  async confirmPaymentIntentPaidFromWebhook(params: {
    intentId: string;
    provider: string;
    paidAt?: Date | null;
    externalTxnId?: string | null;
    note?: string | null;
  }): Promise<{ outcome: 'APPLIED' | 'ALREADY_PAID'; intent: OrderPaymentIntentView }> {
    const paidAt = params.paidAt ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const paymentIntent = await tx.paymentIntent.findUnique({
        where: { id: params.intentId },
        include: {
          paymentMethod: {
            select: {
              id: true,
              name: true,
              type: true,
              bankName: true,
              accountNumber: true,
              isActive: true,
            },
          },
          order: {
            include: {
              items: {
                select: {
                  groomingSessionId: true,
                  hotelStayId: true,
                },
              },
              hotelStays: {
                select: {
                  id: true,
                  stayCode: true,
                },
              },
            },
          },
        },
      });

      if (!paymentIntent || !paymentIntent.order) {
        throw new NotFoundException('Khong tim thay payment intent hop le de doi soat');
      }

      if (paymentIntent.status === 'PAID') {
        return { outcome: 'ALREADY_PAID' as const };
      }

      if (paymentIntent.status !== 'PENDING') {
        throw new BadRequestException('Payment intent khong con hop le de doi soat');
      }

      if (!paymentIntent.paymentMethod.isActive || paymentIntent.paymentMethod.type !== 'BANK') {
        throw new BadRequestException('Phuong thuc thanh toan cua QR da ngung hoat dong hoac khong hop le');
      }

      if (paymentIntent.order.status === 'CANCELLED') {
        throw new BadRequestException('Don hang da huy, khong the auto confirm thanh toan');
      }

      const markPaid = await tx.paymentIntent.updateMany({
        where: {
          id: paymentIntent.id,
          status: 'PENDING',
        },
        data: {
          status: 'PAID',
          paidAt,
          metadata: {
            ...(((paymentIntent.metadata as Record<string, unknown> | null) ?? {})),
            webhookProvider: params.provider,
            externalTxnId: params.externalTxnId ?? null,
            webhookConfirmedAt: paidAt.toISOString(),
          },
        } as any,
      });

      if (markPaid.count === 0) {
        return { outcome: 'ALREADY_PAID' as const };
      }

      const normalizedPayments = await this.normalizePayments(tx as any, [
        {
          method: paymentIntent.paymentMethod.type,
          amount: Number(paymentIntent.amount) || 0,
          note:
            params.note?.trim()
            || `Webhook ${params.provider}${params.externalTxnId ? ` #${params.externalTxnId}` : ''}`,
          paymentAccountId: paymentIntent.paymentMethod.id,
          paymentAccountLabel: paymentIntent.paymentMethod.name,
        },
      ]);

      await this.applyPaymentsToOrder(tx as any, {
        order: paymentIntent.order as any,
        payments: normalizedPayments,
        staffId: null,
      });

      return { outcome: 'APPLIED' as const };
    });

    return {
      outcome: result.outcome,
      intent: await this.hydratePaymentIntent(params.intentId),
    };
  }

  async payOrder(id: string, dto: PayOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          select: {
            groomingSessionId: true,
            hotelStayId: true,
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
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    assertOrderCanAcceptPayment(order);

    const paymentsArr = await this.normalizePayments(
      this.prisma as any,
      dto.payments.filter((p) => p.amount > 0),
    );
    assertHasPositivePayments(paymentsArr);

    return this.prisma.$transaction(async (tx) => {
      return this.applyPaymentsToOrder(tx as any, {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
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
      });
    });
  }

  // completeOrder
  // Finalize SERVICE order: validate sessions, deduct stock, update customer
  async completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            // @ts-ignore - groomingSession/hotelStay relations may exist
          },
        },
        customer: true,
      },
    });
    if (order) this.assertOrderScope(order, user);

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status === 'COMPLETED') throw new BadRequestException('Đơn hàng đã hoàn thành');

    // Validate service items are complete (unless forceComplete)
    if (!dto.forceComplete) {
      const groomingSessions = (
        await Promise.all(
          order.items
            .filter((item) => item.groomingSessionId)
            .map((item) =>
              this.prisma.groomingSession.findUnique({
                where: { id: item.groomingSessionId! },
                select: { id: true, status: true, sessionCode: true },
              }),
            ),
        )
      ).filter(Boolean) as Array<{ id: string; status: string; sessionCode?: string | null }>;
      const hotelStays = (
        await Promise.all(
          order.items
            .filter((item) => item.hotelStayId)
            .map((item) =>
              this.prisma.hotelStay.findUnique({
                where: { id: item.hotelStayId! },
                select: { id: true, status: true },
              }),
            ),
        )
      ).filter(Boolean) as Array<{ id: string; status: string }>;
      assertServiceItemsReadyForCompletion({
        forceComplete: dto.forceComplete,
        groomingSessions,
        hotelStays,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const extraPayments = await this.normalizePayments(
        tx as any,
        (dto.payments ?? []).filter((payment) => payment.amount > 0),
      );
      const traceParts = this.buildOrderServiceTraceParts(order);

      const now = new Date();

      // Deduct stock for product items + mark stockExportedAt per-item
      const exportedProductItems: typeof order.items = [];
      for (const item of order.items) {
        if (!item.productId) continue;
        await this.deductProductBranchStock(tx as any, {
          branchId: order.branchId ?? null,
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
          orderId: order.id,
          staffId,
          reason: `Hoàn thành đơn ${order.orderNumber}`,
        });
        // Mark item-level export timestamp
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            stockExportedAt: now,
            stockExportedBy: staffId,
          } as any,
        });
        exportedProductItems.push(item);
      }

      await recordOrderPayments(tx as any, {
        generateVoucherNumber: (type) => this.generateVoucherNumberFor(tx, type),
        buildServiceTraceTags: (parts) => this.buildServiceTraceTags(parts),
        mergeTransactionNotes: (note, parts) => this.mergeTransactionNotes(note, parts),
        getPaymentLabel: (method) => this.getPaymentLabel(method),
      }, {
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
      })

      await this.expirePendingPaymentIntents(tx as any, { orderId: id });

      const settlement = buildOrderCompletionSettlement({
        orderTotal: order.total,
        orderPaidAmount: order.paidAmount,
        extraPayments,
        overpaymentAction: dto.overpaymentAction,
        hasCustomer: Boolean(order.customerId),
      });
      let finalPaidAmount = settlement.finalPaidAmount;
      if (settlement.adjustment?.type === 'REFUND') {
        const refundPaymentAccount = await this.resolvePaymentAccount(
          tx as any,
          dto.refundMethod ?? 'CASH',
          dto.refundPaymentAccountId,
        );
        finalPaidAmount = order.total;
        await this.createOrderTransaction(tx as any, {
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
          description: `Hoàn tiền dư đơn hàng ${order.orderNumber}`,
          note: dto.settlementNote ?? null,
          source: 'ORDER_ADJUSTMENT',
          staffId,
          traceParts,
        });
      } else if (settlement.adjustment?.type === 'KEEP_CREDIT') {
        await this.updateCustomerDebt(tx as any, order.customerId, -settlement.adjustment.amount);
      }
      const paymentStatus = settlement.paymentStatus;

      // Complete order (+ set stockExportedAt when physical items exist)
      const hasPhysicalItems = exportedProductItems.length > 0;
      const completed = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED' as any,
          completedAt: now,
          paidAmount: finalPaidAmount,
          remainingAmount: 0,
          paymentStatus: paymentStatus as any,
          ...(hasPhysicalItems ? { stockExportedAt: now, stockExportedBy: staffId } : {}),
        } as any,
        include: {
          customer: true,
          items: { include: { product: true, service: true } },
          payments: true,
        },
      });

      // Create STOCK_EXPORTED timeline entry for POS order (without exportStock)
      if (hasPhysicalItems) {
        const pendingTempCount = order.items.filter((i) => (i as any).isTemp).length;
        await createStockExportTimelineEntry(tx.orderTimeline as any, {
          orderId: id,
          performedBy: staffId,
          occurredAt: now,
          exportedItemCount: exportedProductItems.length,
          pendingTempCount,
          metadata: { source: 'POS_COMPLETE' },
        })
      }

      // Update customer spending
      // QUICK orders handle this at createOrder, but they cannot reach here since they are COMPLETED
      await this.incrementCustomerStats(tx as any, order.customerId, order.total);
      await this.applyCompletedProductSalesDelta(tx as any, {
        completedAt: completed.completedAt ?? now,
        branchId: completed.branchId ?? null,
        items: completed.items.map((item) => ({
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      });

      return completed;
    });
  }

  // cancelOrder
  // Cancel order: release reserved stock, cancel sessions
  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    assertOrderCanCancel(order);

    return this.prisma.$transaction(async (tx) => {
      // Cancel grooming sessions
      for (const item of order.items) {
        if (item.groomingSessionId) {
          await tx.groomingSession.update({
            where: { id: item.groomingSessionId },
            data: { status: 'CANCELLED' },
          });
        }
        if (item.hotelStayId) {
          const stay = await tx.hotelStay.findUnique({ where: { id: item.hotelStayId } });
          if (stay && !['CHECKED_OUT', 'CANCELLED'].includes(stay.status)) {
            await tx.hotelStay.update({
              where: { id: item.hotelStayId },
              data: { status: 'CANCELLED' },
            });
          }
        }
      }

      // Determine if stock needs to be restored
      const hasService = order.items.some(
        (i) => i.groomingSessionId || i.hotelStayId || i.type === 'grooming' || i.type === 'hotel',
      );
      const orderType = hasService ? 'SERVICE' : 'QUICK';

      if (orderType === 'QUICK') {
        // QUICK orders deducted stock immediately on creation, so we must restore it
        for (const item of order.items) {
          if (!item.productId) continue;
          await this.restoreProductBranchStock(tx as any, {
            branchId: order.branchId ?? null,
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            quantity: item.quantity,
            orderId: order.id,
            staffId,
            reason: `Hoàn trả do hủy đơn ${order.orderNumber}`,
          });
        }
      }

      // Update order
      const cancelled = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED' as any,
          notes: dto.reason ? `[HUá»¶] ${dto.reason}` : order.notes,
        },
        include: { items: true, payments: true },
      });

      return cancelled;
    });
  }

  // â”€â”€â”€ refundOrder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Refund order: update status to PARTIALLY_REFUNDED or FULLY_REFUNDED
  async refundOrder(id: string, dto: RefundOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    return this.prisma.$transaction(async (tx) => {
      const refunded = await tx.order.update({
        where: { id },
        data: {
          status: dto.status as any,
          notes: dto.reason ? `[HOÀN TIỀN] ${dto.reason}\n${order.notes ?? ''}` : order.notes,
        },
        include: { items: true, payments: true },
      });

      return refunded;
    });
  }

  // â”€â”€â”€ removeOrderItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Remove single item from pending/processing order, recalculate totals
  async removeOrderItem(orderId: string, itemId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status === 'COMPLETED') throw new BadRequestException('Không thể sửa đơn đã hoàn thành');

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Không tìm thấy item trong đơn');

    return this.prisma.$transaction(async (tx) => {
      // Cancel related sessions
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

      // Delete item
      await tx.orderItem.delete({ where: { id: itemId } });

      // Recalculate order totals
      const remaining = order.items.filter((i) => i.id !== itemId);
      const newSubtotal = remaining.reduce((s, i) => s + i.subtotal, 0);
      const newTotal = newSubtotal + order.shippingFee - order.discount;
      const newRemaining = this.calculateRemainingAmount(newTotal, order.paidAmount);
      const newPaymentStatus = this.calculatePaymentStatus(newTotal, order.paidAmount);

      const updated = await tx.order.update({
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

      return updated;
    });
  }

  // findAll (advanced filtering)
  async findAll(params?: {
    search?: string | undefined;
    paymentStatus?: string | undefined;
    status?: string | undefined;
    customerId?: string | undefined;
    productId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }, user?: AccessUser): Promise<any> {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (this.shouldRestrictToOrderBranches(user)) {
      where.branchId = { in: this.getAuthorizedBranchIds(user) };
    }

    if (params?.customerId) where.customerId = params.customerId;

    if (params?.paymentStatus) {
      const statusList = params.paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
      where.paymentStatus = statusList.length > 1 ? { in: statusList } : statusList[0];
    }

    if (params?.status) where.status = params.status;

    if (params?.productId) {
      where.items = {
        some: {
          OR: [
            { productId: params.productId },
            { productVariantId: params.productId },
          ],
        },
      };
    }

    if (params?.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { customerName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params?.dateFrom && params?.dateTo) {
      where.createdAt = {
        gte: new Date(params.dateFrom),
        lte: new Date(params.dateTo + 'T23:59:59'),
      };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          staff: { select: { id: true, fullName: true } },
          items: { include: { product: true, service: true } },
          payments: true,
          transactions: { select: { voucherNumber: true, type: true } },
          groomingSessions: { select: { id: true, sessionCode: true, status: true } },
          hotelStays: { select: { stayCode: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // findOne
  async findOne(id: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderNumber: id },
        ],
      },
      include: {
        customer: { include: { pets: true } },
        staff: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: true,
            productVariant: true,
            service: true,
            serviceVariant: true,
            hotelStay: true,
          },
        },
        payments: true,
        transactions: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const groomingSessionIds = order.items
      .map((item) => item.groomingSessionId)
      .filter((value): value is string => Boolean(value));

    const groomingSessions = groomingSessionIds.length
      ? await this.prisma.groomingSession.findMany({
        where: { id: { in: groomingSessionIds } },
        include: {
          weightBand: { select: { id: true, label: true } },
          orderItems: {
            select: {
              id: true,
              description: true,
              unitPrice: true,
              quantity: true,
              discountItem: true,
              type: true,
              serviceId: true,
            },
          },
          timeline: {
            include: { performedByUser: { select: { id: true, fullName: true, staffCode: true } } },
            orderBy: { createdAt: 'desc' as const },
            take: 5,
          },
        },
      })
      : [];

    const groomingById = new Map(groomingSessions.map((session) => [session.id, session]));

    return {
      ...order,
      items: order.items.map((item) => {
        const groomingSession = item.groomingSessionId ? groomingById.get(item.groomingSessionId) : null;
        const itemPricingSnapshot = item.pricingSnapshot as any;
        const hotelChargeLine = itemPricingSnapshot?.chargeLine;

        return {
          ...item,
          groomingSession: groomingSession
            ? {
              id: groomingSession.id,
              sessionCode: groomingSession.sessionCode,
              status: groomingSession.status,
              packageCode: groomingSession.packageCode,
              price: groomingSession.price,
              orderItems: groomingSession.orderItems,
              timeline: groomingSession.timeline,
            }
            : undefined,
          groomingDetails: groomingSession
            ? {
              petId: groomingSession.petId,
              performerId: groomingSession.staffId,
              startTime: groomingSession.startTime,
              notes: groomingSession.notes,
              packageCode: groomingSession.packageCode,
              weightAtBooking: groomingSession.weightAtBooking,
              weightBandId: groomingSession.weightBandId,
              weightBandLabel: groomingSession.weightBand?.label ?? (groomingSession.pricingSnapshot as any)?.weightBandLabel ?? null,
              pricingSnapshot: groomingSession.pricingSnapshot,
            }
            : undefined,
          hotelDetails: item.hotelStay
            ? {
              petId: item.hotelStay.petId,
              checkInDate: item.hotelStay.checkIn,
              checkOutDate: item.hotelStay.estimatedCheckOut ?? item.hotelStay.checkOut,
              branchId: item.hotelStay.branchId,
              cageId: item.hotelStay.cageId,
              lineType: item.hotelStay.lineType,
              rateTableId: item.hotelStay.rateTableId,
              dailyRate: item.hotelStay.dailyRate,
              depositAmount: item.hotelStay.depositAmount,
              promotion: item.hotelStay.promotion,
              surcharge: item.hotelStay.surcharge,
              notes: item.hotelStay.notes,
              bookingGroupKey: itemPricingSnapshot?.bookingGroupKey ?? undefined,
              chargeLineIndex: hotelChargeLine?.index ?? undefined,
              chargeLineLabel: hotelChargeLine?.label ?? undefined,
              chargeDayType: hotelChargeLine?.dayType ?? undefined,
              chargeQuantityDays: hotelChargeLine?.quantityDays ?? undefined,
              chargeUnitPrice: hotelChargeLine?.unitPrice ?? undefined,
              chargeSubtotal: hotelChargeLine?.subtotal ?? undefined,
              chargeWeightBandId: hotelChargeLine?.weightBandId ?? undefined,
              chargeWeightBandLabel: hotelChargeLine?.weightBandLabel ?? undefined,
            }
            : undefined,
        };
      }),
    };
  }

  // =============================================================================
  // ORDER TIMELINE
  // =============================================================================

  private async createTimelineEntry(params: {
    orderId: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    note?: string;
    performedBy: string;
    metadata?: Record<string, any>;
  }) {
    const { orderId, action, fromStatus, toStatus, note, performedBy, metadata } = params;
    return createOrderTimelineEntry(this.prisma.orderTimeline as any, {
      orderId,
      action,
      fromStatus,
      toStatus,
      note,
      performedBy,
      metadata,
    });
  }

  async getOrderTimeline(orderId: string, user: AccessUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, branchId: true, staffId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);

    const timelines = await this.prisma.orderTimeline.findMany({
      where: { orderId },
      include: {
        performedByUser: {
          select: {
            id: true,
            fullName: true,
            staffCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return timelines.map((t: any) => ({
      ...t,
      performedByUser: t.performedByUser,
    }));
  }

  // =============================================================================
  // APPROVE ORDER
  // =============================================================================

  async approveOrder(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);

    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve order with status ${order.status}. Only PENDING orders can be approved.`);
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          approvedAt: now,
          approvedBy: staffId,
        },
      });

      // Create timeline entry
      await createOrderTimelineEntry(tx.orderTimeline as any, {
        orderId: id,
        action: 'APPROVED',
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        note: dto.note ?? null,
        performedBy: staffId,
      })
    });

    return this.findOne(id, user);
  }

  // =============================================================================
  // EXPORT STOCK
  // =============================================================================

  // Private helper: deduct stock and mark exported items
  private async _decrementStockForItem(
    prismaOrTx: any,
    params: {
      orderItemId: string;
      productVariantId: string;
      quantity: number;
      exportedBy: string;
      exportedAt: Date;
    },
  ): Promise<void> {
    const { orderItemId, productVariantId, quantity, exportedBy, exportedAt } = params;

    // Trá»« tá»“n kho productVariant
    await prismaOrTx.productVariant.update({
      where: { id: productVariantId },
      data: { stockQuantity: { decrement: quantity } },
    });

    // Mark item as exported with timestamp
    await prismaOrTx.orderItem.update({
      where: { id: orderItemId },
      data: {
        stockExportedAt: exportedAt,
        stockExportedBy: exportedBy,
      } as any,
    });
  }

  async exportStock(id: string, dto: { note?: string }, staffId: string, user: AccessUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
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

    // Check if order can be exported
    if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(`Cannot export stock for order with status ${order.status}.`);
    }

    // For service orders, check if all grooming/hotel sessions are completed
    const hasServiceItems = order.items.some((item: any) => item.type === 'grooming' || item.type === 'hotel');
    if (hasServiceItems) {
      const groomingSessions = order.items
        .filter((item: any) => item.groomingSession)
        .map((item: any) => item.groomingSession!);
      const hotelStays = order.items
        .filter((item: any) => item.hotelStay)
        .map((item: any) => item.hotelStay!);

      const allGroomingCompleted = groomingSessions.every((s: any) => s.status === 'COMPLETED');
      const allHotelCompleted = hotelStays.every((s: any) => s.status === 'CHECKED_OUT');

      if (!allGroomingCompleted || !allHotelCompleted) {
        throw new BadRequestException(
          'Cannot export stock until all grooming sessions are COMPLETED and all hotel stays are CHECKED_OUT.',
        );
      }
    }

    const now = new Date();

    // Option B: export only real items (isTemp=false) with productVariantId not yet exported
    const exportableItems = order.items.filter(
      (item: any) =>
        item.type === 'product' &&
        item.productVariantId &&
        !(item as any).isTemp &&
        !(item as any).stockExportedAt,
    );

    // Warning: there are temporary items not swapped yet (do not block, allow partial export)
    const pendingTempCount = order.items.filter(
      (item: any) => item.type === 'product' && (item as any).isTemp,
    ).length;

    // Determine next status
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED';
    const nextStatus = isPaid ? 'COMPLETED' : 'PROCESSING';

    await this.prisma.$transaction(async (tx) => {
      // Deduct stock for each real item (Option B - item-level tracking)
      for (const item of exportableItems) {
        await this._decrementStockForItem(tx, {
          orderItemId: item.id,
          productVariantId: item.productVariantId!,
          quantity: item.quantity,
          exportedBy: staffId,
          exportedAt: now,
        });
      }

      // Update order status
      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          stockExportedAt: now,
          stockExportedBy: staffId,
        },
      });

      // Create timeline entry
      await createStockExportTimelineEntry(tx.orderTimeline as any, {
        orderId: id,
        fromStatus: order.status,
        toStatus: nextStatus,
        note: dto.note ?? null,
        performedBy: staffId,
        occurredAt: now,
        exportedItemCount: exportableItems.length,
        pendingTempCount,
        metadata: { hasServiceItems },
      })
    });

    return this.findOne(id, user);
  }


  // =============================================================================
  // SETTLE ORDER (for service orders)
  // =============================================================================

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
      // Update order
      await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          settledAt: now,
          settledBy: staffId,
          completedAt: now,
        },
      });

      // Create timeline entry
      await createOrderTimelineEntry(tx.orderTimeline as any, {
        orderId: id,
        action: 'SETTLED',
        fromStatus: 'PROCESSING',
        toStatus: 'COMPLETED',
        note: dto.note ?? null,
        performedBy: staffId,
      })
    });

    return this.findOne(id, user);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Timeline
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async getTimeline(orderId: string) {
    // Support lookup by UUID or orderNumber
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      select: { id: true },
    });
    if (!order) return [];
    const timelines = await this.prisma.orderTimeline.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      include: {
        performedByUser: {
          select: {
            id: true,
            fullName: true,
            staffCode: true,
          },
        },
      },
    });
    return timelines;
  }

  // â”€â”€â”€ swapTempItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Swap temporary product to real product; price must match to keep order total
  async swapTempItem(
    orderId: string,
    itemId: string,
    dto: { realProductId: string; realProductVariantId: string },
    staffId: string,
    user?: AccessUser,
  ): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status === 'CANCELLED') throw new BadRequestException('Đơn hàng đã bị hủy');

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Không tìm thấy dòng hàng');
    const isTempItem = (item as any).isTemp === true || (item.type === 'product' && !item.productId && !item.productVariantId);
    if (!isTempItem) throw new BadRequestException('Dòng hàng này không phải sản phẩm tạm');

    // Load real product information
    const realVariant = await this.prisma.productVariant.findUnique({
      where: { id: dto.realProductVariantId },
      include: { product: true },
    });
    if (!realVariant) throw new NotFoundException('Không tìm thấy biến thể sản phẩm');
    if (realVariant.productId !== dto.realProductId) {
      throw new BadRequestException('productId và productVariantId không khớp');
    }

    // Ensure prices match
    if (Math.abs(realVariant.price - item.unitPrice) > 0.01) {
      throw new BadRequestException(
        `Giá sản phẩm thật (${realVariant.price.toLocaleString('vi-VN')}đ) phải bằng giá sản phẩm tạm (${item.unitPrice.toLocaleString('vi-VN')}đ)`,
      );
    }

    const newDescription = realVariant.name !== (realVariant.product as any).name
      ? `${(realVariant.product as any).name} - ${realVariant.name}`
      : (realVariant.product as any).name;

    const oldLabel = (item as any).tempLabel ?? item.description;

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        productId: dto.realProductId,
        productVariantId: dto.realProductVariantId,
        sku: realVariant.sku ?? null,
        description: newDescription,
        isTemp: false,
        tempLabel: null,
      } as any,
    });

    const swapAt = new Date();

    // Option B: auto export stock if the order was already sourced before
    // If order.stockExportedAt has a value -> order already exported
    // Swapped item must be deducted immediately at swap time (not at checkout)
    if (order.stockExportedAt) {
      await this._decrementStockForItem(this.prisma, {
        orderItemId: itemId,
        productVariantId: dto.realProductVariantId,
        quantity: item.quantity,
        exportedBy: staffId,
        exportedAt: swapAt,
      });
    }

    // Timeline: use ITEM_SWAPPED instead of ITEM_ADDED for the correct semantic
    await this.createTimelineEntry({
      orderId,
      action: 'ITEM_SWAPPED',
      note: `Đổi SP tạm "${oldLabel}" -> "${newDescription}"` +
        (order.stockExportedAt ? ` (đã trừ kho ${item.quantity} × ${newDescription})` : ' (chưa xuất kho - sẽ trừ khi xuất)'),
      performedBy: staffId,
    });

    return this.findOne(orderId, user);
  }

  // â”€â”€â”€ createReturnRequest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // T\u1ea1o y\u00eau c\u1ea7u \u0111\u1ed5i tr\u1ea3 h\u00e0ng t\u1eeb \u0111\u01a1n \u0111\u00e3 ho\u00e0n th\u00e0nh.
  // - items c\u00f3 action=RETURN: ghi nh\u1eadn tr\u1ea3 h\u00e0ng, t\u00ednh ti\u1ec1n ho\u00e0n
  // - items c\u00f3 action=EXCHANGE: t\u1ea1o \u0111\u01a1n m\u1edbi v\u1edbi credit pre-applied (\u0111\u1ec3 staff th\u00eam s\u1ea3n ph\u1ea9m v\u00e0o)
  async createReturnRequest(
    orderId: string,
    dto: import('./dto/create-return-request.dto.js').CreateReturnRequestDto,
    staffId: string,
    user?: AccessUser,
  ): Promise<any> {
    // Load order
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { items: true, customer: true, branch: true },
    });
    if (!order) throw new NotFoundException('Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng');
    this.assertOrderScope(order, user);
    orderId = order.id;

    if (order.status !== 'COMPLETED') {
      throw new BadRequestException('Ch\u1ec9 c\u00f3 th\u1ec3 \u0111\u1ed5i/tr\u1ea3 h\u00e0ng cho \u0111\u01a1n \u0111\u00e3 ho\u00e0n th\u00e0nh');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Ph\u1ea3i ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t s\u1ea3n ph\u1ea9m \u0111\u1ed5i/tr\u1ea3');
    }

    // Validate items belong to the order
    const orderItemMap = new Map(order.items.map((item: any) => [item.id, item]));
    for (const reqItem of dto.items) {
      if (!orderItemMap.has(reqItem.orderItemId)) {
        throw new BadRequestException(`S\u1ea3n ph\u1ea9m ${reqItem.orderItemId} kh\u00f4ng thu\u1ed9c \u0111\u01a1n n\u00e0y`);
      }
      const orderItem = orderItemMap.get(reqItem.orderItemId) as any;
      if (reqItem.quantity > orderItem.quantity) {
        throw new BadRequestException(`S\u1ed1 l\u01b0\u1ee3ng tr\u1ea3 kh\u00f4ng th\u1ec3 v\u01b0\u1ee3t qu\u00e1 s\u1ed1 l\u01b0\u1ee3ng \u0111\u00e3 mua (${orderItem.quantity})`);
      }
    }

    // Calculate credit = total value of exchanged/returned items (by unit price)
    let totalCredit = 0;
    for (const reqItem of dto.items) {
      const orderItem = orderItemMap.get(reqItem.orderItemId) as any;
      // Calculate prorated credit: (unitPrice - discountItem/qty) * qty_return
      const effectiveUnitPrice =
        orderItem.unitPrice - (orderItem.discountItem ?? 0) / orderItem.quantity;
      totalCredit += Math.max(0, effectiveUnitPrice * reqItem.quantity);
    }

    const hasExchange = dto.items.some((item) => item.action === 'EXCHANGE');
    const hasReturn = dto.items.some((item) => item.action === 'RETURN');
    const returnType = dto.type; // 'PARTIAL' | 'FULL'

    const itemSummary = dto.items
      .map((item) => {
        const oi = orderItemMap.get(item.orderItemId) as any;
        const action = item.action === 'EXCHANGE' ? '\u0110\u1ed4I' : 'TR\u1ea2';
        return `${action}: ${oi?.description ?? item.orderItemId} x${item.quantity}`;
      })
      .join(', ');

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Create OrderReturnRequest
      const returnRequest = await (tx as any).orderReturnRequest.create({
        data: {
          orderId,
          type: returnType,
          reason: dto.reason ?? null,
          refundAmount: hasReturn ? (dto.refundAmount ?? totalCredit) : 0,
          refundMethod: hasReturn ? (dto.refundMethod ?? null) : null,
          status: 'PENDING',
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

      // 2. Update original order status
      const newStatus = returnType === 'FULL' ? 'RETURNED' : 'PARTIALLY_RETURNED';
      await (tx as any).order.update({
        where: { id: orderId },
        data: { status: newStatus, updatedAt: now },
      });

      // 3. Ghi timeline Ä‘Æ¡n gá»‘c
      await (tx as any).orderTimeline.create({
        data: {
          orderId,
          action: 'RETURN_REQUESTED',
          fromStatus: 'COMPLETED',
          toStatus: newStatus,
          note: `\u0110\u1ed5i/tr\u1ea3: ${itemSummary}` +
            (dto.reason ? ` â€” L\u00fd do: ${dto.reason}` : '') +
            `. Credit: ${totalCredit.toLocaleString('vi-VN')}\u0111`,
          performedBy: staffId,
          metadata: {
            returnRequestId: returnRequest.id,
            type: returnType,
            totalCredit,
            hasExchange,
            hasReturn,
          },
          createdAt: now,
        },
      });

      // 4. If EXCHANGE exists: create new order with pre-applied credit
      let exchangeOrder: any = null;
      if (hasExchange) {
        const exchangeOrderNumber = await this.generateOrderNumber();
        const creditForExchange = dto.items
          .filter((item) => item.action === 'EXCHANGE')
          .reduce((sum, item) => {
            const oi = orderItemMap.get(item.orderItemId) as any;
            const effectiveUnitPrice =
              oi.unitPrice - (oi.discountItem ?? 0) / oi.quantity;
            return sum + Math.max(0, effectiveUnitPrice * item.quantity);
          }, 0);

        exchangeOrder = await (tx as any).order.create({
          data: {
            orderNumber: exchangeOrderNumber,
            customerId: order.customerId,
            customerName: (order.customer as any)?.fullName ??
              (order.customer as any)?.name ??
              (order as any).customerName ??
              'Kh\u00e1ch l\u1ebb',
            staffId,
            branchId: order.branchId ?? null,
            status: 'DRAFT',
            paymentStatus: 'UNPAID',
            subtotal: 0,
            discount: 0,
            shippingFee: 0,
            total: 0,
            paidAmount: creditForExchange,
            remainingAmount: 0,
            creditAmount: creditForExchange,
            linkedReturnId: returnRequest.id,
            notes: `\u0110\u01a1n \u0111\u1ed5i h\u00e0ng t\u1eeb #${order.orderNumber}. Credit \u0111\u01b0\u1ee3c \u00e1p d\u1ee5ng: ${creditForExchange.toLocaleString('vi-VN')}\u0111`,
            createdAt: now,
            updatedAt: now,
          } as any,
        });

        // Create payment record for credit from old order
        if (creditForExchange > 0) {
          await (tx as any).orderPayment.create({
            data: {
              orderId: exchangeOrder.id,
              method: 'ORDER_CREDIT',
              amount: creditForExchange,
              note: `Credit t\u1eeb \u0111\u01a1n #${order.orderNumber}`,
              paymentAccountId: null,
              paymentAccountLabel: `\u0110\u1ed5i h\u00e0ng t\u1eeb ${order.orderNumber}`,
              createdAt: now,
            } as any,
          });

          // Create timeline entry for new order
          await (tx as any).orderTimeline.create({
            data: {
              orderId: exchangeOrder.id,
              action: 'CREATED',
              fromStatus: null,
              toStatus: 'DRAFT',
              note: `\u0110\u01a1n \u0111\u1ed5i h\u00e0ng t\u1eeb #${order.orderNumber}. Credit ${creditForExchange.toLocaleString('vi-VN')}\u0111 \u0111\u00e3 \u0111\u01b0\u1ee3c \u00e1p d\u1ee5ng.`,
              performedBy: staffId,
              metadata: {
                sourceOrderId: orderId,
                sourceOrderNumber: order.orderNumber,
                returnRequestId: returnRequest.id,
                creditAmount: creditForExchange,
              },
              createdAt: now,
            },
          });
        }
      }

      return {
        returnRequest,
        exchangeOrderId: exchangeOrder?.id ?? null,
        exchangeOrderNumber: exchangeOrder?.orderNumber ?? null,
        totalCredit,
        refundAmount: hasReturn ? (dto.refundAmount ?? (hasExchange ? 0 : totalCredit)) : 0,
      };
    });
  }
}
