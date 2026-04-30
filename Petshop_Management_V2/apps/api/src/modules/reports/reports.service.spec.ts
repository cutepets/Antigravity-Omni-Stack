import { ForbiddenException } from '@nestjs/common'
import { ReportsService } from './reports.service'

function createDbMock() {
  return {
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
  } as any
}

function createOverviewDbMock() {
  return {
    order: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 300_000 }, _count: 3 }),
      groupBy: jest.fn().mockResolvedValue([
        { customerId: 'customer-1', _sum: { total: 250_000 }, _count: 2 },
      ]),
    },
    orderItem: {
      groupBy: jest.fn().mockResolvedValue([
        { productId: 'product-1', _sum: { quantity: 4, subtotal: 180_000 } },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: {
      count: jest.fn().mockResolvedValue(8),
      findMany: jest.fn().mockResolvedValue([
        { id: 'customer-1', fullName: 'Khach A', phone: '0901', customerCode: 'KH001', debt: 50_000, totalSpent: 250_000, _count: { orders: 2, hotelStays: 0 } },
      ]),
    },
    product: {
      findMany: jest.fn().mockResolvedValue([{ id: 'product-1', name: 'Pate meo', sku: 'PM001' }]),
    },
    groomingSession: {
      count: jest.fn().mockResolvedValue(2),
    },
    hotelStay: {
      count: jest.fn().mockResolvedValue(1),
    },
    branchStock: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'stock-1',
          stock: 1,
          minStock: 5,
          branch: { id: 'branch-1', name: 'Chi nhanh 1' },
          product: { id: 'product-1', name: 'Pate meo', sku: 'PM001', unit: 'goi' },
          variant: null,
        },
      ]),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'tx-1', voucherNumber: 'PT001', type: 'INCOME', amount: 300_000, description: 'Thu ban hang', date: new Date('2026-04-30T08:00:00.000Z'), source: 'ORDER_PAYMENT', payerName: 'Khach A', branchName: 'Chi nhanh 1' },
      ]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: 300_000 } })
        .mockResolvedValueOnce({ _sum: { amount: 40_000 } })
        .mockResolvedValue({ _sum: { amount: 0 } }),
    },
    supplier: {
      findMany: jest.fn().mockResolvedValue([]),
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
    category: 'Manual',
    paymentMethod: 'CASH',
    branchId: 'branch-1',
    branchName: 'Chi nhanh 1',
    payerId: 'customer-1',
    payerName: 'Khach A',
    refType: 'MANUAL',
    refId: null,
    refNumber: null,
    notes: 'Ghi chu cu',
    tags: null,
    source: 'MANUAL',
    isManual: true,
    date: new Date('2026-04-08T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    staff: { id: 'staff-1', fullName: 'Admin' },
    branch: { id: 'branch-1', name: 'Chi nhanh 1' },
    ...overrides,
  }
}

