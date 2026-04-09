import { LEGACY_PERMISSION_ALIASES, PERMISSION_GROUPS, getRolePermissions } from '@petshop/auth'
import { http, HttpResponse, delay } from 'msw'

const BASE = '/api'

const mockBranches = [
  { id: 'br-1', name: 'Chi nhánh Quận 1', address: '123 Lê Lợi, Q.1, HCM', phone: '028.1234.5001', isActive: true },
  { id: 'br-2', name: 'Chi nhánh Bình Thạnh', address: '45 Đinh Bộ Lĩnh, Q.BT, HCM', phone: '028.1234.5002', isActive: true },
]

const mockAuthUser = {
  id: 'staff-super-admin',
  username: 'admin',
  fullName: 'Mock Super Admin',
  role: 'SUPER_ADMIN',
  staffCode: 'NV0001',
  branchId: mockBranches[0].id,
  authorizedBranches: mockBranches,
  permissions: getRolePermissions('SUPER_ADMIN'),
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const mockProducts = [
  {
    id: 'prod-1', name: 'Thức ăn chó Royal Canin 3kg', sku: 'RC-DOG-3KG',
    category: 'Thức ăn', brand: 'Royal Canin', unit: 'túi',
    salePrice: 450000, costPrice: 320000, stock: 24, minStock: 5, reservedStock: 2,
    image: null, variants: [], createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-2', name: 'Vòng cổ da thú cưng', sku: 'COL-LEATHER',
    category: 'Phụ kiện', brand: 'PetStyle', unit: 'cái',
    salePrice: 85000, costPrice: 50000, stock: 3, minStock: 10, reservedStock: 0,
    image: null, variants: [], createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-3', name: 'Sữa tắm chó mèo Bio-X 450ml', sku: 'BIOX-SHAMPOO',
    category: 'Vệ sinh', brand: 'Bio-X', unit: 'chai',
    salePrice: 95000, costPrice: 60000, stock: 18, minStock: 5, reservedStock: 0,
    image: null, variants: [], createdAt: new Date().toISOString(),
  },
]

const mockServices = [
  {
    id: 'svc-1', name: 'Tắm + Sấy chó nhỏ', type: 'GROOMING',
    basePrice: 120000, unit: 'lần', description: 'Dành cho chó dưới 10kg',
    variants: [], createdAt: new Date().toISOString(),
  },
  {
    id: 'svc-2', name: 'Cắt tỉa lông chó lớn', type: 'GROOMING',
    basePrice: 250000, unit: 'lần', description: 'Dành cho chó 10-25kg',
    variants: [], createdAt: new Date().toISOString(),
  },
  {
    id: 'svc-3', name: 'Lưu trú pet hotel — phòng tiêu chuẩn', type: 'HOTEL',
    basePrice: 180000, unit: 'đêm', description: 'Dành cho mọi kích cỡ',
    variants: [], createdAt: new Date().toISOString(),
  },
]

const mockSuppliers = [
  { id: 'sup-1', name: 'NCC Royal Canin HCM', phone: '0901234567', email: 'royalcanin@hcm.vn', address: 'Quận 1, HCM', createdAt: new Date().toISOString() },
  { id: 'sup-2', name: 'Phụ kiện Pet Hà Nội', phone: '0987654321', email: 'supply@pethn.vn', address: 'Hoàn Kiếm, HN', createdAt: new Date().toISOString() },
]

const mockReceipts = [
  {
    id: 'rcpt-1', status: 'RECEIVED', paymentStatus: 'PAID',
    totalAmount: 4500000, notes: 'Nhập hàng tháng 4',
    supplierId: 'sup-1', supplier: mockSuppliers[0],
    items: [{ productId: 'prod-1', quantity: 10, unitCost: 320000, product: mockProducts[0] }],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rcpt-2', status: 'DRAFT', paymentStatus: 'UNPAID',
    totalAmount: 850000, notes: null,
    supplierId: 'sup-2', supplier: mockSuppliers[1],
    items: [{ productId: 'prod-2', quantity: 10, unitCost: 50000, product: mockProducts[1] }],
    createdAt: new Date().toISOString(),
  },
]

const PROCUREMENT_MOCK_NOW = new Date('2026-04-06T09:00:00+07:00')

function procurementMockTime(daysOffset = 0, hour = 9, minute = 0) {
  const value = new Date(PROCUREMENT_MOCK_NOW)
  value.setDate(value.getDate() + daysOffset)
  value.setHours(hour, minute, 0, 0)
  return value.toISOString()
}

const procurementDemoSuppliers: any[] = [
  { id: 'sup-demo-1', name: 'Royal Demo Supplier', phone: '0988111222', email: 'royal.demo@petcare.local', address: 'Quan 1, TP HCM', notes: 'NCC demo thuc an va grooming', monthTarget: 18000000, yearTarget: 210000000, debt: 0, creditBalance: 300000, createdAt: procurementMockTime(-10, 8, 30) },
  { id: 'sup-demo-2', name: 'Accessory Demo Supplier', phone: '0988333444', email: 'accessory.demo@petcare.local', address: 'VSIP 1, Binh Duong', notes: 'NCC demo phu kien va don chot thieu', monthTarget: 12000000, yearTarget: 145000000, debt: 0, creditBalance: 0, createdAt: procurementMockTime(-9, 9, 15) },
  { id: 'sup-demo-3', name: 'Bio Groom Viet Nam', phone: '0919000102', email: 'bio@petcare.local', address: 'Di An, Binh Duong', notes: 'NCC grooming standard', monthTarget: 9000000, yearTarget: 108000000, debt: 0, creditBalance: 0, createdAt: procurementMockTime(-8, 10, 0) },
  { id: 'sup-demo-4', name: 'Natural Cat Litter', phone: '0919000105', email: 'litter@petcare.local', address: 'Hoc Mon, TP HCM', notes: 'NCC cat ve sinh', monthTarget: 8000000, yearTarget: 96000000, debt: 0, creditBalance: 0, createdAt: procurementMockTime(-7, 10, 45) },
]

const procurementDemoSupplierCredits: any[] = [
  {
    id: 'sp-credit-1',
    supplierId: 'sup-demo-1',
    paymentNumber: 'SP20260406001',
    amount: 300000,
    appliedAmount: 0,
    unappliedAmount: 300000,
    paidAt: procurementMockTime(0, 10, 10),
    paymentMethod: 'BANK',
    notes: 'Tam ung truoc cho don nhap nhap sau',
  },
]

const procurementDemoReceipts: any[] = [
  {
    id: 'proc-rcpt-1',
    receiptNumber: 'PO20260401001',
    status: 'RECEIVED',
    receiptStatus: 'FULL_RECEIVED',
    paymentStatus: 'PAID',
    supplierId: 'sup-demo-1',
    branchId: 'br-1',
    notes: 'Nhap du hai dot, thanh toan xong',
    createdAt: procurementMockTime(-5, 9, 0),
    receivedAt: procurementMockTime(-4, 14, 30),
    completedAt: procurementMockTime(-4, 14, 30),
    items: [
      { id: 'proc-rcpt-1-item-1', productId: 'prod-1', quantity: 10, receivedQuantity: 10, returnedQuantity: 0, closedQuantity: 0, unitCost: 320000 },
      { id: 'proc-rcpt-1-item-2', productId: 'prod-3', quantity: 20, receivedQuantity: 20, returnedQuantity: 0, closedQuantity: 0, unitCost: 60000 },
    ],
    paymentAllocations: [
      { id: 'proc-rcpt-1-pay-1', amount: 2000000, payment: { id: 'sp-alloc-1', paymentNumber: 'SP20260402001', paidAt: procurementMockTime(-4, 15, 0), paymentMethod: 'BANK', notes: 'Thanh toan dot 1' } },
      { id: 'proc-rcpt-1-pay-2', amount: 2400000, payment: { id: 'sp-alloc-2', paymentNumber: 'SP20260403001', paidAt: procurementMockTime(-3, 11, 15), paymentMethod: 'CASH', notes: 'Thanh toan dot 2' } },
    ],
    receiveEvents: [
      {
        id: 'proc-rcpt-1-recv-1',
        receiveNumber: 'RN20260402001',
        receivedAt: procurementMockTime(-4, 10, 20),
        totalQuantity: 20,
        totalAmount: 2240000,
        notes: 'Nhan dot 1',
        items: [
          { id: 'proc-rcpt-1-recv-1i-1', receiptItemId: 'proc-rcpt-1-item-1', productId: 'prod-1', quantity: 4, unitPrice: 320000, totalPrice: 1280000 },
          { id: 'proc-rcpt-1-recv-1i-2', receiptItemId: 'proc-rcpt-1-item-2', productId: 'prod-3', quantity: 16, unitPrice: 60000, totalPrice: 960000 },
        ],
      },
      {
        id: 'proc-rcpt-1-recv-2',
        receiveNumber: 'RN20260403001',
        receivedAt: procurementMockTime(-4, 14, 30),
        totalQuantity: 10,
        totalAmount: 2160000,
        notes: 'Nhan dot 2',
        items: [
          { id: 'proc-rcpt-1-recv-2i-1', receiptItemId: 'proc-rcpt-1-item-1', productId: 'prod-1', quantity: 6, unitPrice: 320000, totalPrice: 1920000 },
          { id: 'proc-rcpt-1-recv-2i-2', receiptItemId: 'proc-rcpt-1-item-2', productId: 'prod-3', quantity: 4, unitPrice: 60000, totalPrice: 240000 },
        ],
      },
    ],
    supplierReturns: [],
  },
  {
    id: 'proc-rcpt-2',
    receiptNumber: 'PO20260403002',
    status: 'DRAFT',
    receiptStatus: 'PARTIAL_RECEIVED',
    paymentStatus: 'PARTIAL',
    supplierId: 'sup-demo-2',
    branchId: 'br-1',
    notes: 'Da nhan mot phan, con doi NCC giao tiep',
    createdAt: procurementMockTime(-3, 8, 45),
    receivedAt: procurementMockTime(-2, 13, 10),
    items: [
      { id: 'proc-rcpt-2-item-1', productId: 'prod-2', quantity: 10, receivedQuantity: 6, returnedQuantity: 0, closedQuantity: 0, unitCost: 50000 },
      { id: 'proc-rcpt-2-item-2', productId: 'prod-3', quantity: 12, receivedQuantity: 8, returnedQuantity: 0, closedQuantity: 0, unitCost: 60000 },
    ],
    paymentAllocations: [
      { id: 'proc-rcpt-2-pay-1', amount: 400000, payment: { id: 'sp-alloc-3', paymentNumber: 'SP20260404001', paidAt: procurementMockTime(-2, 16, 0), paymentMethod: 'BANK', notes: 'Thanh toan mot phan sau dot nhap 1' } },
    ],
    receiveEvents: [
      {
        id: 'proc-rcpt-2-recv-1',
        receiveNumber: 'RN20260404001',
        receivedAt: procurementMockTime(-2, 13, 10),
        totalQuantity: 14,
        totalAmount: 780000,
        notes: 'Nhan dot 1',
        items: [
          { id: 'proc-rcpt-2-recv-1i-1', receiptItemId: 'proc-rcpt-2-item-1', productId: 'prod-2', quantity: 6, unitPrice: 50000, totalPrice: 300000 },
          { id: 'proc-rcpt-2-recv-1i-2', receiptItemId: 'proc-rcpt-2-item-2', productId: 'prod-3', quantity: 8, unitPrice: 60000, totalPrice: 480000 },
        ],
      },
    ],
    supplierReturns: [],
  },
  {
    id: 'proc-rcpt-3',
    receiptNumber: 'PO20260404003',
    status: 'RECEIVED',
    receiptStatus: 'SHORT_CLOSED',
    paymentStatus: 'PARTIAL',
    supplierId: 'sup-demo-2',
    branchId: 'br-2',
    notes: 'NCC giao thieu, da doi chieu va chot',
    createdAt: procurementMockTime(-2, 9, 20),
    receivedAt: procurementMockTime(-1, 11, 45),
    completedAt: procurementMockTime(0, 9, 15),
    shortClosedAt: procurementMockTime(0, 9, 15),
    items: [
      { id: 'proc-rcpt-3-item-1', productId: 'prod-2', quantity: 6, receivedQuantity: 5, returnedQuantity: 1, closedQuantity: 1, unitCost: 50000 },
      { id: 'proc-rcpt-3-item-2', productId: 'prod-1', quantity: 4, receivedQuantity: 2, returnedQuantity: 0, closedQuantity: 2, unitCost: 320000 },
    ],
    paymentAllocations: [
      { id: 'proc-rcpt-3-pay-1', amount: 600000, payment: { id: 'sp-alloc-4', paymentNumber: 'SP20260405001', paidAt: procurementMockTime(0, 10, 30), paymentMethod: 'BANK', notes: 'Thanh toan sau doi chieu chot thieu' } },
    ],
    receiveEvents: [
      {
        id: 'proc-rcpt-3-recv-1',
        receiveNumber: 'RN20260405001',
        receivedAt: procurementMockTime(-1, 11, 45),
        totalQuantity: 7,
        totalAmount: 890000,
        notes: 'Nhan dot duy nhat',
        items: [
          { id: 'proc-rcpt-3-recv-1i-1', receiptItemId: 'proc-rcpt-3-item-1', productId: 'prod-2', quantity: 5, unitPrice: 50000, totalPrice: 250000 },
          { id: 'proc-rcpt-3-recv-1i-2', receiptItemId: 'proc-rcpt-3-item-2', productId: 'prod-1', quantity: 2, unitPrice: 320000, totalPrice: 640000 },
        ],
      },
    ],
    supplierReturns: [
      {
        id: 'proc-sup-return-1',
        returnNumber: 'RT20260406001',
        totalAmount: 50000,
        creditedAmount: 50000,
        refundedAmount: 30000,
        returnedAt: procurementMockTime(0, 13, 15),
        notes: 'Tra lai 1 vong co loi',
        items: [
          { id: 'proc-sup-return-1-item-1', receiptItemId: 'proc-rcpt-3-item-1', productId: 'prod-2', quantity: 1, unitPrice: 50000, totalPrice: 50000, reason: 'Hang loi' },
        ],
        refunds: [
          { id: 'proc-sup-refund-1', refundNumber: 'RF20260406001', amount: 30000, paymentMethod: 'BANK', receivedAt: procurementMockTime(0, 16, 20), notes: 'NCC hoan mot phan' },
        ],
      },
    ],
  },
  {
    id: 'proc-rcpt-4',
    receiptNumber: 'PO20260406004',
    status: 'DRAFT',
    receiptStatus: 'DRAFT',
    paymentStatus: 'UNPAID',
    supplierId: 'sup-demo-1',
    branchId: 'br-1',
    notes: 'Don moi tao, chua nhap hang',
    createdAt: procurementMockTime(0, 9, 0),
    items: [
      { id: 'proc-rcpt-4-item-1', productId: 'prod-1', quantity: 8, receivedQuantity: 0, returnedQuantity: 0, closedQuantity: 0, unitCost: 320000 },
      { id: 'proc-rcpt-4-item-2', productId: 'prod-2', quantity: 6, receivedQuantity: 0, returnedQuantity: 0, closedQuantity: 0, unitCost: 50000 },
    ],
    paymentAllocations: [],
    receiveEvents: [],
    supplierReturns: [],
  },
]

const mockRoles = [
  {
    id: 'role-super-admin',
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Toàn quyền hệ thống',
    permissions: getRolePermissions('SUPER_ADMIN'),
    isSystem: true,
    _count: { users: 1 },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-admin',
    code: 'ADMIN',
    name: 'Quản trị viên',
    description: 'Quản trị vận hành toàn hệ thống',
    permissions: getRolePermissions('ADMIN'),
    isSystem: true,
    _count: { users: 2 },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-manager',
    code: 'MANAGER',
    name: 'Quản lý',
    description: 'Quản lý chi nhánh và đội ngũ',
    permissions: getRolePermissions('MANAGER'),
    isSystem: true,
    _count: { users: 3 },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-staff',
    code: 'STAFF',
    name: 'Nhân viên',
    description: 'Nhân viên vận hành tại cửa hàng',
    permissions: getRolePermissions('STAFF'),
    isSystem: true,
    _count: { users: 8 },
    createdAt: new Date().toISOString(),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function paginate<T>(items: T[], page = 1, limit = 20) {
  const total = items.length
  const skip = (page - 1) * limit
  const data = items.slice(skip, skip + limit)
  return { success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

function toNumber(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function cloneReceiptItems(items: any[] = []) {
  return items.map((item) => ({
    ...item,
    product: mockProducts.find((product) => product.id === item.productId) ?? item.product ?? null,
  }))
}

function recalculateProcurementReceipt(receipt: any) {
  const items = cloneReceiptItems(receipt.items ?? [])
  const totalAmount = items.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitCost), 0)
  const totalReceivedAmount = items.reduce((sum, item) => sum + toNumber(item.receivedQuantity) * toNumber(item.unitCost), 0)
  const totalReturnedAmount = items.reduce((sum, item) => sum + toNumber(item.returnedQuantity) * toNumber(item.unitCost), 0)
  const paidAmount = (receipt.paymentAllocations ?? []).reduce((sum: number, allocation: any) => sum + toNumber(allocation.amount), 0)
  const allFulfilled = items.every((item) => toNumber(item.receivedQuantity) + toNumber(item.closedQuantity) >= toNumber(item.quantity))
  const hasAnyReceive = items.some((item) => toNumber(item.receivedQuantity) > 0)
  const hasAnyClose = items.some((item) => toNumber(item.closedQuantity) > 0)
  const receiptStatus =
    receipt.cancelledAt
      ? 'CANCELLED'
      : allFulfilled && hasAnyClose
        ? 'SHORT_CLOSED'
        : allFulfilled && hasAnyReceive
          ? 'FULL_RECEIVED'
          : hasAnyReceive
            ? 'PARTIAL_RECEIVED'
            : 'DRAFT'
  const payableAmount = Math.max(0, totalReceivedAmount - totalReturnedAmount)
  const debtAmount = Math.max(0, payableAmount - paidAmount)
  const paymentStatus =
    payableAmount <= 0
      ? paidAmount > 0
        ? 'PAID'
        : 'UNPAID'
      : paidAmount <= 0
        ? 'UNPAID'
        : paidAmount < payableAmount
          ? 'PARTIAL'
          : 'PAID'

  Object.assign(receipt, {
    supplier: procurementDemoSuppliers.find((supplier) => supplier.id === receipt.supplierId) ?? null,
    branch: mockBranches.find((branch) => branch.id === receipt.branchId) ?? null,
    items,
    totalAmount,
    totalReceivedAmount,
    totalReturnedAmount,
    paidAmount,
    payableAmount,
    debtAmount,
    receivedAt:
      [...(receipt.receiveEvents ?? [])].sort((left: any, right: any) => new Date(right.receivedAt ?? 0).getTime() - new Date(left.receivedAt ?? 0).getTime())[0]?.receivedAt ?? null,
    status: receiptStatus === 'CANCELLED' ? 'CANCELLED' : receiptStatus === 'DRAFT' ? 'DRAFT' : 'RECEIVED',
    receiptStatus,
    paymentStatus,
  })

  return receipt
}

function syncProcurementSuppliers() {
  for (const supplier of procurementDemoSuppliers) {
    const receipts = procurementDemoReceipts
      .filter((receipt) => receipt.supplierId === supplier.id)
      .map((receipt) => recalculateProcurementReceipt(receipt))
    const debt = receipts.reduce((sum: number, receipt: any) => sum + toNumber(receipt.debtAmount), 0)
    const returnCredit = receipts.reduce(
      (sum, receipt) =>
        sum +
        (receipt.supplierReturns ?? []).reduce(
          (inner: number, supplierReturn: any) =>
            inner + Math.max(0, toNumber(supplierReturn.creditedAmount) - toNumber(supplierReturn.refundedAmount)),
          0,
        ),
      0,
    )
    const paymentCredit = procurementDemoSupplierCredits
      .filter((payment) => payment.supplierId === supplier.id)
      .reduce((sum, payment) => sum + toNumber(payment.unappliedAmount), 0)

    supplier.debt = debt
    supplier.creditBalance = paymentCredit + returnCredit
  }
}

function refreshProcurementMocks() {
  procurementDemoReceipts.forEach((receipt) => recalculateProcurementReceipt(receipt))
  syncProcurementSuppliers()
}

refreshProcurementMocks()

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const inventoryHandlers = [
  // ─── Products ───────────────────────────────────────────────────────────────
  http.get(`${BASE}/inventory/products`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get('search') ?? ''
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)

    let filtered = mockProducts
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q),
      )
    }
    return HttpResponse.json(paginate(filtered, page, limit))
  }),

  http.get(`${BASE}/inventory/products/:id`, async ({ params }) => {
    await delay(200)
    const product = mockProducts.find((p) => p.id === params.id)
    if (!product) return HttpResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 })
    return HttpResponse.json({ success: true, data: product })
  }),

  http.post(`${BASE}/inventory/products`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const newProduct = { id: `prod-${Date.now()}`, ...body, stock: body.stock ?? 0, reservedStock: 0, variants: [], createdAt: new Date().toISOString() }
    mockProducts.push(newProduct)
    return HttpResponse.json({ success: true, data: newProduct }, { status: 201 })
  }),

  http.put(`${BASE}/inventory/products/:id`, async ({ params, request }) => {
    await delay(300)
    const idx = mockProducts.findIndex((p) => p.id === params.id)
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 })
    const body = await request.json() as any
    mockProducts[idx] = { ...mockProducts[idx], ...body }
    return HttpResponse.json({ success: true, data: mockProducts[idx] })
  }),

  http.delete(`${BASE}/inventory/products/:id`, async ({ params }) => {
    await delay(300)
    const idx = mockProducts.findIndex((p) => p.id === params.id)
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 })
    mockProducts.splice(idx, 1)
    return HttpResponse.json({ success: true, message: 'Xóa sản phẩm thành công' })
  }),

  // ─── Services ───────────────────────────────────────────────────────────────
  http.get(`${BASE}/inventory/services`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const search = url.searchParams.get('search') ?? ''
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)

    let filtered = mockServices
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q))
    }
    return HttpResponse.json(paginate(filtered, page, limit))
  }),

  http.get(`${BASE}/inventory/services/:id`, async ({ params }) => {
    await delay(200)
    const service = mockServices.find((s) => s.id === params.id)
    if (!service) return HttpResponse.json({ success: false, message: 'Không tìm thấy dịch vụ' }, { status: 404 })
    return HttpResponse.json({ success: true, data: service })
  }),

  http.post(`${BASE}/inventory/services`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const svc = { id: `svc-${Date.now()}`, ...body, variants: [], createdAt: new Date().toISOString() }
    mockServices.push(svc)
    return HttpResponse.json({ success: true, data: svc }, { status: 201 })
  }),

  http.put(`${BASE}/inventory/services/:id`, async ({ params, request }) => {
    await delay(300)
    const idx = mockServices.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Không tìm thấy dịch vụ' }, { status: 404 })
    const body = await request.json() as any
    mockServices[idx] = { ...mockServices[idx], ...body }
    return HttpResponse.json({ success: true, data: mockServices[idx] })
  }),

  http.delete(`${BASE}/inventory/services/:id`, async ({ params }) => {
    await delay(300)
    const idx = mockServices.findIndex((s) => s.id === params.id)
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Không tìm thấy dịch vụ' }, { status: 404 })
    mockServices.splice(idx, 1)
    return HttpResponse.json({ success: true, message: 'Xóa dịch vụ thành công' })
  }),
]

