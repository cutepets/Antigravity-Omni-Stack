import { BadRequestException } from '@nestjs/common'
import {
  assertOrderCanAcceptPayment,
  assertOrderCanCancel,
  assertOrderCanCreatePaymentIntent,
  assertOrderCanSettle,
  assertServiceItemsReadyForCompletion,
  resolveRequestedPaymentIntentAmount,
} from './order-workflow.policy'

describe('order-workflow.policy', () => {
  it('rejects QR creation for cancelled or fully paid orders', () => {
    expect(() =>
      assertOrderCanCreatePaymentIntent({ status: 'CANCELLED', paymentStatus: 'UNPAID' }),
    ).toThrow(BadRequestException)

    expect(() =>
      assertOrderCanCreatePaymentIntent({ status: 'PROCESSING', paymentStatus: 'PAID' }),
    ).toThrow(BadRequestException)
  })

  it('resolves requested QR amount against remaining debt', () => {
    expect(resolveRequestedPaymentIntentAmount({ total: 500_000, paidAmount: 200_000 }, undefined)).toBe(300_000)
    expect(resolveRequestedPaymentIntentAmount({ total: 500_000, paidAmount: 200_000 }, 150_000)).toBe(150_000)
    expect(() => resolveRequestedPaymentIntentAmount({ total: 500_000, paidAmount: 200_000 }, 0)).toThrow(BadRequestException)
    expect(() => resolveRequestedPaymentIntentAmount({ total: 500_000, paidAmount: 200_000 }, 99.5)).toThrow(BadRequestException)
    expect(() => resolveRequestedPaymentIntentAmount({ total: 500_000, paidAmount: 200_000 }, 400_000)).toThrow(BadRequestException)
  })

  it('rejects pay flow when order is already fully paid', () => {
    expect(() =>
      assertOrderCanAcceptPayment({ paymentStatus: 'PAID' }),
    ).toThrow(BadRequestException)
  })

  it('rejects completion when service sessions are not finished', () => {
    expect(() =>
      assertServiceItemsReadyForCompletion({
        forceComplete: false,
        groomingSessions: [{ id: 'gs-1', status: 'IN_PROGRESS', sessionCode: 'GS001' }],
        hotelStays: [{ id: 'hs-1', status: 'CHECKED_IN' }],
      }),
    ).toThrow(BadRequestException)
  })

  it('rejects cancel for completed orders', () => {
    expect(() => assertOrderCanCancel({ status: 'COMPLETED' })).toThrow(BadRequestException)
  })

  it('rejects settle until service order is processing, exported and fully paid', () => {
    expect(() =>
      assertOrderCanSettle({
        status: 'DRAFT',
        paymentStatus: 'PAID',
        stockExportedAt: new Date(),
        items: [{ type: 'grooming' }],
      }),
    ).toThrow(BadRequestException)

    expect(() =>
      assertOrderCanSettle({
        status: 'PROCESSING',
        paymentStatus: 'PARTIAL',
        stockExportedAt: new Date(),
        items: [{ type: 'grooming' }],
      }),
    ).toThrow(BadRequestException)

    expect(() =>
      assertOrderCanSettle({
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        stockExportedAt: null,
        items: [{ type: 'grooming' }],
      }),
    ).toThrow(BadRequestException)
  })
})
