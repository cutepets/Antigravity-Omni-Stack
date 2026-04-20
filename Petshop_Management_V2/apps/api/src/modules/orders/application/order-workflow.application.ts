type DraftOrderItem = {
  unitPrice: number
  quantity: number
  discountItem?: number | null
  type?: string | null
  groomingDetails?: unknown
  hotelDetails?: unknown
}

type DraftOrderPayment = {
  amount: number
}

export function calculateOrderPaymentStatus(
  total: number,
  paidAmount: number,
): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (paidAmount <= 0) return 'UNPAID'
  if (paidAmount >= total) return 'PAID'
  return 'PARTIAL'
}

export function calculateOrderRemainingAmount(total: number, paidAmount: number) {
  return Math.max(0, total - paidAmount)
}

export function classifyDraftOrderType(items: DraftOrderItem[]) {
  const hasService = items.some(
    (item) => item.groomingDetails || item.hotelDetails || item.type === 'grooming' || item.type === 'hotel',
  )

  return hasService ? 'SERVICE' : 'QUICK'
}

export function buildCreateOrderDraft(params: {
  items: DraftOrderItem[]
  payments: DraftOrderPayment[]
  discount?: number
  shippingFee?: number
}) {
  const subtotal = params.items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity - (item.discountItem ?? 0)
  }, 0)

  const total = subtotal + (params.shippingFee ?? 0) - (params.discount ?? 0)
  const totalPaid = params.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const paymentStatus = calculateOrderPaymentStatus(total, totalPaid)
  const orderType = classifyDraftOrderType(params.items)
  const orderStatus = orderType === 'QUICK' && paymentStatus === 'PAID' ? 'COMPLETED' : 'PROCESSING'

  return {
    subtotal,
    total,
    totalPaid,
    paymentStatus,
    orderType,
    orderStatus,
    remainingAmount: calculateOrderRemainingAmount(total, totalPaid),
  }
}
