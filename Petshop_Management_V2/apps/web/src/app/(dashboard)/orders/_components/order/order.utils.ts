import type { CreateOrderPayload, UpdateOrderPayload } from '@/lib/api/order.api'
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
} from './order.constants'
import type { OrderDraft } from './order.types'
import { buildOrderRequestPayload } from '@/app/(dashboard)/_shared/order/order-payload.builder'
import { buildHotelDraftLineFields } from './order-hotel-line'
import { buildProductVariantName } from '@petshop/shared'

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

function getBranchStock(row: any) {
  return Number(row?.stock ?? 0)
}

function getBranchAvailable(row: any) {
  if (row?.availableStock !== undefined && row?.availableStock !== null) {
    return Math.max(0, Number(row.availableStock) || 0)
  }

  return Math.max(0, getBranchStock(row) - Number(row?.reservedStock ?? row?.reserved ?? 0))
}

function getOrderItemStockRows(item: any) {
  const variantRows = Array.isArray(item.productVariant?.branchStocks) ? item.productVariant.branchStocks : []
  if (item.productVariantId && variantRows.length > 0) return variantRows

  const matchedVariant = Array.isArray(item.product?.variants)
    ? item.product.variants.find((variant: any) => variant.id === item.productVariantId)
    : null
  const matchedVariantRows = Array.isArray(matchedVariant?.branchStocks) ? matchedVariant.branchStocks : []
  if (item.productVariantId && matchedVariantRows.length > 0) return matchedVariantRows

  return Array.isArray(item.product?.branchStocks)
    ? item.product.branchStocks
    : Array.isArray(item.branchStocks)
      ? item.branchStocks
      : []
}

