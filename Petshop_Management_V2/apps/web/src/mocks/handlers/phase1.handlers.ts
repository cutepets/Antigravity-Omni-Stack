import { http, HttpResponse, delay } from 'msw'

const BASE = '/api'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function paginate<T>(items: T[], page = 1, limit = 20) {
  const total = items.length
  const skip = (page - 1) * limit
  const data = items.slice(skip, skip + limit)
  return { success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

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
    return HttpResponse.json(paginate(mockReceipts, page, limit))
  }),

  http.get(`${BASE}/stock/receipts/:id`, async ({ params }) => {
    await delay(200)
    const receipt = mockReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.post(`${BASE}/stock/receipts`, async ({ request }) => {
    await delay(500)
    const body = await request.json() as any
    const totalAmount = body.items?.reduce((sum: number, i: any) => sum + i.quantity * i.unitCost, 0) ?? 0
    const receipt = { id: `rcpt-${Date.now()}`, ...body, status: 'DRAFT', paymentStatus: 'UNPAID', totalAmount, supplier: null, createdAt: new Date().toISOString() }
    mockReceipts.push(receipt as any)
    return HttpResponse.json({ success: true, data: receipt }, { status: 201 })
  }),

  http.patch(`${BASE}/stock/receipts/:id/receive`, async ({ params }) => {
    await delay(400)
    const receipt = mockReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    receipt.status = 'RECEIVED'
    return HttpResponse.json({ success: true, message: 'Nhận hàng thành công' })
  }),

  http.patch(`${BASE}/stock/receipts/:id/pay`, async ({ params }) => {
    await delay(300)
    const receipt = mockReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    receipt.paymentStatus = 'PAID'
    return HttpResponse.json({ success: true, data: receipt })
  }),

  http.patch(`${BASE}/stock/receipts/:id/cancel`, async ({ params }) => {
    await delay(300)
    const receipt = mockReceipts.find((r) => r.id === params.id)
    if (!receipt) return HttpResponse.json({ success: false, message: 'Không tìm thấy phiếu nhập' }, { status: 404 })
    receipt.status = 'CANCELLED'
    return HttpResponse.json({ success: true, data: receipt })
  }),

  // ─── Suggestions ──────────────────────────────────────────────────────────
  http.get(`${BASE}/stock/suggestions`, async () => {
    await delay(300)
    const low = mockProducts.filter((p) => p.stock <= p.minStock)
    return HttpResponse.json({ success: true, data: low })
  }),

  // ─── Suppliers ────────────────────────────────────────────────────────────
  http.get(`${BASE}/stock/suppliers`, async () => {
    await delay(200)
    return HttpResponse.json({ success: true, data: mockSuppliers })
  }),

  http.post(`${BASE}/stock/suppliers`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const sup = { id: `sup-${Date.now()}`, ...body, createdAt: new Date().toISOString() }
    mockSuppliers.push(sup)
    return HttpResponse.json({ success: true, data: sup }, { status: 201 })
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
        { customer: { id: 'c1', fullName: 'Nguyễn Thị Lan', phone: '0901000001', customerCode: 'KH-000001' }, totalSpent: 12_500_000, orderCount: 34 },
        { customer: { id: 'c2', fullName: 'Trần Văn Nam', phone: '0901000002', customerCode: 'KH-000002' }, totalSpent: 8_200_000, orderCount: 21 },
        { customer: { id: 'c3', fullName: 'Lê Hoàng Anh', phone: '0901000003', customerCode: 'KH-000003' }, totalSpent: 5_700_000, orderCount: 15 },
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
      { id: 'tx-1', voucherNumber: 'PT-20260403-0001', type: 'INCOME', amount: 450000, description: 'Thu tiền đơn hàng DH001', createdAt: new Date().toISOString() },
      { id: 'tx-2', voucherNumber: 'PC-20260403-0001', type: 'EXPENSE', amount: 150000, description: 'Chi phí vệ sinh cửa hàng', createdAt: new Date().toISOString() },
    ]
    return HttpResponse.json(paginate(sampleTx, page, limit))
  }),

  http.post(`${BASE}/reports/transactions`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as any
    const prefix = body.type === 'INCOME' ? 'PT' : 'PC'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const tx = { id: `tx-${Date.now()}`, voucherNumber: `${prefix}-${date}-${Math.floor(Math.random() * 9000) + 1000}`, ...body, createdAt: new Date().toISOString() }
    return HttpResponse.json({ success: true, data: tx }, { status: 201 })
  }),
]

export const settingsHandlers = [
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
      { id: 'log-2', action: 'CUSTOMER_CREATE', target: 'Customer', description: 'Tạo khách hàng KH-000123', createdAt: new Date().toISOString(), user: { id: 'u1', fullName: 'Admin', staffCode: 'NV00001' } },
    ]
    return HttpResponse.json(paginate(logs, page, limit))
  }),

  http.post(`${BASE}/upload/image`, async () => {
    await delay(800)
    return HttpResponse.json({ success: true, url: '/uploads/images/mock-image.jpg' })
  }),
]
