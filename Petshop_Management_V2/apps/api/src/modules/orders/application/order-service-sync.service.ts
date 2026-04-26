import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { resolveBranchIdentity } from '../../../common/utils/branch-identity.util.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { UpdateOrderItemDto } from '../dto/update-order.dto.js';
import { buildGroomingSessionRefreshData } from './order-grooming-sync.application.js';
import { buildGroupedHotelStayPlan } from './order-hotel-sync.application.js';

type SyncOrderItemInput = CreateOrderDto['items'][number] | UpdateOrderItemDto;

@Injectable()
export class OrderServiceSyncService {
  constructor(
    private readonly numberingService: OrderNumberingService,
    private readonly orderItemService: OrderItemService,
  ) {}

  private async generateHotelStayCode(
    db: Pick<DatabaseService, 'hotelStay'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    return this.numberingService.generateHotelStayCode(db as DatabaseService, createdAt, branchCode);
  }

  private async generateGroomingSessionCode(
    db: Pick<DatabaseService, 'groomingSession'>,
    createdAt: Date,
    branchCode: string,
  ): Promise<string> {
    return this.numberingService.generateGroomingSessionCode(db as DatabaseService, createdAt, branchCode);
  }

  async refreshGroomingSessionFromOrderItems(tx: DatabaseService, sessionId: string) {
    const items = await tx.orderItem.findMany({
      where: { groomingSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });

    if (items.length === 0) return;

    await tx.groomingSession.update({
      where: { id: sessionId },
      data: buildGroomingSessionRefreshData(items as any, this.orderItemService) as any,
    });
  }

  async syncGroomingSession(
    tx: DatabaseService,
    params: {
      orderId: string;
      orderItemId: string;
      customerId?: string | null;
      branchId?: string | null;
      serviceId?: string | null;
      orderCreatedAt?: Date;
      staffId?: string | null;
      item: SyncOrderItemInput;
      existingSessionId?: string | null;
    },
  ) {
    const details = params.item.groomingDetails;
    if (!details) {
      if (params.existingSessionId) {
        const session = await tx.groomingSession.findUnique({ where: { id: params.existingSessionId } });
        if (session && !['PENDING', 'IN_PROGRESS', 'CANCELLED'].includes(session.status)) {
          throw new BadRequestException(`Phien spa ${session.sessionCode ?? session.id} da hoan thanh, khong the bo khoi don dang giao dich.`);
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
      pricingSnapshot: (this.orderItemService.buildGroomingOrderItemPricingSnapshot(params.item) ?? details.pricingSnapshot) as any,
    };
    const isExtraItem =
      this.orderItemService.getGroomingOrderItemRole({
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
        throw new BadRequestException(`Phien spa ${current.sessionCode ?? current.id} da bi huy, khong the cap nhat lai tu POS.`);
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
        ...(params.staffId
          ? {
              timeline: {
                create: {
                  action: 'Tao phieu tu don',
                  toStatus: 'PENDING',
                  note: `Tu don ${params.orderId}`,
                  performedBy: params.staffId,
                },
              },
            }
          : {}),
      },
    });

    await tx.orderItem.update({
      where: { id: params.orderItemId },
      data: { groomingSessionId: created.id },
    });
    await this.refreshGroomingSessionFromOrderItems(tx, created.id);

    return created.id;
  }

  async syncHotelStay(
    tx: DatabaseService,
    params: {
      orderId: string;
      orderItemId: string;
      customerId?: string | null;
      branchId?: string | null;
      orderCreatedAt?: Date;
      item: SyncOrderItemInput;
      existingStayId?: string | null;
    },
  ) {
    const details = params.item.hotelDetails;
    if (!details) {
      if (params.existingStayId) {
        const stay = await tx.hotelStay.findUnique({ where: { id: params.existingStayId } });
        if (stay && !['BOOKED', 'CANCELLED'].includes(stay.status)) {
          throw new BadRequestException(`Luot luu tru ${stay.stayCode ?? stay.id} da bat dau, khong the bo khoi don dang giao dich.`);
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
        throw new BadRequestException(`Luot luu tru ${current.id} da checkout hoac huy, khong the cap nhat lai tu POS.`);
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

  async syncGroupedHotelStay(
    tx: DatabaseService,
    params: {
      entries: Array<{ item: any; orderItem: any }>;
      order: { id: string; createdAt: Date };
      customerId?: string | null;
      branchId?: string | null;
    },
  ) {
    const groupedPlan = buildGroupedHotelStayPlan(params.entries);
    if (!groupedPlan) return [];

    const {
      sortedGroupItems,
      first,
      firstDetails,
      checkInDate,
      checkOutDate,
      totalPrice,
      totalDays,
      displayLineType,
      pricingSnapshot,
      breakdownSnapshot,
    } = groupedPlan;
    const branch = await resolveBranchIdentity(tx as any, firstDetails.branchId ?? params.branchId ?? null);
    const stayCode = await this.generateHotelStayCode(tx as any, params.order.createdAt, branch.code);
    const pet = await tx.pet.findUnique({ where: { id: firstDetails.petId } });

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

    if (overlap && overlap.id !== first.orderItem.hotelStayId) {
      throw new BadRequestException(`Thu cung da co luot luu tru dang hieu luc (${overlap.stayCode ?? overlap.id}).`);
    }

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
        lineType: displayLineType as any,
        price: totalPrice,
        dailyRate: firstDetails.dailyRate ?? first.item.unitPrice,
        depositAmount: firstDetails.depositAmount ?? 0,
        promotion: firstDetails.promotion ?? 0,
        surcharge: firstDetails.surcharge ?? 0,
        totalPrice,
        totalDays,
        rateTableId: firstDetails.rateTableId ?? null,
        notes: firstDetails.notes ?? null,
        orderId: params.order.id,
        status: 'BOOKED',
        paymentStatus: 'UNPAID',
        pricingSnapshot: pricingSnapshot as any,
        breakdownSnapshot: breakdownSnapshot as any,
      } as any,
    });

    for (const entry of sortedGroupItems) {
      await tx.orderItem.update({
        where: { id: entry.orderItem.id },
        data: {
          hotelStayId: stay.id,
          pricingSnapshot: this.orderItemService.buildHotelOrderItemPricingSnapshot(entry.item) as any,
        },
      });
    }

    return [`HOTEL_STAY:${stay.id}`, `HOTEL_CODE:${stayCode}`];
  }
}
