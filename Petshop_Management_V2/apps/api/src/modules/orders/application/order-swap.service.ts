import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtPayload } from '@petshop/shared';
import { DatabaseService } from '../../../database/database.service.js';
import { OrderAccessService } from '../domain/order-access.service.js';
import { OrderItemService } from '../domain/order-item.service.js';
import { OrderPaymentHelperService } from '../domain/order-payment-helper.service.js';
import { SwapGroomingServiceDto } from '../dto/swap-grooming-service.dto.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderQueryService } from './order-query.service.js';
import { OrderServiceSyncService } from './order-service-sync.service.js';
import { OrderTimelineService } from './order-timeline.service.js';
import {
  getSpaPricingSku,
  isSpaRuleSpeciesMatch,
  isWeightInRange,
  normalizeSpaPackageCode,
} from './order-grooming-swap.application.js';

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>;

@Injectable()
export class OrderSwapService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly accessService: OrderAccessService,
    private readonly orderItemService: OrderItemService,
    private readonly paymentHelperService: OrderPaymentHelperService,
    private readonly paymentService: OrderPaymentService,
    private readonly queryService: OrderQueryService,
    private readonly syncService: OrderServiceSyncService,
    private readonly timelineService: OrderTimelineService,
  ) {}

  private assertOrderScope(order: { branchId?: string | null }, user?: AccessUser) {
    this.accessService.assertOrderScope(order, user);
  }

  private calculatePaymentStatus(total: number, paidAmount: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
    return this.paymentHelperService.calculatePaymentStatus(total, paidAmount);
  }

  private calculateRemainingAmount(total: number, paidAmount: number): number {
    return this.paymentHelperService.calculateRemainingAmount(total, paidAmount);
  }

  private async decrementStockForItem(
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

    await prismaOrTx.productVariant.update({
      where: { id: productVariantId },
      data: { stockQuantity: { decrement: quantity } },
    });

    await prismaOrTx.orderItem.update({
      where: { id: orderItemId },
      data: {
        stockExportedAt: exportedAt,
        stockExportedBy: exportedBy,
      } as any,
    });
  }

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
    if (!order) throw new NotFoundException('Khong tim thay don hang');
    if (order.status === 'CANCELLED') throw new BadRequestException('Don hang da bi huy');

    const item = order.items.find((entry) => entry.id === itemId);
    if (!item) throw new NotFoundException('Khong tim thay dong hang');
    const isTempItem = (item as any).isTemp === true || (item.type === 'product' && !item.productId && !item.productVariantId);
    if (!isTempItem) throw new BadRequestException('Dong hang nay khong phai san pham tam');

    const realVariant = await this.prisma.productVariant.findUnique({
      where: { id: dto.realProductVariantId },
      include: { product: true },
    });
    if (!realVariant) throw new NotFoundException('Khong tim thay bien the san pham');
    if (realVariant.productId !== dto.realProductId) {
      throw new BadRequestException('productId va productVariantId khong khop');
    }

    if (Math.abs(realVariant.price - item.unitPrice) > 0.01) {
      throw new BadRequestException(
        `Gia san pham that (${realVariant.price.toLocaleString('vi-VN')}d) phai bang gia san pham tam (${item.unitPrice.toLocaleString('vi-VN')}d)`,
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
    if (order.stockExportedAt) {
      await this.decrementStockForItem(this.prisma, {
        orderItemId: itemId,
        productVariantId: dto.realProductVariantId,
        quantity: item.quantity,
        exportedBy: staffId,
        exportedAt: swapAt,
      });
    }

    await this.timelineService.createTimelineEntry({
      orderId,
      action: 'ITEM_SWAPPED',
      note:
        `Doi SP tam "${oldLabel}" -> "${newDescription}"` +
        (order.stockExportedAt ? ` (da tru kho ${item.quantity} x ${newDescription})` : ' (chua xuat kho - se tru khi xuat)'),
      performedBy: staffId,
    });

    return this.queryService.findOne(orderId, user);
  }

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
    if (this.orderItemService.getGroomingOrderItemRole(item) === 'EXTRA') {
      throw new BadRequestException('Chi duoc doi dich vu chinh, khong doi dich vu khac');
    }
    if (!item.groomingSessionId) {
      throw new BadRequestException('Dong dich vu nay chua lien ket voi phieu SPA');
    }

    const currentSnapshot = this.orderItemService.getGroomingOrderItemSnapshot(item);
    const currentPricingRuleId = String(currentSnapshot.pricingRuleId ?? currentSnapshot.pricingSnapshot?.pricingRuleId ?? '').trim();
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

    const petId = String(item.petId ?? currentSnapshot.petId ?? currentSnapshot.pricingSnapshot?.petId ?? '').trim();
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
    const currentLineTotal = Math.max(0, Number(item.subtotal ?? (Number(item.unitPrice ?? 0) * quantity - currentDiscount)));
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
        ? await this.paymentService.resolvePaymentAccount(
            tx as any,
            dto.refundMethod ?? 'CASH',
            dto.refundPaymentAccountId,
          )
        : null;

      if (overpaidAmount > 0 && !refundPaymentAccount?.paymentMethod) {
        throw new BadRequestException('Khong xac dinh duoc phuong thuc hoan tien');
      }

      const sku = targetRule.sku ?? getSpaPricingSku(targetRule.packageCode, packageLabel, targetRule.weightBand?.label);
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

      await this.syncService.refreshGroomingSessionFromOrderItems(tx as any, item.groomingSessionId!);

      await tx.groomingSession.update({
        where: { id: item.groomingSessionId! },
        data: {
          timeline: {
            create: {
              action: 'Doi goi dich vu theo don',
              fromStatus: linkedSession.status,
              toStatus: linkedSession.status,
              note:
                `${linkedSession.packageCode ?? item.description} -> ${packageLabel} (don ${order.orderNumber})` +
                (dto.note?.trim() ? ` - Ly do: ${dto.note.trim()}` : ''),
              performedBy: staffId,
            },
          },
        } as any,
      });

      let finalPaidAmount = paidAmount;
      if (overpaidAmount > 0) {
        await this.paymentService.createOrderTransaction(tx as any, {
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
          paymentAccountLabel: dto.refundPaymentAccountLabel?.trim() || refundPaymentAccount?.paymentAccountLabel || null,
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

      await this.timelineService.createTimelineEntry(
        {
          orderId: order.id,
          action: 'ITEM_SWAPPED',
          note:
            `Doi goi SPA "${item.description}" -> "${packageLabel}"` +
            (nextLineTotal !== currentLineTotal
              ? ` (${currentLineTotal.toLocaleString('vi-VN')}d -> ${nextLineTotal.toLocaleString('vi-VN')}d)`
              : ''),
          performedBy: staffId,
        },
        tx as any,
      );
    });

    return this.queryService.findOne(orderId, user);
  }
}
