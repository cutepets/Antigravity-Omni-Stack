import { BadRequestException } from '@nestjs/common'
import { buildOrderCompletionSettlement } from './order-completion.application'

describe('order-completion.application', () => {
  it('rejects completion when outstanding debt remains', () => {
    expect(() =>
      buildOrderCompletionSettlement({
        orderTotal: 500_000,
        orderPaidAmount: 200_000,
        extraPayments: [{ method: 'CASH', amount: 100_000 }],
        overpaymentAction: 'NONE',
        hasCustomer: true,
      }),
    ).toThrow(BadRequestException)
  })

  it('returns refund action for overpayment refunds', () => {
    const result = buildOrderCompletionSettlement({
      orderTotal: 500_000,
      orderPaidAmount: 500_000,
      extraPayments: [{ method: 'CASH', amount: 50_000 }],
      overpaymentAction: 'REFUND',
      hasCustomer: true,
    })

    expect(result.finalPaidAmount).toBe(500_000)
    expect(result.overpaidAmount).toBe(50_000)
    expect(result.paymentStatus).toBe('PAID')
    expect(result.adjustment?.type).toBe('REFUND')
    expect(result.adjustment?.amount).toBe(50_000)
  })

  it('returns keep-credit action for overpayment credit retention', () => {
    const result = buildOrderCompletionSettlement({
      orderTotal: 500_000,
      orderPaidAmount: 520_000,
      extraPayments: [],
      overpaymentAction: 'KEEP_CREDIT',
      hasCustomer: true,
    })

    expect(result.finalPaidAmount).toBe(520_000)
    expect(result.adjustment).toEqual({ type: 'KEEP_CREDIT', amount: 20_000 })
  })

  it('rejects keep-credit without a customer', () => {
    expect(() =>
      buildOrderCompletionSettlement({
        orderTotal: 500_000,
        orderPaidAmount: 520_000,
        extraPayments: [],
        overpaymentAction: 'KEEP_CREDIT',
        hasCustomer: false,
      }),
    ).toThrow(BadRequestException)
  })
})