describe('ReportsService overview dashboard', () => {
  it('returns all-branch overview for global users when branchId is omitted', async () => {
    const db = createOverviewDbMock()
    const service = new ReportsService(db)

    const result = await (service as any).getOverview(
      { role: 'SUPER_ADMIN', permissions: ['FULL_BRANCH_ACCESS'] },
      undefined,
      '2026-04-01',
      '2026-04-30',
    )

    expect(result.data.scope.isAllBranches).toBe(true)
    expect(result.data.range).toEqual({ dateFrom: '2026-04-01', dateTo: '2026-04-30' })
    expect(db.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ branchId: expect.anything() }),
      }),
    )
    const serviceRevenueQuery = db.orderItem.findMany.mock.calls[0]?.[0]
    expect(serviceRevenueQuery.include).toBeUndefined()
    expect(serviceRevenueQuery.select).toEqual(
      expect.objectContaining({
        quantity: true,
        subtotal: true,
        description: true,
        pricingSnapshot: true,
        order: expect.any(Object),
        service: expect.any(Object),
      }),
    )
    expect(serviceRevenueQuery.select.promotionDiscount).toBeUndefined()
    expect(result.data.cashbook).toBeDefined()
    expect(result.data.debt).toBeDefined()
    expect(result.data.purchase).toBeDefined()
  })

  it('rejects managers requesting a branch outside their authorized scope', async () => {
    const db = createOverviewDbMock()
    const service = new ReportsService(db)

    await expect(
      (service as any).getOverview(
        { role: 'MANAGER', permissions: ['report.sales'], authorizedBranchIds: ['branch-1'] },
        'branch-2',
        '2026-04-01',
        '2026-04-30',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('hides cashbook debt and purchase blocks for staff users', async () => {
    const db = createOverviewDbMock()
    const service = new ReportsService(db)

    const result = await (service as any).getOverview(
      { role: 'STAFF', permissions: ['dashboard.read'], branchId: 'branch-1', authorizedBranchIds: ['branch-1'] },
      'branch-1',
      '2026-04-01',
      '2026-04-30',
    )

    expect(result.data.scope.canViewSensitive).toBe(false)
    expect(result.data.cashbook).toBeUndefined()
    expect(result.data.debt).toBeUndefined()
    expect(result.data.purchase).toBeUndefined()
    expect(result.data.sales).toBeUndefined()
  })
})

describe('ReportsService transaction edit rules', () => {
  it('resolves manual order links when creating a transaction', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)

    db.order.findFirst.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DH260408001',
      branchId: 'branch-1',
    })
    db.transaction.create.mockImplementation(async ({ data }: any) =>
      createTransaction({
        ...data,
        id: 'tx-created',
        refType: data.refType,
        refId: data.refId,
        refNumber: data.refNumber,
      }),
    )

    const result = await service.createTransaction(
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
        }),
      }),
    )
    expect(result.data.refType).toBe('ORDER')
    expect(result.data.refId).toBe('order-1')
  })

  it('allows full update for a manual transaction created within 24 hours', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const existing = createTransaction()

    db.transaction.findUnique.mockResolvedValue(existing)
    db.transaction.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      updatedAt: new Date(),
    }))

    const result = await service.updateTransaction(existing.id, {
      amount: 250_000,
      description: 'Thu bo sung',
      paymentMethod: 'BANK',
      notes: 'Da cap nhat',
    }, 'staff-1')

    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: expect.objectContaining({
          amount: 250_000,
          description: 'Thu bo sung',
          paymentMethod: 'BANK',
          notes: 'Da cap nhat',
        }),
      }),
    )
    expect(result.data.editScope).toBe('FULL')
  })

  it('blocks non-note updates for a manual transaction older than 24 hours', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const existing = createTransaction({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })

    db.transaction.findUnique.mockResolvedValue(existing)

    await expect(
      service.updateTransaction(existing.id, { amount: 200_000 }, 'staff-1'),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(db.transaction.update).not.toHaveBeenCalled()
  })

  it('allows note-only update for a manual transaction older than 24 hours', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const existing = createTransaction({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })

    db.transaction.findUnique.mockResolvedValue(existing)
    db.transaction.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      updatedAt: new Date(),
    }))

    const result = await service.updateTransaction(existing.id, { notes: 'Chi sua ghi chu' }, 'staff-1')

    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: 'Chi sua ghi chu',
        }),
      }),
    )
    expect(result.data.editScope).toBe('NOTES_ONLY')
    expect(result.data.lockReason).toContain('24 giờ đầu')
  })

  it('allows note-only update but blocks core updates for synced transactions', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const synced = createTransaction({
      source: 'ORDER_PAYMENT',
      isManual: false,
      refType: 'ORDER',
      refId: 'order-1',
      refNumber: 'DH001',
    })

    db.transaction.findUnique.mockResolvedValue(synced)

    await expect(
      service.updateTransaction(synced.id, { paymentMethod: 'BANK' }, 'staff-1'),
    ).rejects.toBeInstanceOf(ForbiddenException)

    db.transaction.update.mockImplementation(async ({ data }: any) => ({
      ...synced,
      ...data,
      updatedAt: new Date(),
    }))

    const result = await service.updateTransaction(synced.id, { notes: 'Doi chieu lai' }, 'staff-1')

    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: 'Doi chieu lai',
        }),
      }),
    )
    expect(result.data.editScope).toBe('NOTES_ONLY')
    expect(result.data.canDelete).toBe(false)
  })

  it('updates manual links for a recent manual transaction', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const existing = createTransaction()

    db.transaction.findUnique.mockResolvedValue(existing)
    db.stockReceipt.findFirst.mockResolvedValue({
      id: 'receipt-1',
      receiptNumber: 'PN2604003',
      branchId: 'branch-1',
    })
    db.transaction.update.mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      updatedAt: new Date(),
    }))

    const result = await service.updateTransaction(
      existing.id,
      {
        refType: 'STOCK_RECEIPT',
        refNumber: 'PN2604003',
        tags: 'MANUAL_LINK_STOCK_RECEIPT',
      },
      'staff-1',
    )

    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refType: 'STOCK_RECEIPT',
          refId: 'receipt-1',
          refNumber: 'PN2604003',
          tags: 'MANUAL_LINK_STOCK_RECEIPT',
        }),
      }),
    )
    expect(result.data.refType).toBe('STOCK_RECEIPT')
    expect(result.data.refId).toBe('receipt-1')
  })

  it('allows delete only for manual transactions still within the first 24 hours', async () => {
    const db = createDbMock()
    const service = new ReportsService(db)
    const recentManual = createTransaction()

    db.transaction.findUnique.mockResolvedValue(recentManual)
    db.transaction.delete.mockResolvedValue({ id: recentManual.id })

    await expect(service.removeTransaction(recentManual.id)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    )
    expect(db.transaction.delete).toHaveBeenCalledWith({ where: { id: recentManual.id } })

    const oldManual = createTransaction({
      id: 'tx-old',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    db.transaction.findUnique.mockResolvedValue(oldManual)

    await expect(service.removeTransaction(oldManual.id)).rejects.toBeInstanceOf(ForbiddenException)

    const synced = createTransaction({
      id: 'tx-sync',
      source: 'STOCK_RECEIPT',
      isManual: false,
    })
    db.transaction.findUnique.mockResolvedValue(synced)

    await expect(service.removeTransaction(synced.id)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
