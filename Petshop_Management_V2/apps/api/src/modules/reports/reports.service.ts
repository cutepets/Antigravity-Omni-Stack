import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'

type FinanceTransactionType = 'INCOME' | 'EXPENSE'
type FinanceTransactionSource =
  | 'MANUAL'
  | 'ORDER_PAYMENT'
  | 'ORDER_ADJUSTMENT'
  | 'STOCK_RECEIPT'
  | 'HOTEL'
  | 'GROOMING'
  | 'OTHER'

const TRANSACTION_SOURCES: FinanceTransactionSource[] = [
  'MANUAL',
  'ORDER_PAYMENT',
  'ORDER_ADJUSTMENT',
  'STOCK_RECEIPT',
  'HOTEL',
  'GROOMING',
  'OTHER',
]

const TRANSACTION_REF_TYPES = [
  'MANUAL',
  'ORDER',
  'STOCK_RECEIPT',
  'HOTEL_STAY',
  'GROOMING_SESSION',
  'OTHER',
] as const

const SEARCHABLE_FIELDS = ['voucherNumber', 'refNumber', 'payerName', 'description', 'payerId'] as const

export interface FindTransactionsDto {
  page?: number | string
  limit?: number | string
  type?: 'ALL' | FinanceTransactionType
  dateFrom?: string
  dateTo?: string
  search?: string
  branchId?: string
  paymentMethod?: string
  createdById?: string
  source?: FinanceTransactionSource | 'ALL'
  refNumber?: string
  description?: string
  payerName?: string
  includeMeta?: boolean | string
}

export interface CreateTransactionDto {
  type: FinanceTransactionType
  amount: number
  description: string
  category?: string
  paymentMethod?: string
  branchId?: string
  branchName?: string
  payerName?: string
  payerId?: string
  refType?: 'MANUAL'
  refId?: string
  refNumber?: string
  notes?: string
  tags?: string
  date?: string
}

export interface UpdateTransactionDto {
  amount?: number
  description?: string
  category?: string
  paymentMethod?: string
  branchId?: string
  branchName?: string
  payerName?: string
  payerId?: string
  notes?: string
  tags?: string
  date?: string
}

