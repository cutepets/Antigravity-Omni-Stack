import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { UpdateOrderItemDto } from '../dto/update-order.dto.js';

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

@Injectable()
export class OrderItemService {
  buildHotelOrderItemPricingSnapshot(item: {
    description: string;
    quantity: number;
    unitPrice: number;
    discountItem?: number;
    hotelDetails?: any;
  }) {
    return buildHotelOrderItemPricingSnapshot(item);
  }

  buildGroomingOrderItemPricingSnapshot(item: {
    description: string;
    quantity: number;
    unitPrice: number;
    discountItem?: number;
    sku?: string | null;
    groomingDetails?: any;
  }) {
    return buildGroomingOrderItemPricingSnapshot(item);
  }

  getGroomingOrderItemSnapshot(item: any) {
    return ((item?.pricingSnapshot as Record<string, any> | null) ?? {}) as Record<string, any>;
  }

  getGroomingOrderItemRole(item: any): 'MAIN' | 'EXTRA' {
    const details = item?.groomingDetails ?? null;
    const snapshot = details?.pricingSnapshot ?? this.getGroomingOrderItemSnapshot(item);
    return details?.serviceRole === 'EXTRA' || snapshot?.serviceRole === 'EXTRA' ? 'EXTRA' : 'MAIN';
  }

  calculateOrderSubtotal(items: Array<{ unitPrice: number; quantity: number; discountItem?: number }>) {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity - (item.discountItem ?? 0), 0);
  }

  async validateAndNormalizeCreateItems<
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

  buildOrderItemData(item: CreateOrderDto['items'][number] | UpdateOrderItemDto) {
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountItem: item.discountItem ?? 0,
      promotionDiscount: (item as any).promotionDiscount ?? 0,
      promotionSnapshot: (item as any).promotionSnapshot ?? null,
      promotionRedemptionId: (item as any).promotionRedemptionId ?? null,
      isPromotionGift: (item as any).isPromotionGift ?? false,
      vatRate: item.vatRate ?? 0,
      subtotal: item.unitPrice * item.quantity - (item.discountItem ?? 0),
      pricingSnapshot: (this.buildHotelOrderItemPricingSnapshot(item) ?? this.buildGroomingOrderItemPricingSnapshot(item)) as any,
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
}
