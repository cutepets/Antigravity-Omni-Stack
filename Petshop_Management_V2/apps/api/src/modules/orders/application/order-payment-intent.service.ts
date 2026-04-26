import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { resolveBranchIdentity } from '../../../common/utils/branch-identity.util.js';
import { buildVietQrDataUrl, buildVietQrPayload } from '../../../common/utils/vietqr.util.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderPaymentHelperService } from '../domain/order-payment-helper.service.js';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto.js';
import {
  mapOrderPaymentIntentView,
  type OrderPaymentIntentView,
} from '../mappers/payment-intent.mapper.js';
import {
  assertOrderCanCreatePaymentIntent,
  resolveRequestedPaymentIntentAmount,
} from '../policies/order-workflow.policy.js';
import { OrderPaymentService } from './order-payment.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const PAYMENT_INTENT_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class OrderPaymentIntentService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly paymentHelperService: OrderPaymentHelperService,
    private readonly paymentService: OrderPaymentService,
  ) { }

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
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

  private buildTransferContent(params: {
    prefix?: string | null;
    branchCode?: string | null;
    orderNumber?: string | null;
    paymentAccountName?: string | null;
    fallbackId: string;
  }) {
    return this.paymentHelperService.buildTransferContent(params);
  }

  async expirePendingPaymentIntents(
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

  async hydratePaymentIntent(intentId: string): Promise<OrderPaymentIntentView> {
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

  mapPaymentIntentView(paymentIntent: any): OrderPaymentIntentView {
    return mapOrderPaymentIntentView(paymentIntent);
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
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
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

      const normalizedPayments = await this.paymentService.normalizePayments(tx as any, [
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

      await this.paymentService.applyPaymentsToOrder(tx as any, {
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
}
