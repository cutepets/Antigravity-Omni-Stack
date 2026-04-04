import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PayOrderDto } from './dto/pay-order.dto.js';
import { CompleteOrderDto } from './dto/complete-order.dto.js';
import { CancelOrderDto } from './dto/cancel-order.dto.js';

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

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Generate order number: PS-YYYYMMDD-XXXX */
  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const count = await this.prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    });
    return `PS-${dateStr}-${String(count + 1).padStart(4, '0')}`;
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

  // ─── Catalog (POS quick access) ────────────────────────────────────────────

  async getProducts() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { 
        variants: { 
          where: { isActive: true },
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
    let paymentStatus: string;
    if (orderType === 'QUICK') {
      if (totalPaid >= total) paymentStatus = 'PAID';
      else if (totalPaid > 0) paymentStatus = 'PARTIAL';
      else paymentStatus = 'UNPAID';
    } else {
      // SERVICE: starts at UNPAID, collect payment later
      if (totalPaid > 0) paymentStatus = 'PARTIAL';
      else paymentStatus = 'UNPAID';
    }

    const orderStatus = orderType === 'QUICK' && paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING';

    // ── Database transaction ──────────────────────────────────────────────
    return this.prisma.$transaction(async (tx) => {
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
          remainingAmount: total - totalPaid,
          notes: data.notes ?? null,
          items: {
            create: items.map((item) => ({
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
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]!;
        const orderItem = order.items[idx]!

        // ── Product stock handling ─────────────────────────────────────
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new BadRequestException(`Sản phẩm ${item.productId} không tồn tại`);

          if (orderType === 'QUICK') {
            // QUICK: deduct stock immediately
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } } as any,
            });
            await tx.stockTransaction.create({
              data: {
                productId: item.productId,
                type: 'OUT',
                quantity: item.quantity,
                reason: `Bán hàng đơn ${order.orderNumber}`,
                referenceId: order.id,
              },
            });
          }
          // SERVICE stock reservation handled by BranchStock if needed
        }

        // ── Grooming session creation ──────────────────────────────────
        if (item.groomingDetails && orderItem) {
          const session = await tx.groomingSession.create({
            data: {
              petId: item.groomingDetails.petId,
              petName: '', // Will be filled from pet lookup
              customerId: data.customerId ?? null,
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
        }

        // ── Hotel stay creation ────────────────────────────────────────
        if (item.hotelDetails && orderItem) {
          const stay = await tx.hotelStay.create({
            data: {
              petId: item.hotelDetails.petId,
              petName: '', // Will be filled from pet lookup
              customerId: data.customerId ?? null,
              cageId: item.hotelDetails.cageId ?? null,
              checkIn: new Date(item.hotelDetails.checkInDate),
              estimatedCheckOut: new Date(item.hotelDetails.checkOutDate),
              status: 'BOOKED',
              lineType: 'REGULAR',
              price: item.unitPrice * item.quantity,
              paymentStatus: 'UNPAID',
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
        }
      }

      // 3. Create income transaction records
      for (const pay of payments) {
        if (pay.amount <= 0) continue;
        const label = METHOD_LABELS[pay.method] ?? pay.method;
        await tx.transaction.create({
          data: {
            voucherNumber: await this.generateVoucherNumber(),
            type: 'INCOME',
            amount: pay.amount,
            description: `Thu từ đơn hàng ${order.orderNumber} — ${label}`,
            orderId: order.id,
            staffId,
          },
        });
      }

      // 4. Update customer stats (QUICK + PAID only)
      if (data.customerId && orderType === 'QUICK' && paymentStatus === 'PAID') {
        const pointsEarned = Math.floor(total / 1000);
        await tx.customer.update({
          where: { id: data.customerId },
          data: {
            totalSpent: { increment: total },
            totalOrders: { increment: 1 },
            points: { increment: pointsEarned },
          },
        });
      }

      return order;
    });
  }

  // ─── payOrder ───────────────────────────────────────────────────────────────
  // Collect additional payment for SERVICE orders (multi-payment support)
  async payOrder(id: string, dto: PayOrderDto, staffId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });
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
    const remaining = order.total - totalPaid;

    // Detect primary method
    const uniqueMethods = [...new Set(paymentsArr.map((p) => p.method))];
    const primaryMethod = uniqueMethods.length > 1 ? 'MIXED' : (uniqueMethods[0] ?? 'CASH');

    // Payment status
    const status = totalPaid >= order.total ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

    return this.prisma.$transaction(async (tx) => {
      // Create payment records
      for (const p of paymentsArr) {
        await tx.orderPayment.create({
          data: { orderId: id, method: p.method, amount: p.amount },
        });
      }

      // Create transaction record
      const label = METHOD_LABELS[primaryMethod] ?? primaryMethod;
      await tx.transaction.create({
        data: {
          voucherNumber: await this.generateVoucherNumber(),
          type: 'INCOME',
          amount: newPaidThisTime,
          description: `Thu bổ sung đơn hàng ${order.orderNumber} — ${label}`,
          orderId: id,
          staffId,
        },
      });

      // Update order
      const updated = await tx.order.update({
        where: { id },
        data: {
          paidAmount: totalPaid,
          remainingAmount: remaining > 0 ? remaining : 0,
          paymentStatus: status as any,
        },
        include: { items: true, payments: true, customer: true },
      });

      return updated;
    });
  }

  // ─── completeOrder ──────────────────────────────────────────────────────────
  // Finalize SERVICE order: validate sessions, deduct stock, update customer
  async completeOrder(id: string, dto: CompleteOrderDto, staffId: string) {
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
              `Phiên spa ${session.id} chưa hoàn thành. Vui lòng hoàn thành trước khi kết đơn.`,
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
      // Deduct stock for product items
      for (const item of order.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } } as any,
        });
        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Hoàn thành đơn ${order.orderNumber}`,
            referenceId: order.id,
          },
        });
      }

      // Mark grooming sessions as completed/paid
      for (const item of order.items) {
        if (item.groomingSessionId) {
          const session = await tx.groomingSession.findUnique({
            where: { id: item.groomingSessionId },
          });
          if (session && session.status === 'COMPLETED') {
            // Already completed by grooming flow, we just confirm
          }
        }
      }

      // Complete order
      const completed = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED' as any,
          paymentStatus: order.paidAmount >= order.total ? ('PAID' as any) : order.paymentStatus,
        },
        include: {
          customer: true,
          items: { include: { product: true, service: true } },
          payments: true,
        },
      });

      // Update customer spending
      if (order.customerId) {
        const pointsEarned = Math.floor(order.total / 1000);
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalSpent: { increment: order.total },
            totalOrders: { increment: 1 },
            points: { increment: pointsEarned },
          },
        });
      }

      return completed;
    });
  }

  // ─── cancelOrder ────────────────────────────────────────────────────────────
  // Cancel order: release reserved stock, cancel sessions
  async cancelOrder(id: string, dto: CancelOrderDto, staffId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
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
  async removeOrderItem(orderId: string, itemId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
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

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          remainingAmount: newTotal - order.paidAmount,
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
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};

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
  async findOne(id: string) {
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
          },
        },
        payments: true,
        transactions: true,
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }
}
