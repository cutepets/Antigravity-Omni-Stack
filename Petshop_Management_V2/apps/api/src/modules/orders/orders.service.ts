import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { resolvePermissions } from '@petshop/auth';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../database/database.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto.js';
import {
  generateGroomingSessionCode as formatGroomingSessionCode,
  generateHotelStayCode as formatHotelStayCode,
  generateOrderNumber as formatOrderNumber,
} from '@petshop/shared';
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js';
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js';
import { buildVietQrDataUrl, buildVietQrPayload } from '../../common/utils/vietqr.util.js';

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
    price: details.pricingPrice ?? item.unitPrice * item.quantity - (item.discountItem ?? 0),
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

// â”€â”€â”€ Payment method labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  EWALLET: 'Vi dien tu',
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

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    return {
      id: paymentIntent.id,
      code: paymentIntent.code,
      orderId: paymentIntent.orderId ?? null,
      paymentMethodId: paymentIntent.paymentMethodId,
      amount: Number(paymentIntent.amount) || 0,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      provider: paymentIntent.provider ?? null,
      transferContent: paymentIntent.transferContent,
      qrUrl: paymentIntent.qrUrl ?? null,
      qrPayload: paymentIntent.qrPayload ?? null,
      expiresAt: paymentIntent.expiresAt ?? null,
      paidAt: paymentIntent.paidAt ?? null,
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt,
      paymentMethod: {
        id: paymentIntent.paymentMethod.id,
        name: paymentIntent.paymentMethod.name,
        type: paymentIntent.paymentMethod.type,
        colorKey: paymentIntent.paymentMethod.colorKey ?? null,
        bankName: paymentIntent.paymentMethod.bankName ?? null,
        accountNumber: paymentIntent.paymentMethod.accountNumber ?? null,
        accountHolder: paymentIntent.paymentMethod.accountHolder ?? null,
        qrTemplate: paymentIntent.paymentMethod.qrTemplate ?? null,
      },
      order: paymentIntent.order
        ? {
          id: paymentIntent.order.id,
          orderNumber: paymentIntent.order.orderNumber,
          total: Number(paymentIntent.order.total) || 0,
          paidAmount: Number(paymentIntent.order.paidAmount) || 0,
          remainingAmount: Number(paymentIntent.order.remainingAmount) || 0,
          customerName: paymentIntent.order.customerName ?? null,
        }
        : null,
    };
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
      paymentAccountLabel: `${account.name} â€¢ ${account.bankName} â€¢ ${account.accountNumber}` as string,
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
    if (params.amount <= 0) return null;

    const tags = this.buildServiceTraceTags(params.traceParts ?? []);
    const notes = this.mergeTransactionNotes(params.note, params.traceParts ?? []);

    return tx.transaction.create({
      data: {
        voucherNumber: await this.generateVoucherNumberFor(tx, params.type),
        type: params.type,
        amount: params.amount,
        description: params.description,
        orderId: params.order.id,
        paymentMethod: params.paymentMethod ?? null,
        paymentAccountId: params.paymentAccountId ?? null,
        paymentAccountLabel: params.paymentAccountLabel ?? null,
        branchId: params.order.branchId ?? null,
        refType: 'ORDER',
        refId: params.order.id,
        refNumber: params.order.orderNumber,
        payerId: params.order.customerId ?? null,
        payerName: params.order.customerName ?? null,
        notes,
        tags,
        source: params.source,
        isManual: false,
        staffId: params.staffId ?? null,
      } as any,
    });
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
    const paymentsArr = params.payments.filter((payment) => payment.amount > 0);
    if (paymentsArr.length === 0) {
      throw new BadRequestException('So tien thanh toan phai lon hon 0');
    }

    const newPaidThisTime = paymentsArr.reduce((sum, payment) => sum + payment.amount, 0);
    const totalPaid = params.order.paidAmount + newPaidThisTime;
    const remaining = this.calculateRemainingAmount(params.order.total, totalPaid);
    const paymentStatus = this.calculatePaymentStatus(params.order.total, totalPaid);
    const traceParts = this.buildOrderServiceTraceParts(params.order as any);

    for (const payment of paymentsArr) {
      await tx.orderPayment.create({
        data: {
          orderId: params.order.id,
          method: payment.method,
          amount: payment.amount,
          note: payment.note ?? null,
          paymentAccountId: payment.paymentAccountId ?? null,
          paymentAccountLabel: payment.paymentAccountLabel ?? null,
        } as any,
      });

      await this.createOrderTransaction(tx as any, {
        order: {
          id: params.order.id,
          orderNumber: params.order.orderNumber,
          branchId: params.order.branchId ?? null,
          customerId: params.order.customerId ?? null,
          customerName: params.order.customerName ?? null,
        },
        type: 'INCOME',
        amount: payment.amount,
        paymentMethod: payment.method,
        paymentAccountId: payment.paymentAccountId ?? null,
        paymentAccountLabel: payment.paymentAccountLabel ?? null,
        description: `Thu bo sung don hang ${params.order.orderNumber} - ${this.getPaymentLabel(payment.method)}`,
        note: payment.note ?? null,
        source: 'ORDER_PAYMENT',
        staffId: params.staffId ?? null,
        traceParts,
      });
    }

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
    },
  ) {
    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    const branchStock =
      (params.productVariantId
        ? await tx.branchStock.findFirst({
          where: {
            branchId: branch.id,
            productVariantId: params.productVariantId,
          },
        })
        : null) ??
      await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: null,
        },
      });

    if (branchStock) {
      await tx.branchStock.update({
        where: { id: branchStock.id },
        data: {
          stock: { increment: params.quantity },
        },
      });
    }

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: params.productVariantId ?? null,
        type: 'IN',
        quantity: params.quantity,
        reason: params.reason,
        referenceId: params.orderId,
      },
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
    },
  ) {
    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    const productDisplayLabel = params.productVariantId
      ? await tx.productVariant
        .findUnique({
          where: { id: params.productVariantId },
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
    const branchStock =
      (params.productVariantId
        ? await tx.branchStock.findFirst({
          where: {
            branchId: branch.id,
            productVariantId: params.productVariantId,
          },
        })
        : null) ??
      await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: null,
        },
      });

    if (!branchStock) {
      throw new BadRequestException(`San pham ${productDisplayLabel} chua co ton kho tai chi nhanh ${branch.name}`);
    }

    if (branchStock.stock < params.quantity) {
      throw new BadRequestException(
        `Ton kho khong du cho san pham ${productDisplayLabel} tai chi nhanh ${branch.name}. Con ${branchStock.stock}, can ${params.quantity}.`,
      );
    }

    /*
    if (!branchStock) {
      throw new BadRequestException(`Sản phẩm ${params.productId} chưa có tồn kho tại chi nhánh ${branch.name}`);
    }

    if (branchStock.stock < params.quantity) {
      throw new BadRequestException(
        `Tồn kho không đủ cho sản phẩm ${params.productId} tại chi nhánh ${branch.name}. Còn ${branchStock.stock}, cần ${params.quantity}.`,
      );
    }
    */

    await tx.branchStock.update({
      where: { id: branchStock.id },
      data: {
        stock: { decrement: params.quantity },
      },
    });

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: params.productVariantId ?? null,
        type: 'OUT',
        quantity: params.quantity,
        reason: params.reason,
        referenceId: params.orderId,
      },
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

      if (item.type === 'product' && !productId) {
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
      serviceId: item.serviceId ?? null,
      serviceVariantId: item.serviceVariantId ?? null,
      petId: item.petId ?? null,
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
    const payload = {
      petId: details.petId,
      petName: pet?.name ?? '',
      customerId: params.customerId ?? null,
      branchId: branch.id,
      staffId: details.performerId ?? null,
      serviceId: params.serviceId ?? null,
      orderId: params.orderId,
      startTime: details.startTime ? new Date(details.startTime) : null,
      notes: details.notes ?? null,
      price: params.item.unitPrice * params.item.quantity - (params.item.discountItem ?? 0),
      packageCode: details.packageCode ?? null,
      weightAtBooking: details.weightAtBooking ?? null,
      weightBandId: details.weightBandId ?? null,
      pricingSnapshot: (buildGroomingOrderItemPricingSnapshot(params.item) ?? details.pricingSnapshot) as any,
    };

    if (params.existingSessionId) {
      const current = await tx.groomingSession.findUnique({ where: { id: params.existingSessionId } });
      if (current && current.status === 'CANCELLED') {
        throw new BadRequestException(`Phiên spa ${current.sessionCode ?? current.id} đã bị huỷ, không thể cập nhật lại từ POS.`);
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
        throw new BadRequestException(`Lượt lưu trú ${current.id} đã checkout hoặc huỷ, không thể cập nhật lại từ POS.`);
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

  private async loadOrderOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
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

  // â”€â”€â”€ Catalog (POS quick access) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ createOrder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Auto-classify: QUICK (product only) vs SERVICE (has grooming/hotel)
  // QUICK: deduct stock immediately, status â†’ PAID/PARTIAL
  // SERVICE: reserve stock, status â†’ PENDING, pay later
  async createOrder(data: CreateOrderDto, staffId: string): Promise<any> {
    const { items, payments = [], discount = 0, shippingFee = 0 } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất 1 sản phẩm');
    }

    const orderNumber = await this.generateOrderNumber();

    // Classify order type
    const hasService = items.some(
      (i) => i.groomingDetails || i.hotelDetails || i.type === 'grooming' || i.type === 'hotel',
    );
    const orderType = hasService ? 'SERVICE' : 'QUICK';
    const normalizedPayments = await this.normalizePayments(this.prisma as any, payments);

    // â”€â”€ Financial calculations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let subtotal = 0;
    for (const item of items) {
      const lineNet = item.unitPrice * item.quantity - (item.discountItem ?? 0);
      subtotal += lineNet;
    }
    const total = subtotal + shippingFee - discount;
    const totalPaid = normalizedPayments.reduce((s, p) => s + p.amount, 0);

    // â”€â”€ Payment status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const paymentStatus = this.calculatePaymentStatus(total, totalPaid);

    const orderStatus = orderType === 'QUICK' && paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING';

    // â”€â”€ Database transaction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return this.prisma.$transaction(async (tx) => {
      const serviceTraceParts: string[] = [];
      const normalizedItems = await this.validateAndNormalizeCreateItems(tx as any, items);
      const hotelStayGroups = new Map<string, Array<{ item: any; orderItem: any }>>();

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
          subtotal,
          discount,
          shippingFee,
          total,
          paidAmount: totalPaid,
          remainingAmount: this.calculateRemainingAmount(total, totalPaid),
          notes: data.notes ?? null,
          items: {
            create: normalizedItems.map((item) => ({
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
              serviceId: item.serviceId ?? null,
              serviceVariantId: item.serviceVariantId ?? null,
              petId: item.petId ?? null,
            })),
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

      // 2. Handle stock & service sessions per item
      for (let idx = 0; idx < normalizedItems.length; idx++) {
        const item = normalizedItems[idx]!;
        const orderItem = order.items[idx]!

        // â”€â”€ Product stock handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new BadRequestException(`Sản phẩm ${item.productId} không tồn tại`);

          if (orderType === 'QUICK') {
            // QUICK: deduct stock immediately
            await this.deductProductBranchStock(tx as any, {
              branchId: data.branchId ?? null,
              productId: item.productId,
              productVariantId: item.productVariantId ?? null,
              quantity: item.quantity,
              orderId: order.id,
              reason: `Bán hàng đơn ${order.orderNumber}`,
            });
          }
          // SERVICE stock reservation handled by BranchStock if needed
        }

        // â”€â”€ Grooming session creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (item.groomingDetails && orderItem) {
          const branch = await resolveBranchIdentity(tx as any, data.branchId ?? null);
          const session = await tx.groomingSession.create({
            data: {
              sessionCode: await this.generateGroomingSessionCode(
                tx as any,
                order.createdAt,
                branch.code,
              ),
              petId: item.groomingDetails.petId,
              petName: '', // Will be filled from pet lookup
              customerId: data.customerId ?? null,
              branchId: branch.id,
              staffId: item.groomingDetails.performerId ?? null,
              serviceId: item.serviceId ?? null,
              orderId: order.id,
              status: 'PENDING',
              startTime: item.groomingDetails.startTime
                ? new Date(item.groomingDetails.startTime)
                : null,
              notes: item.groomingDetails.notes ?? null,
              price: item.unitPrice * item.quantity,
              packageCode: item.groomingDetails.packageCode ?? null,
              weightAtBooking: item.groomingDetails.weightAtBooking ?? null,
              weightBandId: item.groomingDetails.weightBandId ?? null,
              pricingSnapshot: buildGroomingOrderItemPricingSnapshot(item) as any,
            },
          });

          // Link groomingSessionId to order item
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { groomingSessionId: session.id },
          });

          // Fill petName
          const pet = await tx.pet.findUnique({ where: { id: item.groomingDetails.petId } });
          if (pet) {
            await tx.groomingSession.update({
              where: { id: session.id },
              data: { petName: pet.name },
            });
          }

          serviceTraceParts.push(`GROOMING_SESSION:${session.id}`);
        }

        // â”€â”€ Hotel stay creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (item.hotelDetails && orderItem) {
          const groupKey = item.hotelDetails.bookingGroupKey ?? orderItem.id;
          const group = hotelStayGroups.get(groupKey) ?? [];
          group.push({ item, orderItem });
          hotelStayGroups.set(groupKey, group);
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
        const checkInDate = new Date(firstDetails.checkInDate);
        const checkOutDate = new Date(firstDetails.checkOutDate);
        const branch = await resolveBranchIdentity(
          tx as any,
          firstDetails.branchId ?? data.branchId ?? null,
        );
        const stayCode = await this.generateHotelStayCode(tx as any, order.createdAt, branch.code);
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
            customerId: data.customerId ?? null,
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
            orderId: order.id,
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

        serviceTraceParts.push(`HOTEL_STAY:${stay.id}`);
        serviceTraceParts.push(`HOTEL_CODE:${stayCode}`);
      }

      // 3. Create income transaction records
      for (const pay of normalizedPayments) {
        if (pay.amount <= 0) continue;
        const traceParts = serviceTraceParts;
        const label = this.getPaymentLabel(pay.method);
        await tx.transaction.create({
          data: {
            voucherNumber: await this.generateVoucherNumberFor(tx as any, 'INCOME'),
            type: 'INCOME',
            amount: pay.amount,
            description: `Thu từ đơn hàng ${order.orderNumber} - ${label}`,
            orderId: order.id,
            paymentMethod: pay.method,
            paymentAccountId: pay.paymentAccountId ?? null,
            paymentAccountLabel: pay.paymentAccountLabel ?? null,
            branchId: data.branchId ?? null,
            refType: 'ORDER',
            refId: order.id,
            refNumber: order.orderNumber,
            payerId: data.customerId ?? null,
            payerName: data.customerName,
            notes: this.mergeTransactionNotes(pay.note ?? data.notes ?? null, traceParts),
            tags: this.buildServiceTraceTags(traceParts),
            source: 'ORDER_PAYMENT',
            isManual: false,
            staffId,
          } as any,
        });
      }

      // 4. Update customer stats (QUICK + PAID only)
      // Note: SERVICE orders increment stats inside completeOrder
      if (data.customerId && orderType === 'QUICK' && paymentStatus === 'PAID') {
        await this.incrementCustomerStats(tx as any, data.customerId, total);
      }

      if (orderStatus === 'COMPLETED') {
        await this.applyCompletedProductSalesDelta(tx as any, {
          completedAt: order.completedAt ?? order.createdAt,
          branchId: order.branchId ?? null,
          items: order.items.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        });
      }

      return order;
    });
  }

  // â”€â”€â”€ payOrder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Collect additional payment for SERVICE orders (multi-payment support)
  async updateOrder(id: string, data: UpdateOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
      },
    });
    if (order) this.assertOrderScope(order, user);

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Không thể sửa đơn đã hoàn tất hoặc đã huỷ');
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
            throw new BadRequestException(`LÆ°á»£t lÆ°u trÃº ${currentStay.id} Ä‘Ã£ checkout hoáº·c huá»·, khÃ´ng thá»ƒ cáº­p nháº­t láº¡i tá»« POS.`);
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
              status: 'BOOKED',
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
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Khong tim thay don hang');

    const paymentIntents = await this.prisma.paymentIntent.findMany({
      where: { orderId: id },
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
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Khong the tao QR cho don hang da huy');
    }
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED') {
      throw new BadRequestException('Don hang da duoc thanh toan day du');
    }

    const remainingAmount = this.calculateRemainingAmount(order.total, order.paidAmount);
    if (remainingAmount <= 0) {
      throw new BadRequestException('Don hang khong con so tien de tao QR');
    }

    const requestedAmount = dto.amount !== undefined ? Number(dto.amount) : remainingAmount;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('So tien tao QR khong hop le');
    }

    if (!Number.isInteger(requestedAmount)) {
      throw new BadRequestException('So tien QR phai la so nguyen VND');
    }

    if (requestedAmount > remainingAmount) {
      throw new BadRequestException('So tien QR khong duoc vuot qua cong no con lai');
    }

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
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED') {
      throw new BadRequestException('Đơn hàng đã thanh toán đầy đủ');
    }

    const paymentsArr = await this.normalizePayments(
      this.prisma as any,
      dto.payments.filter((p) => p.amount > 0),
    );
    if (paymentsArr.length === 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

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

  // â”€â”€â”€ completeOrder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      for (const item of order.items) {
        if (item.groomingSessionId) {
          const session = await this.prisma.groomingSession.findUnique({
            where: { id: item.groomingSessionId },
          });
          if (session && !['COMPLETED', 'CANCELLED'].includes(session.status)) {
            throw new BadRequestException(
              `Phiên spa ${session.sessionCode ?? session.id} chưa hoàn thành. Vui lòng hoàn thành trước khi kết đơn.`,
            );
          }
        }
        if (item.hotelStayId) {
          const stay = await this.prisma.hotelStay.findUnique({
            where: { id: item.hotelStayId },
          });
          if (stay && !['CHECKED_OUT', 'CANCELLED'].includes(stay.status)) {
            throw new BadRequestException(
              `Lượt lưu trú ${stay.id} chưa trả pet. Vui lòng checkout trước khi kết đơn.`,
            );
          }
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const extraPayments = await this.normalizePayments(
        tx as any,
        (dto.payments ?? []).filter((payment) => payment.amount > 0),
      );
      const extraPaidAmount = extraPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const traceParts = this.buildOrderServiceTraceParts(order);

      // Deduct stock for product items
      for (const item of order.items) {
        if (!item.productId) continue;
        await this.deductProductBranchStock(tx as any, {
          branchId: order.branchId ?? null,
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
          orderId: order.id,
          reason: `Hoàn thành đơn ${order.orderNumber}`,
        });
      }

      for (const payment of extraPayments) {
        await tx.orderPayment.create({
          data: {
            orderId: id,
            method: payment.method,
            amount: payment.amount,
            note: payment.note ?? null,
            paymentAccountId: payment.paymentAccountId ?? null,
            paymentAccountLabel: payment.paymentAccountLabel ?? null,
          } as any,
        });

        await this.createOrderTransaction(tx as any, {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId ?? null,
            customerId: order.customerId ?? null,
            customerName: order.customerName,
          },
          type: 'INCOME',
          amount: payment.amount,
          paymentMethod: payment.method,
          paymentAccountId: payment.paymentAccountId ?? null,
          paymentAccountLabel: payment.paymentAccountLabel ?? null,
          description: `Thu bổ sung đơn hàng ${order.orderNumber} - ${this.getPaymentLabel(payment.method)}`,
          note: payment.note ?? dto.settlementNote ?? null,
          source: 'ORDER_PAYMENT',
          staffId,
          traceParts,
        });
      }

      await this.expirePendingPaymentIntents(tx as any, { orderId: id });

      const grossPaidAmount = order.paidAmount + extraPaidAmount;
      const overpaidAmount = Math.max(0, grossPaidAmount - order.total);
      const outstandingAmount = Math.max(0, order.total - grossPaidAmount);

      if (outstandingAmount > 0) {
        throw new BadRequestException(
          `Đơn hàng còn thiếu ${outstandingAmount.toLocaleString('vi-VN')} đ. Vui lòng thu đủ trước khi hoàn tất.`,
        );
      }

      let finalPaidAmount = grossPaidAmount;

      if (overpaidAmount > 0) {
        if (dto.overpaymentAction === 'REFUND') {
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
            amount: overpaidAmount,
            paymentMethod: refundPaymentAccount.paymentMethod ?? dto.refundMethod ?? 'CASH',
            paymentAccountId: refundPaymentAccount.paymentAccountId,
            paymentAccountLabel: dto.refundPaymentAccountLabel?.trim() || refundPaymentAccount.paymentAccountLabel,
            description: `Hoàn tiền dư đơn hàng ${order.orderNumber}`,
            note: dto.settlementNote ?? null,
            source: 'ORDER_ADJUSTMENT',
            staffId,
            traceParts,
          });
        } else if (dto.overpaymentAction === 'KEEP_CREDIT') {
          if (!order.customerId) {
            throw new BadRequestException('Không thể giữ tiền dư vào công nợ khi đơn không có khách hàng');
          }

          await this.updateCustomerDebt(tx as any, order.customerId, -overpaidAmount);
        } else {
          throw new BadRequestException(
            `Đơn hàng đang dư ${overpaidAmount.toLocaleString('vi-VN')} đ. Hãy chọn hoàn tiền hoặc giữ lại công nợ âm.`,
          );
        }
      }

      const paymentStatus = this.calculatePaymentStatus(order.total, Math.min(finalPaidAmount, order.total));

      // Complete order
      const completed = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED' as any,
          completedAt: new Date(),
          paidAmount: finalPaidAmount,
          remainingAmount: 0,
          paymentStatus: paymentStatus as any,
        },
        include: {
          customer: true,
          items: { include: { product: true, service: true } },
          payments: true,
        },
      });

      // Update customer spending
      // QUICK orders handle this at createOrder, but they cannot reach here since they are COMPLETED
      await this.incrementCustomerStats(tx as any, order.customerId, order.total);
      await this.applyCompletedProductSalesDelta(tx as any, {
        completedAt: completed.completedAt ?? new Date(),
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

  // â”€â”€â”€ cancelOrder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Cancel order: release reserved stock, cancel sessions
  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.status === 'COMPLETED') throw new BadRequestException('Đơn đã hoàn thành không thể huỷ');

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
            reason: `Hoàn trả do huỷ đơn ${order.orderNumber}`,
          });
        }
      }

      // Update order
      const cancelled = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED' as any,
          notes: dto.reason ? `[HUỶ] ${dto.reason}` : order.notes,
        },
        include: { items: true, payments: true },
      });

      return cancelled;
    });
  }

  // â”€â”€â”€ removeOrderItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ findAll (advanced filtering) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async findAll(params?: {
    search?: string | undefined;
    paymentStatus?: string | undefined;
    status?: string | undefined;
    customerId?: string | undefined;
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
          groomingSessions: { select: { sessionCode: true } },
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

  // â”€â”€â”€ findOne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async findOne(id: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
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
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const groomingSessionIds = order.items
      .map((item) => item.groomingSessionId)
      .filter((value): value is string => Boolean(value));

    const groomingSessions = groomingSessionIds.length
      ? await this.prisma.groomingSession.findMany({
        where: { id: { in: groomingSessionIds } },
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
          groomingDetails: groomingSession
            ? {
              petId: groomingSession.petId,
              performerId: groomingSession.staffId,
              startTime: groomingSession.startTime,
              notes: groomingSession.notes,
              packageCode: groomingSession.packageCode,
              weightAtBooking: groomingSession.weightAtBooking,
              weightBandId: groomingSession.weightBandId,
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
    return this.prisma.orderTimeline.create({
      data: {
        orderId,
        action: action as any,
        fromStatus: fromStatus ?? null,
        toStatus: toStatus ?? null,
        note: note ?? null,
        performedBy,
        metadata: (metadata ?? undefined) as any,
      },
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
      await tx.orderTimeline.create({
        data: {
          orderId: id,
          action: 'APPROVED',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          note: dto.note ?? null,
          performedBy: staffId,
        },
      });
    });

    return this.findOne(id, user);
  }

  // =============================================================================
  // EXPORT STOCK
  // =============================================================================

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

    // Determine next status
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'COMPLETED';
    const nextStatus = isPaid ? 'COMPLETED' : 'PROCESSING';

    await this.prisma.$transaction(async (tx) => {
      // Update order
      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          stockExportedAt: now,
          stockExportedBy: staffId,
        },
      });

      // Create timeline entry
      await tx.orderTimeline.create({
        data: {
          orderId: id,
          action: 'STOCK_EXPORTED',
          fromStatus: order.status,
          toStatus: nextStatus,
          note: dto.note ?? null,
          performedBy: staffId,
          metadata: { hasServiceItems } as any,
        },
      });
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

    // Check if order can be settled
    if (order.status !== 'PROCESSING') {
      throw new BadRequestException(`Cannot settle order with status ${order.status}. Order must be in PROCESSING status.`);
    }

    const hasServiceItems = order.items.some((item: any) => item.type === 'grooming' || item.type === 'hotel');
    if (!hasServiceItems) {
      throw new BadRequestException('Settle is only available for service orders (grooming/hotel).');
    }

    // Check if stock has been exported
    if (!order.stockExportedAt) {
      throw new BadRequestException('Cannot settle order until stock has been exported.');
    }

    // Check if order is fully paid
    if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'COMPLETED') {
      throw new BadRequestException('Cannot settle order until it is fully paid.');
    }

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
      await tx.orderTimeline.create({
        data: {
          orderId: id,
          action: 'SETTLED',
          fromStatus: 'PROCESSING',
          toStatus: 'COMPLETED',
          note: dto.note ?? null,
          performedBy: staffId,
        },
      });
    });

    return this.findOne(id, user);
  }
}
