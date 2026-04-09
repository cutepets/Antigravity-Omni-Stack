import { delay, http, HttpResponse } from 'msw'

const BASE = '/api'

type MockFinanceTransaction = {
  id: string
  voucherNumber: string
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string
  category: string | null
  paymentMethod: string | null
  branchId: string | null
  branchName: string | null
  payerId: string | null
  payerName: string | null
  refType: string | null
  refId: string | null
  refNumber: string | null
  notes: string | null
  tags: string | null
  source: string
  isManual: boolean
  editScope?: 'FULL' | 'NOTES_ONLY'
  canDelete?: boolean
  lockReason?: string | null
  date: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string } | null
}

const MANUAL_FULL_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

function getTransactionCapability(transaction: MockFinanceTransaction) {
  const createdAtMs = new Date(transaction.createdAt).getTime()
  const isManual = transaction.isManual || transaction.source === 'MANUAL'

  if (!isManual) {
    return {
      editScope: 'NOTES_ONLY' as const,
      canDelete: false,
      lockReason: 'Phiếu đồng bộ chỉ được cập nhật ghi chú.',
    }
  }

  if (Date.now() - createdAtMs <= MANUAL_FULL_EDIT_WINDOW_MS) {
    return {
      editScope: 'FULL' as const,
      canDelete: true,
      lockReason: null,
    }
  }

  return {
    editScope: 'NOTES_ONLY' as const,
    canDelete: false,
    lockReason: 'Phiếu tự tạo chỉ được sửa hoặc xóa toàn bộ trong 24 giờ đầu. Sau đó chỉ còn sửa ghi chú.',
  }
}

function withCapability(transaction: MockFinanceTransaction): MockFinanceTransaction {
  return {
    ...transaction,
    ...getTransactionCapability(transaction),
  }
}

