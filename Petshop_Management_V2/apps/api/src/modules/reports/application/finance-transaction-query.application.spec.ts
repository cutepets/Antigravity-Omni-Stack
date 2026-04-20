import { runFinanceTransactionQuery } from './finance-transaction-query.application'

describe('finance-transaction-query.application', () => {
  it('builds the transaction read model with balances and meta options', async () => {
    const db = {
      transaction: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'tx-1',
              voucherNumber: 'PT-001',
              type: 'INCOME',
              amount: 100_000,
              description: 'Thu tiền',
              source: 'MANUAL',
              date: new Date('2026-04-20T00:00:00.000Z'),
              createdAt: new Date('2026-04-20T00:00:00.000Z'),
              updatedAt: new Date('2026-04-20T01:00:00.000Z'),
              branch: { id: 'branch-1', name: 'Chi nhánh A' },
              staff: { id: 'staff-1', fullName: 'Alice' },
            },
          ])
          .mockResolvedValueOnce([
            { paymentMethod: 'CASH', paymentAccountId: null, paymentAccountLabel: null },
          ])
          .mockResolvedValueOnce([{ source: 'MANUAL' }]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 100_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 30_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 50_000 } })
          .mockResolvedValueOnce({ _sum: { amount: 10_000 } }),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([{ id: 'branch-1', name: 'Chi nhánh A' }]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'staff-1', fullName: 'Alice' }]),
      },
    }

    const result = await runFinanceTransactionQuery(
      db as any,
      {
        page: 2,
        limit: 10,
        includeMeta: true,
      } as any,
      {
        branchIdFilter: { in: ['branch-1'] },
        where: { branchId: { in: ['branch-1'] } },
        openingWhere: { branchId: { in: ['branch-1'] }, date: { lt: new Date('2026-04-20T00:00:00.000Z') } },
        includeMeta: true,
        transactionSources: ['MANUAL', 'ORDER_PAYMENT'],
        normalizeTransaction: (tx: any) => ({
          id: tx.id,
          voucherNumber: tx.voucherNumber,
        }),
      },
    )

    expect(result).toEqual({
      success: true,
      data: {
        transactions: [{ id: 'tx-1', voucherNumber: 'PT-001' }],
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
        openingBalance: 40_000,
        totalIncome: 100_000,
        totalExpense: 30_000,
        closingBalance: 110_000,
        meta: {
          branches: [{ id: 'branch-1', name: 'Chi nhánh A' }],
          paymentMethods: [{ value: 'CASH', label: 'CASH' }],
          creators: [{ id: 'staff-1', name: 'Alice' }],
          sources: ['MANUAL', 'ORDER_PAYMENT'],
        },
      },
    })
  })
})
