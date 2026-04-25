import { Injectable } from '@nestjs/common';
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
  calculateOrderSubtotal(items: Array<{ unitPrice: number; quantity: number; discountItem?: number }>) {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity - (item.discountItem ?? 0), 0);
  }

  buildOrderItemData(item: CreateOrderDto['items'][number] | UpdateOrderItemDto) {
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
      sku: 'sku' in item ? item.sku ?? null : null,
      serviceId: item.serviceId ?? null,
      serviceVariantId: item.serviceVariantId ?? null,
      petId: item.petId ?? null,
      isTemp: item.isTemp ?? false,
      tempLabel: item.tempLabel ?? null,
    };
  }
}