function buildVoucherBase(type: MockFinanceTransaction['type'], isoDate: string) {
  const date = new Date(isoDate)
  const yy = String(date.getUTCFullYear()).slice(-2)
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${type === 'EXPENSE' ? 'PC' : 'PT'}${yy}${mm}${dd}`
}

function buildMockVoucherNumber(type: MockFinanceTransaction['type'], isoDate: string) {
  const voucherBase = buildVoucherBase(type, isoDate)
  const nextSequence =
    mockFinanceTransactions.filter((transaction) => transaction.voucherNumber.startsWith(voucherBase)).length + 1
  const width = type === 'EXPENSE' ? 4 : 3
  return `${voucherBase}${String(nextSequence).padStart(width, '0')}`
}

const mockBranches = [
  { id: 'br-1', name: 'Chi nhanh Quan 1' },
  { id: 'br-2', name: 'Chi nhanh Binh Thanh' },
]

const mockOrders = [
  { id: 'ord-1', orderNumber: 'DH001' },
  { id: 'ord-2', orderNumber: 'DH260408001' },
]

const mockStockReceipts = [
  { id: 'rcpt-2', receiptNumber: 'RCPT-002' },
  { id: 'rcpt-3', receiptNumber: 'PN2604003' },
]

function resolveMockManualReference(body: Partial<MockFinanceTransaction>) {
  const refType = body.refType ?? 'MANUAL'
  const refId = body.refId ?? null
  const refNumber = body.refNumber ?? null

  if (refType === 'MANUAL') {
    return {
      refType: 'MANUAL',
      refId: null,
      refNumber: null,
    }
  }

  if (refType === 'ORDER') {
    const order = mockOrders.find((item) => item.id === refId || item.orderNumber === refNumber)
    if (!order) {
      return null
    }

    return {
      refType: 'ORDER',
      refId: order.id,
      refNumber: order.orderNumber,
    }
  }

  if (refType === 'STOCK_RECEIPT') {
    const receipt = mockStockReceipts.find((item) => item.id === refId || item.receiptNumber === refNumber)
    if (!receipt) {
      return null
    }

    return {
      refType: 'STOCK_RECEIPT',
      refId: receipt.id,
      refNumber: receipt.receiptNumber,
    }
  }

  return null
}

const mockFinanceTransactions: MockFinanceTransaction[] = [
  {
    id: 'tx-1',
    voucherNumber: 'PT260403001',
    type: 'INCOME',
    amount: 450000,
    description: 'Thu tien don hang DH001',
    category: 'Ban hang',
    paymentMethod: 'CASH',
    branchId: 'br-1',
    branchName: 'Chi nhanh Quan 1',
    payerId: 'cus-1',
    payerName: 'Nguyen Thi Lan',
    refType: 'ORDER',
    refId: 'ord-1',
    refNumber: 'DH001',
    notes: null,
    tags: null,
    source: 'ORDER_PAYMENT',
    isManual: false,
    date: '2026-04-03T09:30:00.000Z',
    createdAt: '2026-04-03T09:30:00.000Z',
    updatedAt: '2026-04-03T09:30:00.000Z',
    createdBy: { id: 'staff-1', name: 'Admin' },
  },
  {
    id: 'tx-2',
    voucherNumber: 'PC2604030001',
    type: 'EXPENSE',
    amount: 150000,
    description: 'Chi van chuyen noi bo',
    category: 'Van hanh',
    paymentMethod: 'BANK',
    branchId: 'br-1',
    branchName: 'Chi nhanh Quan 1',
    payerId: null,
    payerName: 'Nha xe Thanh Cong',
    refType: 'MANUAL',
    refId: null,
    refNumber: null,
    notes: 'Phi giao nhan',
    tags: null,
    source: 'MANUAL',
    isManual: true,
    date: '2026-04-03T11:00:00.000Z',
    createdAt: '2026-04-03T11:00:00.000Z',
    updatedAt: '2026-04-03T11:00:00.000Z',
    createdBy: { id: 'staff-1', name: 'Admin' },
  },
  {
    id: 'tx-3',
    voucherNumber: 'PC2604040002',
    type: 'EXPENSE',
    amount: 850000,
    description: 'Thanh toan phieu nhap RCPT-002',
    category: 'Nhap hang',
    paymentMethod: 'BANK',
    branchId: null,
    branchName: null,
    payerId: 'sup-2',
    payerName: 'Phu kien Pet Ha Noi',
    refType: 'STOCK_RECEIPT',
    refId: 'rcpt-2',
    refNumber: 'RCPT-002',
    notes: null,
    tags: null,
    source: 'STOCK_RECEIPT',
    isManual: false,
    date: '2026-04-04T08:45:00.000Z',
    createdAt: '2026-04-04T08:45:00.000Z',
    updatedAt: '2026-04-04T08:45:00.000Z',
    createdBy: { id: 'staff-2', name: 'Thu ngan kho' },
  },
  {
    id: 'tx-4',
    voucherNumber: 'PT260404003',
    type: 'INCOME',
    amount: 300000,
    description: 'Thu khach le tai quay',
    category: 'Thu khac',
    paymentMethod: 'MOMO',
    branchId: 'br-2',
    branchName: 'Chi nhanh Binh Thanh',
    payerId: null,
    payerName: 'Khach le',
    refType: 'MANUAL',
    refId: null,
    refNumber: null,
    notes: 'Thu bo sung',
    tags: null,
    source: 'MANUAL',
    isManual: true,
    date: '2026-04-04T15:20:00.000Z',
    createdAt: '2026-04-04T15:20:00.000Z',
    updatedAt: '2026-04-04T15:20:00.000Z',
    createdBy: { id: 'staff-3', name: 'Le ngan' },
  },
  ...Array.from({ length: 11 }, (_, index): MockFinanceTransaction => {
    const sequence = index + 5
    const isExpense = sequence % 3 === 0
    const branch = mockBranches[sequence % mockBranches.length] ?? null
    const date = new Date(Date.UTC(2026, 3, 5 - index, 8 + (index % 7), 15 + ((index * 9) % 40), 0))
    const paymentMethod = ['CASH', 'BANK', 'MOMO', 'CARD'][index % 4]!

    if (sequence % 5 === 0) {
      return {
        id: `tx-${sequence}`,
        voucherNumber: `PT2604${String(20 - index).padStart(2, '0')}${String(sequence).padStart(3, '0')}`,
        type: 'INCOME',
        amount: 320000 + index * 45000,
        description: `Thu dich vu grooming POS demo ${sequence}`,
        category: 'Grooming',
        paymentMethod,
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        payerId: `cus-demo-${sequence}`,
        payerName: `Khach grooming ${sequence}`,
        refType: 'ORDER',
        refId: null,
        refNumber: `POS-GROOM-${String(sequence).padStart(3, '0')}`,
        notes: `POS trace: GROOMING_SESSION:demo-groom-${sequence}`,
        tags: `FINANCE_DEMO,POS_ORDER,GROOMING_SESSION:demo-groom-${sequence}`,
        source: 'ORDER_PAYMENT',
        isManual: false,
        date: date.toISOString(),
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        createdBy: { id: 'staff-2', name: 'POS Grooming' },
      }
    }

    if (sequence % 4 === 0) {
      return {
        id: `tx-${sequence}`,
        voucherNumber: `PT2604${String(20 - index).padStart(2, '0')}${String(sequence).padStart(3, '0')}`,
        type: 'INCOME',
        amount: 450000 + index * 65000,
        description: `Thu dich vu hotel POS demo ${sequence}`,
        category: 'Hotel',
        paymentMethod,
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        payerId: `cus-demo-${sequence}`,
        payerName: `Khach hotel ${sequence}`,
        refType: 'ORDER',
        refId: null,
        refNumber: `POS-HOTEL-${String(sequence).padStart(3, '0')}`,
        notes: `POS trace: HOTEL_STAY:demo-hotel-${sequence} | HOTEL_CODE:HOTELDEMO${String(sequence).padStart(3, '0')}`,
        tags: `FINANCE_DEMO,POS_ORDER,HOTEL_STAY:demo-hotel-${sequence},HOTEL_CODE:HOTELDEMO${String(sequence).padStart(3, '0')}`,
        source: 'ORDER_PAYMENT',
        isManual: false,
        date: date.toISOString(),
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        createdBy: { id: 'staff-2', name: 'POS Hotel' },
      }
    }

    if (isExpense) {
      return {
        id: `tx-${sequence}`,
        voucherNumber: `PC2604${String(20 - index).padStart(2, '0')}${String(sequence).padStart(4, '0')}`,
        type: 'EXPENSE',
        amount: 280000 + index * 72000,
        description: `Chi nhap hang demo ${sequence}`,
        category: 'Stock',
        paymentMethod,
        branchId: branch?.id ?? null,
        branchName: branch?.name ?? null,
        payerId: `sup-demo-${sequence}`,
        payerName: `Nha cung cap ${sequence}`,
        refType: 'STOCK_RECEIPT',
        refId: null,
        refNumber: `RCPT-DEMO-${String(sequence).padStart(3, '0')}`,
        notes: `Chi cong no nha cung cap demo ${sequence}`,
        tags: 'FINANCE_DEMO',
        source: 'STOCK_RECEIPT',
        isManual: false,
        date: date.toISOString(),
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        createdBy: { id: 'staff-4', name: 'Kho demo' },
      }
    }

    return {
      id: `tx-${sequence}`,
      voucherNumber: `PT2604${String(20 - index).padStart(2, '0')}${String(sequence).padStart(3, '0')}`,
      type: 'INCOME',
      amount: 210000 + index * 38000,
      description: `Thu bo sung demo ${sequence}`,
      category: 'Manual',
      paymentMethod,
      branchId: branch?.id ?? null,
      branchName: branch?.name ?? null,
      payerId: null,
      payerName: `Khach le ${sequence}`,
      refType: 'MANUAL',
      refId: null,
      refNumber: null,
      notes: `Manual finance demo ${sequence}`,
      tags: 'FINANCE_DEMO',
      source: 'MANUAL',
      isManual: true,
      date: date.toISOString(),
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      createdBy: { id: 'staff-1', name: 'Admin' },
    }
  }),
]

function buildMeta() {
  return {
    branches: mockBranches,
    paymentMethods: Array.from(new Set(mockFinanceTransactions.map((transaction) => transaction.paymentMethod).filter(Boolean))) as string[],
    creators: Array.from(
      new Map(
        mockFinanceTransactions
          .filter((transaction) => transaction.createdBy)
          .map((transaction) => [transaction.createdBy!.id, transaction.createdBy!]),
      ).values(),
    ),
    sources: Array.from(new Set(mockFinanceTransactions.map((transaction) => transaction.source))),
  }
}

export const financeHandlers = [
  http.get(`${BASE}/reports/transactions`, async ({ request }) => {
    await delay(250)

    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const type = url.searchParams.get('type')
    const branchId = url.searchParams.get('branchId')
    const paymentMethod = url.searchParams.get('paymentMethod')
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')

    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : Number.NEGATIVE_INFINITY
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : Number.POSITIVE_INFINITY

    const baseFiltered = mockFinanceTransactions.filter((transaction) => {
      if (type && type !== 'ALL' && transaction.type !== type) return false
      if (branchId && transaction.branchId !== branchId) return false
      if (paymentMethod && transaction.paymentMethod !== paymentMethod) return false

      if (search) {
        const haystack = [
          transaction.voucherNumber,
          transaction.description,
          transaction.payerName ?? '',
          transaction.refNumber ?? '',
          transaction.source,
          transaction.notes ?? '',
        ]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(search)) return false
      }

      return true
    })

    const openingBalance = baseFiltered.reduce((sum, transaction) => {
      const transactionTime = new Date(transaction.date).getTime()
      if (transactionTime >= fromTime) return sum
      return sum + (transaction.type === 'INCOME' ? transaction.amount : -transaction.amount)
    }, 0)

    const inRange = baseFiltered
      .filter((transaction) => {
        const transactionTime = new Date(transaction.date).getTime()
        return transactionTime >= fromTime && transactionTime <= toTime
      })
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())

    const totalIncome = inRange
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const totalExpense = inRange
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    const total = inRange.length
    const offset = (page - 1) * limit
    const transactions = inRange.slice(offset, offset + limit).map(withCapability)

    return HttpResponse.json({
      success: true,
      data: {
        transactions,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        openingBalance,
        totalIncome,
        totalExpense,
        closingBalance: openingBalance + totalIncome - totalExpense,
        meta: buildMeta(),
      },
    })
  }),

  http.post(`${BASE}/reports/transactions`, async ({ request }) => {
    await delay(300)

    const body = (await request.json()) as Partial<MockFinanceTransaction>
    const resolvedReference = resolveMockManualReference(body)
    if (!resolvedReference) {
      return HttpResponse.json({ success: false, message: 'Linked reference not found' }, { status: 404 })
    }
    const now = new Date().toISOString()
    const transaction: MockFinanceTransaction = {
      id: `tx-${Date.now()}`,
      voucherNumber: buildMockVoucherNumber(body.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME', body.date ?? now),
      type: body.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
      amount: Number(body.amount ?? 0),
      description: body.description ?? '',
      category: body.category ?? null,
      paymentMethod: body.paymentMethod ?? 'CASH',
      branchId: body.branchId ?? null,
      branchName: mockBranches.find((branch) => branch.id === body.branchId)?.name ?? null,
      payerId: body.payerId ?? null,
      payerName: body.payerName ?? null,
      refType: resolvedReference.refType,
      refId: resolvedReference.refId,
      refNumber: resolvedReference.refNumber,
      notes: body.notes ?? null,
      tags: body.tags ?? null,
      source: 'MANUAL',
      isManual: true,
      date: body.date ?? now,
      createdAt: now,
      updatedAt: now,
      createdBy: { id: 'staff-1', name: 'Admin' },
    }

    mockFinanceTransactions.unshift(transaction)
    return HttpResponse.json({ success: true, data: withCapability(transaction) }, { status: 201 })
  }),

  http.get(`${BASE}/reports/transactions/:voucherNumber`, async ({ params }) => {
    await delay(150)

    const transaction = mockFinanceTransactions.find((item) => item.voucherNumber === params.voucherNumber)
    if (!transaction) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }

    return HttpResponse.json({ success: true, data: withCapability(transaction) })
  }),

  http.patch(`${BASE}/reports/transactions/:id`, async ({ params, request }) => {
    await delay(250)

    const index = mockFinanceTransactions.findIndex((item) => item.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }
    const current = mockFinanceTransactions[index]
    const capability = getTransactionCapability(current)

    const body = (await request.json()) as Partial<MockFinanceTransaction>
    const shouldUpdateReference = body.refType !== undefined || body.refId !== undefined || body.refNumber !== undefined
    const changedKeys = Object.entries(body)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
    const hasRestrictedChange =
      capability.editScope !== 'FULL' && changedKeys.some((key) => key !== 'notes')

    if (hasRestrictedChange) {
      return HttpResponse.json({ success: false, message: capability.lockReason }, { status: 403 })
    }

    const resolvedReference = shouldUpdateReference
      ? resolveMockManualReference({
          refType: body.refType ?? current.refType ?? 'MANUAL',
          refId: body.refId ?? current.refId,
          refNumber: body.refNumber,
        })
      : null

    if (shouldUpdateReference && !resolvedReference) {
      return HttpResponse.json({ success: false, message: 'Linked reference not found' }, { status: 404 })
    }

    mockFinanceTransactions[index] = {
      ...current,
      ...(capability.editScope === 'FULL' ? body : { notes: body.notes ?? current.notes }),
      ...(resolvedReference ?? {}),
      updatedAt: new Date().toISOString(),
      branchName: body.branchId
        ? mockBranches.find((branch) => branch.id === body.branchId)?.name ?? current.branchName
        : current.branchName,
    }

    return HttpResponse.json({ success: true, data: withCapability(mockFinanceTransactions[index]) })
  }),

  http.delete(`${BASE}/reports/transactions/:id`, async ({ params }) => {
    await delay(250)

    const index = mockFinanceTransactions.findIndex((item) => item.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }
    const capability = getTransactionCapability(mockFinanceTransactions[index]!)
    if (!capability.canDelete) {
      return HttpResponse.json({ success: false, message: capability.lockReason }, { status: 403 })
    }

    mockFinanceTransactions.splice(index, 1)
    return HttpResponse.json({ success: true, message: 'Deleted' })
  }),
]
