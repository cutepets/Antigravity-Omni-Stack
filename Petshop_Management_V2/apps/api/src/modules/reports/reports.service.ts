import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { getRolePermissions, resolvePermissions } from '@petshop/auth'
import { generateFinanceVoucherNumber } from '../../common/utils/finance-voucher.util.js'
import {
  normalizeBulkDeleteIds,
  normalizeBulkUpdateIds,
  runBulkDelete,
  sanitizeBulkUpdatePayload,
} from '../../common/utils/bulk-delete.util.js'
import { DatabaseService } from '../../database/database.service.js'
import {
  buildFinanceTransactionWhere,
  getFinanceTransactionCapability,
  normalizeFinanceTransaction,
} from './application/finance-transactions.application.js'
import {
  createManualFinanceTransaction,
  removeFinanceTransaction,
  updateFinanceTransaction,
} from './application/finance-transaction-mutation.application.js'
import { runFinanceTransactionQuery } from './application/finance-transaction-query.application.js'

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
  type?: FinanceTransactionType
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

export type BulkUpdateTransactionDto = Partial<Pick<UpdateTransactionDto,
  'type' | 'category' | 'paymentMethod' | 'paymentAccountId' | 'paymentAccountLabel' | 'branchId' | 'branchName' | 'date'
>>

type TransactionCapability = {
  editScope: TransactionEditScope
  canDelete: boolean
  lockReason: string | null
}