export const stockHandlers = [
  // ─── Receipts ────────────────────────────────────────────────────────────────
  http.get(`${BASE}/stock/receipts`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    refreshProcurementMocks()
    return HttpResponse.json(paginate(procurementDemoReceipts, page, limit))
  }),

  http.get(`${BASE}/stock/receipts/:id`, async ({ params }) => {
    await delay(200)
    refreshProcurementMocks()
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.post(`${BASE}/stock/receipts`, async ({ request }) => {
    await delay(500)
    const body = await request.json() as any
    const totalAmount = body.items?.reduce((sum: number, i: any) => sum + i.quantity * i.unitCost, 0) ?? 0
    const receipt = {
      id: `proc-rcpt-${Date.now()}`,
      receiptNumber: `PO${Date.now()}`,
      ...body,
      status: 'DRAFT',
      receiptStatus: 'DRAFT',
      paymentStatus: 'UNPAID',
      totalAmount,
      totalReceivedAmount: 0,
      totalReturnedAmount: 0,
      paidAmount: 0,
      supplier: null,
      createdAt: new Date().toISOString(),
      items: (body.items ?? []).map((item: any, index: number) => ({
        id: `proc-rcpt-item-${Date.now()}-${index}`,
        productId: item.productId,
        quantity: Number(item.quantity ?? 0),
        receivedQuantity: 0,
        returnedQuantity: 0,
        closedQuantity: 0,
        unitCost: Number(item.unitCost ?? 0),
      })),
      paymentAllocations: [],
      receiveEvents: [],
      supplierReturns: [],
    }
    procurementDemoReceipts.push(receipt as any)
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt }, { status: 201 })
  }),

  http.patch(`${BASE}/stock/receipts/:id/receive`, async ({ params }) => {
    await delay(400)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    for (const item of receipt.items ?? []) {
      item.receivedQuantity = Number(item.quantity ?? 0)
    }
    receipt.receiveEvents = [
      ...(receipt.receiveEvents ?? []),
      {
        id: `proc-recv-${Date.now()}`,
        receiveNumber: `RN${Date.now()}`,
        receivedAt: new Date().toISOString(),
        totalQuantity: (receipt.items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
        totalAmount: (receipt.items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0) * Number(item.unitCost ?? 0), 0),
        notes: 'Nhan du hang tu thao tac nhanh',
        items: [],
      },
    ]
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, message: 'Nhận hàng thành công' })
  }),

  http.patch(`${BASE}/stock/receipts/:id/pay`, async ({ params }) => {
    await delay(300)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    receipt.paymentAllocations = [
      ...(receipt.paymentAllocations ?? []),
      {
        id: `proc-pay-${Date.now()}`,
        amount: Number(receipt.payableAmount ?? receipt.totalAmount ?? 0),
        payment: {
          id: `proc-sp-${Date.now()}`,
          paymentNumber: `SP${Date.now()}`,
          paidAt: new Date().toISOString(),
          paymentMethod: 'BANK',
          notes: 'Thanh toan nhanh mock',
        },
      },
    ]
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.patch(`${BASE}/stock/receipts/:id/cancel`, async ({ params }) => {
    await delay(300)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    receipt.cancelledAt = new Date().toISOString()
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt })
  }),

  // ─── Suggestions ──────────────────────────────────────────────────────────
  http.post(`${BASE}/stock/receipts/:id/payments`, async ({ params, request }) => {
    await delay(300)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p' }, { status: 404 })
    const body = await request.json() as any
    refreshProcurementMocks()
    const outstanding = Math.max(0, Number(receipt.payableAmount ?? 0) - Number(receipt.paidAmount ?? 0))
    const requestedAmount = Math.max(0, Number(body.amount ?? 0))
    const allocationAmount = Math.min(requestedAmount, outstanding)
    const creditAmount = Math.max(0, requestedAmount - allocationAmount)

    if (allocationAmount > 0) {
      receipt.paymentAllocations = [
        ...(receipt.paymentAllocations ?? []),
        {
          id: `proc-pay-${Date.now()}`,
          amount: allocationAmount,
          payment: {
            id: `proc-sp-${Date.now()}`,
            paymentNumber: `SP${Date.now()}`,
            paidAt: new Date().toISOString(),
            paymentMethod: body.paymentMethod ?? 'BANK',
            notes: body.notes ?? null,
          },
        },
      ]
    }

    if (creditAmount > 0) {
      procurementDemoSupplierCredits.push({
        id: `proc-credit-${Date.now()}`,
        supplierId: receipt.supplierId,
        paymentNumber: `SP${Date.now()}`,
        amount: creditAmount,
        appliedAmount: 0,
        unappliedAmount: creditAmount,
        paidAt: new Date().toISOString(),
        paymentMethod: body.paymentMethod ?? 'BANK',
        notes: body.notes ?? 'Thanh toan du de giu credit',
      })
    }

    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.post(`${BASE}/stock/suppliers/:supplierId/payments`, async ({ params, request }) => {
    await delay(300)
    const supplier = procurementDemoSuppliers.find((item) => item.id === params.supplierId)
    if (!supplier) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y nhÃ  cung cáº¥p' }, { status: 404 })
    const body = await request.json() as any
    procurementDemoSupplierCredits.push({
      id: `proc-credit-${Date.now()}`,
      supplierId: supplier.id,
      paymentNumber: `SP${Date.now()}`,
      amount: Number(body.amount ?? 0),
      appliedAmount: 0,
      unappliedAmount: Number(body.amount ?? 0),
      paidAt: new Date().toISOString(),
      paymentMethod: body.paymentMethod ?? 'BANK',
      notes: body.notes ?? null,
    })
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: supplier })
  }),

  http.post(`${BASE}/stock/receipts/:id/receivings`, async ({ params, request }) => {
    await delay(350)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p' }, { status: 404 })
    const body = await request.json() as any
    const eventItems = (body.items ?? [])
      .map((entry: any) => {
        const receiptItem = (receipt.items ?? []).find((item: any) => item.id === entry.receiptItemId)
        if (!receiptItem) return null
        const requestedQty = Math.max(0, Number(entry.quantity ?? 0))
        const remaining = Math.max(0, Number(receiptItem.quantity ?? 0) - Number(receiptItem.receivedQuantity ?? 0) - Number(receiptItem.closedQuantity ?? 0))
        const acceptedQty = Math.min(requestedQty, remaining)
        if (acceptedQty <= 0) return null
        receiptItem.receivedQuantity = Number(receiptItem.receivedQuantity ?? 0) + acceptedQty
        return {
          id: `proc-recv-item-${Date.now()}-${receiptItem.id}`,
          receiptItemId: receiptItem.id,
          productId: receiptItem.productId,
          quantity: acceptedQty,
          unitPrice: Number(receiptItem.unitCost ?? 0),
          totalPrice: acceptedQty * Number(receiptItem.unitCost ?? 0),
        }
      })
      .filter(Boolean)

    receipt.receiveEvents = [
      ...(receipt.receiveEvents ?? []),
      {
        id: `proc-recv-${Date.now()}`,
        receiveNumber: `RN${Date.now()}`,
        receivedAt: new Date().toISOString(),
        totalQuantity: eventItems.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
        totalAmount: eventItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice ?? 0), 0),
        notes: body.notes ?? null,
        items: eventItems,
      },
    ]
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.post(`${BASE}/stock/receipts/:id/close`, async ({ params, request }) => {
    await delay(300)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p' }, { status: 404 })
    const body = await request.json() as any
    for (const entry of body.items ?? []) {
      const receiptItem = (receipt.items ?? []).find((item: any) => item.id === entry.receiptItemId)
      if (!receiptItem) continue
      const requestedQty = Math.max(0, Number(entry.quantity ?? 0))
      const remaining = Math.max(0, Number(receiptItem.quantity ?? 0) - Number(receiptItem.receivedQuantity ?? 0) - Number(receiptItem.closedQuantity ?? 0))
      receiptItem.closedQuantity = Number(receiptItem.closedQuantity ?? 0) + Math.min(requestedQty, remaining)
    }
    receipt.shortClosedAt = new Date().toISOString()
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.post(`${BASE}/stock/receipts/:id/returns`, async ({ params, request }) => {
    await delay(320)
    const receipt = procurementDemoReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p' }, { status: 404 })
    const body = await request.json() as any
    const returnItems = (body.items ?? [])
      .map((entry: any) => {
        const receiptItem = (receipt.items ?? []).find((item: any) => item.id === entry.receiptItemId)
        if (!receiptItem) return null
        const requestedQty = Math.max(0, Number(entry.quantity ?? 0))
        const available = Math.max(0, Number(receiptItem.receivedQuantity ?? 0) - Number(receiptItem.returnedQuantity ?? 0))
        const acceptedQty = Math.min(requestedQty, available)
        if (acceptedQty <= 0) return null
        receiptItem.returnedQuantity = Number(receiptItem.returnedQuantity ?? 0) + acceptedQty
        return {
          id: `proc-return-item-${Date.now()}-${receiptItem.id}`,
          receiptItemId: receiptItem.id,
          productId: receiptItem.productId,
          quantity: acceptedQty,
          unitPrice: Number(receiptItem.unitCost ?? 0),
          totalPrice: acceptedQty * Number(receiptItem.unitCost ?? 0),
          reason: entry.reason ?? body.notes ?? null,
        }
      })
      .filter(Boolean)

    const supplierReturn = {
      id: `proc-return-${Date.now()}`,
      returnNumber: `RT${Date.now()}`,
      totalAmount: returnItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice ?? 0), 0),
      creditedAmount: returnItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice ?? 0), 0),
      refundedAmount: 0,
      returnedAt: new Date().toISOString(),
      notes: body.notes ?? null,
      items: returnItems,
      refunds: [],
    }
    receipt.supplierReturns = [...(receipt.supplierReturns ?? []), supplierReturn]
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: supplierReturn })
  }),

  http.post(`${BASE}/stock/returns/:id/refunds`, async ({ params, request }) => {
    await delay(300)
    const supplierReturn = procurementDemoReceipts
      .flatMap((receipt) => receipt.supplierReturns ?? [])
      .find((item) => item.id === params.id)
    if (!supplierReturn) return HttpResponse.json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y phiáº¿u tráº£ NCC' }, { status: 404 })
    const body = await request.json() as any
    const amount = Math.max(0, Number(body.amount ?? 0))
    supplierReturn.refunds = [
      ...(supplierReturn.refunds ?? []),
      {
        id: `proc-refund-${Date.now()}`,
        refundNumber: `RF${Date.now()}`,
        amount,
        paymentMethod: body.paymentMethod ?? 'BANK',
        receivedAt: new Date().toISOString(),
        notes: body.notes ?? null,
      },
    ]
    supplierReturn.refundedAmount = Number(supplierReturn.refundedAmount ?? 0) + amount
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: supplierReturn })
  }),

  http.get(`${BASE}/stock/suggestions`, async () => {
    await delay(300)
    const low = mockProducts.filter((p) => p.stock <= p.minStock)
    return HttpResponse.json({ success: true, data: low })
  }),

  // ─── Suppliers ────────────────────────────────────────────────────────────
  http.get(`${BASE}/stock/suppliers`, async () => {
    await delay(200)
    refreshProcurementMocks()
    const enriched = procurementDemoSuppliers.map((supplier) => {
      const receipts = procurementDemoReceipts.filter((receipt) => receipt.supplierId === supplier.id)
      const totalSpent = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.totalAmount ?? 0), 0)
      const totalOrders = receipts.length
      const debt = Number((supplier as any).debt ?? 0)
      return {
        ...supplier,
        isActive: (supplier as any).isActive ?? true,
        debt,
        stats: {
          totalOrders,
          totalSpent,
          totalDebt: debt,
          avgOrderValue: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
          spendLast30Days: totalSpent,
          ordersLast30Days: totalOrders,
          totalUnits: receipts.reduce((sum: number, receipt: any) => sum + (receipt.items ?? []).reduce((inner: number, item: any) => inner + Number(item.quantity ?? 0), 0), 0),
          uniqueProducts: new Set(receipts.flatMap((receipt) => (receipt.items ?? []).map((item: any) => item.productId))).size,
          lastOrderAt: receipts[0]?.createdAt ?? null,
        },
        evaluation: {
          score: totalOrders > 0 ? 78 : 50,
          label: totalOrders > 0 ? 'Ổn định' : 'Cần theo dõi',
          debtRatio: totalSpent > 0 ? debt / totalSpent : 0,
        },
      }
    })

    return HttpResponse.json({
      success: true,
      data: enriched,
      summary: {
        totalSuppliers: enriched.length,
        activeSuppliers: enriched.filter((supplier) => supplier.isActive !== false).length,
        suppliersWithDebt: enriched.filter((supplier) => Number(supplier.stats?.totalDebt ?? 0) > 0).length,
        totalDebt: enriched.reduce((sum: number, supplier: any) => sum + Number(supplier.stats?.totalDebt ?? 0), 0),
        spendLast30Days: enriched.reduce((sum: number, supplier: any) => sum + Number(supplier.stats?.spendLast30Days ?? 0), 0),
        avgEvaluationScore: enriched.length > 0 ? Math.round(enriched.reduce((sum: number, supplier: any) => sum + Number(supplier.evaluation?.score ?? 0), 0) / enriched.length) : 0,
      },
    })
  }),

  http.get(`${BASE}/stock/suppliers/:id`, async ({ params }) => {
    await delay(200)
    refreshProcurementMocks()
    const supplier = procurementDemoSuppliers.find((item) => item.id === params.id)
    if (!supplier) {
      return HttpResponse.json({ success: false, message: 'Không tìm thấy nhà cung cấp' }, { status: 404 })
    }

    const receipts = procurementDemoReceipts.filter((receipt) => receipt.supplierId === supplier.id)
    const totalSpent = receipts.reduce((sum: number, receipt: any) => sum + Number(receipt.totalAmount ?? 0), 0)
    const totalOrders = receipts.length
    const debt = Number((supplier as any).debt ?? 0)

    return HttpResponse.json({
      success: true,
      data: {
        ...supplier,
        isActive: (supplier as any).isActive ?? true,
        debt,
        stats: {
          totalOrders,
          totalSpent,
          totalDebt: debt,
          avgOrderValue: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
          spendLast30Days: totalSpent,
          ordersLast30Days: totalOrders,
          totalUnits: receipts.reduce((sum: number, receipt: any) => sum + (receipt.items ?? []).reduce((inner: number, item: any) => inner + Number(item.quantity ?? 0), 0), 0),
          uniqueProducts: new Set(receipts.flatMap((receipt) => (receipt.items ?? []).map((item: any) => item.productId))).size,
          lastOrderAt: receipts[0]?.createdAt ?? null,
        },
        evaluation: {
          score: totalOrders > 0 ? 78 : 50,
          label: totalOrders > 0 ? 'Ổn định' : 'Cần theo dõi',
          summary: totalOrders > 0 ? 'Mock supplier đang có lịch sử nhập hàng ổn định.' : 'Mock supplier chưa có nhiều giao dịch để đánh giá.',
          debtRatio: totalSpent > 0 ? debt / totalSpent : 0,
          factors: {
            recencyScore: totalOrders > 0 ? 82 : 40,
            frequencyScore: totalOrders > 1 ? 76 : 52,
            debtScore: totalSpent > 0 ? Math.max(40, Math.round(100 - (debt / totalSpent) * 100)) : 55,
            assortmentScore: Math.min(100, new Set(receipts.flatMap((receipt) => (receipt.items ?? []).map((item: any) => item.productId))).size * 25),
          },
        },
        recentReceipts: receipts.map((receipt) => ({
          ...receipt,
          paidAmount: receipt.paymentStatus === 'PAID' ? receipt.totalAmount : Math.max(0, receipt.totalAmount - debt),
          debtAmount: receipt.paymentStatus === 'PAID' ? 0 : debt,
          itemCount: (receipt.items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
        })),
        products: receipts.flatMap((receipt) =>
          (receipt.items ?? []).map((item: any) => ({
            key: item.productId,
            productId: item.productId,
            productVariantId: null,
            name: item.product?.name ?? 'Sản phẩm',
            sku: item.product?.sku ?? '',
            unit: item.product?.unit ?? 'cái',
            totalQty: Number(item.quantity ?? 0),
            lastUnitPrice: Number(item.unitCost ?? 0),
            lastOrderAt: receipt.createdAt,
          })),
        ),
      },
    })
  }),

  http.post(`${BASE}/stock/suppliers`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const sup = { id: `sup-${Date.now()}`, isActive: true, debt: 0, avatar: null, documents: [], monthTarget: null, yearTarget: null, ...body, createdAt: new Date().toISOString() }
    procurementDemoSuppliers.push(sup)
    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: sup }, { status: 201 })
  }),

  http.put(`${BASE}/stock/suppliers/:id`, async ({ params, request }) => {
    await delay(300)
    const body = await request.json() as any
    const index = procurementDemoSuppliers.findIndex((item) => item.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ success: false, message: 'Không tìm thấy nhà cung cấp' }, { status: 404 })
    }

    procurementDemoSuppliers[index] = {
      ...procurementDemoSuppliers[index],
      ...body,
    }

    refreshProcurementMocks()
    return HttpResponse.json({ success: true, data: procurementDemoSuppliers[index] })
  }),
]

