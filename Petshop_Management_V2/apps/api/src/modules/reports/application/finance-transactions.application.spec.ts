import {
  buildFinanceTransactionWhere,
  getFinanceTransactionCapability,
  normalizeFinanceTransaction,
} from './finance-transactions.application'

describe('finance-transactions.application', () => {
  it('returns full capability for manual transactions inside the edit window', () => {
    const createdAt = new Date('2026-04-20T01:00:00.000Z')

    const capability = getFinanceTransactionCapability(
      { isManual: true, createdAt },
      {
        manualFullEditWindowMs: 24 * 60 * 60 * 1000,
        nowMs: new Date('2026-04-20T10:00:00.000Z').getTime(),
      },
    )

    expect(capability).toEqual({
      editScope: 'FULL',
      canDelete: true,
      lockReason: null,
    })
  })

  it('normalizes finance transactions with capability and creator info', () => {
    const normalized = normalizeFinanceTransaction(
      {
        id: 'tx-1',
        voucherNumber: 'PT-001',
        type: 'INCOME',
        amount: 200_000,
        description: 'Thu tiền',
        source: 'MANUAL',
        branch: { name: 'Chi nhánh A' },
        staff: { id: 'staff-1', fullName: 'Alice' },
        date: new Date('2026-04-20T00:00:00.000Z'),
        createdAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T01:00:00.000Z'),
      },
      {
        manualFullEditWindowMs: 24 * 60 * 60 * 1000,
        nowMs: new Date('2026-04-20T10:00:00.000Z').getTime(),
      },
    )

    expect(normalized).toEqual(
      expect.objectContaining({
        id: 'tx-1',
        voucherNumber: 'PT-001',
        branchName: 'Chi nhánh A',
        createdBy: { id: 'staff-1', name: 'Alice' },
        editScope: 'FULL',
        canDelete: true,
      }),
    )
  })

  it('builds transaction filters from branch scope, payment filter, date range, and search terms', () => {
    const where = buildFinanceTransactionWhere(
      {
        type: 'INCOME',
        paymentMethod: 'cash',
        source: 'ORDER_PAYMENT',
        refNumber: 'DH001',
        description: 'spa',
        payerName: 'alice',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-20',
        search: 'PT-001 Alice',
      },
      {
        branchIdFilter: { in: ['branch-1', 'branch-2'] },
        searchableFields: ['voucherNumber', 'refNumber', 'payerName'],
        legacyPaymentMethodTypes: new Set(['CASH', 'BANK']),
        startOfDay: (value: string) => new Date(`${value}T00:00:00.000Z`),
        endOfDay: (value: string) => new Date(`${value}T23:59:59.999Z`),
      },
    )

    expect(where).toEqual({
      type: 'INCOME',
      branchId: { in: ['branch-1', 'branch-2'] },
      paymentMethod: 'CASH',
      source: 'ORDER_PAYMENT',
      refNumber: { contains: 'DH001', mode: 'insensitive' },
      description: { contains: 'spa', mode: 'insensitive' },
      payerName: { contains: 'alice', mode: 'insensitive' },
      date: {
        gte: new Date('2026-04-01T00:00:00.000Z'),
        lte: new Date('2026-04-20T23:59:59.999Z'),
      },
      AND: [
        {
          OR: [
            { voucherNumber: { contains: 'PT-001', mode: 'insensitive' } },
            { refNumber: { contains: 'PT-001', mode: 'insensitive' } },
            { payerName: { contains: 'PT-001', mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { voucherNumber: { contains: 'Alice', mode: 'insensitive' } },
            { refNumber: { contains: 'Alice', mode: 'insensitive' } },
            { payerName: { contains: 'Alice', mode: 'insensitive' } },
          ],
        },
      ],
    })
  })
})
