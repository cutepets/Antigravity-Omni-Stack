import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { OrderPaymentHelperService } from '../domain/order-payment-helper.service.js';
import { buildOrderCompletionSettlement } from './order-completion.application.js';
import { applyCreateOrderPostActions } from './order-create.application.js';
import {
  createOrderFinanceTransaction,
  recordOrderPayments,
} from './order-finance.application.js';
import {
  createOrderTimelineEntry,
  createStockExportTimelineEntry,
} from './order-timeline.application.js';
import {
  buildExchangeOrderData,
  calculateExchangeOrderSubtotal,
  buildCurrentReturnQuantityMap,
  buildReturnedQuantityMap,
  buildReturnItemSummary,
  calculateReturnCreditBreakdown,
  getReturnableQuantity,
  hasRemainingReturnableProductQuantity,
  isReturnAction,
  isOrderReturnWindowExpired,
  validateExchangeOrderItems,
  resolveReturnRefundAmount,
  resolveOrderReturnWindowDays,
} from './order-return.application.js';
import { buildOrderPaymentUpdate } from './order-payment.application.js';
import { buildCreateOrderDraft } from './order-workflow.application.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { UpdateOrderDto, UpdateOrderItemDto } from '../dto/update-order.dto.js';
import { PayOrderDto } from '../dto/pay-order.dto.js';
import { CompleteOrderDto } from '../dto/complete-order.dto.js';
import { CancelOrderDto } from '../dto/cancel-order.dto.js';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto.js';
import { RefundOrderDto } from '../dto/refund-order.dto.js';
import { SwapGroomingServiceDto } from '../dto/swap-grooming-service.dto.js';
import {
  POINTS_REDEMPTION_RATE,
} from '@petshop/shared';
import { resolveBranchIdentity } from '../../../common/utils/branch-identity.util.js';
import { buildVietQrDataUrl, buildVietQrPayload } from '../../../common/utils/vietqr.util.js';
import { runBulkDelete } from '../../../common/utils/bulk-delete.util.js';
import { mapOrderPaymentIntentView } from '../mappers/payment-intent.mapper.js';
import {
  assertHasPositivePayments,
  assertOrderCanAcceptPayment,
  assertOrderCanCancel,
  assertOrderCanCreatePaymentIntent,
  assertOrderCanSettle,
  assertServiceItemsReadyForCompletion,
  resolveRequestedPaymentIntentAmount,
} from '../policies/order-workflow.policy.js';
import { OrderCatalogService } from './order-catalog.service.js';
import { OrderInventoryService } from './order-inventory.service.js';
import { OrderPaymentIntentService } from './order-payment-intent.service.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderQueryService } from './order-query.service.js';

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
  sku?: string | null;
  groomingDetails?: any;
}) {
  if (!item.groomingDetails?.packageCode && !item.groomingDetails?.pricingSnapshot && !item.groomingDetails?.serviceRole) return undefined;

  const details = item.groomingDetails;
  const pricingSnapshot = details.pricingSnapshot ?? {};
  const serviceRole = details.serviceRole ?? pricingSnapshot.serviceRole ?? 'MAIN';

  return {
    source: 'POS_GROOMING_PRICE',
    serviceRole,
    pricingRuleId: details.pricingRuleId ?? pricingSnapshot.pricingRuleId ?? null,
    packageCode: details.packageCode ?? null,
    weightAtBooking: details.weightAtBooking ?? null,
    weightBandId: details.weightBandId ?? null,
    weightBandLabel: details.weightBandLabel ?? null,
    durationMinutes: details.durationMinutes ?? pricingSnapshot.durationMinutes ?? null,
    serviceName: details.serviceItems ?? item.description ?? null,
    sku: item.sku ?? pricingSnapshot.sku ?? null,
    price: details.pricingPrice ?? item.unitPrice * item.quantity,
    discountItem: item.discountItem ?? 0,
    totalPrice: item.unitPrice * item.quantity - (item.discountItem ?? 0),
    pricingSnapshot: details.pricingSnapshot ?? null,
  };
}

function normalizeSpaPackageCode(value?: string | null) {
  return String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeSpaSkuText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getSpaWeightBandSkuSuffix(label?: string | null) {
  const numbers = String(label ?? '').match(/\d+(?:[.,]\d+)?/g);
  return numbers?.map((value) => value.replace(/[.,]/g, '')).join('') ?? '';
}

function getSpaSkuInitials(value?: string | null) {
  return normalizeSpaSkuText(value)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('');
}

function getSpaSkuPrefix(packageCode?: string | null, label?: string | null) {
  const code = normalizeSpaSkuText(packageCode).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const prefixByCode: Record<string, string> = {
    BATH: 'T',
    TAM: 'T',
    HYGIENE: 'VS',
    VE_SINH: 'VS',
    CLIP: 'CL',
    CUT: 'CL',
    SHAVE: 'CL',
    CAO_LONG: 'CL',
    BATH_HYGIENE: 'TVS',
    BATH_CLEAN: 'TVS',
    BATH_CLIP: 'TCL',
    BATH_SHAVE: 'TCL',
    BATH_CLIP_HYGIENE: 'TCLVS',
    BATH_SHAVE_HYGIENE: 'TCLVS',
    SPA: 'SPA',
  };

  return prefixByCode[code] ?? (getSpaSkuInitials(label) || 'SPA');
}

function getSpaPricingSku(packageCode?: string | null, label?: string | null, weightBandLabel?: string | null) {
  return `${getSpaSkuPrefix(packageCode, label)}${getSpaWeightBandSkuSuffix(weightBandLabel)}`;
}

function normalizeSpeciesKey(value?: string | null) {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!normalized) return '';
  if (['meo', 'cat', 'feline'].includes(normalized)) return 'cat';
  if (['cho', 'dog', 'canine'].includes(normalized)) return 'dog';
  return normalized;
}

function isSpaRuleSpeciesMatch(petSpecies?: string | null, ruleSpecies?: string | null) {
  if (!ruleSpecies) return true;
  if (!petSpecies) return false;
  return normalizeSpeciesKey(petSpecies) === normalizeSpeciesKey(ruleSpecies);
}

