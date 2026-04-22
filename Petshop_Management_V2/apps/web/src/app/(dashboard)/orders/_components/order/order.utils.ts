import type { CreateOrderPayload, UpdateOrderPayload } from '@/lib/api/order.api'
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
} from './order.constants'
import type { OrderDraft } from './order.types'

// ─── Re-exports from shared layer ────────────────────────────────────────────
// These were duplicated here — now the source of truth lives in _shared/cart/
export {
  normalizeServiceText,
  isHotelService,
  isGroomingService,
  isCatalogService,
  getOrderServiceId,
  inferSpaPackageCodeFromService,
  getCartQuantityStep,
  parseCartQuantityInput,
} from '@/app/(dashboard)/_shared/cart/cart.utils'

export {
  buildCartLineId,
  buildProductCartItem,
  buildDirectServiceCartItem,
  buildGroomingCartItem,
  buildServiceCartItem,
} from '@/app/(dashboard)/_shared/cart/cart.builders'

export { parseDecimalInput } from '@/app/(dashboard)/_shared/payment/payment.utils'

export function createEmptyDraft(branchId?: string): OrderDraft {
  return { branchId, customerName: 'Khach le', discount: 0, shippingFee: 0, notes: '', items: [] }
}


export function getPaymentStatusMeta(status?: string) {
  if (!status) return { className: 'badge badge-ghost', label: '--' }
  return {
    className: PAYMENT_STATUS_BADGE[status] ?? 'badge badge-gray',
    label: PAYMENT_STATUS_LABEL[status] ?? status,
  }
}

export function getOrderStatusMeta(status?: string) {
  if (!status) return { className: 'badge badge-ghost', label: '--' }
  return {
    className: ORDER_STATUS_BADGE[status] ?? 'badge badge-gray',
    label: ORDER_STATUS_LABEL[status] ?? status,
  }
}

export function buildDraftFromOrder(order: any): OrderDraft {
  return {
    branchId: order.branchId ?? undefined,
    customerId: order.customer?.id ?? undefined,
    customerName: order.customer?.name || order.customer?.fullName || order.customerName || 'Khach le',
    discount: Number(order.discount) || 0,
    shippingFee: Number(order.shippingFee) || 0,
    notes: order.notes || '',
    items: (order.items ?? []).map((item: any) => ({
      id: item.id,
      orderItemId: item.id,
      productId: item.productId ?? undefined,
      productVariantId: item.productVariantId ?? undefined,
      serviceId: item.serviceId ?? undefined,
      serviceVariantId: item.serviceVariantId ?? undefined,
      petId: item.petId ?? undefined,
      petName: item.petName ?? undefined,
      description: item.name || item.description,
      sku: item.sku || '',
      unitPrice: Number(item.unitPrice) || 0,
      discountItem: Number(item.discountItem) || 0,
      vatRate: Number(item.vatRate) || 0,
      type: item.type || 'product',
      image: item.image || '',
      unit: item.unit || 'cai',
      quantity: Number(item.quantity) || 1,
      variantName: item.variantName ?? undefined,
      // Stock fields cho StockBranchPopover
      branchStocks: item.product?.branchStocks ?? item.branchStocks ?? undefined,
      variants: item.product?.variants ?? item.variants ?? undefined,
      stock: item.product?.stock ?? item.stock ?? undefined,
      totalStock: item.product?.totalStock ?? item.totalStock ?? item.product?.stock ?? item.stock ?? undefined,
      availableStock: item.product?.availableStock ?? item.availableStock ?? undefined,
      trading: item.product?.trading ?? item.trading ?? undefined,
      isTemp: item.isTemp === true || (item.type === 'product' && !item.productId && !item.productVariantId),
      tempLabel: item.tempLabel ?? undefined,

      hotelDetails: item.hotelDetails
        ? {
          petId: item.hotelDetails.petId,
          checkIn: item.hotelDetails.checkInDate,
          checkOut: item.hotelDetails.checkOutDate,
          stayId: item.hotelStayId,
          lineType: item.hotelDetails.lineType ?? 'REGULAR',
          bookingGroupKey: item.hotelDetails.bookingGroupKey,
          chargeLineIndex: item.hotelDetails.chargeLineIndex,
          chargeLineLabel: item.hotelDetails.chargeLineLabel,
          chargeDayType: item.hotelDetails.chargeDayType,
          chargeQuantityDays: item.hotelDetails.chargeQuantityDays,
          chargeUnitPrice: item.hotelDetails.chargeUnitPrice,
          chargeSubtotal: item.hotelDetails.chargeSubtotal,
          chargeWeightBandId: item.hotelDetails.chargeWeightBandId ?? null,
          chargeWeightBandLabel: item.hotelDetails.chargeWeightBandLabel ?? null,
        }
        : undefined,
      groomingDetails: item.groomingDetails
        ? {
          petId: item.groomingDetails.petId,
          performerId: item.groomingDetails.performerId,
          startTime: item.groomingDetails.startTime,
          scheduledDate: item.groomingDetails.scheduledDate,
          notes: item.groomingDetails.notes,
          serviceItems: item.groomingDetails.serviceItems,
          packageCode: item.groomingDetails.packageCode,
          serviceRole: item.groomingDetails.serviceRole,
          pricingRuleId: item.groomingDetails.pricingRuleId,
          durationMinutes: item.groomingDetails.durationMinutes,
          weightAtBooking: item.groomingDetails.weightAtBooking,
          weightBandId: item.groomingDetails.weightBandId,
          weightBandLabel: item.groomingDetails.weightBandLabel,
          pricingPrice: item.groomingDetails.pricingPrice,
          pricingSnapshot: item.groomingDetails.pricingSnapshot,
        }
        : undefined,
      // groomingSession: chỉ để hiển thị badge status ở FE, không gửi lên BE
      groomingSession: item.groomingSession ?? undefined,
    })),
  }
}

