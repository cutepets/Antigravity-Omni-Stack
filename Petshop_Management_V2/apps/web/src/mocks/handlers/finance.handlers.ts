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
  date: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string } | null
}

const mockBranches = [
  { id: 'br-1', name: 'Chi nhanh Quan 1' },
  { id: 'br-2', name: 'Chi nhanh Binh Thanh' },
]

const mockFinanceTransactions: MockFinanceTransaction[] = [
  {
    id: 'tx-1',
    voucherNumber: 'PT-20260403-0001',
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
    voucherNumber: 'PC-20260403-0001',
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
    voucherNumber: 'PC-20260404-0002',
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
    voucherNumber: 'PT-20260404-0003',
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
        voucherNumber: `PT-202604${String(20 - index).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
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
        voucherNumber: `PT-202604${String(20 - index).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
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
        notes: `POS trace: HOTEL_STAY:demo-hotel-${sequence} | HOTEL_CODE:HOTEL-DEMO-${String(sequence).padStart(3, '0')}`,
        tags: `FINANCE_DEMO,POS_ORDER,HOTEL_STAY:demo-hotel-${sequence},HOTEL_CODE:HOTEL-DEMO-${String(sequence).padStart(3, '0')}`,
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
        voucherNumber: `PC-202604${String(20 - index).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
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
      voucherNumber: `PT-202604${String(20 - index).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`,
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
    const transactions = inRange.slice(offset, offset + limit)

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
    const now = new Date().toISOString()
    const prefix = body.type === 'EXPENSE' ? 'PC' : 'PT'
    const voucherDate = now.slice(0, 10).replace(/-/g, '')

    const transaction: MockFinanceTransaction = {
      id: `tx-${Date.now()}`,
      voucherNumber: `${prefix}-${voucherDate}-${Math.floor(Math.random() * 9000) + 1000}`,
      type: body.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
      amount: Number(body.amount ?? 0),
      description: body.description ?? '',
      category: body.category ?? null,
      paymentMethod: body.paymentMethod ?? 'CASH',
      branchId: body.branchId ?? null,
      branchName: mockBranches.find((branch) => branch.id === body.branchId)?.name ?? null,
      payerId: body.payerId ?? null,
      payerName: body.payerName ?? null,
      refType: body.refType ?? 'MANUAL',
      refId: body.refId ?? null,
      refNumber: body.refNumber ?? null,
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
    return HttpResponse.json({ success: true, data: transaction }, { status: 201 })
  }),

  http.get(`${BASE}/reports/transactions/:voucherNumber`, async ({ params }) => {
    await delay(150)

    const transaction = mockFinanceTransactions.find((item) => item.voucherNumber === params.voucherNumber)
    if (!transaction) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }

    return HttpResponse.json({ success: true, data: transaction })
  }),

  http.patch(`${BASE}/reports/transactions/:id`, async ({ params, request }) => {
    await delay(250)

    const index = mockFinanceTransactions.findIndex((item) => item.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }
    if (!mockFinanceTransactions[index].isManual) {
      return HttpResponse.json({ success: false, message: 'Only manual transactions can be updated' }, { status: 400 })
    }

    const body = (await request.json()) as Partial<MockFinanceTransaction>
    mockFinanceTransactions[index] = {
      ...mockFinanceTransactions[index],
      ...body,
      updatedAt: new Date().toISOString(),
      branchName: body.branchId
        ? mockBranches.find((branch) => branch.id === body.branchId)?.name ?? mockFinanceTransactions[index].branchName
        : mockFinanceTransactions[index].branchName,
    }

    return HttpResponse.json({ success: true, data: mockFinanceTransactions[index] })
  }),

  http.delete(`${BASE}/reports/transactions/:id`, async ({ params }) => {
    await delay(250)

    const index = mockFinanceTransactions.findIndex((item) => item.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 })
    }
    if (!mockFinanceTransactions[index].isManual) {
      return HttpResponse.json({ success: false, message: 'Only manual transactions can be deleted' }, { status: 400 })
    }

    mockFinanceTransactions.splice(index, 1)
    return HttpResponse.json({ success: true, message: 'Deleted' })
  }),
]