function startOfDay(value: string) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value: string) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function toBoolean(value: boolean | string | undefined, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return fallback
}

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  private buildVoucherNumber(type: FinanceTransactionType) {
    const prefix = type === 'INCOME' ? 'PT' : 'PC'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `${prefix}-${date}-${random}`
  }

  private normalizeTransaction(tx: any) {
    return {
      id: tx.id,
      voucherNumber: tx.voucherNumber,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category ?? null,
      notes: tx.notes ?? null,
      tags: tx.tags ?? null,
      source: tx.source ?? 'OTHER',
      isManual: tx.isManual ?? (tx.source === 'MANUAL'),
      date: tx.date,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      createdBy: tx.staff
        ? {
            id: tx.staff.id,
            name: tx.staff.fullName,
          }
        : null,
    }
  }

  private buildTransactionWhere(query: FindTransactionsDto, options?: { beforeDate?: Date }) {
    const where: any = {}

    if (query.type && query.type !== 'ALL') where.type = query.type
    if (query.createdById) where.staffId = query.createdById

    if (options?.beforeDate) {
      where.date = { lt: options.beforeDate }
    } else if (query.dateFrom || query.dateTo) {
      where.date = {}
      if (query.dateFrom) where.date.gte = startOfDay(query.dateFrom)
      if (query.dateTo) where.date.lte = endOfDay(query.dateTo)
    }

    const searchTerms = query.search?.trim().split(/\s+/).filter(Boolean) ?? []
    if (searchTerms.length > 0) {
      where.AND = searchTerms.map((term) => ({
        OR: SEARCHABLE_FIELDS.map((field) => ({
          [field]: { contains: term, mode: 'insensitive' },
        })),
      }))
    }

    return where
  }

  async getDashboard() {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const [
      todayOrders,
      monthOrders,
      totalCustomers,
      newCustomersThisMonth,
      lowStockCount,
      pendingGrooming,
      activeHotelStays,
    ] = await Promise.all([
      this.db.order.aggregate({
        where: { createdAt: { gte: startOfDay }, paymentStatus: { in: ['PAID', 'COMPLETED'] } },
        _sum: { total: true },
        _count: true,
      }),
      this.db.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, paymentStatus: { in: ['PAID', 'COMPLETED'] } },
        _sum: { total: true },
        _count: true,
      }),
      this.db.customer.count(),
      this.db.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.db.product.count({
        // @ts-ignore
        where: { stock: { lte: 5 } },
      }),
      this.db.groomingSession.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.db.hotelStay.count({ where: { status: 'CHECKED_IN' } } as any),
    ])

    return {
      success: true,
      data: {
        todayRevenue: todayOrders._sum.total ?? 0,
        todayOrderCount: todayOrders._count,
        monthRevenue: monthOrders._sum.total ?? 0,
        monthOrderCount: monthOrders._count,
        totalCustomers,
        newCustomersThisMonth,
        lowStockCount,
        pendingGrooming,
        activeHotelStays,
      },
    }
  }

  async getRevenueChart(days: number = 7) {
    const result: { date: string; revenue: number }[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const agg = await this.db.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          paymentStatus: { in: ['PAID', 'COMPLETED'] },
        },
        _sum: { total: true },
      })

      result.push({
        date: start.toISOString().slice(0, 10),
        revenue: agg._sum.total ?? 0,
      })
    }

    return { success: true, data: result }
  }

  async getTopCustomers(limit: number = 10) {
    const orders = await this.db.order.groupBy({
      by: ['customerId'] as any,
      where: { paymentStatus: { in: ['PAID', 'COMPLETED'] } },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: Number(limit),
    })

    const customerIds = orders.map((o: any) => o.customerId).filter(Boolean)
    const customers = await this.db.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true, phone: true, customerCode: true },
    })

    const data = orders.map((o: any) => ({
      customer: customers.find((c: any) => c.id === o.customerId),
      totalSpent: o._sum.total ?? 0,
      orderCount: o._count,
    }))

    return { success: true, data }
  }

  async getTopProducts(limit: number = 10) {
    const items = await this.db.orderItem.groupBy({
      by: ['productId'] as any,
      where: { productId: { not: null } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: Number(limit),
    })

    const productIds = items.map((i: any) => i.productId).filter(Boolean)
    const products = await this.db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    })

    const data = items.map((i: any) => ({
      product: products.find((p: any) => p.id === i.productId),
      totalQuantity: i._sum.quantity ?? 0,
      totalRevenue: i._sum.subtotal ?? 0,
    }))

    return { success: true, data }
  }

  async findTransactions(query: FindTransactionsDto) {
    const page = toPositiveInt(query.page, 1)
    const limit = toPositiveInt(query.limit, 20)
    const skip = (page - 1) * limit
    const where = this.buildTransactionWhere(query)
    const openingWhere = query.dateFrom
      ? this.buildTransactionWhere(query, { beforeDate: startOfDay(query.dateFrom) })
      : null
    const includeMeta = toBoolean(query.includeMeta, true)

    const listPromise = Promise.all([
      this.db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          staff: { select: { id: true, fullName: true } },
        },
      }),
      this.db.transaction.count({ where }),
      this.db.transaction.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.db.transaction.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      openingWhere
        ? this.db.transaction.aggregate({
            where: { ...openingWhere, type: 'INCOME' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      openingWhere
        ? this.db.transaction.aggregate({
            where: { ...openingWhere, type: 'EXPENSE' },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
    ])

    const metaPromise = includeMeta
      ? Promise.all([
          this.db.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          }),
          this.db.user.findMany({
            where: { transactions: { some: {} } },
            select: { id: true, fullName: true },
            orderBy: { fullName: 'asc' },
          }),
        ])
      : Promise.resolve(null)

    const [[rows, total, incomeAgg, expenseAgg, openingIncomeAgg, openingExpenseAgg], metaResult] =
      await Promise.all([listPromise, metaPromise])

    const openingBalance = (openingIncomeAgg._sum.amount ?? 0) - (openingExpenseAgg._sum.amount ?? 0)
    const totalIncome = incomeAgg._sum.amount ?? 0
    const totalExpense = expenseAgg._sum.amount ?? 0
    const closingBalance = openingBalance + totalIncome - totalExpense

    const data: any = {
      transactions: rows.map((tx) => this.normalizeTransaction(tx)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      openingBalance,
      totalIncome,
      totalExpense,
      closingBalance,
    }

    if (metaResult) {
      const [branches, creators] = metaResult
      data.meta = {
        branches,
        paymentMethods: [],
        creators: creators.map((item) => ({ id: item.id, name: item.fullName })),
        sources: TRANSACTION_SOURCES,
      }
    }

    return { success: true, data }
  }

  async createTransaction(dto: CreateTransactionDto, staffId: string) {
    if (!dto.type) throw new BadRequestException('Thiếu loại giao dịch')
    if (!dto.description?.trim()) throw new BadRequestException('Mô tả giao dịch là bắt buộc')
    if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
      throw new BadRequestException('Số tiền phải lớn hơn 0')
    }
    if (dto.refType && dto.refType !== 'MANUAL') {
      throw new BadRequestException('Phiếu tạo thủ công chỉ hỗ trợ refType MANUAL')
    }

    const txDate = dto.date ? new Date(dto.date) : new Date()
    if (Number.isNaN(txDate.getTime())) {
      throw new BadRequestException('Ngày giao dịch không hợp lệ')
    }

    const branch = dto.branchId
      ? await this.db.branch.findUnique({
          where: { id: dto.branchId },
          select: { id: true, name: true },
        })
      : null

    if (dto.branchId && !branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh')
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const voucherNumber = this.buildVoucherNumber(dto.type)
      try {
        const tx = await this.db.transaction.create({
          data: {
            voucherNumber,
            type: dto.type,
            amount: Number(dto.amount),
            description: dto.description.trim(),
            category: dto.category?.trim() || null,
            staffId,
            date: txDate,
          } as any,
          include: {
            staff: { select: { id: true, fullName: true } },
          },
        })

        return { success: true, data: this.normalizeTransaction(tx) }
      } catch (error: any) {
        if (error?.code !== 'P2002') {
          throw error
        }
      }
    }

    throw new Error('Không thể tạo số chứng từ duy nhất, vui lòng thử lại')
  }

  async updateTransaction(id: string, dto: UpdateTransactionDto, _staffId: string) {
    const existing = await this.db.transaction.findUnique({ where: { id } as any })
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phiếu thu/chi')
    }

    if (dto.amount !== undefined && (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0)) {
      throw new BadRequestException('Số tiền phải lớn hơn 0')
    }

    let txDate: Date | undefined
    if (dto.date !== undefined) {
      txDate = new Date(dto.date)
      if (Number.isNaN(txDate.getTime())) {
        throw new BadRequestException('Ngày giao dịch không hợp lệ')
      }
    }

    const branch = dto.branchId
      ? await this.db.branch.findUnique({
          where: { id: dto.branchId },
          select: { id: true, name: true },
        })
      : null

    if (dto.branchId && !branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh')
    }

    const updated = await this.db.transaction.update({
      where: { id } as any,
      data: {
        ...(dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(txDate ? { date: txDate } : {}),
      } as any,
      include: {
        staff: { select: { id: true, fullName: true } },
      },
    })

    return { success: true, data: this.normalizeTransaction(updated) }
  }

  async removeTransaction(id: string) {
    const existing = await this.db.transaction.findUnique({ where: { id } as any })
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phiếu thu/chi')
    }

    await this.db.transaction.delete({ where: { id } as any })
    return { success: true, message: 'Đã xóa phiếu thu/chi thủ công' }
  }

  async findTransactionByVoucher(voucherNumber: string) {
    const tx = await this.db.transaction.findFirst({
      where: { voucherNumber } as any,
      include: {
        staff: { select: { id: true, fullName: true } },
      },
    })

    if (!tx) {
      return { success: false, message: 'Không tìm thấy phiếu thu/chi' }
    }

    return { success: true, data: this.normalizeTransaction(tx) }
  }
}