export function buildOrderPayload(draft: OrderDraft): CreateOrderPayload | UpdateOrderPayload {
  return {
    customerId: draft.customerId || undefined,
    customerName: draft.customerName.trim() || 'Khach le',
    branchId: draft.branchId || undefined,
    items: draft.items.map((item) => ({
      id: (item as any).orderItemId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      sku: item.sku,
      serviceId: item.serviceId,
      serviceVariantId: item.serviceVariantId,
      petId: item.petId,
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      discountItem: Number(item.discountItem) || 0,
      vatRate: Number(item.vatRate) || 0,
      type: item.type,
      isTemp: (item as any).isTemp ?? false,
      tempLabel: (item as any).tempLabel ?? undefined,
      groomingDetails: item.groomingDetails
        ? {
          petId: item.groomingDetails.petId,
          performerId: item.groomingDetails.performerId,
          startTime: item.groomingDetails.startTime,
          scheduledDate: item.groomingDetails.scheduledDate,
          notes: item.groomingDetails.notes,
          serviceItems: item.groomingDetails.serviceItems,
          packageCode: item.groomingDetails.packageCode,
          serviceRole: item.groomingDetails.serviceRole,
          pricingRuleId: item.groomingDetails.pricingRuleId,
          durationMinutes: item.groomingDetails.durationMinutes,
          weightAtBooking: item.groomingDetails.weightAtBooking,
          weightBandId: item.groomingDetails.weightBandId,
          weightBandLabel: item.groomingDetails.weightBandLabel,
          pricingPrice: item.groomingDetails.pricingPrice,
          pricingSnapshot: item.groomingDetails.pricingSnapshot,
        }
        : undefined,
      hotelDetails: item.hotelDetails
        ? {
          petId: item.hotelDetails.petId,
          checkInDate: item.hotelDetails.checkIn,
          checkOutDate: item.hotelDetails.checkOut,
          branchId: draft.branchId,
          lineType: item.hotelDetails.lineType,
          bookingGroupKey: item.hotelDetails.bookingGroupKey,
          chargeLineIndex: item.hotelDetails.chargeLineIndex,
          chargeLineLabel: item.hotelDetails.chargeLineLabel,
          chargeDayType: item.hotelDetails.chargeDayType,
          chargeQuantityDays: item.hotelDetails.chargeQuantityDays,
          chargeUnitPrice: item.hotelDetails.chargeUnitPrice,
          chargeSubtotal: item.hotelDetails.chargeSubtotal,
          chargeWeightBandId: item.hotelDetails.chargeWeightBandId ?? undefined,
          chargeWeightBandLabel: item.hotelDetails.chargeWeightBandLabel ?? undefined,
        }
        : undefined,
    })),
    discount: Number(draft.discount) || 0,
    shippingFee: Number(draft.shippingFee) || 0,
    notes: draft.notes.trim() || undefined,
  }
}

export function isOrderReadonly(status?: string) {
  return ['COMPLETED', 'CANCELLED'].includes(status ?? '')
}

export function canCancelCurrentOrder(order: any, hasCancelPermission: boolean) {
  if (!order || !hasCancelPermission) return false
  if (['CANCELLED', 'COMPLETED', 'FULLY_REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status)) return false
  if (order.stockExportedAt) return false
  if (['PAID', 'PARTIAL', 'COMPLETED'].includes(order.paymentStatus) || order.paidAmount > 0) return false
  return true
}


export function canExportCurrentOrder(order: any, canExportStock: boolean) {
  return Boolean(
    canExportStock &&
    ['CONFIRMED', 'PROCESSING'].includes(order?.status ?? '') &&
    !order?.stockExportedAt,
  )
}

export function canSettleCurrentOrder(
  order: any,
  canSettleOrder: boolean,
  hasServiceItems: boolean,
) {
  return Boolean(
    canSettleOrder &&
    order?.status === 'PROCESSING' &&
    Boolean(order?.stockExportedAt) &&
    ['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '') &&
    hasServiceItems,
  )
}

export function canPayCurrentOrder(order: any, canPayOrder: boolean) {
  return Boolean(canPayOrder && !['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? ''))
}

export function canRefundCurrentOrder(order: any, canRefundOrder: boolean) {
  return Boolean(canRefundOrder && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order?.status ?? ''))
}

export function canReturnCurrentOrder(order: any, hasPermission: boolean) {
  return Boolean(hasPermission && order?.status === 'COMPLETED')
}
