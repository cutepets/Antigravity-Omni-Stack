export type OrderPaymentIntentView = {
  id: string
  code: string
  orderId?: string | null
  paymentMethodId: string
  amount: number
  currency: string
  status: 'PENDING' | 'PAID' | 'EXPIRED'
  provider?: 'VIETQR' | null
  transferContent: string
  qrUrl?: string | null
  qrPayload?: string | null
  expiresAt?: Date | null
  paidAt?: Date | null
  createdAt: Date
  updatedAt: Date
  paymentMethod: {
    id: string
    name: string
    type: string
    colorKey?: string | null
    bankName?: string | null
    accountNumber?: string | null
    accountHolder?: string | null
    qrTemplate?: string | null
  }
  order?: {
    id: string
    orderNumber: string
    total: number
    paidAmount: number
    remainingAmount: number
    customerName?: string | null
  } | null
}

export function mapOrderPaymentIntentView(paymentIntent: any): OrderPaymentIntentView {
  return {
    id: paymentIntent.id,
    code: paymentIntent.code,
    orderId: paymentIntent.orderId ?? null,
    paymentMethodId: paymentIntent.paymentMethodId,
    amount: Number(paymentIntent.amount) || 0,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    provider: paymentIntent.provider ?? null,
    transferContent: paymentIntent.transferContent,
    qrUrl: paymentIntent.qrUrl ?? null,
    qrPayload: paymentIntent.qrPayload ?? null,
    expiresAt: paymentIntent.expiresAt ?? null,
    paidAt: paymentIntent.paidAt ?? null,
    createdAt: paymentIntent.createdAt,
    updatedAt: paymentIntent.updatedAt,
    paymentMethod: {
      id: paymentIntent.paymentMethod.id,
      name: paymentIntent.paymentMethod.name,
      type: paymentIntent.paymentMethod.type,
      colorKey: paymentIntent.paymentMethod.colorKey ?? null,
      bankName: paymentIntent.paymentMethod.bankName ?? null,
      accountNumber: paymentIntent.paymentMethod.accountNumber ?? null,
      accountHolder: paymentIntent.paymentMethod.accountHolder ?? null,
      qrTemplate: paymentIntent.paymentMethod.qrTemplate ?? null,
    },
    order: paymentIntent.order
      ? {
          id: paymentIntent.order.id,
          orderNumber: paymentIntent.order.orderNumber,
          total: Number(paymentIntent.order.total) || 0,
          paidAmount: Number(paymentIntent.order.paidAmount) || 0,
          remainingAmount: Number(paymentIntent.order.remainingAmount) || 0,
          customerName: paymentIntent.order.customerName ?? null,
        }
      : null,
  }
}
