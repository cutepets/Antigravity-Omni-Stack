import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'

export interface FindTransactionsDto {
  page?: number
  limit?: number
  type?: 'INCOME' | 'EXPENSE'
  dateFrom?: string
  dateTo?: string
}

export interface CreateTransactionDto {
  type: 'INCOME' | 'EXPENSE'
  amount: number
  description: string
  category?: string
  orderId?: string
  notes?: string
}

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

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
        where: { stock: { lte: 5 } }, // approximate low stock count
      }),
      this.db.groomingSession.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.db.hotelStay.count({ where: { status: 'CHECKED_IN' } }),
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
      totalRevenue: i._sum.subTotal ?? 0,
    }))

    return { success: true, data }
  }

  // ─── Finance / Sổ quỹ ────────────────────────────────────────────────────

  async findTransactions(query: FindTransactionsDto) {
    const { page = 1, limit = 20, type, dateFrom, dateTo } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}

    if (type) where.type = type
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [data, total] = await Promise.all([
      this.db.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.db.transaction.count({ where }),
    ])

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async createTransaction(dto: CreateTransactionDto) {
    // Generate voucher number: PT/PC-YYYYMMDD-XXXX
    const prefix = dto.type === 'INCOME' ? 'PT' : 'PC'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const count = await this.db.transaction.count()
    const voucherNumber = `${prefix}-${date}-${String(count + 1).padStart(4, '0')}`

    const tx = await this.db.transaction.create({
      data: { ...dto, voucherNumber } as any,
    })

    return { success: true, data: tx }
  }

  async findTransactionByVoucher(voucherNumber: string) {
    const tx = await this.db.transaction.findFirst({ where: { voucherNumber } as any })
    if (!tx) {
      return { success: false, message: 'Không tìm thấy phiếu thu/chi' }
    }
    return { success: true, data: tx }
  }
}
