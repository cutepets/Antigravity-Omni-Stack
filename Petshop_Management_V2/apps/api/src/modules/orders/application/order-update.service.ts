import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { resolveBranchIdentity } from '../../../common/utils/branch-identity.util.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderNumberingService } from '../domain/order-numbering.service.js';
import { OrderPaymentHelperService } from '../domain/order-payment-helper.service.js';
import { UpdateOrderDto } from '../dto/update-order.dto.js';
import { buildGroupedHotelStayPlan } from './order-hotel-sync.application.js';
import { OrderQueryService } from './order-query.service.js';
import { OrderServiceSyncService } from './order-service-sync.service.js';
import { PromotionApplicationService } from '../../promotions/promotion-application.service.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderUpdateService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly orderItemService: OrderItemService,
    private readonly numberingService: OrderNumberingService,
    private readonly paymentHelperService: OrderPaymentHelperService,
    private readonly queryService: OrderQueryService,
    private readonly syncService: OrderServiceSyncService,
    private readonly promotionApplication?: PromotionApplicationService,
  ) {}

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  private calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    return this.paymentHelperService.calculatePaymentStatus(total, paidAmount);
  }

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

    if (!order) throw new NotFoundException('Khong tim thay don hang');
    id = order.id;

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException('Khong the sua don da hoan tat hoac da huy');
    }
    if (!data.items?.length) {
      throw new BadRequestException('Don hang phai co it nhat 1 san pham hoac dich vu');
    }

    for (const item of data.items) {
      if (item.groomingDetails && item.hotelDetails) {
        throw new BadRequestException(`Item "${item.description}" khong the vua la spa vua la hotel`);
      }
    }

    const promotionDraft = this.promotionApplication
      ? await this.promotionApplication.applyToOrderDraft({
      branchId: data.branchId ?? null,
      customerId: data.customerId ?? null,
      items: data.items as any,
      manualDiscount: data.manualDiscount ?? data.discount ?? 0,
      voucherCode: data.voucherCode ?? null,
    })
      : {
        result: { enabled: false, previewToken: '', promotionDiscount: 0 } as any,
        discount: data.discount ?? 0,
        promotionDiscount: 0,
        manualDiscount: data.discount ?? 0,
        items: data.items,
      };
    const orderItems = promotionDraft.items as UpdateOrderDto['items'];
    const discount = promotionDraft.discount;
    const shippingFee = data.shippingFee ?? 0;
    const subtotal = this.orderItemService.calculateOrderSubtotal(orderItems);
    const total = subtotal + shippingFee - discount;
    const paymentStatus = this.calculatePaymentStatus(total, order.paidAmount);

    await this.prisma.$transaction(async (tx) => {
      const normalizedItems = await this.orderItemService.validateAndNormalizeCreateItems(tx as any, orderItems);
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

        await this.syncService.syncGroomingSession(tx as any, {
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
        await this.syncService.syncHotelStay(tx as any, {
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
        const itemData = this.orderItemService.buildOrderItemData(item);
        const existingItem = item.id ? existingById.get(item.id) : null;

        if (existingItem) {
          await tx.orderItem.update({
            where: { id: existingItem.id },
            data: itemData,
          });

          await this.syncService.syncGroomingSession(tx as any, {
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
            await this.syncService.syncHotelStay(tx as any, {
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

        await this.syncService.syncGroomingSession(tx as any, {
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
          await this.syncService.syncHotelStay(tx as any, {
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
        const groupedPlan = buildGroupedHotelStayPlan(groupItems);
        if (!groupedPlan) continue;

        const {
          sortedGroupItems,
          first,
          firstDetails,
          checkInDate,
          checkOutDate,
          totalPrice,
          displayLineType,
          pricingSnapshot,
          breakdownSnapshot,
        } = groupedPlan;
        const existingStayId = sortedGroupItems.find((entry) => entry.existingStayId)?.existingStayId ?? null;
        const branch = await resolveBranchIdentity(tx as any, firstDetails.branchId ?? data.branchId ?? null);
        const pet = await tx.pet.findUnique({ where: { id: firstDetails.petId } });
        const checkInNow = sortedGroupItems.some((entry) => entry.item.hotelDetails?.checkInNow === true);
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
          dailyRate: firstDetails.dailyRate ?? first.item.unitPrice,
          depositAmount: firstDetails.depositAmount ?? 0,
          promotion: firstDetails.promotion ?? 0,
          surcharge: firstDetails.surcharge ?? 0,
          totalPrice,
          rateTableId: firstDetails.rateTableId ?? null,
          notes: firstDetails.notes ?? null,
          orderId: id,
          pricingSnapshot: pricingSnapshot as any,
          breakdownSnapshot: breakdownSnapshot as any,
          ...(checkInNow ? { status: 'CHECKED_IN' as const, checkedInAt: new Date() } : {}),
        };

        let stayId = existingStayId;
        if (stayId) {
          const currentStay = await tx.hotelStay.findUnique({ where: { id: stayId } });
          if (currentStay && !['BOOKED', 'CHECKED_IN'].includes(currentStay.status)) {
            throw new BadRequestException(`Luot luu tru ${currentStay.id} da checkout hoac huy, khong the cap nhat lai tu POS.`);
          }
          await tx.hotelStay.update({
            where: { id: stayId },
            data: stayPayload as any,
          });
        } else {
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
            throw new BadRequestException(`Thu cung da co luot luu tru dang hieu luc (${overlap.stayCode ?? overlap.id}).`);
          }

          const stayCode = await this.numberingService.generateHotelStayCode(tx as any, order.createdAt, branch.code);
          const createdStay = await tx.hotelStay.create({
            data: {
              stayCode,
              ...stayPayload,
              status: checkInNow ? 'CHECKED_IN' : 'BOOKED',
              paymentStatus: 'UNPAID',
            } as any,
          });
          stayId = createdStay.id;
        }

        for (const entry of sortedGroupItems) {
          await tx.orderItem.update({
            where: { id: entry.orderItem.id },
            data: {
              hotelStayId: stayId,
              pricingSnapshot: this.orderItemService.buildHotelOrderItemPricingSnapshot(entry.item) as any,
            },
          });
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          customerName: data.customerName,
          customerId: data.customerId ?? null,
          branchId: data.branchId ?? null,
          subtotal,
          discount,
          manualDiscount: promotionDraft.manualDiscount,
          promotionDiscount: promotionDraft.promotionDiscount,
          promotionSnapshot: promotionDraft.result as any,
          promotionPreviewToken: promotionDraft.result.previewToken,
          shippingFee,
          total,
          remainingAmount: Math.max(0, total - order.paidAmount),
          paymentStatus: paymentStatus as any,
          notes: data.notes ?? null,
        } as any,
      });

      await this.promotionApplication?.recordRedemptions(tx as any, {
        order: {
          id,
          orderNumber: order.orderNumber,
          customerId: data.customerId ?? null,
          branchId: data.branchId ?? null,
        },
        staffId,
        preview: promotionDraft.result,
      });
    });

    return this.queryService.findOne(id, user);
  }
}
