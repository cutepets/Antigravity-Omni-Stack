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
const LEGACY_PAYMENT_METHOD_TYPES = new Set(['CASH', 'BANK', 'EWALLET', 'CARD', 'MOMO', 'VNPAY', 'POINTS'])

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
  paymentAccountId?: string
  paymentAccountLabel?: string
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
  paymentAccountId?: string
  paymentAccountLabel?: string
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

function toNumber(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function toInt(value: unknown) {
  return Math.max(0, Math.round(toNumber(value)))
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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

  private async resolvePaymentAccount(paymentMethod?: string | null, paymentAccountId?: string | null) {
    const normalizedMethod = paymentMethod?.trim().toUpperCase() || null
    const normalizedAccountId = paymentAccountId?.trim() || null

    if (!normalizedAccountId) {
      return {
        paymentMethod: normalizedMethod,
        paymentAccountId: null,
        paymentAccountLabel: null,
      }
    }

    const account = await this.db.paymentMethod.findUnique({
      where: { id: normalizedAccountId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        bankName: true,
        accountNumber: true,
      },
    })

    if (!account || account.isActive !== true) {
      throw new BadRequestException('Phuong thuc thanh toan khong hop le hoac da ngung hoat dong')
    }

    const paymentAccountLabel =
      account.type === 'BANK' && (account.bankName || account.accountNumber)
        ? [account.name, account.bankName, account.accountNumber].filter(Boolean).join(' • ')
        : account.name

    return {
      paymentMethod: account.type as string,
      paymentAccountId: account.id as string,
      paymentAccountLabel,
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
      paymentAccountId: tx.paymentAccountId ?? null,
      paymentAccountLabel: tx.paymentAccountLabel ?? null,
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
    if (query.paymentMethod?.trim()) {
      const normalizedPaymentFilter = query.paymentMethod.trim()
      const upperPaymentFilter = normalizedPaymentFilter.toUpperCase()
      if (LEGACY_PAYMENT_METHOD_TYPES.has(upperPaymentFilter)) {
        where.paymentMethod = upperPaymentFilter
      } else {
        where.paymentAccountId = normalizedPaymentFilter
      }
    }
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

  private resolveDateRange(dateFrom?: string | null, dateTo?: string | null) {
    const from = dateFrom?.trim() ? startOfDay(dateFrom) : null
    const to = dateTo?.trim() ? endOfDay(dateTo) : null

    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('dateFrom khong hop le')
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('dateTo khong hop le')
    }

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('dateFrom khong duoc lon hon dateTo')
    }

    return { from, to }
  }

  private buildCustomerBranchScope(user?: BranchScopedUser, requestedBranchId?: string | null) {
    const scopedBranchIds = getScopedBranchIds(user, requestedBranchId)
    if (!scopedBranchIds) return null

    const branchIdFilter = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }

    return {
      OR: [
        { branchId: branchIdFilter },
        {
          AND: [
            { branchId: null },
            {
              OR: [
                { orders: { some: { branchId: { in: scopedBranchIds } } } },
                { hotelStays: { some: { branchId: { in: scopedBranchIds } } } },
                { pets: { some: { branchId: { in: scopedBranchIds } } } },
              ],
            },
          ],
        },
      ],
    }
  }

  private buildSupplierEvaluation(params: {
    totalSpent: number
    totalDebt: number
    uniqueProducts: number
    ordersLast30Days: number
    lastOrderAt?: Date | null
  }) {
    const now = new Date()
    const daysSinceLastOrder = params.lastOrderAt
      ? Math.floor((now.getTime() - params.lastOrderAt.getTime()) / (24 * 60 * 60 * 1000))
      : 999
    const frequencyScore = Math.min(100, params.ordersLast30Days * 18)
    const recencyScore =
      daysSinceLastOrder <= 7 ? 100 : daysSinceLastOrder <= 30 ? 85 : daysSinceLastOrder <= 60 ? 65 : 35
    const debtRatio = params.totalSpent > 0 ? params.totalDebt / params.totalSpent : 0
    const debtScore = Math.max(0, 100 - Math.round(Math.min(1, debtRatio) * 100))
    const assortmentScore = Math.min(100, params.uniqueProducts * 16)
    const score = Math.round((frequencyScore + recencyScore + debtScore + assortmentScore) / 4)

    const label =
      score >= 85 ? 'Doi tac chien luoc' : score >= 70 ? 'On dinh' : score >= 55 ? 'Can theo doi' : 'Rui ro'
    const summary =
      score >= 85
        ? 'Nguon cung on dinh, nen uu tien duy tri.'
        : score >= 70
          ? 'Quan he giao dich tot, theo doi dinh ky.'
          : score >= 55
            ? 'Can theo doi them ve cong no va tan suat giao dich.'
            : 'Bien dong cao, can ra soat dieu kien hop tac.'

    return {
      score,
      label,
      summary,
      debtRatio,
    }
  }

  private async buildPurchaseSummaryData(
    user?: BranchScopedUser,
    requestedBranchId?: string | null,
    dateFrom?: string | null,
    dateTo?: string | null,
  ) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)
    const last30Days = new Date()
    last30Days.setDate(last30Days.getDate() - 30)

    const suppliers = await this.db.supplier.findMany({
      ...(branchIdFilter !== undefined
        ? { where: { stockReceipts: { some: { branchId: branchIdFilter } } } }
        : {}),
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        isActive: true,
        stockReceipts: {
          where: {
            ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
            ...(from || to
              ? {
                  createdAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
            status: { not: 'CANCELLED' },
            receiptStatus: { not: 'CANCELLED' },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            receiptNumber: true,
            createdAt: true,
            totalReceivedAmount: true,
            totalReturnedAmount: true,
            paidAmount: true,
            items: {
              select: {
                productId: true,
                productVariantId: true,
              },
            },
          },
        },
      },
    })

    const rows = suppliers
      .map((supplier) => {
        const receipts = supplier.stockReceipts ?? []
        const lastReceiptAt = receipts[0]?.createdAt ?? null
        const productKeys = new Set<string>()
        let totalSpent = 0
        let totalDebt = 0
        let spendLast30Days = 0
        let ordersLast30Days = 0

        for (const receipt of receipts) {
          const payableAmount = roundCurrency(
            Math.max(0, toNumber(receipt.totalReceivedAmount) - toNumber(receipt.totalReturnedAmount)),
          )
          const debtAmount = roundCurrency(Math.max(0, payableAmount - toNumber(receipt.paidAmount)))

          totalSpent += payableAmount
          totalDebt += debtAmount

          if (new Date(receipt.createdAt) >= last30Days) {
            spendLast30Days += payableAmount
            ordersLast30Days += 1
          }

          for (const item of receipt.items ?? []) {
            productKeys.add(`${item.productId}:${item.productVariantId ?? 'base'}`)
          }
        }

        totalSpent = roundCurrency(totalSpent)
        totalDebt = roundCurrency(totalDebt)
        spendLast30Days = roundCurrency(spendLast30Days)

        return {
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          phone: supplier.phone,
          debt: totalDebt,
          _isActive: supplier.isActive,
          stats: {
            totalOrders: receipts.length,
            totalSpent,
            totalDebt,
            spendLast30Days,
            avgOrderValue: receipts.length > 0 ? roundCurrency(totalSpent / receipts.length) : 0,
            lastOrderAt: lastReceiptAt ? lastReceiptAt.toISOString() : null,
            uniqueProducts: productKeys.size,
          },
          evaluation: this.buildSupplierEvaluation({
            totalSpent,
            totalDebt,
            uniqueProducts: productKeys.size,
            ordersLast30Days,
            lastOrderAt: lastReceiptAt,
          }),
        }
      })
      .sort((left, right) => right.stats.totalSpent - left.stats.totalSpent || right.stats.totalDebt - left.stats.totalDebt)

    const summary = {
      totalSuppliers: rows.length,
      activeSuppliers: rows.filter((supplier) => supplier._isActive !== false).length,
      suppliersWithDebt: rows.filter((supplier) => supplier.stats.totalDebt > 0).length,
      totalDebt: roundCurrency(rows.reduce((sum, supplier) => sum + supplier.stats.totalDebt, 0)),
      spendLast30Days: roundCurrency(rows.reduce((sum, supplier) => sum + supplier.stats.spendLast30Days, 0)),
      avgEvaluationScore:
        rows.length > 0
          ? Math.round(rows.reduce((sum, supplier) => sum + supplier.evaluation.score, 0) / rows.length)
          : 0,
    }

    return {
      suppliers: rows.map(({ _isActive, ...supplier }) => supplier),
      summary,
    }
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

  async getRevenueChart(
    days: number = 7,
    user?: BranchScopedUser,
    requestedBranchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const result: { date: string; revenue: number }[] = []
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)
    const today = new Date()
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const branchScope = branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}

    const startDate = from ?? new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
    const endDate = to ?? new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    const cursor = new Date(startDate)
    cursor.setHours(0, 0, 0, 0)

    while (cursor.getTime() <= endDate.getTime()) {
      const start = new Date(cursor)
      const end = new Date(cursor)
      end.setDate(end.getDate() + 1)

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

      cursor.setDate(cursor.getDate() + 1)
    }

    return { success: true, data: result }
  }

  async getTopCustomers(
    limit: number = 10,
    user?: BranchScopedUser,
    requestedBranchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)
    const orders = await this.db.order.groupBy({
      by: ['customerId'] as any,
      where: {
        ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
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

  async getTopProducts(
    limit: number = 10,
    user?: BranchScopedUser,
    requestedBranchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)
    const items = await this.db.orderItem.groupBy({
      by: ['productId'] as any,
      where: {
        productId: { not: null },
        ...(branchIdFilter !== undefined || from || to
          ? {
              order: {
                is: {
                  ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
                  ...(from || to
                    ? {
                        createdAt: {
                          ...(from ? { gte: from } : {}),
                          ...(to ? { lte: to } : {}),
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
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

  async getPurchaseSummary(user?: BranchScopedUser, requestedBranchId?: string, dateFrom?: string, dateTo?: string) {
    const data = await this.buildPurchaseSummaryData(user, requestedBranchId, dateFrom, dateTo)
    return { success: true, data }
  }

  async getInventoryHealth(user?: BranchScopedUser, requestedBranchId?: string) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const rows = await this.db.branchStock.findMany({
      where: {
        ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
        stock: { lte: 5 },
      },
      include: {
        branch: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
        variant: { select: { id: true, name: true } },
      },
      orderBy: [{ stock: 'asc' }, { updatedAt: 'asc' }],
    })

    const items = rows.map((row) => ({
      id: row.id,
      stock: row.stock,
      minStock: row.minStock ?? 5,
      shortage: Math.max(0, (row.minStock ?? 5) - toInt(row.stock)),
      branch: row.branch,
      product: row.product,
      variant: row.variant,
    }))

    return {
      success: true,
      data: {
        items,
        summary: {
          totalItems: items.length,
          outOfStockCount: items.filter((item) => item.stock <= 0).length,
          totalShortage: items.reduce((sum, item) => sum + item.shortage, 0),
          affectedBranches: new Set(items.map((item) => item.branch?.id).filter(Boolean)).size,
        },
      },
    }
  }

  async getDebtSummary(
    limit: number = 100,
    user?: BranchScopedUser,
    requestedBranchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const customerScope = this.buildCustomerBranchScope(user, requestedBranchId)
    const customerWhere =
      customerScope == null
        ? { debt: { gt: 0 } }
        : {
            AND: [
              { debt: { gt: 0 } },
              customerScope,
            ],
          }
    const normalizedLimit = toPositiveInt(limit, 100)

    const [customers, purchaseSummary] = await Promise.all([
      this.db.customer.findMany({
        where: customerWhere as any,
        orderBy: [{ debt: 'desc' }, { totalSpent: 'desc' }],
        take: normalizedLimit,
        select: {
          id: true,
          fullName: true,
          customerCode: true,
          phone: true,
          debt: true,
          totalSpent: true,
          branchId: true,
          _count: {
            select: {
              orders: true,
              hotelStays: true,
            },
          },
        },
      }),
      this.buildPurchaseSummaryData(user, requestedBranchId, dateFrom, dateTo),
    ])

    const suppliers = purchaseSummary.suppliers
      .filter((supplier) => supplier.stats.totalDebt > 0)
      .sort((left, right) => right.stats.totalDebt - left.stats.totalDebt)
      .slice(0, normalizedLimit)

    const totalCustomerDebt = roundCurrency(customers.reduce((sum, customer) => sum + toNumber(customer.debt), 0))
    const totalSupplierDebt = roundCurrency(suppliers.reduce((sum, supplier) => sum + supplier.stats.totalDebt, 0))

    return {
      success: true,
      data: {
        customers,
        suppliers,
        summary: {
          totalCustomerDebt,
          totalSupplierDebt,
          customersWithDebt: customers.length,
          suppliersWithDebt: suppliers.length,
          highestDebt: Math.max(
            customers[0] ? toNumber(customers[0].debt) : 0,
            suppliers[0]?.stats.totalDebt ?? 0,
          ),
        },
      },
    }
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
              OR: [{ paymentAccountId: { not: null } }, { paymentMethod: { not: null } }],
            },
            select: {
              paymentMethod: true,
              paymentAccountId: true,
              paymentAccountLabel: true,
            },
            orderBy: [{ paymentAccountLabel: 'asc' }, { paymentMethod: 'asc' }],
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
      const paymentMethodOptions = Array.from(
        paymentMethods.reduce((map, item) => {
          const value = item.paymentAccountId ?? item.paymentMethod
          const label = item.paymentAccountLabel ?? item.paymentMethod
          if (value && label && !map.has(value)) {
            map.set(value, label)
          }
          return map
        }, new Map<string, string>()),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, 'vi'))

      data.meta = {
        branches,
        paymentMethods: paymentMethodOptions,
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
    const paymentAccount = await this.resolvePaymentAccount(dto.paymentMethod, dto.paymentAccountId)

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
            paymentMethod: paymentAccount.paymentMethod ?? null,
            paymentAccountId: paymentAccount.paymentAccountId,
            paymentAccountLabel: paymentAccount.paymentAccountLabel,
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
    const shouldUpdatePaymentAccount =
      allowCoreEdit && (dto.paymentMethod !== undefined || dto.paymentAccountId !== undefined || dto.paymentAccountLabel !== undefined)
    const paymentAccount = shouldUpdatePaymentAccount
      ? await this.resolvePaymentAccount(dto.paymentMethod ?? existing.paymentMethod, dto.paymentAccountId)
      : null

    const updated = await this.db.transaction.update({
      where: { id } as any,
      data: {
        ...(allowCoreEdit && dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
        ...(allowCoreEdit && dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(allowCoreEdit && dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(paymentAccount
          ? {
              paymentMethod: paymentAccount.paymentMethod ?? null,
              paymentAccountId: paymentAccount.paymentAccountId,
              paymentAccountLabel: paymentAccount.paymentAccountLabel,
            }
          : {}),
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
