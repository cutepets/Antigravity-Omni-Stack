import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js'
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
type TransactionEditScope = 'FULL' | 'NOTES_ONLY'

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
const MANUAL_REFERENCE_TYPES = ['MANUAL', 'ORDER', 'STOCK_RECEIPT'] as const

const SEARCHABLE_FIELDS = ['voucherNumber', 'refNumber', 'payerName', 'description', 'payerId'] as const
const MANUAL_FULL_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000
const NOTE_ONLY_FIELDS = ['notes'] as const

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
  refType?: (typeof MANUAL_REFERENCE_TYPES)[number]
  refId?: string
  refNumber?: string
  notes?: string
  tags?: string
  date?: string
  attachmentUrl?: string
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
  refType?: (typeof MANUAL_REFERENCE_TYPES)[number]
  refId?: string
  refNumber?: string
  notes?: string
  tags?: string
  date?: string
  attachmentUrl?: string
}

type TransactionCapability = {
  editScope: TransactionEditScope
  canDelete: boolean
  lockReason: string | null
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

  private buildVoucherNumber(type: FinanceTransactionType, issuedAt: Date) {
    return generateFinanceVoucherNumber(this.db, type, issuedAt)
  }

  private getBranchIdFilter(user?: BranchScopedUser, requestedBranchId?: string | null) {
    const scopedBranchIds = getScopedBranchIds(user, requestedBranchId)
    if (!scopedBranchIds) return undefined
    return scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }
  }

  private normalizeManualReferenceType(refType?: string | null): (typeof MANUAL_REFERENCE_TYPES)[number] {
    const normalized = (refType ?? 'MANUAL').trim().toUpperCase()
    if ((MANUAL_REFERENCE_TYPES as readonly string[]).includes(normalized)) {
      return normalized as (typeof MANUAL_REFERENCE_TYPES)[number]
    }

    throw new BadRequestException('refType khong hop le')
  }

  private async resolveManualReference(params: {
    refType?: string | null | undefined
    refId?: string | null | undefined
    refNumber?: string | null | undefined
    user?: BranchScopedUser | undefined
  }) {
    const refType = this.normalizeManualReferenceType(params.refType)
    const rawRefId = params.refId?.trim() || null
    const rawRefNumber = params.refNumber?.trim() || null

    if (refType === 'MANUAL') {
      return {
        refType: 'MANUAL' as const,
        refId: null,
        refNumber: null,
      }
    }

    if (!rawRefId && !rawRefNumber) {
      throw new BadRequestException(
        refType === 'ORDER' ? 'Vui long nhap ma don hang de lien ket' : 'Vui long nhap ma phieu nhap de lien ket',
      )
    }

    if (refType === 'ORDER') {
      const orderWhere: Array<{ id: string } | { orderNumber: string }> = []
      if (rawRefId) orderWhere.push({ id: rawRefId })
      if (rawRefNumber) orderWhere.push({ orderNumber: rawRefNumber })
      const order = await this.db.order.findFirst({
        where: { OR: orderWhere },
        select: { id: true, orderNumber: true, branchId: true },
      })

      if (!order) {
        throw new NotFoundException('Khong tim thay don hang de lien ket')
      }

      assertBranchAccess(order.branchId, params.user)

      return {
        refType: 'ORDER' as const,
        refId: order.id,
        refNumber: order.orderNumber,
      }
    }

    const receiptWhere: Array<{ id: string } | { receiptNumber: string }> = []
    if (rawRefId) receiptWhere.push({ id: rawRefId })
    if (rawRefNumber) receiptWhere.push({ receiptNumber: rawRefNumber })
    const receipt = await this.db.stockReceipt.findFirst({
      where: { OR: receiptWhere },
      select: { id: true, receiptNumber: true, branchId: true },
    })

    if (!receipt) {
      throw new NotFoundException('Khong tim thay phieu nhap de lien ket')
    }

    assertBranchAccess(receipt.branchId, params.user)

    return {
      refType: 'STOCK_RECEIPT' as const,
      refId: receipt.id,
      refNumber: receipt.receiptNumber,
    }
  }

  private getTransactionCapability(tx: { isManual?: boolean | null; source?: string | null; createdAt?: Date | string | null }): TransactionCapability {
    const isManual = tx.isManual ?? tx.source === 'MANUAL'
    const createdAt = tx.createdAt ? new Date(tx.createdAt) : null
    const createdAtMs = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : Date.now()

    if (!isManual) {
      return {
        editScope: 'NOTES_ONLY',
        canDelete: false,
        lockReason: 'Phiếu đồng bộ chỉ được cập nhật ghi chú.',
      }
    }

    if (Date.now() - createdAtMs <= MANUAL_FULL_EDIT_WINDOW_MS) {
      return {
        editScope: 'FULL',
        canDelete: true,
        lockReason: null,
      }
    }

    return {
      editScope: 'NOTES_ONLY',
      canDelete: false,
      lockReason: 'Phiếu tự tạo chỉ được sửa hoặc xóa toàn bộ trong 24 giờ đầu. Sau đó chỉ còn sửa ghi chú.',
    }
  }

  private normalizeTransaction(tx: any) {
    const capability = this.getTransactionCapability(tx)

    return {
      id: tx.id,
      voucherNumber: tx.voucherNumber,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category ?? null,
      paymentMethod: tx.paymentMethod ?? null,
      branchId: tx.branchId ?? null,
      branchName: tx.branchName ?? tx.branch?.name ?? null,
      payerId: tx.payerId ?? null,
      payerName: tx.payerName ?? null,
      refType: tx.refType ?? null,
      refId: tx.refId ?? null,
      refNumber: tx.refNumber ?? null,
      notes: tx.notes ?? null,
      tags: tx.tags ?? null,
      source: tx.source ?? 'OTHER',
      isManual: tx.isManual ?? (tx.source === 'MANUAL'),
      attachmentUrl: tx.attachmentUrl ?? null,
      editScope: capability.editScope,
      canDelete: capability.canDelete,
      lockReason: capability.lockReason,
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

  private buildTransactionWhere(
    query: FindTransactionsDto,
    options?: { beforeDate?: Date; user?: BranchScopedUser; requestedBranchId?: string | null },
  ) {
    const where: any = {}
    const branchIdFilter = this.getBranchIdFilter(options?.user, query.branchId ?? options?.requestedBranchId)

    if (query.type && query.type !== 'ALL') where.type = query.type
    if (query.createdById) where.staffId = query.createdById
    if (branchIdFilter !== undefined) where.branchId = branchIdFilter
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod
    if (query.source && query.source !== 'ALL') where.source = query.source
    if (query.refNumber?.trim()) where.refNumber = { contains: query.refNumber.trim(), mode: 'insensitive' }
    if (query.description?.trim()) where.description = { contains: query.description.trim(), mode: 'insensitive' }
    if (query.payerName?.trim()) where.payerName = { contains: query.payerName.trim(), mode: 'insensitive' }

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

  async getDashboard(user?: BranchScopedUser, requestedBranchId?: string) {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const branchScope = branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}
    const customerBranchWhere = branchIdFilter !== undefined ? { branchId: branchIdFilter } : null

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
        where: { ...branchScope, createdAt: { gte: startOfDay }, paymentStatus: { in: ['PAID', 'COMPLETED'] } },
        _sum: { total: true },
        _count: true,
      }),
      this.db.order.aggregate({
        where: { ...branchScope, createdAt: { gte: startOfMonth }, paymentStatus: { in: ['PAID', 'COMPLETED'] } },
        _sum: { total: true },
        _count: true,
      }),
      customerBranchWhere ? this.db.customer.count({ where: customerBranchWhere }) : this.db.customer.count(),
      this.db.customer.count({
        where: { ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}), createdAt: { gte: startOfMonth } },
      }),
      this.db.branchStock.count({
        where: { ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}), stock: { lte: 5 } },
      }),
      this.db.groomingSession.count({ where: { ...branchScope, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.db.hotelStay.count({ where: { ...branchScope, status: 'CHECKED_IN' } } as any),
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

  async getRevenueChart(days: number = 7, user?: BranchScopedUser, requestedBranchId?: string) {
    const result: { date: string; revenue: number }[] = []
    const today = new Date()
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const branchScope = branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

      const agg = await this.db.order.aggregate({
        where: {
          ...branchScope,
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

  async getTopCustomers(limit: number = 10, user?: BranchScopedUser, requestedBranchId?: string) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const orders = await this.db.order.groupBy({
      by: ['customerId'] as any,
      where: {
        ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
        paymentStatus: { in: ['PAID', 'COMPLETED'] },
      },
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

  async getTopProducts(limit: number = 10, user?: BranchScopedUser, requestedBranchId?: string) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const items = await this.db.orderItem.groupBy({
      by: ['productId'] as any,
      where: {
        productId: { not: null },
        ...(branchIdFilter !== undefined ? { order: { is: { branchId: branchIdFilter } } } : {}),
      },
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

  async findTransactions(query: FindTransactionsDto, user?: BranchScopedUser, requestedBranchId?: string) {
    const page = toPositiveInt(query.page, 1)
    const limit = toPositiveInt(query.limit, 20)
    const skip = (page - 1) * limit
    const branchIdFilter = this.getBranchIdFilter(user, query.branchId ?? requestedBranchId)
    const where = this.buildTransactionWhere(query, {
      ...(user ? { user } : {}),
      ...(requestedBranchId !== undefined ? { requestedBranchId } : {}),
    })
    const openingWhere = query.dateFrom
      ? this.buildTransactionWhere(query, {
          beforeDate: startOfDay(query.dateFrom),
          ...(user ? { user } : {}),
          ...(requestedBranchId !== undefined ? { requestedBranchId } : {}),
        })
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
          branch: { select: { id: true, name: true } },
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
            where: {
              isActive: true,
              ...(branchIdFilter !== undefined ? { id: branchIdFilter } : {}),
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          }),
          this.db.user.findMany({
            where: {
              transactions: {
                some: branchIdFilter !== undefined ? { branchId: branchIdFilter } : {},
              },
            },
            select: { id: true, fullName: true },
            orderBy: { fullName: 'asc' },
          }),
          this.db.transaction.findMany({
            where: {
              ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
              paymentMethod: { not: null },
            },
            select: { paymentMethod: true },
            distinct: ['paymentMethod'],
          }),
          this.db.transaction.findMany({
            where: {
              ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
            },
            select: { source: true },
            distinct: ['source'],
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
      const [branches, creators, paymentMethods, sources] = metaResult
      data.meta = {
        branches,
        paymentMethods: paymentMethods
          .map((item) => item.paymentMethod)
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => left.localeCompare(right)),
        creators: creators.map((item) => ({ id: item.id, name: item.fullName })),
        sources: Array.from(new Set([...TRANSACTION_SOURCES, ...sources.map((item) => item.source).filter(Boolean)])).sort(),
      }
    }

    return { success: true, data }
  }

  async createTransaction(
    dto: CreateTransactionDto,
    staffId: string,
    user?: BranchScopedUser,
    requestedBranchId?: string,
  ) {
    if (!dto.type) throw new BadRequestException('Thiếu loại giao dịch')
    if (!dto.description?.trim()) throw new BadRequestException('Mô tả giao dịch là bắt buộc')
    if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
      throw new BadRequestException('Số tiền phải lớn hơn 0')
    }
    if (dto.refType && !(MANUAL_REFERENCE_TYPES as readonly string[]).includes(dto.refType)) {
      throw new BadRequestException('Phiếu tạo thủ công chỉ hỗ trợ refType MANUAL')
    }

    const txDate = dto.date ? new Date(dto.date) : new Date()
    if (Number.isNaN(txDate.getTime())) {
      throw new BadRequestException('Ngày giao dịch không hợp lệ')
    }

    const manualReference = await this.resolveManualReference({
      refType: dto.refType,
      refId: dto.refId,
      refNumber: dto.refNumber,
      user,
    })

    const writableBranchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
    const branch = writableBranchId
      ? await this.db.branch.findUnique({
          where: { id: writableBranchId },
          select: { id: true, name: true },
        })
      : null

    if (writableBranchId && !branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh')
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const voucherNumber = await this.buildVoucherNumber(dto.type, txDate)
      try {
        const tx = await this.db.transaction.create({
          data: {
            voucherNumber,
            type: dto.type,
            amount: Number(dto.amount),
            description: dto.description.trim(),
            category: dto.category?.trim() || null,
            paymentMethod: dto.paymentMethod?.trim() || null,
            branchId: branch?.id ?? null,
            branchName: dto.branchName?.trim() || branch?.name || null,
            payerName: dto.payerName?.trim() || null,
            payerId: dto.payerId?.trim() || null,
            refType: manualReference.refType,
            refId: manualReference.refId,
            refNumber: manualReference.refNumber,
            notes: dto.notes?.trim() || null,
            tags: dto.tags?.trim() || null,
            attachmentUrl: dto.attachmentUrl?.trim() || null,
            source: 'MANUAL',
            isManual: true,
            staffId,
            date: txDate,
          } as any,
          include: {
            staff: { select: { id: true, fullName: true } },
            branch: { select: { id: true, name: true } },
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

  async updateTransaction(
    id: string,
    dto: UpdateTransactionDto,
    _staffId: string,
    user?: BranchScopedUser,
    requestedBranchId?: string,
  ) {
    const existing = await this.db.transaction.findUnique({ where: { id } as any })
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phiếu thu/chi')
    }

    assertBranchAccess(existing.branchId, user)
    const capability = this.getTransactionCapability(existing)
    const changedKeys = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
    const hasRestrictedChange =
      capability.editScope !== 'FULL' &&
      changedKeys.some((key) => !(NOTE_ONLY_FIELDS as readonly string[]).includes(key))

    if (hasRestrictedChange) {
      throw new ForbiddenException(capability.lockReason ?? 'Phiếu này chỉ được cập nhật ghi chú')
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

    const allowCoreEdit = capability.editScope === 'FULL'
    const writableBranchId =
      allowCoreEdit && (dto.branchId !== undefined || requestedBranchId)
        ? resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
        : null
    const shouldUpdateManualReference =
      allowCoreEdit && (dto.refType !== undefined || dto.refId !== undefined || dto.refNumber !== undefined)

    const branch = writableBranchId
      ? await this.db.branch.findUnique({
          where: { id: writableBranchId },
          select: { id: true, name: true },
        })
      : null

    if (writableBranchId && !branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh')
    }

    const manualReference = shouldUpdateManualReference
      ? await this.resolveManualReference({
          refType: dto.refType ?? existing.refType ?? 'MANUAL',
          refId: dto.refId,
          refNumber: dto.refNumber,
          user,
        })
      : null

    const updated = await this.db.transaction.update({
      where: { id } as any,
      data: {
        ...(allowCoreEdit && dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
        ...(allowCoreEdit && dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(allowCoreEdit && dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(allowCoreEdit && dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod?.trim() || null } : {}),
        ...(allowCoreEdit && (dto.branchId !== undefined || requestedBranchId) ? { branchId: branch?.id ?? null } : {}),
        ...(allowCoreEdit && (dto.branchId !== undefined || dto.branchName !== undefined || requestedBranchId)
          ? { branchName: dto.branchName?.trim() || branch?.name || null }
          : {}),
        ...(allowCoreEdit && dto.payerName !== undefined ? { payerName: dto.payerName?.trim() || null } : {}),
        ...(allowCoreEdit && dto.payerId !== undefined ? { payerId: dto.payerId?.trim() || null } : {}),
        ...(manualReference
          ? {
              refType: manualReference.refType,
              refId: manualReference.refId,
              refNumber: manualReference.refNumber,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(allowCoreEdit && dto.tags !== undefined ? { tags: dto.tags?.trim() || null } : {}),
        ...(allowCoreEdit && dto.attachmentUrl !== undefined ? { attachmentUrl: dto.attachmentUrl?.trim() || null } : {}),
        ...(allowCoreEdit && txDate ? { date: txDate } : {}),
      } as any,
      include: {
        staff: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    return { success: true, data: this.normalizeTransaction(updated) }
  }

  async removeTransaction(id: string, user?: BranchScopedUser) {
    const existing = await this.db.transaction.findUnique({ where: { id } as any })
    if (!existing) {
      throw new NotFoundException('Không tìm thấy phiếu thu/chi')
    }

    assertBranchAccess(existing.branchId, user)
    const capability = this.getTransactionCapability(existing)
    if (!capability.canDelete) {
      throw new ForbiddenException(capability.lockReason ?? 'Phiếu này không thể xóa')
    }
    await this.db.transaction.delete({ where: { id } as any })
    return { success: true, message: 'Đã xóa phiếu thu/chi thủ công' }
  }

  async findTransactionByVoucher(voucherNumber: string, user?: BranchScopedUser) {
    const tx = await this.db.transaction.findFirst({
      where: { voucherNumber } as any,
      include: {
        staff: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
      },
    })

    if (!tx) {
      throw new NotFoundException('Không tìm thấy phiếu thu/chi')
    }

    assertBranchAccess(tx.branchId, user)
    return { success: true, data: this.normalizeTransaction(tx) }
  }
}
