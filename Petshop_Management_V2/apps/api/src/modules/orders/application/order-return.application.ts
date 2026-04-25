type ReturnAction = 'EXCHANGE' | 'RETURN'

export type ReturnRequestItemInput = {
  orderItemId: string
  quantity: number
  action: string
  reason?: string | null
}

export type ReturnOrderItem = {
  id: string
  type?: string | null
  quantity: number
  unitPrice: number
  discountItem?: number | null
  description?: string | null
  sku?: string | null
  productVariantId?: string | null
}

export type ReturnCreditBreakdown = {
  totalCredit: number
  returnCredit: number
  exchangeCredit: number
}

export type ExchangeOrderItemInput = {
  type: string
  productId?: string | null
  isTemp?: boolean | null
  unitPrice: number
  quantity: number
  discountItem?: number | null
}

export type ApprovedReturnRequest = {
  items?: Array<{
    orderItemId: string
    quantity: number
    action?: string | null
  }>
}

export const DEFAULT_ORDER_RETURN_WINDOW_DAYS = 7

export function isReturnAction(value: string): value is ReturnAction {
  return value === 'EXCHANGE' || value === 'RETURN'
}

export function getReturnedUnitCredit(orderItem: ReturnOrderItem) {
  const quantity = Math.max(1, Number(orderItem.quantity ?? 1))
  return Number(orderItem.unitPrice ?? 0) - Number(orderItem.discountItem ?? 0) / quantity
}

export function calculateReturnCreditBreakdown(
  items: ReturnRequestItemInput[],
  orderItemMap: Map<string, ReturnOrderItem>,
): ReturnCreditBreakdown {
  return items.reduce<ReturnCreditBreakdown>(
    (breakdown, item) => {
      const orderItem = orderItemMap.get(item.orderItemId)
      if (!orderItem || !isReturnAction(item.action)) return breakdown

      const credit = Math.max(0, getReturnedUnitCredit(orderItem) * item.quantity)
      if (item.action === 'RETURN') {
        breakdown.returnCredit += credit
      } else {
        breakdown.exchangeCredit += credit
      }
      breakdown.totalCredit += credit
      return breakdown
    },
    { totalCredit: 0, returnCredit: 0, exchangeCredit: 0 },
  )
}

export function buildReturnedQuantityMap(returnRequests: ApprovedReturnRequest[]) {
  const quantityByItemId = new Map<string, number>()

  for (const request of returnRequests) {
    for (const item of request.items ?? []) {
      if (!isReturnAction(String(item.action ?? ''))) continue
      quantityByItemId.set(
        item.orderItemId,
        (quantityByItemId.get(item.orderItemId) ?? 0) + Number(item.quantity ?? 0),
      )
    }
  }

  return quantityByItemId
}

export function getReturnableQuantity(orderItem: ReturnOrderItem, returnedQuantityByItemId: Map<string, number>) {
  return Math.max(0, Number(orderItem.quantity ?? 0) - (returnedQuantityByItemId.get(orderItem.id) ?? 0))
}

export function buildCurrentReturnQuantityMap(items: ReturnRequestItemInput[]) {
  const quantityByItemId = new Map<string, number>()
  for (const item of items) {
    quantityByItemId.set(item.orderItemId, (quantityByItemId.get(item.orderItemId) ?? 0) + Number(item.quantity ?? 0))
  }
  return quantityByItemId
}

export function hasRemainingReturnableProductQuantity(
  orderItems: ReturnOrderItem[],
  returnedQuantityByItemId: Map<string, number>,
  currentQuantityByItemId = new Map<string, number>(),
) {
  return orderItems.some((item) => {
    if (item.type !== 'product') return false
    const consumed = (returnedQuantityByItemId.get(item.id) ?? 0) + (currentQuantityByItemId.get(item.id) ?? 0)
    return Math.max(0, Number(item.quantity ?? 0) - consumed) > 0
  })
}

export function resolveOrderReturnWindowDays(configValue: unknown) {
  if (configValue === null || configValue === undefined) return DEFAULT_ORDER_RETURN_WINDOW_DAYS
  const value = Number(configValue)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return DEFAULT_ORDER_RETURN_WINDOW_DAYS
  return value
}

export function isOrderReturnWindowExpired(params: {
  completedAt?: Date | string | null
  windowDays: number
  now: Date
}) {
  if (params.windowDays === 0) return false
  if (!params.completedAt) return false

  const completedAt = new Date(params.completedAt)
  if (Number.isNaN(completedAt.getTime())) return false

  const expiresAt = new Date(completedAt)
  expiresAt.setDate(expiresAt.getDate() + params.windowDays)
  return params.now.getTime() > expiresAt.getTime()
}

export function buildReturnItemSummary(
  items: ReturnRequestItemInput[],
  orderItemMap: Map<string, ReturnOrderItem>,
) {
  return items
    .map((item) => {
      const orderItem = orderItemMap.get(item.orderItemId)
      const action = item.action === 'EXCHANGE' ? 'DOI' : 'TRA'
      return `${action}: ${orderItem?.description ?? item.orderItemId} x${item.quantity}`
    })
    .join(', ')
}

export function resolveReturnRefundAmount(params: {
  hasReturn: boolean
  requestedRefundAmount?: number
  returnCredit: number
}) {
  if (!params.hasReturn) return 0
  return params.requestedRefundAmount ?? params.returnCredit
}

export function validateExchangeOrderItems(items: ExchangeOrderItemInput[]) {
  for (const item of items) {
    if (item.type !== 'product') {
      throw new Error('Chi ho tro doi sang san pham vat ly')
    }

    if (!item.productId && item.isTemp !== true) {
      throw new Error('San pham doi moi phai co productId')
    }
  }
}

export function calculateExchangeOrderSubtotal(items: ExchangeOrderItemInput[]) {
  return items.reduce((sum, item) => (
    sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0) - Number(item.discountItem ?? 0)
  ), 0)
}

export function resolveExchangeOrderPaymentStatus(params: { total: number; creditAmount: number }) {
  if (params.creditAmount <= 0) return 'UNPAID'
  if (params.creditAmount >= params.total) return 'PAID'
  return 'PARTIAL'
}

export function buildExchangeOrderData(params: {
  orderNumber: string
  sourceOrder: {
    id: string
    orderNumber: string
    customerId?: string | null
    customerName?: string | null
    branchId?: string | null
    customer?: { fullName?: string | null; name?: string | null } | null
  }
  staffId: string
  returnRequestId: string
  creditAmount: number
  subtotal?: number
  createdAt: Date
}) {
  const customerName = params.sourceOrder.customer?.fullName
    ?? params.sourceOrder.customer?.name
    ?? params.sourceOrder.customerName
    ?? 'Khach le'

  const subtotal = Math.max(0, Number(params.subtotal ?? 0))
  const total = subtotal

  return {
    orderNumber: params.orderNumber,
    customerId: params.sourceOrder.customerId,
    customerName,
    staffId: params.staffId,
    branchId: params.sourceOrder.branchId ?? null,
    status: 'PENDING',
    paymentStatus: resolveExchangeOrderPaymentStatus({ total, creditAmount: params.creditAmount }),
    subtotal,
    discount: 0,
    shippingFee: 0,
    total,
    paidAmount: params.creditAmount,
    remainingAmount: Math.max(0, total - params.creditAmount),
    creditAmount: params.creditAmount,
    linkedReturnId: params.returnRequestId,
    notes: `Don doi hang tu #${params.sourceOrder.orderNumber}. Credit duoc ap dung: ${params.creditAmount.toLocaleString('vi-VN')}d`,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  }
}
