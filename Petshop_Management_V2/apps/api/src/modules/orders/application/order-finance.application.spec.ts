import { createOrderFinanceTransaction, recordOrderPayments } from './order-finance.application'

describe('order-finance.application', () => {
  it('creates a finance transaction payload with generated voucher, tags, and merged notes', async () => {
    const tx = {
      transaction: {
        create: jest.fn().mockResolvedValue({ id: 'trx-1' }),
      },
    }

    const result = await createOrderFinanceTransaction(
      tx as any,
      {
        generateVoucherNumber: jest.fn().mockResolvedValue('PT-001'),
        buildServiceTraceTags: jest.fn().mockReturnValue('POS_ORDER,GROOMING_SESSION:1'),
        mergeTransactionNotes: jest.fn().mockReturnValue('cash | POS trace: GROOMING_SESSION:1'),
      },
      {
        order: {
          id: 'order-1',
          orderNumber: 'DH001',
          branchId: 'branch-1',
          customerId: 'customer-1',
          customerName: 'Alice',
        },
        type: 'INCOME',
        amount: 150_000,
        paymentMethod: 'CASH',
        paymentAccountId: 'cashbox-1',
        paymentAccountLabel: 'Quỹ tiền mặt',
        description: 'Thu đơn hàng DH001',
        note: 'cash',
        source: 'ORDER_PAYMENT',
        staffId: 'staff-1',
        traceParts: ['GROOMING_SESSION:1'],
      },
    )

    expect(result).toEqual({ id: 'trx-1' })
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherNumber: 'PT-001',
        type: 'INCOME',
        amount: 150_000,
        description: 'Thu đơn hàng DH001',
        orderId: 'order-1',
        paymentMethod: 'CASH',
        paymentAccountId: 'cashbox-1',
        paymentAccountLabel: 'Quỹ tiền mặt',
        branchId: 'branch-1',
        refType: 'ORDER',
        refId: 'order-1',
        refNumber: 'DH001',
        payerId: 'customer-1',
        payerName: 'Alice',
        notes: 'cash | POS trace: GROOMING_SESSION:1',
        tags: 'POS_ORDER,GROOMING_SESSION:1',
        source: 'ORDER_PAYMENT',
        isManual: false,
        staffId: 'staff-1',
      }),
    })
  })

  it('skips transaction creation when amount is not positive', async () => {
    const tx = {
      transaction: {
        create: jest.fn(),
      },
    }

    const result = await createOrderFinanceTransaction(
      tx as any,
      {
        generateVoucherNumber: jest.fn(),
        buildServiceTraceTags: jest.fn(),
        mergeTransactionNotes: jest.fn(),
      },
      {
        order: {
          id: 'order-1',
          orderNumber: 'DH001',
        },
        type: 'INCOME',
        amount: 0,
        description: 'ignored',
        source: 'ORDER_PAYMENT',
      },
    )

    expect(result).toBeNull()
    expect(tx.transaction.create).not.toHaveBeenCalled()
  })

  it('records order payments and mirrors them into finance transactions', async () => {
    const tx = {
      orderPayment: {
        create: jest.fn().mockResolvedValue(undefined),
      },
      transaction: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    await recordOrderPayments(
      tx as any,
      {
        generateVoucherNumber: jest.fn().mockResolvedValue('PT-002'),
        buildServiceTraceTags: jest.fn().mockReturnValue('POS_ORDER,HOTEL_STAY:1'),
        mergeTransactionNotes: jest.fn().mockImplementation((note) => note ?? null),
        getPaymentLabel: jest.fn().mockReturnValue('Tiền mặt'),
      },
      {
        order: {
          id: 'order-1',
          orderNumber: 'DH001',
          branchId: 'branch-1',
          customerId: 'customer-1',
          customerName: 'Alice',
        },
        payments: [
          {
            method: 'CASH',
            amount: 120_000,
            note: 'thu đợt 2',
            paymentAccountId: 'cashbox-1',
            paymentAccountLabel: 'Quỹ tiền mặt',
          },
        ],
        staffId: 'staff-1',
        traceParts: ['HOTEL_STAY:1'],
        defaultNote: 'ghi chú mặc định',
      },
    )

    expect(tx.orderPayment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        method: 'CASH',
        amount: 120_000,
        note: 'thu đợt 2',
        paymentAccountId: 'cashbox-1',
        paymentAccountLabel: 'Quỹ tiền mặt',
      },
    })
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: 'Thu bổ sung đơn hàng DH001 - Tiền mặt',
        amount: 120_000,
        source: 'ORDER_PAYMENT',
      }),
    })
  })
})
