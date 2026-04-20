import { buildReceiptSnapshot } from './receipt-snapshot.mapper'

describe('receipt snapshot mapper', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T08:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds draft unpaid snapshot from ordered items', () => {
    expect(
      buildReceiptSnapshot({
        items: [{ quantity: 2, unitPrice: 10, receivedQuantity: 0, returnedQuantity: 0, closedQuantity: 0 }],
        paymentAllocations: [],
      }),
    ).toMatchObject({
      orderedAmount: 20,
      receivedAmount: 0,
      payableAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      receiptStatus: 'DRAFT',
      paymentStatus: 'UNPAID',
      legacyStatus: 'DRAFT',
    })
  })

  it('builds partial received and partially paid snapshot', () => {
    expect(
      buildReceiptSnapshot({
        items: [{ quantity: 5, unitPrice: 10, receivedQuantity: 2, returnedQuantity: 0, closedQuantity: 0 }],
        paymentAllocations: [{ amount: 5, payment: { paidAt: '2026-04-19T10:00:00.000Z' } }],
        receiveEvents: [{ receivedAt: '2026-04-18T10:00:00.000Z' }],
      }),
    ).toMatchObject({
      orderedAmount: 50,
      receivedAmount: 20,
      payableAmount: 20,
      paidAmount: 5,
      outstandingAmount: 15,
      receiptStatus: 'PARTIAL_RECEIVED',
      paymentStatus: 'PARTIAL',
      legacyStatus: 'DRAFT',
      paymentDate: new Date('2026-04-19T10:00:00.000Z'),
      receivedAt: new Date('2026-04-18T10:00:00.000Z'),
    })
  })

  it('builds short-closed paid snapshot with completion date', () => {
    expect(
      buildReceiptSnapshot({
        shortClosedAt: '2026-04-20T07:00:00.000Z',
        items: [{ quantity: 5, unitPrice: 10, receivedQuantity: 3, returnedQuantity: 1, closedQuantity: 2 }],
        paymentAllocations: [{ amount: 20, payment: { paidAt: '2026-04-20T07:30:00.000Z' } }],
      }),
    ).toMatchObject({
      receivedAmount: 30,
      returnedAmount: 10,
      payableAmount: 20,
      paidAmount: 20,
      outstandingAmount: 0,
      receiptStatus: 'SHORT_CLOSED',
      paymentStatus: 'PAID',
      legacyStatus: 'RECEIVED',
      completedAt: new Date('2026-04-20T07:00:00.000Z'),
    })
  })
})