export const reportsHandlers = [
  http.get(`${BASE}/reports/dashboard`, async () => {
    await delay(400)
    return HttpResponse.json({
      success: true,
      data: {
        todayRevenue: 4_850_000,
        todayOrderCount: 12,
        monthRevenue: 87_500_000,
        monthOrderCount: 234,
        totalCustomers: 1_432,
        newCustomersThisMonth: 38,
        lowStockCount: 2,
        pendingGrooming: 5,
        activeHotelStays: 3,
      },
    })
  }),

  http.get(`${BASE}/reports/revenue-chart`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const days = Number(url.searchParams.get('days') ?? 7)
    const data = Array.from({ length: days }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      return {
        date: date.toISOString().slice(0, 10),
        revenue: Math.floor(Math.random() * 5_000_000) + 1_000_000,
      }
    })
    return HttpResponse.json({ success: true, data })
  }),

  http.get(`${BASE}/reports/top-customers`, async () => {
    await delay(300)
    return HttpResponse.json({
      success: true,
      data: [
        { customer: { id: 'c1', fullName: 'Nguyễn Thị Lan', phone: '0901000001', customerCode: 'KH000001' }, totalSpent: 12_500_000, orderCount: 34 },
        { customer: { id: 'c2', fullName: 'Trần Văn Nam', phone: '0901000002', customerCode: 'KH000002' }, totalSpent: 8_200_000, orderCount: 21 },
        { customer: { id: 'c3', fullName: 'Lê Hoàng Anh', phone: '0901000003', customerCode: 'KH000003' }, totalSpent: 5_700_000, orderCount: 15 },
      ],
    })
  }),

  http.get(`${BASE}/reports/top-products`, async () => {
    await delay(300)
    return HttpResponse.json({
      success: true,
      data: [
        { product: { id: 'prod-1', name: 'Thức ăn chó Royal Canin 3kg', sku: 'RC-DOG-3KG' }, totalQuantity: 124, totalRevenue: 55_800_000 },
        { product: { id: 'prod-3', name: 'Sữa tắm chó mèo Bio-X 450ml', sku: 'BIOX-SHAMPOO' }, totalQuantity: 98, totalRevenue: 9_310_000 },
      ],
    })
  }),

  http.get(`${BASE}/reports/transactions`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const sampleTx = [
      { id: 'tx-1', voucherNumber: 'PT260403001', type: 'INCOME', amount: 450000, description: 'Thu tiền đơn hàng DH001', createdAt: new Date().toISOString() },
      { id: 'tx-2', voucherNumber: 'PC2604030001', type: 'EXPENSE', amount: 150000, description: 'Chi phí vệ sinh cửa hàng', createdAt: new Date().toISOString() },
    ]
    return HttpResponse.json(paginate(sampleTx, page, limit))
  }),

  http.post(`${BASE}/reports/transactions`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const now = new Date()
    const yy = String(now.getUTCFullYear()).slice(-2)
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const prefix = body.type === 'INCOME' ? 'PT' : 'PC'
    const width = body.type === 'INCOME' ? 3 : 4
    const tx = { id: `tx-${Date.now()}`, voucherNumber: `${prefix}${yy}${mm}${dd}${String(Math.floor(Math.random() * 999) + 1).padStart(width, '0')}`, ...body, createdAt: new Date().toISOString() }
    return HttpResponse.json({ success: true, data: tx }, { status: 201 })
  }),
]

