import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import {
  buildReturnedQuantityMap,
  getReturnableQuantity,
} from './order-return.application.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

type OrderListParams = {
  search?: string | undefined;
  paymentStatus?: string | undefined;
  status?: string | undefined;
  customerId?: string | undefined;
  productId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

@Injectable()
export class OrderQueryService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
  ) { }

  private getAuthorizedBranchIds(user?: AccessUser): string[] {
    return this.accessService.getAuthorizedBranchIds(user);
  }

  private shouldRestrictToOrderBranches(user?: AccessUser): boolean {
    return this.accessService.shouldRestrictToOrderBranches(user);
  }

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  async loadOrderOrThrow(id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        customer: true,
        payments: true,
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
        items: {
          include: {
            product: {
              include: {
                variants: { where: { isActive: true, deletedAt: null } },
              },
            },
            service: true,
            productVariant: true,
            serviceVariant: true,
            hotelStay: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Khong tim thay don hang');
    return order;
  }

  async findAll(params?: OrderListParams, user?: AccessUser): Promise<any> {
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
          OR: [{ productId: params.productId }, { productVariantId: params.productId }],
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
        lte: new Date(`${params.dateTo}T23:59:59`),
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

  async findOne(id: string, user?: AccessUser): Promise<any> {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
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
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    this.assertOrderScope(order, user);

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
              sku: true,
              petId: true,
              pricingSnapshot: true,
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
    const approvedReturnRequests = await (this.prisma as any).orderReturnRequest.findMany({
      where: {
        orderId: order.id,
        status: 'APPROVED',
      },
      include: { items: true },
    });
    const returnedQuantityByItemId = buildReturnedQuantityMap(approvedReturnRequests);

    return {
      ...order,
      items: order.items.map((item) => {
        const groomingSession = item.groomingSessionId ? groomingById.get(item.groomingSessionId) : null;
        const itemPricingSnapshot = item.pricingSnapshot as any;
        const hotelChargeLine = itemPricingSnapshot?.chargeLine;

        return {
          ...item,
          returnAvailability: {
            returnedQuantity: returnedQuantityByItemId.get(item.id) ?? 0,
            returnableQuantity: getReturnableQuantity(item as any, returnedQuantityByItemId),
          },
          groomingSession: groomingSession
            ? {
              id: groomingSession.id,
              sessionCode: groomingSession.sessionCode,
              status: groomingSession.status,
              packageCode: groomingSession.packageCode,
              price: groomingSession.price,
              extraServices: Array.isArray((groomingSession.pricingSnapshot as any)?.extraServices)
                ? (groomingSession.pricingSnapshot as any).extraServices
                : [],
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
              packageCode: itemPricingSnapshot?.serviceRole === 'EXTRA' ? undefined : groomingSession.packageCode,
              serviceRole: itemPricingSnapshot?.serviceRole ?? 'MAIN',
              pricingRuleId: itemPricingSnapshot?.pricingRuleId ?? undefined,
              durationMinutes: itemPricingSnapshot?.durationMinutes ?? null,
              weightAtBooking: itemPricingSnapshot?.weightAtBooking ?? groomingSession.weightAtBooking,
              weightBandId: itemPricingSnapshot?.weightBandId ?? groomingSession.weightBandId,
              weightBandLabel:
                itemPricingSnapshot?.weightBandLabel
                ?? groomingSession.weightBand?.label
                ?? (groomingSession.pricingSnapshot as any)?.weightBandLabel
                ?? null,
              pricingPrice: item.unitPrice,
              pricingSnapshot: itemPricingSnapshot ?? groomingSession.pricingSnapshot,
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
              weightBandId: item.hotelStay.weightBandId,
              weightBandLabel:
                hotelChargeLine?.weightBandLabel
                ?? (item.hotelStay.pricingSnapshot as any)?.weightBandLabel
                ?? undefined,
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
}
