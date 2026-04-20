type FinanceTransactionType = 'INCOME' | 'EXPENSE'
type FinanceTransactionSource = 'ORDER_PAYMENT' | 'ORDER_ADJUSTMENT'

type OrderRef = {
  id: string
  orderNumber: string
  branchId?: string | null
  customerId?: string | null
  customerName?: string | null
}

type OrderPaymentRecord = {
  method: string
  amount: number
  note?: string | null
  paymentAccountId?: string | null
  paymentAccountLabel?: string | null
}

type FinanceWriter = {
  transaction: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>
  }
  orderPayment?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>
  }
}

type FinanceDeps = {
  generateVoucherNumber: (type: FinanceTransactionType) => Promise<string>
  buildServiceTraceTags: (parts: string[]) => string | null
  mergeTransactionNotes: (note: string | null | undefined, parts: string[]) => string | null
  getPaymentLabel?: (method: string) => string
}

type CreateOrderFinanceTransactionParams = {
  order: OrderRef
  type: FinanceTransactionType
  amount: number
  paymentMethod?: string | null
  paymentAccountId?: string | null
  paymentAccountLabel?: string | null
  description: string
  note?: string | null
  source: FinanceTransactionSource
  staffId?: string | null
  traceParts?: string[]
}

type RecordOrderPaymentsParams = {
  order: OrderRef
  payments: OrderPaymentRecord[]
  staffId?: string | null
  traceParts?: string[]
  defaultNote?: string | null
}

export async function createOrderFinanceTransaction(
  tx: FinanceWriter,
  deps: FinanceDeps,
  params: CreateOrderFinanceTransactionParams,
) {
  if (params.amount <= 0) return null

  const traceParts = params.traceParts ?? []
  return tx.transaction.create({
    data: {
      voucherNumber: await deps.generateVoucherNumber(params.type),
      type: params.type,
      amount: params.amount,
      description: params.description,
      orderId: params.order.id,
      paymentMethod: params.paymentMethod ?? null,
      paymentAccountId: params.paymentAccountId ?? null,
      paymentAccountLabel: params.paymentAccountLabel ?? null,
      branchId: params.order.branchId ?? null,
      refType: 'ORDER',
      refId: params.order.id,
      refNumber: params.order.orderNumber,
      payerId: params.order.customerId ?? null,
      payerName: params.order.customerName ?? null,
      notes: deps.mergeTransactionNotes(params.note, traceParts),
      tags: deps.buildServiceTraceTags(traceParts),
      source: params.source,
      isManual: false,
      staffId: params.staffId ?? null,
    },
  })
}

export async function recordOrderPayments(
  tx: FinanceWriter,
  deps: FinanceDeps,
  params: RecordOrderPaymentsParams,
) {
  if (!tx.orderPayment) {
    throw new Error('orderPayment writer is required to record order payments')
  }

  const traceParts = params.traceParts ?? []

  for (const payment of params.payments.filter((item) => item.amount > 0)) {
    await tx.orderPayment.create({
      data: {
        orderId: params.order.id,
        method: payment.method,
        amount: payment.amount,
        note: payment.note ?? params.defaultNote ?? null,
        paymentAccountId: payment.paymentAccountId ?? null,
        paymentAccountLabel: payment.paymentAccountLabel ?? null,
      },
    })

    await createOrderFinanceTransaction(tx, deps, {
      order: params.order,
      type: 'INCOME',
      amount: payment.amount,
      paymentMethod: payment.method,
      paymentAccountId: payment.paymentAccountId ?? null,
      paymentAccountLabel: payment.paymentAccountLabel ?? null,
      description: `Thu bổ sung đơn hàng ${params.order.orderNumber} - ${deps.getPaymentLabel?.(payment.method) ?? payment.method}`,
      note: payment.note ?? params.defaultNote ?? null,
      source: 'ORDER_PAYMENT',
      staffId: params.staffId ?? null,
      traceParts,
    })
  }
}