function isWeightInRange(
  weight: number,
  minWeight?: number | null,
  maxWeight?: number | null,
) {
  if (!Number.isFinite(weight)) return false;
  const safeMin = Number(minWeight ?? 0);
  const safeMax = maxWeight === null || maxWeight === undefined ? Number.POSITIVE_INFINITY : Number(maxWeight);
  return weight >= safeMin && weight < safeMax;
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

@Injectable()
export class OrderCommandService {
  constructor(
    private prisma: DatabaseService,
    private readonly accessService: OrderAccessService = new OrderAccessService(),
    private readonly numberingService: OrderNumberingService = new OrderNumberingService(),
    private readonly orderItemService: OrderItemService = new OrderItemService(),
    private readonly paymentHelperService: OrderPaymentHelperService = new OrderPaymentHelperService(),
    private readonly inventoryService: OrderInventoryService = new OrderInventoryService(new OrderCatalogService(prisma)),
    private readonly queryService: OrderQueryService = new OrderQueryService(prisma, accessService),
    private readonly paymentService: OrderPaymentService = new OrderPaymentService(
      prisma,
      accessService,
      numberingService,
      paymentHelperService,
      inventoryService,
    ),
    private readonly paymentIntentService: OrderPaymentIntentService = new OrderPaymentIntentService(
      prisma,
      accessService,
      paymentHelperService,
      paymentService,
    ),
  ) { }

  private resolveUserPermissions(user?: AccessUser): Set<string> {
    return this.accessService.resolveUserPermissions(user);
  }

  private getAuthorizedBranchIds(user?: AccessUser): string[] {
    return this.accessService.getAuthorizedBranchIds(user);
  }

  private shouldRestrictToOrderBranches(user?: AccessUser): boolean {
    return this.accessService.shouldRestrictToOrderBranches(user);
  }

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    if (!this.shouldRestrictToOrderBranches(user)) return;

    const authorizedBranchIds = this.getAuthorizedBranchIds(user);
    if (!order.branchId || !authorizedBranchIds.includes(order.branchId)) {
      throw new ForbiddenException('BÃ¡ÂºÂ¡n chÃ¡Â»â€° Ã„â€˜Ã†Â°Ã¡Â»Â£c truy cÃ¡ÂºÂ­p dÃ¡Â»Â¯ liÃ¡Â»â€¡u thuÃ¡Â»â„¢c chi nhÃƒÂ¡nh Ã„â€˜Ã†Â°Ã¡Â»Â£c phÃƒÂ¢n quyÃ¡Â»Ân');
    }
  }

  // Helpers

  /** Generate order number: DH202604060001 */
  private async generateOrderNumber(): Promise<string> {
    return this.numberingService.generateOrderNumber(this.prisma);
  }

  /** Generate voucher number for transactions: VCH-YYYYMMDD-XXXX */
  private async generateVoucherNumber(): Promise<string> {
    return this.numberingService.generateVoucherNumber(this.prisma);
  }

  /** Generate hotel stay code: H2604TH001 */
  private async generateHotelStayCode(
    db: Pick<DatabaseService, 'hotelStay'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    return this.numberingService.generateHotelStayCode(db, createdAt, branchCode);
  }

  /** Generate grooming session code: S2604TH001 */
  private async generateGroomingSessionCode(
    db: Pick<DatabaseService, 'groomingSession'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    return this.numberingService.generateGroomingSessionCode(db, createdAt, branchCode);
  }

  private buildServiceTraceTags(parts: string[]): string | null {
    return this.paymentService.buildServiceTraceTags(parts);
  }

  private mergeTransactionNotes(baseNote: string | null | undefined, traceParts: string[]): string | null {
    return this.paymentService.mergeTransactionNotes(baseNote, traceParts);
  }

  private buildOrderServiceTraceParts(order: {
    items?: Array<{ groomingSessionId?: string | null; hotelStayId?: string | null }>;
    hotelStays?: Array<{ id: string; stayCode?: string | null }>;
  }): string[] {
    return this.paymentService.buildOrderServiceTraceParts(order);
  }

  private getPaymentLabel(method: string): string {
    return this.paymentService.getPaymentLabel(method);
  }

  private calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    return this.paymentHelperService.calculatePaymentStatus(total, paidAmount);
  }

  private calculateRemainingAmount(total: number, paidAmount: number): number {
    return this.paymentHelperService.calculateRemainingAmount(total, paidAmount);
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
    return this.paymentHelperService.sanitizeTransferContentPart(value, maxLength);
  }

  private buildTransferContent(params: {
    prefix?: string | null;
    branchCode?: string | null;
    orderNumber?: string | null;
    paymentAccountName?: string | null;
    fallbackId: string;
  }) {
    return this.paymentHelperService.buildTransferContent(params);
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
    return this.paymentService.generateVoucherNumberFor(db, type);
    return this.numberingService.generateFinanceVoucherNumber(db as DatabaseService, type);
  }

  private async resolvePaymentAccount(
    db: Pick<DatabaseService, '$queryRaw' | 'paymentMethod'>,
    paymentMethod?: string | null,
    paymentAccountId?: string | null,
  ) {
    return this.paymentService.resolvePaymentAccount(db, paymentMethod, paymentAccountId);
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
    return this.paymentService.normalizePayments(db, payments);
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
    return this.paymentService.createOrderTransaction(tx, params);
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
    return this.paymentService.applyPaymentsToOrder(tx, params);
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
        throw new BadRequestException('PhÃ¡ÂºÂ£i khÃƒÂ¡ch hÃƒÂ ng Ã„â€˜Ã¡Â»Æ’ thanh toÃƒÂ¡n bÃ¡ÂºÂ±ng Ã„â€˜iÃ¡Â»Æ’m');
      }
      const customer = await (tx as any).customer.findUnique({
        where: { id: params.order.customerId },
      });
      const sysConfig = await (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } });
      const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
      const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
      if (!customer || customer.points < pointsToDeduct) {
        throw new BadRequestException('KhÃƒÂ¡ch hÃƒÂ ng khÃƒÂ´ng Ã„â€˜Ã¡Â»Â§ Ã„â€˜iÃ¡Â»Æ’m Ã„â€˜Ã¡Â»Æ’ thanh toÃƒÂ¡n');
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

    const now = new Date();
    const orderItems = params.order.items ?? [];
    const hasServiceItems = orderItems.some((item) => (
      item.type === 'service' ||
      item.type === 'grooming' ||
      item.type === 'hotel' ||
      Boolean(item.groomingSessionId) ||
      Boolean(item.hotelStayId)
    ));
    const autoExportItems = paymentStatus === 'PAID' && Boolean(params.staffId) && !params.order.stockExportedAt && !hasServiceItems
      ? orderItems.filter((item) => (
        item.type === 'product' &&
        Boolean(item.id) &&
        Boolean(item.productId) &&
        item.isTemp !== true &&
        !item.stockExportedAt
      ))
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
    return tx.order.update({
      where: { id: params.order.id },
      data: {
        paidAmount: totalPaid,
        remainingAmount: remaining,
        paymentStatus: paymentStatus as any,
        ...(shouldAutoComplete
          ? {
            status: 'COMPLETED' as any,
            completedAt: now,
            stockExportedAt: now,
            stockExportedBy: params.staffId ?? null,
          }
          : {}),
      },
      include: { items: true, payments: true, customer: true },
    }).then(async (updatedOrder: any) => {
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
      return updatedOrder;
    });
  }

  private async updateCustomerDebt(tx: DatabaseService, customerId: string | null | undefined, delta: number) {
    return this.paymentService.updateCustomerDebt(tx, customerId, delta);
  }


  private async incrementCustomerStats(tx: DatabaseService, customerId: string | null | undefined, total: number) {
    return this.paymentService.incrementCustomerStats(tx, customerId, total);
  }

  private calculateOrderSubtotal(items: Array<{ unitPrice: number; quantity: number; discountItem?: number }>) {
    return this.orderItemService.calculateOrderSubtotal(items);
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
    return this.orderItemService.buildOrderItemData(item);
  }

  private getGroomingOrderItemSnapshot(item: any) {
    return ((item?.pricingSnapshot as Record<string, any> | null) ?? {}) as Record<string, any>;
  }

  private getGroomingOrderItemRole(item: any): 'MAIN' | 'EXTRA' {
    const details = item?.groomingDetails ?? null;
    const snapshot = details?.pricingSnapshot ?? this.getGroomingOrderItemSnapshot(item);
    return details?.serviceRole === 'EXTRA' || snapshot?.serviceRole === 'EXTRA' ? 'EXTRA' : 'MAIN';
  }

  private async refreshGroomingSessionFromOrderItems(tx: DatabaseService, sessionId: string) {
    const items = await tx.orderItem.findMany({
      where: { groomingSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) return;

    const mainItem = items.find((item) => this.getGroomingOrderItemRole(item) !== 'EXTRA') ?? null;
    const sourceItem = mainItem ?? items[0];
    const sourceSnapshot = this.getGroomingOrderItemSnapshot(sourceItem);
    const grossAmount = items.reduce((sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0);
    const discountAmount = items.reduce((sum, item) => sum + Number(item.discountItem ?? 0), 0);
    const extraServices = items
      .filter((item) => this.getGroomingOrderItemRole(item) === 'EXTRA')
      .map((item) => {
        const snapshot = this.getGroomingOrderItemSnapshot(item);
        const quantity = Number(item.quantity ?? 1);
        const price = Number(item.unitPrice ?? snapshot.price ?? 0);
        return {
          orderItemId: item.id,
          pricingRuleId: snapshot.pricingRuleId ?? snapshot.pricingSnapshot?.pricingRuleId ?? null,
          sku: item.sku ?? snapshot.sku ?? snapshot.pricingSnapshot?.sku ?? null,
          name: item.description ?? snapshot.serviceName ?? null,
          price,
          quantity,
          durationMinutes: snapshot.durationMinutes ?? snapshot.pricingSnapshot?.durationMinutes ?? null,
          discountItem: Number(item.discountItem ?? 0),
          total: price * quantity - Number(item.discountItem ?? 0),
        };
      });

    await tx.groomingSession.update({
      where: { id: sessionId },
      data: {
        serviceId: mainItem?.serviceId ?? null,
        price: grossAmount,
        packageCode: mainItem ? sourceSnapshot.packageCode ?? null : null,
        weightAtBooking: mainItem ? sourceSnapshot.weightAtBooking ?? null : null,
        weightBandId: mainItem ? sourceSnapshot.weightBandId ?? null : null,
        pricingSnapshot: {
          ...sourceSnapshot,
          source: 'POS_GROOMING_GROUP',
          mainOrderItemId: mainItem?.id ?? null,
          mainService: mainItem
            ? {
              orderItemId: mainItem.id,
              name: mainItem.description,
              price: Number(mainItem.unitPrice ?? 0),
              quantity: Number(mainItem.quantity ?? 1),
              discountItem: Number(mainItem.discountItem ?? 0),
              serviceId: mainItem.serviceId ?? null,
            }
            : null,
          extraServices,
          grossAmount,
          discountAmount,
          totalAmount: Math.max(0, grossAmount - discountAmount),
          orderItemIds: items.map((item) => item.id),
        } as any,
      },
    });
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
          throw new BadRequestException(`PhiÃƒÂªn spa ${session.sessionCode ?? session.id} Ã„â€˜ÃƒÂ£ hoÃƒÂ n thÃƒÂ nh, khÃƒÂ´ng thÃ¡Â»Æ’ bÃ¡Â»Â khÃ¡Â»Âi Ã„â€˜Ã†Â¡n Ã„â€˜ang giao dÃ¡Â»â€¹ch.`);
        }
        const siblingCount = await tx.orderItem.count({
          where: { groomingSessionId: params.existingSessionId, id: { not: params.orderItemId } },
        });
        await tx.orderItem.update({
          where: { id: params.orderItemId },
          data: { groomingSessionId: null },
        });
        if (siblingCount > 0) {
          await this.refreshGroomingSessionFromOrderItems(tx, params.existingSessionId);
          return null;
        }
        await tx.groomingSession.update({
          where: { id: params.existingSessionId },
          data: { status: 'CANCELLED' },
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
    const isExtraItem = this.getGroomingOrderItemRole({
      pricingSnapshot: payload.pricingSnapshot,
      groomingDetails: details,
    }) === 'EXTRA';
    const reusableSession = params.existingSessionId
      ? null
      : await tx.groomingSession.findFirst({
        where: {
          orderId: params.orderId,
          petId: details.petId,
          status: { not: 'CANCELLED' },
        },
        select: { id: true, status: true, sessionCode: true },
      });
    const targetSessionId = params.existingSessionId ?? reusableSession?.id ?? null;

    if (targetSessionId) {
      const current = await tx.groomingSession.findUnique({ where: { id: targetSessionId } });
      if (current && current.status === 'CANCELLED') {
        throw new BadRequestException(`PhiÃƒÂªn spa ${current.sessionCode ?? current.id} Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ hÃ¡Â»Â§y, khÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t lÃ¡ÂºÂ¡i tÃ¡Â»Â« POS.`);
      }

      if (!isExtraItem) {
        await tx.groomingSession.update({
          where: { id: targetSessionId },
          data: payload,
        });
      }

      await tx.orderItem.update({
        where: { id: params.orderItemId },
        data: { groomingSessionId: targetSessionId },
      });
      await this.refreshGroomingSessionFromOrderItems(tx, targetSessionId);

      return targetSessionId;
    }

    const codeDate = params.orderCreatedAt ?? new Date();
    const sessionCode = await this.generateGroomingSessionCode(tx as any, codeDate, branch.code);
    const created = await tx.groomingSession.create({
      data: {
        ...payload,
        serviceId: isExtraItem ? null : payload.serviceId,
        packageCode: isExtraItem ? null : payload.packageCode,
        weightBandId: isExtraItem ? null : payload.weightBandId,
        sessionCode,
        status: 'PENDING',
        ...(params.staffId ? {
          timeline: {
            create: {
              action: 'TÃ¡ÂºÂ¡o phiÃ¡ÂºÂ¿u tÃ¡Â»Â« Ã„â€˜Ã†Â¡n',
              toStatus: 'PENDING',
              note: `TÃ¡Â»Â« Ã„â€˜Ã†Â¡n ${params.orderId}`,
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
    await this.refreshGroomingSessionFromOrderItems(tx, created.id);

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
          throw new BadRequestException(`LÃ†Â°Ã¡Â»Â£t lÃ†Â°u trÃƒÂº ${stay.stayCode ?? stay.id} Ã„â€˜ÃƒÂ£ bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u, khÃƒÂ´ng thÃ¡Â»Æ’ bÃ¡Â»Â khÃ¡Â»Âi Ã„â€˜Ã†Â¡n Ã„â€˜ang giao dÃ¡Â»â€¹ch.`);
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
        throw new BadRequestException(`LÃ†Â°Ã¡Â»Â£t lÃ†Â°u trÃƒÂº ${current.id} Ã„â€˜ÃƒÂ£ checkout hoÃ¡ÂºÂ·c hÃ¡Â»Â§y, khÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t lÃ¡ÂºÂ¡i tÃ¡Â»Â« POS.`);
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

    // Validate: prevent duplicate active stays for the same pet
    const overlap = await tx.hotelStay.findFirst({
      where: {
        petId: firstDetails.petId,
        status: { in: ['BOOKED', 'CHECKED_IN'] },
        checkIn: { lt: checkOutDate },
        OR: [
          { estimatedCheckOut: null },
          { estimatedCheckOut: { gt: checkInDate } },
          { checkOutActual: { gt: checkInDate } },
          { checkOut: { gt: checkInDate } },
        ],
      },
      select: { id: true, stayCode: true },
    });
    if (overlap) {
      throw new BadRequestException(
        `ThÃƒÂº cÃ†Â°ng Ã„â€˜ÃƒÂ£ cÃƒÂ³ lÃ†Â°Ã¡Â»Â£t lÃ†Â°u trÃƒÂº trÃƒÂ¹ng thÃ¡Â»Âi gian${overlap.stayCode ? ` (${overlap.stayCode})` : ''}.`,
      );
    }

    // Auto-checkin if checkIn is now or in the past (POS flow)
    const resolvedStatus = checkInDate <= new Date() ? 'CHECKED_IN' : 'BOOKED';

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
        status: resolvedStatus,
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
    return this.queryService.loadOrderOrThrow(id);
  }

  // createOrder
  // Auto-classify: QUICK (product only) vs SERVICE (has grooming/hotel)
  // QUICK: deduct stock immediately, status -> PAID/PARTIAL
  // SERVICE: reserve stock, status -> PENDING, pay later
  async createOrder(data: CreateOrderDto, staffId: string): Promise<any> {
    const { items, payments = [], discount = 0, shippingFee = 0 } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('Ã„ÂÃ†Â¡n hÃƒÂ ng phÃ¡ÂºÂ£i cÃƒÂ³ ÃƒÂ­t nhÃ¡ÂºÂ¥t 1 sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m');
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

            await this.inventoryService.deductProductBranchStock(tx as any, {
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
                throw new BadRequestException('PhÃ¡ÂºÂ£i thiÃ¡ÂºÂ¿t lÃ¡ÂºÂ­p khÃƒÂ¡ch hÃƒÂ ng Ã„â€˜Ã¡Â»Æ’ thanh toÃƒÂ¡n bÃ¡ÂºÂ±ng Ã„â€˜iÃ¡Â»Æ’m');
              }
              const customer = await (tx as any).customer.findUnique({
                where: { id: data.customerId },
              });
              const sysConfig = await (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } });
              const pointRedemptionRate = Number(sysConfig?.loyaltyPointValue ?? 1) || 1;
              const pointsToDeduct = Math.ceil(pointPaymentTotal / pointRedemptionRate);
              if (!customer || customer.points < pointsToDeduct) {
                throw new BadRequestException('KhÃƒÂ¡ch hÃƒÂ ng khÃƒÂ´ng Ã„â€˜Ã¡Â»Â§ Ã„â€˜iÃ¡Â»Æ’m Ã„â€˜Ã¡Â»Æ’ thanh toÃƒÂ¡n');
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
            this.inventoryService.applyCompletedProductSalesDelta(tx as any, {
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

    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
    id = order.id; // Resolve to internal UUID

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('KhÃƒÂ´ng thÃ¡Â»Æ’ sÃ¡Â»Â­a Ã„â€˜Ã†Â¡n Ã„â€˜ÃƒÂ£ hoÃƒÂ n tÃ¡ÂºÂ¥t hoÃ¡ÂºÂ·c Ã„â€˜ÃƒÂ£ hÃ¡Â»Â§y');
    }
    if (!data.items?.length) {
      throw new BadRequestException('Ã„ÂÃ†Â¡n hÃƒÂ ng phÃ¡ÂºÂ£i cÃƒÂ³ ÃƒÂ­t nhÃ¡ÂºÂ¥t 1 sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m hoÃ¡ÂºÂ·c dÃ¡Â»â€¹ch vÃ¡Â»Â¥');
    }

    for (const item of data.items) {
      if (item.groomingDetails && item.hotelDetails) {
        throw new BadRequestException(`Item "${item.description}" khÃƒÂ´ng thÃ¡Â»Æ’ vÃ¡Â»Â«a lÃƒÂ  spa vÃ¡Â»Â«a lÃƒÂ  hotel`);
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
            throw new BadRequestException(`LÃ†Â°Ã¡Â»Â£t lÃ†Â°u trÃƒÂº ${currentStay.id} Ã„â€˜ÃƒÂ£ checkout hoÃ¡ÂºÂ·c hÃ¡Â»Â§y, khÃƒÂ´ng thÃ¡Â»Æ’ cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t lÃ¡ÂºÂ¡i tÃ¡Â»Â« POS.`);
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
    return this.paymentIntentService.listPaymentIntents(id, user);
  }

  async getPaymentIntentByCode(code: string, user?: AccessUser): Promise<OrderPaymentIntentView> {
    return this.paymentIntentService.getPaymentIntentByCode(code, user);
  }

  async createPaymentIntent(id: string, dto: CreatePaymentIntentDto, user?: AccessUser): Promise<OrderPaymentIntentView> {
    return this.paymentIntentService.createPaymentIntent(id, dto, user);
  }

  async confirmPaymentIntentPaidFromWebhook(params: {
    intentId: string;
    provider: string;
    paidAt?: Date | null;
    externalTxnId?: string | null;
    note?: string | null;
  }): Promise<{ outcome: 'APPLIED' | 'ALREADY_PAID'; intent: OrderPaymentIntentView }> {
    return this.paymentIntentService.confirmPaymentIntentPaidFromWebhook(params);
  }

  async payOrder(id: string, dto: PayOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    return this.paymentService.payOrder(id, dto, staffId, user);
  }

  // completeOrder
  // Finalize SERVICE order: validate sessions, deduct stock, update customer
  async completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
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

    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
    if (order.status === 'COMPLETED') throw new BadRequestException('Ã„ÂÃ†Â¡n hÃƒÂ ng Ã„â€˜ÃƒÂ£ hoÃƒÂ n thÃƒÂ nh');

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
        await this.inventoryService.deductProductBranchStock(tx as any, {
          branchId: order.branchId ?? null,
          productId: item.productId!,
          productVariantId: item.productVariantId ?? null,
          quantity: item.quantity,
          orderId: order.id,
          staffId,
          reason: `HoÃƒÂ n thÃƒÂ nh Ã„â€˜Ã†Â¡n ${order.orderNumber}`,
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
          description: `HoÃƒÂ n tiÃ¡Â»Ân dÃ†Â° Ã„â€˜Ã†Â¡n hÃƒÂ ng ${order.orderNumber}`,
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

  // cancelOrder
  // Cancel order: release reserved stock, cancel sessions
  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
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
          await this.inventoryService.restoreProductBranchStock(tx as any, {
            branchId: order.branchId ?? null,
            productId: item.productId,
            productVariantId: item.productVariantId ?? null,
            quantity: item.quantity,
            orderId: order.id,
            staffId,
            reason: `HoÃƒÂ n trÃ¡ÂºÂ£ do hÃ¡Â»Â§y Ã„â€˜Ã†Â¡n ${order.orderNumber}`,
          });
        }
      }

      // Update order
      const cancelled = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED' as any,
          notes: dto.reason ? `[HUÃƒÂ¡Ã‚Â»Ã‚Â¶] ${dto.reason}` : order.notes,
        },
        include: { items: true, payments: true },
      });

      return cancelled;
    });
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ refundOrder ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  private assertCanPermanentlyDeleteOrder(user?: AccessUser) {
    if (user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Chi SUPER_ADMIN moi duoc xoa vinh vien don hang');
    }
  }

  private async collectOrderDeleteGraph(
    tx: Pick<DatabaseService, 'order' | 'orderReturnRequest'>,
    seedOrderIds: string[],
  ): Promise<{ orderIds: string[]; returnRequestIds: string[] }> {
    const orderIds = new Set(seedOrderIds.filter(Boolean));
    const returnRequestIds = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;
      const currentOrderIds = [...orderIds];
      const currentReturnRequestIds = [...returnRequestIds];

      const orders = currentOrderIds.length > 0
        ? await (tx as any).order.findMany({
          where: { id: { in: currentOrderIds } },
          select: { id: true, linkedReturnId: true },
        })
        : [];

      for (const order of orders) {
        if (order.linkedReturnId && !returnRequestIds.has(order.linkedReturnId)) {
          returnRequestIds.add(order.linkedReturnId);
          changed = true;
        }
      }

      const returnWhere: any[] = [];
      if (currentOrderIds.length > 0) returnWhere.push({ orderId: { in: currentOrderIds } });
      if (currentReturnRequestIds.length > 0) returnWhere.push({ id: { in: currentReturnRequestIds } });

      const returnRequests = returnWhere.length > 0
        ? await (tx as any).orderReturnRequest.findMany({
          where: { OR: returnWhere },
          select: { id: true, orderId: true },
        })
        : [];

      for (const request of returnRequests) {
        if (!returnRequestIds.has(request.id)) {
          returnRequestIds.add(request.id);
          changed = true;
        }
        if (request.orderId && !orderIds.has(request.orderId)) {
          orderIds.add(request.orderId);
          changed = true;
        }
      }

      const nextReturnRequestIds = [...returnRequestIds];
      const exchangeOrders = nextReturnRequestIds.length > 0
        ? await (tx as any).order.findMany({
          where: { linkedReturnId: { in: nextReturnRequestIds } },
          select: { id: true },
        })
        : [];

      for (const order of exchangeOrders) {
        if (!orderIds.has(order.id)) {
          orderIds.add(order.id);
          changed = true;
        }
      }
    }

    return { orderIds: [...orderIds], returnRequestIds: [...returnRequestIds] };
  }

  private async reverseOrderStockTransactions(tx: DatabaseService, orderIds: string[]) {
    const stockTransactions = await (tx as any).stockTransaction.findMany({
      where: {
        referenceType: 'ORDER',
        referenceId: { in: orderIds },
      },
      select: {
        id: true,
        productId: true,
        productVariantId: true,
        sourceProductVariantId: true,
        branchId: true,
        type: true,
        quantity: true,
        sourceQuantity: true,
        actionQuantity: true,
      },
    });

    for (const movement of stockTransactions) {
      const type = String(movement.type ?? '').toUpperCase();
      if (type !== 'IN' && type !== 'OUT') continue;

      const quantity = Math.abs(Number(movement.sourceQuantity ?? movement.quantity ?? movement.actionQuantity ?? 0));
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      if (!movement.branchId) {
        throw new BadRequestException('Khong the dao ton kho cua giao dich thieu chi nhanh');
      }

      const productVariantId = movement.sourceProductVariantId ?? movement.productVariantId ?? null;
      let branchStock = await (tx as any).branchStock.findFirst({
        where: {
          branchId: movement.branchId,
          productId: movement.productId,
          productVariantId,
        },
      });

      if (!branchStock && productVariantId !== null) {
        branchStock = await (tx as any).branchStock.findFirst({
          where: {
            branchId: movement.branchId,
            productId: movement.productId,
            productVariantId: null,
          },
        });
      }

      if (!branchStock && productVariantId === null) {
        branchStock = await (tx as any).branchStock.findFirst({
          where: {
            branchId: movement.branchId,
            productId: movement.productId,
          },
        });
      }

      if (type === 'OUT') {
        if (branchStock) {
          await (tx as any).branchStock.update({
            where: { id: branchStock.id },
            data: { stock: { increment: quantity } },
          });
        } else {
          await (tx as any).branchStock.create({
            data: {
              branchId: movement.branchId,
              productId: movement.productId,
              productVariantId,
              stock: quantity,
              reservedStock: 0,
              minStock: 5,
            } as any,
          });
        }
      } else {
        if (!branchStock || Number(branchStock.stock ?? 0) < quantity) {
          throw new BadRequestException('Ton kho khong du de dao giao dich nhap kho cua don hang');
        }
        await (tx as any).branchStock.update({
          where: { id: branchStock.id },
          data: { stock: { decrement: quantity } },
        });
      }
    }

    if (stockTransactions.length > 0) {
      await (tx as any).stockTransaction.deleteMany({
        where: { id: { in: stockTransactions.map((movement: any) => movement.id) } },
      });
    }
  }

  private async rollbackOrderCustomerAndSales(
    tx: DatabaseService,
    params: {
      orders: any[];
      paymentsByOrderId: Map<string, any[]>;
      transactionsByOrderId: Map<string, any[]>;
      loyaltyPointValue: number;
    },
  ) {
    for (const order of params.orders) {
      if (!order.customerId) continue;

      const isCompletedOrder = Boolean(order.completedAt) || ['COMPLETED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED'].includes(String(order.status ?? ''));
      const pointsEarned = isCompletedOrder ? Math.floor(Number(order.total ?? 0) / 1000) : 0;
      const pointPaymentTotal = (params.paymentsByOrderId.get(order.id) ?? [])
        .filter((payment) => String(payment.method ?? '').toUpperCase() === 'POINTS')
        .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount ?? 0)), 0);
      const pointsToRestore = pointPaymentTotal > 0
        ? Math.ceil(pointPaymentTotal / params.loyaltyPointValue)
        : 0;
      const pointDelta = pointsToRestore - pointsEarned;

      const transactions = params.transactionsByOrderId.get(order.id) ?? [];
      const refundedOverpayment = transactions
        .filter((transaction) => (
          String(transaction.type ?? '').toUpperCase() === 'EXPENSE' &&
          String(transaction.source ?? '') === 'ORDER_ADJUSTMENT'
        ))
        .reduce((sum, transaction) => sum + Math.max(0, Number(transaction.amount ?? 0)), 0);
      const creditRollback = Math.max(0, Number(order.paidAmount ?? 0) - Number(order.total ?? 0) - refundedOverpayment);

      const data: Record<string, unknown> = {};
      if (isCompletedOrder) {
        data.totalSpent = { decrement: Number(order.total ?? 0) };
        data.totalOrders = { decrement: 1 };
      }
      if (pointDelta > 0) data.points = { increment: pointDelta };
      if (pointDelta < 0) data.points = { decrement: Math.abs(pointDelta) };
      if (pointsToRestore > 0) data.pointsUsed = { decrement: pointsToRestore };
      if (creditRollback > 0) data.debt = { increment: creditRollback };

      if (Object.keys(data).length > 0) {
        await (tx as any).customer.update({
          where: { id: order.customerId },
          data,
        });
      }

      if (isCompletedOrder) {
        await this.inventoryService.applyCompletedProductSalesDelta(tx as any, {
          completedAt: order.completedAt ?? order.createdAt ?? new Date(),
          branchId: order.branchId ?? null,
          multiplier: -1,
          items: (order.items ?? []).map((item: any) => ({
            productId: item.productId ?? null,
            productVariantId: item.productVariantId ?? null,
            quantity: Number(item.quantity ?? 0),
            subtotal: Number(item.subtotal ?? 0),
          })),
        });
      }
    }
  }

  async deleteOrderCascade(id: string, staffId: string, user?: AccessUser): Promise<{ success: true; deletedIds: string[]; deletedOrderNumbers: string[] }> {
    void staffId;
    this.assertCanPermanentlyDeleteOrder(user);

    const rootOrder = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      select: { id: true },
    });
    if (!rootOrder) throw new NotFoundException('Khong tim thay don hang');

    return this.prisma.$transaction(async (tx) => {
      const graph = await this.collectOrderDeleteGraph(tx as any, [rootOrder.id]);
      const orders = await (tx as any).order.findMany({
        where: { id: { in: graph.orderIds } },
        include: { items: true },
      });

      const orderIds = orders.map((order: any) => order.id);
      const orderNumbers = orders.map((order: any) => order.orderNumber).filter(Boolean);
      if (orderIds.length === 0) throw new NotFoundException('Khong tim thay don hang');

      const [payments, transactions, paymentIntents, systemConfig] = await Promise.all([
        (tx as any).orderPayment.findMany({ where: { orderId: { in: orderIds } } }),
        (tx as any).transaction.findMany({
          where: {
            OR: [
              { orderId: { in: orderIds } },
              { refType: 'ORDER', refId: { in: orderIds } },
            ],
          },
        }),
        (tx as any).paymentIntent.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        }),
        (tx as any).systemConfig.findFirst({ select: { loyaltyPointValue: true } }),
      ]);

      const paymentsByOrderId = new Map<string, any[]>();
      for (const payment of payments) {
        const entries = paymentsByOrderId.get(payment.orderId) ?? [];
        entries.push(payment);
        paymentsByOrderId.set(payment.orderId, entries);
      }

      const transactionsByOrderId = new Map<string, any[]>();
      for (const transaction of transactions) {
        const transactionOrderId = transaction.orderId ?? (transaction.refType === 'ORDER' ? transaction.refId : null);
        if (!transactionOrderId) continue;
        const entries = transactionsByOrderId.get(transactionOrderId) ?? [];
        entries.push(transaction);
        transactionsByOrderId.set(transactionOrderId, entries);
      }

      await this.reverseOrderStockTransactions(tx as any, orderIds);
      await this.rollbackOrderCustomerAndSales(tx as any, {
        orders,
        paymentsByOrderId,
        transactionsByOrderId,
        loyaltyPointValue: Number(systemConfig?.loyaltyPointValue ?? 1000) || 1000,
      });

      const paymentIntentIds = paymentIntents.map((intent: any) => intent.id);
      const webhookConditions: any[] = [{ matchedOrderId: { in: orderIds } }];
      const bankConditions: any[] = [{ matchedOrderId: { in: orderIds } }];
      if (paymentIntentIds.length > 0) {
        webhookConditions.push({ matchedPaymentIntentId: { in: paymentIntentIds } });
        bankConditions.push({ matchedPaymentIntentId: { in: paymentIntentIds } });
      }

      await (tx as any).paymentWebhookEvent.deleteMany({ where: { OR: webhookConditions } });
      await (tx as any).bankTransaction.deleteMany({ where: { OR: bankConditions } });

      if (paymentIntentIds.length > 0) {
        await (tx as any).paymentIntent.deleteMany({ where: { id: { in: paymentIntentIds } } });
      }

      await (tx as any).transaction.deleteMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            { refType: 'ORDER', refId: { in: orderIds } },
          ],
        },
      });

      if (graph.returnRequestIds.length > 0) {
        await (tx as any).orderReturnItem.deleteMany({
          where: { returnRequestId: { in: graph.returnRequestIds } },
        });
        await (tx as any).orderReturnRequest.deleteMany({
          where: { id: { in: graph.returnRequestIds } },
        });
      }

      await (tx as any).orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).groomingSession.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).hotelStay.deleteMany({ where: { orderId: { in: orderIds } } });
      await (tx as any).order.deleteMany({ where: { id: { in: orderIds } } });

      return {
        success: true,
        deletedIds: orderIds,
        deletedOrderNumbers: orderNumbers,
      };
    });
  }

  async bulkDeleteOrders(ids: string[], staffId: string, user?: AccessUser) {
    this.assertCanPermanentlyDeleteOrder(user);
    return runBulkDelete(ids, (orderId) => this.deleteOrderCascade(orderId, staffId, user));
  }

  // Refund order: update status to PARTIALLY_REFUNDED or FULLY_REFUNDED
  async refundOrder(id: string, dto: RefundOrderDto, staffId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');

    return this.prisma.$transaction(async (tx) => {
      const refunded = await tx.order.update({
        where: { id },
        data: {
          status: dto.status as any,
          notes: dto.reason ? `[HOÃƒâ‚¬N TIÃ¡Â»â‚¬N] ${dto.reason}\n${order.notes ?? ''}` : order.notes,
        },
        include: { items: true, payments: true },
      });

      return refunded;
    });
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ removeOrderItem ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Remove single item from pending/processing order, recalculate totals
  async removeOrderItem(orderId: string, itemId: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) this.assertOrderScope(order, user);
    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
    if (order.status === 'COMPLETED') throw new BadRequestException('KhÃƒÂ´ng thÃ¡Â»Æ’ sÃ¡Â»Â­a Ã„â€˜Ã†Â¡n Ã„â€˜ÃƒÂ£ hoÃƒÂ n thÃƒÂ nh');

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y item trong Ã„â€˜Ã†Â¡n');

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
    return this.queryService.findAll(params, user);
  }

  // findOne
  async findOne(id: string, user?: AccessUser): Promise<any> {
    return this.queryService.findOne(id, user);
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
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.assertOrderScope(order, user);
    id = order.id;
    id = order.id;

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

    // TrÃƒÂ¡Ã‚Â»Ã‚Â« tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n kho productVariant
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

    // Check if order can be exported
    if (!['CONFIRMED', 'PROCESSING'].includes(order.status) && !canExportPendingPaidProductOrder) {
      throw new BadRequestException(`Cannot export stock for order with status ${order.status}.`);
    }

    // For service orders, check if all grooming/hotel sessions are completed
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

    // Option B: export only real items (isTemp=false) not yet exported
    const exportableItems = order.items.filter(
      (item: any) =>
        item.type === 'product' &&
        item.productId &&
        !(item as any).isTemp &&
        !(item as any).stockExportedAt,
    );

    // Warning: there are temporary items not swapped yet (do not block, allow partial export)
    const pendingTempCount = order.items.filter(
      (item: any) => item.type === 'product' && (item as any).isTemp,
    ).length;

    if (exportableItems.length === 0 && pendingTempCount === 0) {
      throw new BadRequestException('Khong co san pham nao can xuat kho.');
    }

    // Determine next status
    const nextStatus = isPaid ? 'COMPLETED' : 'PROCESSING';

    await this.prisma.$transaction(async (tx) => {
      // Deduct stock for each real item (Option B - item-level tracking)
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Timeline
  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ swapTempItem ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
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
    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
    if (order.status === 'CANCELLED') throw new BadRequestException('Ã„ÂÃ†Â¡n hÃƒÂ ng Ã„â€˜ÃƒÂ£ bÃ¡Â»â€¹ hÃ¡Â»Â§y');

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y dÃƒÂ²ng hÃƒÂ ng');
    const isTempItem = (item as any).isTemp === true || (item.type === 'product' && !item.productId && !item.productVariantId);
    if (!isTempItem) throw new BadRequestException('DÃƒÂ²ng hÃƒÂ ng nÃƒÂ y khÃƒÂ´ng phÃ¡ÂºÂ£i sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m tÃ¡ÂºÂ¡m');

    // Load real product information
    const realVariant = await this.prisma.productVariant.findUnique({
      where: { id: dto.realProductVariantId },
      include: { product: true },
    });
    if (!realVariant) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y biÃ¡ÂºÂ¿n thÃ¡Â»Æ’ sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m');
    if (realVariant.productId !== dto.realProductId) {
      throw new BadRequestException('productId vÃƒÂ  productVariantId khÃƒÂ´ng khÃ¡Â»â€ºp');
    }

    // Ensure prices match
    if (Math.abs(realVariant.price - item.unitPrice) > 0.01) {
      throw new BadRequestException(
        `GiÃƒÂ¡ sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m thÃ¡ÂºÂ­t (${realVariant.price.toLocaleString('vi-VN')}Ã„â€˜) phÃ¡ÂºÂ£i bÃ¡ÂºÂ±ng giÃƒÂ¡ sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m tÃ¡ÂºÂ¡m (${item.unitPrice.toLocaleString('vi-VN')}Ã„â€˜)`,
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
      note: `Ã„ÂÃ¡Â»â€¢i SP tÃ¡ÂºÂ¡m "${oldLabel}" -> "${newDescription}"` +
        (order.stockExportedAt ? ` (Ã„â€˜ÃƒÂ£ trÃ¡Â»Â« kho ${item.quantity} Ãƒâ€” ${newDescription})` : ' (chÃ†Â°a xuÃ¡ÂºÂ¥t kho - sÃ¡ÂºÂ½ trÃ¡Â»Â« khi xuÃ¡ÂºÂ¥t)'),
      performedBy: staffId,
    });

    return this.findOne(orderId, user);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ createReturnRequest ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // TÃ¡ÂºÂ¡o yÃƒÂªu cÃ¡ÂºÂ§u Ã„â€˜Ã¡Â»â€¢i trÃ¡ÂºÂ£ hÃƒÂ ng tÃ¡Â»Â« Ã„â€˜Ã†Â¡n Ã„â€˜ÃƒÂ£ hoÃƒÂ n thÃƒÂ nh.
  // - items cÃƒÂ³ action=RETURN: ghi nhÃ¡ÂºÂ­n trÃ¡ÂºÂ£ hÃƒÂ ng, tÃƒÂ­nh tiÃ¡Â»Ân hoÃƒÂ n
  // - items cÃƒÂ³ action=EXCHANGE: tÃ¡ÂºÂ¡o Ã„â€˜Ã†Â¡n mÃ¡Â»â€ºi vÃ¡Â»â€ºi credit pre-applied (Ã„â€˜Ã¡Â»Æ’ staff thÃƒÂªm sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m vÃƒÂ o)
  async swapGroomingService(
    orderId: string,
    itemId: string,
    dto: SwapGroomingServiceDto,
    staffId: string,
    user?: AccessUser,
  ): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { items: true, customer: true },
    });
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    this.assertOrderScope(order, user);
    orderId = order.id;

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Khong the doi goi SPA cho don da hoan tat hoac da huy');
    }
    if (['PARTIALLY_REFUNDED', 'FULLY_REFUNDED'].includes(String(order.paymentStatus ?? ''))) {
      throw new BadRequestException('Khong the doi goi SPA cho don da phat sinh hoan tien');
    }

    const item = order.items.find((entry: any) => entry.id === itemId);
    if (!item) throw new NotFoundException('Khong tim thay dong dich vu');
    if (item.type !== 'grooming') {
      throw new BadRequestException('Chi ho tro doi cho dong dich vu SPA');
    }
    if (this.getGroomingOrderItemRole(item) === 'EXTRA') {
      throw new BadRequestException('Chi duoc doi dich vu chinh, khong doi dich vu khac');
    }
    if (!item.groomingSessionId) {
      throw new BadRequestException('Dong dich vu nay chua lien ket voi phieu SPA');
    }

    const currentSnapshot = this.getGroomingOrderItemSnapshot(item);
    const currentPricingRuleId = String(
      currentSnapshot.pricingRuleId
      ?? currentSnapshot.pricingSnapshot?.pricingRuleId
      ?? '',
    ).trim();
    if (!currentPricingRuleId) {
      throw new BadRequestException('Dong SPA hien tai thieu metadata bang gia, chua ho tro doi goi');
    }

    const targetPricingRuleId = String(dto.targetPricingRuleId ?? '').trim();
    if (!targetPricingRuleId) {
      throw new BadRequestException('Thieu goi SPA muon doi den');
    }
    if (targetPricingRuleId === currentPricingRuleId) {
      throw new BadRequestException('Goi SPA moi trung voi goi hien tai');
    }

    const linkedSession = await this.prisma.groomingSession.findUnique({
      where: { id: item.groomingSessionId },
      select: {
        id: true,
        sessionCode: true,
        status: true,
        packageCode: true,
      },
    });
    if (!linkedSession) {
      throw new NotFoundException('Khong tim thay phieu SPA lien ket');
    }
    if (['COMPLETED', 'CANCELLED'].includes(linkedSession.status)) {
      throw new BadRequestException('Phieu SPA da hoan thanh hoac da huy, khong the doi goi');
    }

    const petId = String(
      item.petId
      ?? currentSnapshot.petId
      ?? currentSnapshot.pricingSnapshot?.petId
      ?? '',
    ).trim();
    if (!petId) {
      throw new BadRequestException('Khong xac dinh duoc thu cung cua dong SPA');
    }

    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, name: true, species: true, weight: true },
    });
    if (!pet) {
      throw new NotFoundException('Khong tim thay thu cung');
    }

    const targetRule = await this.prisma.spaPriceRule.findUnique({
      where: { id: targetPricingRuleId },
      include: { weightBand: true },
    });
    if (!targetRule || targetRule.isActive !== true) {
      throw new BadRequestException('Bang gia SPA dich den khong hop le hoac da ngung ap dung');
    }
    if (!targetRule.weightBandId || !targetRule.weightBand) {
      throw new BadRequestException('Chi ho tro doi sang goi SPA chinh theo hang can');
    }

    const weightAtBooking = Number(currentSnapshot.weightAtBooking ?? pet.weight ?? Number.NaN);
    if (!Number.isFinite(weightAtBooking)) {
      throw new BadRequestException('Thu cung chua co can nang de doi goi SPA');
    }

    const ruleSpecies = targetRule.species ?? targetRule.weightBand.species ?? null;
    if (!isSpaRuleSpeciesMatch(pet.species, ruleSpecies)) {
      throw new BadRequestException('Goi SPA moi khong phu hop loai thu cung');
    }
    if (!isWeightInRange(weightAtBooking, targetRule.weightBand.minWeight, targetRule.weightBand.maxWeight)) {
      throw new BadRequestException('Goi SPA moi khong phu hop hang can cua thu cung');
    }

    const packageLabel = normalizeSpaPackageCode(targetRule.packageCode);
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    const currentDiscount = Math.max(0, Number(item.discountItem ?? 0));
    const targetUnitPrice = Math.max(0, Number(targetRule.price ?? 0));
    const targetGross = targetUnitPrice * quantity;
    const nextDiscountItem = Math.min(currentDiscount, targetGross);
    const currentLineTotal = Math.max(
      0,
      Number(item.subtotal ?? (Number(item.unitPrice ?? 0) * quantity - currentDiscount)),
    );
    const nextLineTotal = Math.max(0, targetGross - nextDiscountItem);
    const nextSubtotal = Math.max(
      0,
      order.items.reduce(
        (sum, entry: any) => sum + (entry.id === item.id ? nextLineTotal : Number(entry.subtotal ?? 0)),
        0,
      ),
    );
    const orderDiscount = Math.max(0, Number(order.discount ?? 0));
    const shippingFee = Math.max(0, Number(order.shippingFee ?? 0));
    const nextTotal = Math.max(0, nextSubtotal + shippingFee - orderDiscount);
    const paidAmount = Math.max(0, Number(order.paidAmount ?? 0));
    const overpaidAmount = Math.max(0, paidAmount - nextTotal);

    const matchingService = await this.prisma.service.findFirst({
      where: {
        type: 'GROOMING',
        isActive: true,
        OR: [
          { name: { equals: packageLabel, mode: 'insensitive' } as any },
          { name: { contains: packageLabel, mode: 'insensitive' } as any },
        ],
      },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const refundPaymentAccount = overpaidAmount > 0
        ? await this.resolvePaymentAccount(
          tx as any,
          dto.refundMethod ?? 'CASH',
          dto.refundPaymentAccountId,
        )
        : null;

      if (overpaidAmount > 0 && !refundPaymentAccount?.paymentMethod) {
        throw new BadRequestException('Khong xac dinh duoc phuong thuc hoan tien');
      }

      const sku = targetRule.sku
        ?? getSpaPricingSku(targetRule.packageCode, packageLabel, targetRule.weightBand?.label);

      const nextSnapshot = {
        ...currentSnapshot,
        source: 'POS_GROOMING_PRICE',
        serviceRole: 'MAIN',
        pricingRuleId: targetRule.id,
        packageCode: targetRule.packageCode,
        weightAtBooking,
        weightBandId: targetRule.weightBandId,
        weightBandLabel: targetRule.weightBand?.label ?? null,
        durationMinutes: targetRule.durationMinutes ?? null,
        serviceName: packageLabel,
        sku,
        price: targetUnitPrice,
        discountItem: nextDiscountItem,
        totalPrice: nextLineTotal,
        pricingSnapshot: {
          ...(currentSnapshot.pricingSnapshot ?? {}),
          source: 'SPA_PRICE_RULE',
          serviceRole: 'MAIN',
          pricingRuleId: targetRule.id,
          packageCode: targetRule.packageCode,
          weightBandId: targetRule.weightBandId ?? null,
          weightBandLabel: targetRule.weightBand?.label ?? null,
          price: targetUnitPrice,
          durationMinutes: targetRule.durationMinutes ?? null,
          serviceName: packageLabel,
          sku,
        },
      };

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          serviceId: matchingService?.id ?? item.serviceId ?? null,
          sku,
          description: packageLabel,
          unitPrice: targetUnitPrice,
          discountItem: nextDiscountItem,
          subtotal: nextLineTotal,
          pricingSnapshot: nextSnapshot as any,
        } as any,
      });

      await this.refreshGroomingSessionFromOrderItems(tx as any, item.groomingSessionId!);

      await tx.groomingSession.update({
        where: { id: item.groomingSessionId! },
        data: {
          timeline: {
            create: {
              action: 'Ã„ÂÃ¡Â»â€¢i gÃƒÂ³i dÃ¡Â»â€¹ch vÃ¡Â»Â¥ theo Ã„â€˜Ã†Â¡n',
              fromStatus: linkedSession.status,
              toStatus: linkedSession.status,
              note: `${linkedSession.packageCode ?? item.description} Ã¢â€ â€™ ${packageLabel} (Ã„â€˜Ã†Â¡n ${order.orderNumber})` +
                (dto.note?.trim() ? ` Ã¢â‚¬â€ LÃƒÂ½ do: ${dto.note.trim()}` : ''),
              performedBy: staffId,
            },
          },
        } as any,
      });

      let finalPaidAmount = paidAmount;
      if (overpaidAmount > 0) {
        await this.createOrderTransaction(tx as any, {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId,
            customerId: order.customerId,
            customerName: order.customer?.fullName ?? order.customerName ?? null,
          },
          type: 'EXPENSE',
          amount: overpaidAmount,
          paymentMethod: refundPaymentAccount?.paymentMethod ?? dto.refundMethod ?? 'CASH',
          paymentAccountId: refundPaymentAccount?.paymentAccountId ?? null,
          paymentAccountLabel: dto.refundPaymentAccountLabel?.trim()
            || refundPaymentAccount?.paymentAccountLabel
            || null,
          description: `Hoan tien chenh lech doi goi SPA ${order.orderNumber}`,
          note: dto.note?.trim() || `Doi goi ${item.description} -> ${packageLabel}`,
          source: 'ORDER_ADJUSTMENT',
          staffId,
        });
        finalPaidAmount = nextTotal;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: nextSubtotal,
          total: nextTotal,
          paidAmount: finalPaidAmount,
          remainingAmount: this.calculateRemainingAmount(nextTotal, finalPaidAmount),
          paymentStatus: this.calculatePaymentStatus(nextTotal, finalPaidAmount) as any,
        } as any,
      });

      await this.createTimelineEntry({
        orderId: order.id,
        action: 'ITEM_SWAPPED',
        note: `Doi goi SPA "${item.description}" -> "${packageLabel}"` +
          (nextLineTotal !== currentLineTotal
            ? ` (${currentLineTotal.toLocaleString('vi-VN')}d -> ${nextLineTotal.toLocaleString('vi-VN')}d)`
            : ''),
        performedBy: staffId,
      });
    });

    return this.findOne(orderId, user);
  }

  async createReturnRequest(
    orderId: string,
    dto: import('../dto/create-return-request.dto.js').CreateReturnRequestDto,
    staffId: string,
    user?: AccessUser,
  ): Promise<any> {
    // Load order
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      include: { items: true, customer: true, branch: true },
    });
    if (!order) throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y Ã„â€˜Ã†Â¡n hÃƒÂ ng');
    this.assertOrderScope(order, user);
    orderId = order.id;

    if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order.status)) {
      throw new BadRequestException('ChÃ¡Â»â€° cÃƒÂ³ thÃ¡Â»Æ’ Ã„â€˜Ã¡Â»â€¢i/trÃ¡ÂºÂ£ hÃƒÂ ng cho Ã„â€˜Ã†Â¡n Ã„â€˜ÃƒÂ£ hoÃƒÂ n thÃƒÂ nh');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('PhÃ¡ÂºÂ£i chÃ¡Â»Ân ÃƒÂ­t nhÃ¡ÂºÂ¥t mÃ¡Â»â„¢t sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m Ã„â€˜Ã¡Â»â€¢i/trÃ¡ÂºÂ£');
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

    // Validate items belong to the order
    const orderItemMap = new Map(order.items.map((item: any) => [item.id, item]));
    for (const reqItem of dto.items) {
      if (!isReturnAction(reqItem.action)) {
        throw new BadRequestException('Hanh dong doi/tra khong hop le');
      }
      if (!orderItemMap.has(reqItem.orderItemId)) {
        throw new BadRequestException(`SÃ¡ÂºÂ£n phÃ¡ÂºÂ©m ${reqItem.orderItemId} khÃƒÂ´ng thuÃ¡Â»â„¢c Ã„â€˜Ã†Â¡n nÃƒÂ y`);
      }
      const orderItem = orderItemMap.get(reqItem.orderItemId) as any;
      const returnableQuantity = getReturnableQuantity(orderItem, returnedQuantityByItemId);
      if (reqItem.quantity > returnableQuantity) {
        throw new BadRequestException(`SÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng trÃ¡ÂºÂ£ khÃƒÂ´ng thÃ¡Â»Æ’ vÃ†Â°Ã¡Â»Â£t quÃƒÂ¡ sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng Ã„â€˜ÃƒÂ£ mua (${orderItem.quantity})`);
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
    const returnType = dto.type; // 'PARTIAL' | 'FULL'
    const refundAmount = resolveReturnRefundAmount({
      hasReturn,
      requestedRefundAmount: dto.refundAmount,
      returnCredit: creditBreakdown.returnCredit,
    });

    const totalCredit = creditBreakdown.totalCredit;
    const itemSummary = buildReturnItemSummary(dto.items, orderItemMap as any);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create OrderReturnRequest
      const returnRequest = await (tx as any).orderReturnRequest.create({
        data: {
          orderId,
          type: returnType,
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

      // 1b. Restore stock for RETURN items (hoÃƒÂ n kho cho hÃƒÂ ng trÃ¡ÂºÂ£)
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
        stockRestoredItems.push(
          `+${reqItem.quantity} Ãƒâ€” ${orderItem.description ?? orderItem.sku ?? orderItem.productVariantId}`,
        );
      }

      // 2. Update original order status
      const currentReturnQuantityByItemId = buildCurrentReturnQuantityMap(dto.items);
      const newStatus = hasRemainingReturnableProductQuantity(order.items as any, returnedQuantityByItemId, currentReturnQuantityByItemId)
        ? 'PARTIALLY_REFUNDED'
        : 'FULLY_REFUNDED';
      await (tx as any).order.update({
        where: { id: orderId },
        data: { status: newStatus, updatedAt: now },
      });

      // 3. Ghi timeline Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n gÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc
      await createOrderTimelineEntry((tx as any).orderTimeline, {
        orderId,
        action: 'REFUNDED',
        fromStatus: 'COMPLETED',
        toStatus: newStatus,
        note: `Ã„ÂÃ¡Â»â€¢i/trÃ¡ÂºÂ£: ${itemSummary}` +
          (dto.reason ? ` Ã¢â‚¬â€ LÃƒÂ½ do: ${dto.reason}` : '') +
          `. Credit: ${totalCredit.toLocaleString('vi-VN')}Ã„â€˜` +
          (stockRestoredItems.length > 0 ? ` | HoÃƒÂ n kho: ${stockRestoredItems.join(', ')}` : ''),
        performedBy: staffId,
        metadata: {
          returnRequestId: returnRequest.id,
          returnFlow: 'ORDER_RETURN_EXCHANGE',
          type: returnType,
          totalCredit,
          returnCredit: creditBreakdown.returnCredit,
          exchangeCredit: creditBreakdown.exchangeCredit,
          refundAmount,
          hasExchange,
          hasReturn,
          stockRestored: stockRestoredItems,
        },
      });

      // 4. If EXCHANGE exists: create new order with pre-applied credit
      let exchangeOrder: any = null;
      if (hasExchange) {
        const exchangeOrderNumber = await this.generateOrderNumber();
        const creditForExchange = creditBreakdown.exchangeCredit;
        const normalizedExchangeItems = exchangeItems.length > 0
          ? await this.validateAndNormalizeCreateItems(tx as any, exchangeItems as any)
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
              ? { items: { create: normalizedExchangeItems.map((item: any) => this.buildOrderItemData(item)) } }
              : {}),
            orderNumber: exchangeOrderNumber,
            customerId: order.customerId,
            customerName: (order.customer as any)?.fullName ??
              (order.customer as any)?.name ??
              (order as any).customerName ??
              'KhÃƒÂ¡ch lÃ¡ÂºÂ»',
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
            notes: `Ã„ÂÃ†Â¡n Ã„â€˜Ã¡Â»â€¢i hÃƒÂ ng tÃ¡Â»Â« #${order.orderNumber}. Credit Ã„â€˜Ã†Â°Ã¡Â»Â£c ÃƒÂ¡p dÃ¡Â»Â¥ng: ${creditForExchange.toLocaleString('vi-VN')}Ã„â€˜`,
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

          await createStockExportTimelineEntry((tx as any).orderTimeline, {
            orderId: exchangeOrder.id,
            fromStatus: 'PENDING',
            toStatus: 'COMPLETED',
            performedBy: staffId,
            occurredAt: now,
            exportedItemCount: autoExportExchangeItems.length,
            pendingTempCount: 0,
            metadata: { source: 'EXCHANGE_CREDIT_AUTO_EXPORT', returnRequestId: returnRequest.id },
          });
        }

        // Create payment record for credit from old order
        if (creditForExchange > 0) {
          await (tx as any).orderPayment.create({
            data: {
              orderId: exchangeOrder.id,
              method: 'ORDER_CREDIT',
              amount: creditForExchange,
              note: `Credit tÃ¡Â»Â« Ã„â€˜Ã†Â¡n #${order.orderNumber}`,
              paymentAccountId: null,
              paymentAccountLabel: `Ã„ÂÃ¡Â»â€¢i hÃƒÂ ng tÃ¡Â»Â« DH${order.orderNumber.replace(/^DH/i, '')}`,
              createdAt: now,
            } as any,
          });

          // Create timeline entry for new order
          await createOrderTimelineEntry((tx as any).orderTimeline, {
            orderId: exchangeOrder.id,
            action: 'CREATED',
            fromStatus: null,
            toStatus: 'PENDING',
            note: `Ã„ÂÃ†Â¡n Ã„â€˜Ã¡Â»â€¢i hÃƒÂ ng tÃ¡Â»Â« #${order.orderNumber}. Credit ${creditForExchange.toLocaleString('vi-VN')}Ã„â€˜ Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c ÃƒÂ¡p dÃ¡Â»Â¥ng.`,
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
          });
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