export const settingsHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(200)
    const body = await request.json() as { username?: string }

    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        ...mockAuthUser,
        username: body.username?.trim() || mockAuthUser.username,
      },
    })
  }),

  http.post(`${BASE}/auth/refresh`, async () => {
    await delay(120)
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: mockAuthUser,
    })
  }),

  http.post(`${BASE}/auth/logout`, async () => {
    await delay(100)
    return HttpResponse.json({ success: true })
  }),

  http.get(`${BASE}/auth/me`, async () => {
    await delay(120)
    return HttpResponse.json(mockAuthUser)
  }),

  http.get(`${BASE}/settings/branches`, async () => {
    await delay(200)
    return HttpResponse.json({
      success: true,
      data: mockBranches,
    })
  }),

  http.get(`${BASE}/settings/configs`, async () => {
    await delay(200)
    return HttpResponse.json({
      success: true,
      data: { shopName: 'Petshop Nhật Minh', shopPhone: '028.1234.5678', currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' },
    })
  }),

  http.put(`${BASE}/settings/configs`, async ({ request }) => {
    await delay(300)
    const body = await request.json() as any
    return HttpResponse.json({ success: true, data: body })
  }),

  http.get(`${BASE}/settings/branches`, async () => {
    await delay(200)
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'br-1', name: 'Chi nhánh Quận 1', address: '123 Lê Lợi, Q.1, HCM', phone: '028.1234.5001', isActive: true },
        { id: 'br-2', name: 'Chi nhánh Bình Thạnh', address: '45 Đinh Bộ Lĩnh, Q.BT, HCM', phone: '028.1234.5002', isActive: true },
      ],
    })
  }),

  http.post(`${BASE}/settings/branches`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    return HttpResponse.json({ success: true, data: { id: `br-${Date.now()}`, ...body } }, { status: 201 })
  }),

  http.get(`${BASE}/roles`, async () => {
    await delay(250)
    return HttpResponse.json(mockRoles)
  }),

  http.get(`${BASE}/roles/permission-catalog`, async () => {
    await delay(250)
    return HttpResponse.json({
      groups: PERMISSION_GROUPS,
      legacyAliases: LEGACY_PERMISSION_ALIASES,
    })
  }),

  http.post(`${BASE}/roles`, async ({ request }) => {
    await delay(350)
    const body = await request.json() as any
    const role = {
      id: `role-${Date.now()}`,
      code: String(body.code ?? '').toUpperCase(),
      name: body.name ?? '',
      description: body.description ?? '',
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      isSystem: false,
      _count: { users: 0 },
      createdAt: new Date().toISOString(),
    }
    mockRoles.unshift(role)
    return HttpResponse.json(role, { status: 201 })
  }),

  http.put(`${BASE}/roles/:id`, async ({ params, request }) => {
    await delay(350)
    const body = await request.json() as any
    const index = mockRoles.findIndex((role) => role.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ message: 'Không tìm thấy vai trò' }, { status: 404 })
    }

    mockRoles[index] = {
      ...mockRoles[index],
      code: body.code !== undefined ? String(body.code).toUpperCase() : mockRoles[index].code,
      name: body.name ?? mockRoles[index].name,
      description: body.description ?? mockRoles[index].description,
      permissions: Array.isArray(body.permissions) ? body.permissions : mockRoles[index].permissions,
    }

    return HttpResponse.json(mockRoles[index])
  }),

  http.delete(`${BASE}/roles/:id`, async ({ params }) => {
    await delay(300)
    const index = mockRoles.findIndex((role) => role.id === params.id)
    if (index === -1) {
      return HttpResponse.json({ message: 'Không tìm thấy vai trò' }, { status: 404 })
    }

    mockRoles.splice(index, 1)
    return HttpResponse.json({ success: true })
  }),

  http.get(`${BASE}/customer-groups`, async () => {
    await delay(200)
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'grp-1', name: 'VIP', color: '#FFD700', discount: 10, description: 'Khách hàng VIP' },
        { id: 'grp-2', name: 'Thân thiết', color: '#C0C0C0', discount: 5, description: 'KH mua hàng thường xuyên' },
      ],
    })
  }),

  http.get(`${BASE}/activity-logs`, async ({ request }) => {
    await delay(300)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const logs = [
      { id: 'log-1', action: 'ORDER_COMPLETE', target: 'Order', description: 'Hoàn thành đơn DH001', createdAt: new Date().toISOString(), user: { id: 'u1', fullName: 'Admin', staffCode: 'NV00001' } },
      { id: 'log-2', action: 'CUSTOMER_CREATE', target: 'Customer', description: 'Tạo khách hàng KH000123', createdAt: new Date().toISOString(), user: { id: 'u1', fullName: 'Admin', staffCode: 'NV00001' } },
    ]
    return HttpResponse.json(paginate(logs, page, limit))
  }),

  http.post(`${BASE}/upload/image`, async () => {
    await delay(800)
    return HttpResponse.json({ success: true, url: '/uploads/images/mock-image.jpg' })
  }),

  http.post(`${BASE}/upload/file`, async () => {
    await delay(800)
    return HttpResponse.json({ success: true, url: '/uploads/files/mock-file.pdf', name: 'mock-file.pdf' })
  }),

  http.delete(`${BASE}/upload/file`, async () => {
    await delay(200)
    return HttpResponse.json({ success: true })
  }),
]
