import { ForbiddenException } from '@nestjs/common'
import {
  createManualFinanceTransaction,
  removeFinanceTransaction,
  updateFinanceTransaction,
} from './finance-transaction-mutation.application.js'

function createDbMock() {
  return {
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
    stockReceipt: {
      findFirst: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
    paymentMethod: {
      findUnique: jest.fn(),
    },
  } as any
}

function createTransaction(overrides?: Record<string, unknown>) {
  return {
    id: 'tx-1',
    voucherNumber: 'PT260408001',
    type: 'INCOME',
    amount: 100_000,
    description: 'Thu tay',
    paymentMethod: 'CASH',
    branchId: 'branch-1',
    refType: 'MANUAL',
    refId: null,
    refNumber: null,
    notes: 'Ghi chu cu',
    source: 'MANUAL',
    isManual: true,
    date: new Date('2026-04-08T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const deps: {
  buildVoucherNumber: jest.Mock<Promise<string>, [type: 'INCOME' | 'EXPENSE', issuedAt: Date]>
  normalizeTransaction: jest.Mock<any, [tx: any]>
  getTransactionCapability: jest.Mock<{ editScope: 'FULL' | 'NOTES_ONLY'; canDelete: boolean; lockReason: string | null }, [tx?: any]>
} = {
  buildVoucherNumber: jest.fn(async (_type: 'INCOME' | 'EXPENSE', _issuedAt: Date) => 'PT260408001'),
  normalizeTransaction: jest.fn((tx: any) => tx),
  getTransactionCapability: jest.fn(() => ({
    editScope: 'FULL' as const,
    canDelete: true,
    lockReason: null,
  })),
}

describe('finance transaction mutation application', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a manual transaction linked to an order reference', async () => {
    const db = createDbMock()
    db.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH260408001',
      branchId: 'branch-1',
    })
    db.transaction.create.mockImplementation(async ({ data }: any) => createTransaction(data))

    const result = await createManualFinanceTransaction(
      db,
      deps,
      {
        type: 'INCOME',
        amount: 150_000,
        description: 'Thu lien ket don hang',
        refType: 'ORDER',
        refNumber: 'DH260408001',
      },
      'staff-1',
    )

    expect(db.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refType: 'ORDER',
          refId: 'order-1',
          refNumber: 'DH260408001',
          source: 'MANUAL',
          isManual: true,
        }),
      }),
    )
    expect(result.data.refId).toBe('order-1')
  })

  it('blocks core updates when capability is notes-only', async () => {
    const db = createDbMock()
    db.transaction.findUnique.mockResolvedValue(createTransaction({ source: 'ORDER_PAYMENT', isManual: false }))
    deps.getTransactionCapability.mockReturnValueOnce({
      editScope: 'NOTES_ONLY',
      canDelete: false,
      lockReason: 'Locked',
    })

    await expect(
      updateFinanceTransaction(db, deps, 'tx-1', { amount: 200_000 }),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(db.transaction.update).not.toHaveBeenCalled()
  })

  it('allows deleting transactions only when capability allows it', async () => {
    const db = createDbMock()
    db.transaction.findUnique.mockResolvedValue(createTransaction())
    db.transaction.delete.mockResolvedValue({ id: 'tx-1' })

    await expect(removeFinanceTransaction(db, deps, 'tx-1')).resolves.toEqual(
      expect.objectContaining({ success: true }),
    )
    expect(db.transaction.delete).toHaveBeenCalledWith({ where: { id: 'tx-1' } })
  })
})