export function buildDraftFromOrder(order: any): OrderDraft {
  return {
    branchId: order.branchId ?? undefined,
    customerId: order.customer?.id ?? undefined,
    customerName: order.customer?.name || order.customer?.fullName || order.customerName || 'Khach le',
    discount: Number(order.discount) || 0,
    shippingFee: Number(order.shippingFee) || 0,
    notes: order.notes || '',
    items: (order.items ?? []).map((item: any) => {
      const hotelFields = item.hotelDetails ? buildHotelDraftLineFields(item) : null
      const stockRows = getOrderItemStockRows(item)
      const productVariant = item.productVariant ?? null
      const variantName =
        item.variantName ??
        buildProductVariantName(
          item.product?.name ?? item.name ?? item.description,
          productVariant?.variantLabel,
          productVariant?.unitLabel,
        ) ??
        productVariant?.name ??
        undefined

      return {
        id: item.id,
        orderItemId: item.id,
        productId: item.productId ?? undefined,
        productVariantId: item.productVariantId ?? undefined,
        serviceId: item.serviceId ?? undefined,
        serviceVariantId: item.serviceVariantId ?? undefined,
        petId: item.petId ?? undefined,
        petName: item.petName ?? undefined,
        description: item.name || item.description || item.product?.name,
        sku: item.sku || productVariant?.sku || item.product?.sku || '',
        unitPrice: hotelFields?.unitPrice ?? (Number(item.unitPrice) || 0),
        discountItem: Number(item.discountItem) || 0,
        vatRate: Number(item.vatRate) || 0,
        type: item.type || 'product',
        image: item.image || '',
        unit: item.unit || productVariant?.unitLabel || item.product?.unit || 'cai',
        baseUnit: item.product?.unit ?? item.unit ?? undefined,
        quantity: hotelFields?.quantity ?? (Number(item.quantity) || 1),
        variantName,
        variantLabel: productVariant?.variantLabel ?? undefined,
        unitLabel: productVariant?.unitLabel ?? undefined,
        branchStocks: stockRows.length > 0 ? stockRows : undefined,
        variants: item.product?.variants ?? item.variants ?? undefined,
        stock: stockRows.length > 0 ? stockRows.reduce((sum: number, row: any) => sum + getBranchStock(row), 0) : item.product?.stock ?? item.stock ?? undefined,
        totalStock: stockRows.length > 0 ? stockRows.reduce((sum: number, row: any) => sum + getBranchStock(row), 0) : item.product?.totalStock ?? item.totalStock ?? item.product?.stock ?? item.stock ?? undefined,
        availableStock: stockRows.length > 0 ? stockRows.reduce((sum: number, row: any) => sum + getBranchAvailable(row), 0) : item.product?.availableStock ?? item.availableStock ?? undefined,
        trading: item.product?.trading ?? item.trading ?? undefined,
        isTemp: item.isTemp === true || (item.type === 'product' && !item.productId && !item.productVariantId),
        tempLabel: item.tempLabel ?? undefined,
        hotelStayId: hotelFields?.hotelStayId ?? item.hotelStayId ?? undefined,
        hotelStay: hotelFields?.hotelStay ?? item.hotelStay ?? undefined,

        hotelDetails: item.hotelDetails
          ? {
            petId: item.hotelDetails.petId,
            checkIn: hotelFields?.hotelDetails.checkIn ?? item.hotelDetails.checkInDate,
            checkOut: hotelFields?.hotelDetails.estimatedCheckOut ?? item.hotelDetails.checkOutDate,
            stayId: hotelFields?.hotelStayId ?? item.hotelStayId,
            stayCode: hotelFields?.hotelDetails.stayCode ?? null,
            status: hotelFields?.hotelDetails.status ?? null,
            checkedInAt: hotelFields?.hotelDetails.checkedInAt ?? null,
            estimatedCheckOut: hotelFields?.hotelDetails.estimatedCheckOut ?? null,
            checkOutActual: hotelFields?.hotelDetails.checkOutActual ?? null,
            lineType: item.hotelDetails.lineType ?? 'REGULAR',
            weightBandId: item.hotelDetails.weightBandId ?? item.hotelDetails.chargeWeightBandId ?? null,
            weightBandLabel: item.hotelDetails.weightBandLabel ?? item.hotelDetails.chargeWeightBandLabel ?? null,
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
      }
    }),
  }
}

export function buildDraftCopyFromOrder(order: any): OrderDraft {
  const draft = buildDraftFromOrder(order)

  return {
    ...draft,
    items: draft.items.map((item: any, index) => ({
      ...item,
      id: `${item.type || 'item'}:${item.productVariantId ?? item.productId ?? item.serviceVariantId ?? item.serviceId ?? 'copy'}:${index}`,
      orderItemId: undefined,
      hotelStayId: undefined,
      hotelStay: undefined,
      groomingSession: undefined,
      hotelDetails: item.hotelDetails
        ? {
          ...item.hotelDetails,
          stayId: undefined,
          stayCode: null,
          status: null,
          checkedInAt: null,
          checkOutActual: null,
        }
        : undefined,
    })),
  }
}

export function buildOrderPayload(draft: OrderDraft): CreateOrderPayload | UpdateOrderPayload {
  return buildOrderRequestPayload({
    customerId: draft.customerId,
    customerName: draft.customerName,
    branchId: draft.branchId,
    items: draft.items,
    discount: draft.discount,
    shippingFee: draft.shippingFee,
    notes: draft.notes,
  })
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
  const hasServiceItems = Array.isArray(order?.items)
    ? order.items.some((item: any) => (
      item?.type === 'service' ||
      item?.type === 'grooming' ||
      item?.type === 'hotel' ||
      Boolean(item?.groomingSessionId) ||
      Boolean(item?.hotelStayId)
    ))
    : false
  const isPaid = ['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '')
  return Boolean(
    canExportStock &&
    (
      ['CONFIRMED', 'PROCESSING'].includes(order?.status ?? '') ||
      (order?.status === 'PENDING' && isPaid && !hasServiceItems)
    ) &&
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
  if (!order || !canPayOrder) return false
  if (['CANCELLED', 'FULLY_REFUNDED'].includes(order.status ?? '')) return false
  return !['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '')
}

export function canRefundCurrentOrder(order: any, canRefundOrder: boolean) {
  return Boolean(canRefundOrder && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order?.status ?? ''))
}

export function canReturnCurrentOrder(order: any, hasPermission: boolean) {
  const hasReturnableProduct = (order?.items ?? []).some((item: any) => (
    item?.type === 'product' &&
    Number(item?.returnAvailability?.returnableQuantity ?? item?.quantity ?? 0) > 0
  ))
  return Boolean(hasPermission && ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(order?.status ?? '') && hasReturnableProduct)
}
