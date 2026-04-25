import type { CartItem } from '@petshop/shared'
import type {
  CreateOrderPayload,
  PayOrderPayload,
  UpdateOrderPayload,
} from '@/lib/api/order.api'

type OrderPaymentPayload = PayOrderPayload['payments'][number]

type BuildOrderRequestPayloadParams = {
  customerId?: string
  customerName?: string
  branchId?: string
  items: CartItem[]
  discount?: number
  shippingFee?: number
  notes?: string
  payments?: OrderPaymentPayload[]
}

export function buildOrderRequestPayload(
  params: BuildOrderRequestPayloadParams,
): CreateOrderPayload | UpdateOrderPayload {
  return {
    customerId: params.customerId || undefined,
    customerName: params.customerName?.trim() || 'Khach le',
    branchId: params.branchId || undefined,
    items: params.items.map((item) => ({
      id: (item as any).orderItemId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      sku: item.sku,
      serviceId: item.serviceId && item.serviceId !== 'EXTERNAL' ? item.serviceId : undefined,
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
            branchId: params.branchId,
            lineType: item.hotelDetails.lineType,
            weightBandId: item.hotelDetails.weightBandId ?? undefined,
            weightBandLabel: item.hotelDetails.weightBandLabel ?? undefined,
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
    payments: params.payments,
    discount: Number(params.discount) || 0,
    shippingFee: Number(params.shippingFee) || 0,
    notes: params.notes?.trim() || undefined,
  }
}
