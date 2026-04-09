import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { resolvePermissions } from '@petshop/auth';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../database/database.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';
import {
  generateGroomingSessionCode as formatGroomingSessionCode,
  generateHotelStayCode as formatHotelStayCode,
  generateOrderNumber as formatOrderNumber,
} from '@petshop/shared';
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js';
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

// ─── Payment method labels ──────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  CARD: 'Thẻ',
  POINTS: 'Điểm tích lũy',
};

@Injectable()
export class OrdersService {
  constructor(private prisma: DatabaseService) {}

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

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  private async generateVoucherNumberFor(
    db: Pick<DatabaseService, 'transaction'>,
    type: 'INCOME' | 'EXPENSE',
  ): Promise<string> {
    return generateFinanceVoucherNumber(db, type);
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
      description: string;
      note?: string | null;
      source: 'ORDER_PAYMENT' | 'ORDER_ADJUSTMENT';
      staffId: string;
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
        staffId: params.staffId,
      } as any,
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
      throw new BadRequestException(`Sản phẩm ${params.productId} chưa có tồn kho tại chi nhánh ${branch.name}`);
    }

    if (branchStock.stock < params.quantity) {
      throw new BadRequestException(
        `Tồn kho không đủ cho sản phẩm ${params.productId} tại chi nhánh ${branch.name}. Còn ${branchStock.stock}, cần ${params.quantity}.`,
      );
    }

    await tx.branchStock.update({
      where: { id: branchStock.id },
      data: {
        stock: { decrement: params.quantity },
      },
    });

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
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

  // ─── Catalog (POS quick access) ────────────────────────────────────────────

  async getProducts() {
    return this.prisma.product.findMany({
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
  }

  async getServices() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ─── createOrder ────────────────────────────────────────────────────────────
  // Auto-classify: QUICK (product only) vs SERVICE (has grooming/hotel)
  // QUICK: deduct stock immediately, status → PAID/PARTIAL
  // SERVICE: reserve stock, status → PENDING, pay later
  async createOrder(data: CreateOrderDto, staffId: string) {
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

    // ── Financial calculations ────────────────────────────────────────────
    let subtotal = 0;
    for (const item of items) {
      const lineNet = item.unitPrice * item.quantity - (item.discountItem ?? 0);
      subtotal += lineNet;
    }
    const total = subtotal + shippingFee - discount;
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    // ── Payment status ────────────────────────────────────────────────────
    const paymentStatus = this.calculatePaymentStatus(total, totalPaid);

    const orderStatus = orderType === 'QUICK' && paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING';

    // ── Database transaction ──────────────────────────────────────────────
    return this.prisma.$transaction(async (tx) => {
      const serviceTraceParts: string[] = [];
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
              type: item.type,
              productId: item.productId ?? null,
              productVariantId: item.productVariantId ?? null,
              serviceId: item.serviceId ?? null,
              serviceVariantId: item.serviceVariantId ?? null,
              petId: item.petId ?? null,
            })),
          },
          payments: {
            create: payments.map((p) => ({
              method: p.method,
              amount: p.amount,
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

        // ── Product stock handling ─────────────────────────────────────
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

        // ── Grooming session creation ──────────────────────────────────
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

        // ── Hotel stay creation ────────────────────────────────────────
        if (item.hotelDetails && orderItem) {
          const checkInDate = new Date(item.hotelDetails.checkInDate);
          const checkOutDate = new Date(item.hotelDetails.checkOutDate);
          const branch = await resolveBranchIdentity(
            tx as any,
            item.hotelDetails.branchId ?? data.branchId ?? null,
          );
          const stayCode = await this.generateHotelStayCode(tx as any, order.createdAt, branch.code);
          const totalPrice = item.unitPrice * item.quantity;

          const stay = await tx.hotelStay.create({
            data: {
              stayCode,
              petId: item.hotelDetails.petId,
              petName: '', // Will be filled from pet lookup
              customerId: data.customerId ?? null,
              branchId: branch.id,
              cageId: item.hotelDetails.cageId ?? null,
              checkIn: checkInDate,
              estimatedCheckOut: checkOutDate,
              status: 'BOOKED',
              lineType: (item.hotelDetails.lineType as any) ?? 'REGULAR',
              price: totalPrice,
              dailyRate: item.hotelDetails.dailyRate ?? item.unitPrice,
              depositAmount: item.hotelDetails.depositAmount ?? 0,
              paymentStatus: 'UNPAID',
              promotion: item.hotelDetails.promotion ?? 0,
              surcharge: item.hotelDetails.surcharge ?? 0,
              totalPrice,
              rateTableId: item.hotelDetails.rateTableId ?? null,
              notes: item.hotelDetails.notes ?? null,
              orderId: order.id,
            },
          });

          // Link hotelStayId to order item
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { hotelStayId: stay.id },
          });

          // Fill petName
          const pet = await tx.pet.findUnique({ where: { id: item.hotelDetails.petId } });
          if (pet) {
            await tx.hotelStay.update({
              where: { id: stay.id },
              data: { petName: pet.name },
            });
          }

          serviceTraceParts.push(`HOTEL_STAY:${stay.id}`);
          serviceTraceParts.push(`HOTEL_CODE:${stayCode}`);
        }
      }

      // 3. Create income transaction records
      for (const pay of payments) {
        if (pay.amount <= 0) continue;
        const traceParts = serviceTraceParts;
        const label = this.getPaymentLabel(pay.method);
        await tx.transaction.create({
          data: {
            voucherNumber: await this.generateVoucherNumberFor(tx as any, 'INCOME'),
            type: 'INCOME',
            amount: pay.amount,
            description: `Thu từ đơn hàng ${order.orderNumber} — ${label}`,
            orderId: order.id,
            paymentMethod: pay.method,
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

      return order;
    });
  }

  // ─── payOrder ───────────────────────────────────────────────────────────────
  // Collect additional payment for SERVICE orders (multi-payment support)
  async updateOrder(id: string, data: UpdateOrderDto, staffId: string, user?: AccessUser) {
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
          existingStayId: currentItem.hotelStayId,
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
          await this.syncHotelStay(tx as any, {
            orderId: id,
            orderItemId: existingItem.id,
            customerId: data.customerId ?? null,
            branchId: data.branchId ?? null,
            orderCreatedAt: order.createdAt,
            item,
            existingStayId: existingItem.hotelStayId,
          });
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
        await this.syncHotelStay(tx as any, {
          orderId: id,
          orderItemId: createdItem.id,
          customerId: data.customerId ?? null,
          branchId: data.branchId ?? null,
          orderCreatedAt: order.createdAt,
          item,
        });
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

  async payOrder(id: string, dto: PayOrderDto, staffId: string, user?: AccessUser) {
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

    const paymentsArr = dto.payments.filter((p) => p.amount > 0);
    if (paymentsArr.length === 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    const newPaidThisTime = paymentsArr.reduce((s, p) => s + p.amount, 0);
    const totalPaid = order.paidAmount + newPaidThisTime;
    const remaining = this.calculateRemainingAmount(order.total, totalPaid);

    // Detect primary method
    const uniqueMethods = [...new Set(paymentsArr.map((p) => p.method))];
    const primaryMethod = uniqueMethods.length > 1 ? 'MIXED' : (uniqueMethods[0] ?? 'CASH');

    // Payment status
    const status = this.calculatePaymentStatus(order.total, totalPaid);

    return this.prisma.$transaction(async (tx) => {
      // Create payment records
      for (const p of paymentsArr) {
        await tx.orderPayment.create({
          data: { orderId: id, method: p.method, amount: p.amount },
        });
      }

      // Create transaction record
      const label = this.getPaymentLabel(primaryMethod);
      const serviceTraceParts = this.buildOrderServiceTraceParts(order);
      await tx.transaction.create({
        data: {
          voucherNumber: await this.generateVoucherNumberFor(tx as any, 'INCOME'),
          type: 'INCOME',
          amount: newPaidThisTime,
          description: `Thu bổ sung đơn hàng ${order.orderNumber} — ${label}`,
          orderId: id,
          paymentMethod: primaryMethod,
          branchId: order.branchId ?? null,
          refType: 'ORDER',
          refId: order.id,
          refNumber: order.orderNumber,
          payerId: order.customerId ?? null,
          payerName: order.customerName ?? null,
          notes: this.mergeTransactionNotes(dto.payments.map((p) => p.note).filter(Boolean).join(' | ') || null, serviceTraceParts),
          tags: this.buildServiceTraceTags(serviceTraceParts),
          source: 'ORDER_PAYMENT',
          isManual: false,
          staffId,
        } as any,
      });

      // Update order
      const updated = await tx.order.update({
        where: { id },
        data: {
          paidAmount: totalPaid,
          remainingAmount: remaining,
          paymentStatus: status as any,
        },
        include: { items: true, payments: true, customer: true },
      });

      return updated;
    });
  }

  // ─── completeOrder ──────────────────────────────────────────────────────────
  // Finalize SERVICE order: validate sessions, deduct stock, update customer
  async completeOrder(id: string, dto: CompleteOrderDto, staffId: string, user?: AccessUser) {
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
      const extraPayments = (dto.payments ?? []).filter((payment) => payment.amount > 0);
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
          },
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
          description: `Thu bổ sung đơn hàng ${order.orderNumber} — ${this.getPaymentLabel(payment.method)}`,
          note: payment.note ?? dto.settlementNote ?? null,
          source: 'ORDER_PAYMENT',
          staffId,
          traceParts,
        });
      }

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
            paymentMethod: dto.refundMethod ?? 'CASH',
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

      return completed;
    });
  }

  // ─── cancelOrder ────────────────────────────────────────────────────────────
  // Cancel order: release reserved stock, cancel sessions
  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string, user?: AccessUser) {
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

  // ─── removeOrderItem ────────────────────────────────────────────────────────
  // Remove single item from pending/processing order, recalculate totals
  async removeOrderItem(orderId: string, itemId: string, user?: AccessUser) {
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

  // ─── findAll (advanced filtering) ───────────────────────────────────────────
  async findAll(params?: {
    search?: string | undefined;
    paymentStatus?: string | undefined;
    status?: string | undefined;
    customerId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  }, user?: AccessUser) {
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

  // ─── findOne ────────────────────────────────────────────────────────────────
  async findOne(id: string, user?: AccessUser) {
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

        return {
          ...item,
          groomingDetails: groomingSession
            ? {
                petId: groomingSession.petId,
                performerId: groomingSession.staffId,
                startTime: groomingSession.startTime,
                notes: groomingSession.notes,
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
              }
            : undefined,
        };
      }),
    };
  }
}
