import { buildOrderPaymentUpdate } from './order-payment.application'

describe('order-payment.application', () => {
  it('builds payment update totals from positive payments only', () => {
    const result = buildOrderPaymentUpdate({
      order: {
        id: 'order-1',
        total: 500_000,
        paidAmount: 120_000,
      },
      payments: [
        { method: 'CASH', amount: 80_000 },
        { method: 'BANK', amount: 0 },
        { method: 'CARD', amount: 50_000 },
      ],
    })

    expect(result.acceptedPayments).toHaveLength(2)
    expect(result.newPaidThisTime).toBe(130_000)
    expect(result.totalPaid).toBe(250_000)
    expect(result.remainingAmount).toBe(250_000)
    expect(result.paymentStatus).toBe('PARTIAL')
  })
})
