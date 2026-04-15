import type { CartItem } from '@petshop/shared'
import type { CreateOrderPayload, UpdateOrderPayload } from '@/lib/api/order.api'
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_LABEL,
} from './order.constants'
import type { OrderDraft } from './order.types'

export function normalizeServiceText(value?: string) {
  return value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? ''
}

export function isHotelService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
  return (
    service?.pricingKind === 'HOTEL' ||
    serviceType === 'HOTEL' ||
    service?.suggestionKind === 'HOTEL' ||
    text.includes('hotel') ||
    text.includes('luu chuong')
  )
}

export function isGroomingService(service: any) {
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
  return (
    service?.pricingKind === 'GROOMING' ||
    serviceType === 'GROOMING' ||
    service?.suggestionKind === 'SPA' ||
    service?.packageCode !== undefined
  )
}

export function getOrderServiceId(service: any) {
  if (service?.serviceId) return service.serviceId
  return service?.entryType?.startsWith('pricing-') ? undefined : service?.id
}

export function inferSpaPackageCodeFromService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
  const hasBath = text.includes('tam')
  const hasClip = text.includes('cao') || text.includes('cat')
  const hasHygiene = text.includes('ve sinh')

  if (text.includes('spa')) return 'SPA'
  if (hasBath && hasClip && hasHygiene) return 'BATH_CLIP_HYGIENE'
  if (hasBath && hasHygiene) return 'BATH_HYGIENE'
  if (hasClip) return 'CLIP'
  if (hasBath) return 'BATH'
  if (hasHygiene) return 'HYGIENE'
  return undefined
}

export function buildCartLineId(
  type: 'product' | 'service' | 'hotel' | 'grooming',
  ...parts: Array<string | number | null | undefined>
) {
  return [type, ...parts.filter((part) => part !== undefined && part !== null && String(part).trim() !== '')]
    .map((part) => String(part).replace(/\s+/g, '-'))
    .join(':')
}

export function createEmptyDraft(branchId?: string): OrderDraft {
  return { branchId, customerName: 'Khach le', discount: 0, shippingFee: 0, notes: '', items: [] }
}

export function buildProductCartItem(product: any): CartItem {
  return {
    id: buildCartLineId('product', product.productId ?? product.id, product.productVariantId ?? 'base'),
    productId: product.productId ?? product.id,
    productVariantId: product.productVariantId,
    description: product.productName ?? product.name,
    sku: product.sku,
    quantity: 1,
    unitPrice: Number(product.sellingPrice ?? product.price ?? 0),
    discountItem: 0,
    vatRate: 0,
    type: 'product',
    unit: product.unit ?? 'cai',
    image: product.image,
    variantName: product.variantLabel ?? undefined,
    variants: product.variants ?? [],
  }
}

export function buildDirectServiceCartItem(service: any, petId?: string, petName?: string): CartItem {
  const itemType = isHotelService(service) ? 'hotel' : 'service'
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)

  return {
    id: buildCartLineId(itemType, service.id, petId),
    serviceId: getOrderServiceId(service),
    description: isHotelService(service)
      ? `Luu tru${service.weightBandLabel ? ` - ${service.weightBandLabel}` : ''}`
      : service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: itemType,
    image: service.image,
    unit: itemType === 'hotel' ? 'ngay' : 'lan',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
    petName,
  }
}

export function buildGroomingCartItem(service: any, petId?: string, petName?: string): CartItem {
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)
  const packageCode = service?.packageCode ?? inferSpaPackageCodeFromService(service)
  const petWeight = Number(service?.petSnapshot?.weight ?? Number.NaN)
  const pricingSnapshot =
    service?.pricingSnapshot ??
    (service?.pricingRuleId || service?.weightBandId
      ? {
          pricingRuleId: service?.pricingRuleId,
          packageCode,
          weightBandId: service?.weightBandId ?? null,
          weightBandLabel: service?.weightBandLabel ?? null,
          price: unitPrice,
        }
      : undefined)

  return {
    id: buildCartLineId('grooming', service.id, petId),
    serviceId: getOrderServiceId(service),
    description: service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: 'grooming',
    image: service.image,
    unit: 'lan',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
    petName,
    groomingDetails: petId
      ? {
          petId,
          packageCode,
          serviceItems: service?.name,
          weightAtBooking: Number.isFinite(petWeight) ? petWeight : undefined,
          weightBandId: service?.weightBandId,
          weightBandLabel: service?.weightBandLabel,
          pricingPrice: unitPrice,
          pricingSnapshot,
        }
      : undefined,
  }
}

export function parseDecimalInput(value: string, fallback = 0) {
  const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getCartQuantityStep(item: { type?: string }) {
  return item.type === 'hotel' ? 0.5 : 1
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
            notes: item.groomingDetails.notes,
            serviceItems: item.groomingDetails.serviceItems,
            packageCode: item.groomingDetails.packageCode,
            weightAtBooking: item.groomingDetails.weightAtBooking,
            weightBandId: item.groomingDetails.weightBandId,
            weightBandLabel: item.groomingDetails.weightBandLabel,
            pricingPrice: item.groomingDetails.pricingPrice,
            pricingSnapshot: item.groomingDetails.pricingSnapshot,
          }
        : undefined,
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
      serviceId: item.serviceId,
      serviceVariantId: item.serviceVariantId,
      petId: item.petId,
      description: item.description,
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      discountItem: Number(item.discountItem) || 0,
      vatRate: Number(item.vatRate) || 0,
      type: item.type,
      groomingDetails: item.groomingDetails
        ? {
            petId: item.groomingDetails.petId,
            performerId: item.groomingDetails.performerId,
            startTime: item.groomingDetails.startTime,
            notes: item.groomingDetails.notes,
            serviceItems: item.groomingDetails.serviceItems,
            packageCode: item.groomingDetails.packageCode,
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

export function canApproveCurrentOrder(order: any, canApproveOrder: boolean) {
  return Boolean(canApproveOrder && order?.status === 'PENDING')
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