type OverviewScope = {
  scopedBranchIds: string[] | null
  branchIdFilter: string | { in: string[] } | undefined
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

function toDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function safeSnapshot(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function addGroupedAmount(
  map: Map<string, { key: string; label: string; quantity: number; revenue: number; count: number }>,
  key: string,
  label: string,
  quantity: number,
  revenue: number,
) {
  const current = map.get(key) ?? { key, label, quantity: 0, revenue: 0, count: 0 }
  current.quantity = roundCurrency(current.quantity + quantity)
  current.revenue = roundCurrency(current.revenue + revenue)
  current.count += 1
  map.set(key, current)
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

  private getOverviewScope(user?: BranchScopedUser, requestedBranchId?: string | null): OverviewScope {
    const scopedBranchIds = getScopedBranchIds(user, requestedBranchId)
    return {
      scopedBranchIds,
      branchIdFilter: scopedBranchIds
        ? scopedBranchIds.length === 1
          ? scopedBranchIds[0]
          : { in: scopedBranchIds }
        : undefined,
    }
  }

  private hasPermission(user: BranchScopedUser | undefined, permission: string) {
    if (!user) return true
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.permissions?.includes('FULL_BRANCH_ACCESS')) {
      return true
    }

    return new Set(resolvePermissions([
      ...(user.permissions ?? []),
      ...getRolePermissions(user.role as any),
    ])).has(permission)
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
    return getFinanceTransactionCapability(tx, {
      manualFullEditWindowMs: MANUAL_FULL_EDIT_WINDOW_MS,
    })
  }

  private normalizeTransaction(tx: any) {
    return normalizeFinanceTransaction(tx, {
      manualFullEditWindowMs: MANUAL_FULL_EDIT_WINDOW_MS,
    })
  }

  private buildTransactionWhere(
    query: FindTransactionsDto,
    options?: { beforeDate?: Date; user?: BranchScopedUser; requestedBranchId?: string | null },
  ) {
    const branchIdFilter = this.getBranchIdFilter(options?.user, query.branchId ?? options?.requestedBranchId)
    return buildFinanceTransactionWhere(query, {
      branchIdFilter,
      beforeDate: options?.beforeDate,
      searchableFields: SEARCHABLE_FIELDS,
      legacyPaymentMethodTypes: LEGACY_PAYMENT_METHOD_TYPES,
      startOfDay,
      endOfDay,
    })
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

  async getOverview(
    user?: BranchScopedUser,
    requestedBranchId?: string | null,
    dateFrom?: string | null,
    dateTo?: string | null,
  ) {
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)
    const today = new Date()
    const fallbackFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
    const fallbackTo = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    const startDate = from ?? fallbackFrom
    const endDate = to ?? fallbackTo
    const { scopedBranchIds, branchIdFilter } = this.getOverviewScope(user, requestedBranchId)
    const branchScope = branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}
    const dateScope = { createdAt: { gte: startDate, lte: endDate } }
    const role = user?.role ?? 'SYSTEM'
    const isStaffRestricted = role === 'STAFF'
    const canReadSales = this.hasPermission(user, 'report.sales')
    const canReadCustomers = this.hasPermission(user, 'report.customer') || this.hasPermission(user, 'dashboard.read')
    const canReadInventory = this.hasPermission(user, 'report.inventory') || this.hasPermission(user, 'dashboard.read')
    const canReadCashbook = !isStaffRestricted && this.hasPermission(user, 'report.cashbook')
    const canReadDebt = !isStaffRestricted && this.hasPermission(user, 'report.debt')
    const canReadPurchase = !isStaffRestricted && (this.hasPermission(user, 'report.purchase') || this.hasPermission(user, 'report.debt'))
    const startDateParam = toDateParam(startDate)
    const endDateParam = toDateParam(endDate)

    const [
      orderAgg,
      newCustomers,
      pendingGrooming,
      inProgressGrooming,
      activeHotelStays,
      bookedHotelStays,
      revenueChartResult,
      topCustomersResult,
      topProductsResult,
      serviceRevenueResult,
      inventoryHealthResult,
      cashbookResult,
      debtResult,
      purchaseResult,
    ] = await Promise.all([
      this.db.order.aggregate({
        where: {
          ...branchScope,
          ...dateScope,
          paymentStatus: { in: ['PAID', 'COMPLETED'] },
        },
        _sum: { total: true },
        _count: true,
      }),
      canReadCustomers
        ? this.db.customer.count({
            where: {
              ...(branchIdFilter !== undefined ? { branchId: branchIdFilter } : {}),
              ...dateScope,
            },
          })
        : Promise.resolve(0),
      this.db.groomingSession.count({ where: { ...branchScope, status: 'PENDING' } }),
      this.db.groomingSession.count({ where: { ...branchScope, status: 'IN_PROGRESS' } }),
      this.db.hotelStay.count({ where: { ...branchScope, status: 'CHECKED_IN' } } as any),
      this.db.hotelStay.count({ where: { ...branchScope, status: 'BOOKED' } } as any),
      canReadSales ? this.getRevenueChart(30, user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve({ data: [] }),
      canReadCustomers ? this.getTopCustomers(5, user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve({ data: [] }),
      canReadSales ? this.getTopProducts(5, user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve({ data: [] }),
      canReadSales ? this.getServiceRevenue(user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve({ data: null }),
      canReadInventory ? this.getInventoryHealth(user, requestedBranchId ?? undefined) : Promise.resolve({ data: { items: [], summary: { totalItems: 0, outOfStockCount: 0, totalShortage: 0, affectedBranches: 0 } } }),
      canReadCashbook
        ? this.findTransactions(
            {
              dateFrom: startDateParam,
              dateTo: endDateParam,
              limit: 5,
              includeMeta: false,
            },
            user,
            requestedBranchId ?? undefined,
          )
        : Promise.resolve(null),
      canReadDebt ? this.getDebtSummary(5, user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve(null),
      canReadPurchase ? this.getPurchaseSummary(user, requestedBranchId ?? undefined, startDateParam, endDateParam) : Promise.resolve(null),
    ])

    const revenue = toNumber(orderAgg._sum.total)
    const orderCount = toInt(orderAgg._count)
    const inventorySummary = inventoryHealthResult.data?.summary ?? {
      totalItems: 0,
      outOfStockCount: 0,
      totalShortage: 0,
      affectedBranches: 0,
    }
    const serviceOpenCount = toInt(pendingGrooming) + toInt(inProgressGrooming) + toInt(activeHotelStays)
    const debtSummary = debtResult?.data?.summary
    const purchaseSummary = purchaseResult?.data?.summary
    const alertCount =
      toInt(inventorySummary.totalItems) +
      toInt(pendingGrooming) +
      (canReadDebt ? toInt(debtSummary?.customersWithDebt) + toInt(debtSummary?.suppliersWithDebt) : 0)

    const workQueue = [
      ...(pendingGrooming
        ? [{ id: 'pending-grooming', label: 'Spa đang chờ', value: toInt(pendingGrooming), href: '/grooming', tone: 'blue' }]
        : []),
      ...(activeHotelStays
        ? [{ id: 'active-hotel', label: 'Pet Hotel đang lưu trú', value: toInt(activeHotelStays), href: '/hotel', tone: 'amber' }]
        : []),
      ...(inventorySummary.totalItems
        ? [{ id: 'low-stock', label: 'Sản phẩm sắp thiếu', value: toInt(inventorySummary.totalItems), href: '/inventory/stock', tone: 'rose' }]
        : []),
      ...(canReadDebt && debtSummary?.highestDebt
        ? [{ id: 'debt', label: 'Công nợ cần theo dõi', value: toInt(debtSummary.customersWithDebt + debtSummary.suppliersWithDebt), href: '/reports?tab=debt', tone: 'orange' }]
        : []),
    ]

    return {
      success: true,
      data: {
        scope: {
          requestedBranchId: requestedBranchId || null,
          scopedBranchIds,
          isAllBranches: scopedBranchIds === null,
          role,
          canViewSensitive: !isStaffRestricted,
        },
        range: {
          dateFrom: startDateParam,
          dateTo: endDateParam,
        },
        visibility: {
          sales: canReadSales,
          customers: canReadCustomers,
          inventory: canReadInventory,
          cashbook: canReadCashbook,
          debt: canReadDebt,
          purchase: canReadPurchase,
        },
        kpis: {
          revenue,
          orderCount,
          avgOrderValue: orderCount > 0 ? roundCurrency(revenue / orderCount) : 0,
          newCustomers,
          serviceOpenCount,
          alertCount,
        },
        revenueSeries: revenueChartResult.data ?? [],
        services: {
          pendingGrooming: toInt(pendingGrooming),
          inProgressGrooming: toInt(inProgressGrooming),
          activeHotelStays: toInt(activeHotelStays),
          bookedHotelStays: toInt(bookedHotelStays),
          revenue: serviceRevenueResult.data?.summary ?? null,
        },
        inventory: {
          ...inventorySummary,
          items: inventoryHealthResult.data?.items?.slice(0, 6) ?? [],
        },
        sales: canReadSales
          ? {
              topProducts: topProductsResult.data ?? [],
            }
          : undefined,
        customers: {
          newCustomers,
          topCustomers: topCustomersResult.data ?? [],
        },
        cashbook: canReadCashbook && cashbookResult
          ? {
              transactions: cashbookResult.data?.transactions ?? [],
              total: cashbookResult.data?.total ?? 0,
              openingBalance: cashbookResult.data?.openingBalance ?? 0,
              totalIncome: cashbookResult.data?.totalIncome ?? 0,
              totalExpense: cashbookResult.data?.totalExpense ?? 0,
              closingBalance: cashbookResult.data?.closingBalance ?? 0,
            }
          : undefined,
        debt: canReadDebt && debtSummary ? debtSummary : undefined,
        purchase: canReadPurchase && purchaseSummary ? purchaseSummary : undefined,
        workQueue,
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
        date: toDateParam(start),
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

  async getServiceRevenue(
    user?: BranchScopedUser,
    requestedBranchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const branchIdFilter = this.getBranchIdFilter(user, requestedBranchId)
    const { from, to } = this.resolveDateRange(dateFrom, dateTo)

    const items = await this.db.orderItem.findMany({
      where: {
        OR: [
          { groomingSessionId: { not: null } },
          { hotelStayId: { not: null } },
          { service: { is: { type: { in: ['GROOMING', 'HOTEL'] } } } },
        ],
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
            paymentStatus: { in: ['PAID', 'COMPLETED'] },
          },
        },
      } as any,
      select: {
        id: true,
        groomingSessionId: true,
        hotelStayId: true,
        quantity: true,
        subtotal: true,
        description: true,
        pricingSnapshot: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true, createdAt: true, branchId: true } },
        service: { select: { id: true, name: true, type: true } },
        groomingSession: {
          select: {
            id: true,
            packageCode: true,
            weightBand: { select: { id: true, label: true } },
          },
        },
        hotelStay: {
          select: {
            id: true,
            lineType: true,
            weightBand: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: [{ order: { createdAt: 'desc' } }, { createdAt: 'desc' }],
      take: 1000,
    })

    const hotelByDayType = new Map<string, { key: string; label: string; quantity: number; revenue: number; count: number }>()
    const hotelByWeightBand = new Map<string, { key: string; label: string; quantity: number; revenue: number; count: number }>()
    const groomingByPackage = new Map<string, { key: string; label: string; quantity: number; revenue: number; count: number }>()
    const groomingByWeightBand = new Map<string, { key: string; label: string; quantity: number; revenue: number; count: number }>()
    const detailRows: any[] = []

    let hotelRevenue = 0
    let groomingRevenue = 0
    let hotelDays = 0
    let groomingQuantity = 0
    const orderIds = new Set<string>()

    const pushHotelLine = (item: any, line: Record<string, any>, fallbackSubtotal: number) => {
      const dayType = String(line.dayType ?? item.hotelStay?.lineType ?? 'REGULAR').toUpperCase() === 'HOLIDAY' ? 'HOLIDAY' : 'REGULAR'
      const quantityDays = toNumber(line.quantityDays ?? item.quantity)
      const revenue = roundCurrency(toNumber(line.subtotal ?? fallbackSubtotal))
      const weightBandLabel = String(line.weightBandLabel ?? item.hotelStay?.weightBand?.label ?? 'Chưa rõ hạng cân')
      const label = String(line.label ?? item.description ?? (dayType === 'HOLIDAY' ? 'Hotel ngày lễ' : 'Hotel ngày thường'))

      hotelRevenue = roundCurrency(hotelRevenue + revenue)
      hotelDays = roundCurrency(hotelDays + quantityDays)
      addGroupedAmount(hotelByDayType, dayType, dayType === 'HOLIDAY' ? 'Ngày lễ' : 'Ngày thường', quantityDays, revenue)
      addGroupedAmount(hotelByWeightBand, weightBandLabel, weightBandLabel, quantityDays, revenue)
      detailRows.push({
        type: 'HOTEL',
        orderNumber: item.order?.orderNumber ?? '',
        date: item.order?.createdAt ?? item.createdAt,
        label,
        packageCode: null,
        dayType,
        weightBandLabel,
        quantity: quantityDays,
        revenue,
      })
    }

    for (const item of items) {
      const snapshot = safeSnapshot(item.pricingSnapshot)
      const source = String(snapshot.source ?? '').toUpperCase()
      const serviceType = String(item.service?.type ?? '').toUpperCase()
      const subtotal = roundCurrency(toNumber(item.subtotal))
      const isHotel = Boolean(item.hotelStayId) || source.includes('HOTEL') || serviceType === 'HOTEL'
      const isGrooming = Boolean(item.groomingSessionId) || source.includes('GROOMING') || source.includes('SPA') || serviceType === 'GROOMING'

      if (!isHotel && !isGrooming) continue
      if (item.order?.id) orderIds.add(item.order.id)

      if (isHotel) {
        const chargeLines = Array.isArray(snapshot.chargeLines) ? snapshot.chargeLines : null
        if (chargeLines && chargeLines.length > 0) {
          for (const line of chargeLines) {
            pushHotelLine(item, safeSnapshot(line), toNumber(line?.subtotal))
          }
        } else {
          const chargeLine = safeSnapshot(snapshot.chargeLine)
          pushHotelLine(item, chargeLine, subtotal)
        }
        continue
      }

      const pricingSnapshot = safeSnapshot(snapshot.pricingSnapshot)
      const packageCode = String(snapshot.packageCode ?? pricingSnapshot.packageCode ?? item.groomingSession?.packageCode ?? 'OTHER')
      const weightBandLabel = String(
        snapshot.weightBandLabel ??
          pricingSnapshot.weightBandLabel ??
          item.groomingSession?.weightBand?.label ??
          'Chưa rõ hạng cân',
      )
      const quantity = toNumber(item.quantity)

      groomingRevenue = roundCurrency(groomingRevenue + subtotal)
      groomingQuantity = roundCurrency(groomingQuantity + quantity)
      addGroupedAmount(groomingByPackage, packageCode, packageCode, quantity, subtotal)
      addGroupedAmount(groomingByWeightBand, weightBandLabel, weightBandLabel, quantity, subtotal)
      detailRows.push({
        type: 'GROOMING',
        orderNumber: item.order?.orderNumber ?? '',
        date: item.order?.createdAt ?? item.createdAt,
        label: item.description,
        packageCode,
        dayType: null,
        weightBandLabel,
        quantity,
        revenue: subtotal,
      })
    }

    const sortByRevenue = (left: { revenue: number }, right: { revenue: number }) => right.revenue - left.revenue

    return {
      success: true,
      data: {
        summary: {
          totalRevenue: roundCurrency(hotelRevenue + groomingRevenue),
          hotelRevenue,
          groomingRevenue,
          hotelDays,
          groomingQuantity,
          orderCount: orderIds.size,
          itemCount: detailRows.length,
        },
        hotel: {
          byDayType: Array.from(hotelByDayType.values()).sort(sortByRevenue),
          byWeightBand: Array.from(hotelByWeightBand.values()).sort(sortByRevenue),
        },
        grooming: {
          byPackage: Array.from(groomingByPackage.values()).sort(sortByRevenue),
          byWeightBand: Array.from(groomingByWeightBand.values()).sort(sortByRevenue),
        },
        details: detailRows.slice(0, 500),
      },
    }
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
        variant: { select: { id: true, name: true, variantLabel: true, unitLabel: true } },
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

    return runFinanceTransactionQuery(
      this.db,
      { page, limit, includeMeta },
      {
        branchIdFilter,
        where,
        openingWhere,
        includeMeta,
        transactionSources: TRANSACTION_SOURCES,
        normalizeTransaction: (tx) => this.normalizeTransaction(tx),
      },
    )
  }

  async createTransaction(
    dto: CreateTransactionDto,
    staffId: string,
    user?: BranchScopedUser,
    requestedBranchId?: string,
  ) {
    return createManualFinanceTransaction(
      this.db,
      {
        buildVoucherNumber: (type, issuedAt) => this.buildVoucherNumber(type, issuedAt),
        normalizeTransaction: (tx) => this.normalizeTransaction(tx),
      },
      dto,
      staffId,
      user,
      requestedBranchId,
    )
  }

  async updateTransaction(
    id: string,
    dto: UpdateTransactionDto,
    _staffId: string,
    user?: BranchScopedUser,
    requestedBranchId?: string,
  ) {
    return updateFinanceTransaction(
      this.db,
      {
        getTransactionCapability: (tx) => this.getTransactionCapability(tx),
        normalizeTransaction: (tx) => this.normalizeTransaction(tx),
      },
      id,
      dto,
      user,
      requestedBranchId,
    )
  }

  async removeTransaction(id: string, user?: BranchScopedUser) {
    return removeFinanceTransaction(
      this.db,
      {
        getTransactionCapability: (tx) => this.getTransactionCapability(tx),
      },
      id,
      user,
    )
  }

  async bulkRemoveTransactions(ids: unknown, user?: BranchScopedUser) {
    const normalizedIds = normalizeBulkDeleteIds(ids)
    return runBulkDelete(normalizedIds, (id) => this.removeTransaction(id, user))
  }

  async bulkUpdateTransactions(ids: unknown, updates: BulkUpdateTransactionDto, user?: BranchScopedUser) {
    const normalizedIds = normalizeBulkUpdateIds(ids)
    const payload = sanitizeBulkUpdatePayload<BulkUpdateTransactionDto>(updates, [
      'type',
      'category',
      'paymentMethod',
      'paymentAccountId',
      'paymentAccountLabel',
      'branchId',
      'branchName',
      'date',
    ])

    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN') {
      const transactions = await this.db.transaction.findMany({
        where: { id: { in: normalizedIds } },
        select: { branchId: true },
      })
      for (const transaction of transactions) {
        assertBranchAccess(transaction.branchId, user)
      }
    }

    const data: Record<string, unknown> = { ...payload }
    if (typeof payload.date === 'string') {
      data.date = new Date(payload.date)
    }

    const result = await this.db.transaction.updateMany({
      where: { id: { in: normalizedIds } },
      data: data as any,
    })

    return { success: true, updatedIds: normalizedIds, updatedCount: result.count }
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
