import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { DatabaseService } from '../../database/database.service.js'

type ShiftStatus = 'OPEN' | 'CLOSED'
type ShiftReviewStatus = 'PENDING' | 'CHECKED' | 'APPROVED' | 'REJECTED'

export interface FindShiftSessionsDto {
  page?: number | string
  limit?: number | string
  branchId?: string
  staffId?: string
  status?: ShiftStatus | 'ALL'
  reviewStatus?: ShiftReviewStatus | 'ALL'
  dateFrom?: string
  dateTo?: string
}

export interface StartShiftDto {
  branchId?: string
  openAmount?: number
  openDenominations?: unknown
  employeeNote?: string
  notes?: string
}

export interface EndShiftDto {
  closeAmount?: number
  closeDenominations?: unknown
  employeeNote?: string
  notes?: string
}

export interface UpdateShiftReviewDto {
  openAmount?: number
  closeAmount?: number | null
  openDenominations?: unknown
  closeDenominations?: unknown
  employeeNote?: string | null
  managerNote?: string | null
  managerConclusion?: string | null
  reviewStatus?: ShiftReviewStatus
  notes?: string | null
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function trimNullable(value: unknown) {
  if (typeof value !== 'string') return value === null ? null : undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
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

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function canManageShift(user?: BranchScopedUser) {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'MANAGER') return true
  return new Set(resolvePermissions(user.permissions ?? [])).has('report.cashbook')
}

function canDeleteShift(user?: BranchScopedUser) {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
}

@Injectable()
export class ShiftsService {
  constructor(private readonly db: DatabaseService) {}

  private normalizeShift(shift: any, summary?: any) {
    return {
      id: shift.id,
      branchId: shift.branchId,
      branchName: shift.branch?.name ?? null,
      staffId: shift.staffId,
      staffName: shift.staff?.fullName ?? null,
      openAmount: shift.openAmount ?? 0,
      closeAmount: shift.closeAmount ?? null,
      expectedCloseAmount: shift.expectedCloseAmount ?? summary?.expectedCloseAmount ?? null,
      differenceAmount: shift.differenceAmount ?? summary?.differenceAmount ?? null,
      cashIncomeAmount: shift.cashIncomeAmount ?? summary?.cashIncome ?? 0,
      cashExpenseAmount: shift.cashExpenseAmount ?? summary?.cashExpense ?? 0,
      orderCount: shift.orderCount ?? summary?.orderCount ?? 0,
      refundCount: shift.refundCount ?? summary?.refundCount ?? 0,
      manualIncomeCount: shift.manualIncomeCount ?? summary?.manualIncomeCount ?? 0,
      manualExpenseCount: shift.manualExpenseCount ?? summary?.manualExpenseCount ?? 0,
      nonCashSummary: shift.nonCashSummary ?? summary?.otherPayments ?? [],
      openDenominations: shift.openDenominations ?? null,
      closeDenominations: shift.closeDenominations ?? null,
      summarySnapshot: shift.summarySnapshot ?? null,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt ?? null,
      lastReclosedAt: shift.lastReclosedAt ?? null,
      closeCount: shift.closeCount ?? 0,
      employeeNote: shift.employeeNote ?? null,
      managerNote: shift.managerNote ?? null,
      managerConclusion: shift.managerConclusion ?? null,
      reviewStatus: shift.reviewStatus ?? 'PENDING',
      reviewedAt: shift.reviewedAt ?? null,
      reviewedById: shift.reviewedById ?? null,
      notes: shift.notes ?? null,
      status: shift.status ?? 'OPEN',
      canRecloseToday: shift.status === 'CLOSED' && shift.closedAt && shift.reviewStatus !== 'APPROVED'
        ? isSameLocalDay(new Date(shift.closedAt), new Date())
        : false,
      summary: summary ?? null,
    }
  }

  private async findShiftOrThrow(id: string) {
    const shift = await (this.db as any).shiftSession.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    })

    if (!shift) {
      throw new NotFoundException('Khong tim thay ca')
    }

    return shift
  }

  async getCurrentShift(staffId: string, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const branchId = resolveWritableBranchId(user, requestedBranchId)
    if (!branchId) {
      throw new BadRequestException('Vui long chon chi nhanh')
    }

    const openShift = await (this.db as any).shiftSession.findFirst({
      where: { branchId, staffId, status: 'OPEN' },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
    })

    if (openShift) {
      return { success: true, data: this.normalizeShift(openShift, await this.buildShiftSummary(openShift)) }
    }

    const todayClosedShift = await (this.db as any).shiftSession.findFirst({
      where: {
        branchId,
        staffId,
        status: 'CLOSED',
        reviewStatus: { not: 'APPROVED' },
        closedAt: { gte: startOfDay(new Date().toISOString()), lte: endOfDay(new Date().toISOString()) },
      },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
      orderBy: { closedAt: 'desc' },
    })

    return {
      success: true,
      data: todayClosedShift ? this.normalizeShift(todayClosedShift, await this.buildShiftSummary(todayClosedShift, new Date())) : null,
    }
  }

  async startShift(dto: StartShiftDto, staffId: string, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const branchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
    if (!branchId) {
      throw new BadRequestException('Vui long chon chi nhanh')
    }

    const existingOpen = await (this.db as any).shiftSession.findFirst({
      where: { branchId, staffId, status: 'OPEN' },
      select: { id: true },
    })

    if (existingOpen) {
      throw new BadRequestException('Nhan vien dang co ca tien mat dang mo tai chi nhanh nay')
    }

    const existingTodayUnapproved = await (this.db as any).shiftSession.findFirst({
      where: {
        branchId,
        staffId,
        status: 'CLOSED',
        reviewStatus: { not: 'APPROVED' },
        closedAt: { gte: startOfDay(new Date().toISOString()), lte: endOfDay(new Date().toISOString()) },
      },
      select: { id: true },
    })

    if (existingTodayUnapproved) {
      throw new BadRequestException('Nhan vien da co ca trong ngay. Hay chot lai ca hien tai neu co phat sinh them')
    }

    const shift = await (this.db as any).shiftSession.create({
      data: {
        branchId,
        staffId,
        openAmount: toMoney(dto.openAmount),
        openDenominations: dto.openDenominations ?? undefined,
        employeeNote: trimNullable(dto.employeeNote),
        notes: trimNullable(dto.notes),
        status: 'OPEN',
        reviewStatus: 'PENDING',
      },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    })

    return { success: true, data: this.normalizeShift(shift, await this.buildShiftSummary(shift)) }
  }

  async endShift(id: string, dto: EndShiftDto, staffId: string, user?: BranchScopedUser) {
    const shift = await this.findShiftOrThrow(id)
    assertBranchAccess(shift.branchId, user)

    if (shift.staffId !== staffId && !canManageShift(user)) {
      throw new ForbiddenException('Ban chi duoc chot ca cua minh')
    }

    const now = new Date()
    if (shift.status === 'CLOSED' && (!shift.closedAt || !isSameLocalDay(new Date(shift.closedAt), now))) {
      throw new BadRequestException('Chi duoc chot lai ca da dong trong cung ngay')
    }

    const summary = await this.buildShiftSummary(shift, now)
    const closeAmount = toMoney(dto.closeAmount)
    const expectedCloseAmount = summary.expectedCloseAmount
    const differenceAmount = closeAmount - expectedCloseAmount

    const updated = await (this.db as any).shiftSession.update({
      where: { id },
      data: {
        closeAmount,
        expectedCloseAmount,
        differenceAmount,
        cashIncomeAmount: summary.cashIncome,
        cashExpenseAmount: summary.cashExpense,
        orderCount: summary.orderCount,
        refundCount: summary.refundCount,
        manualIncomeCount: summary.manualIncomeCount,
        manualExpenseCount: summary.manualExpenseCount,
        nonCashSummary: summary.otherPayments,
        summarySnapshot: { ...summary, differenceAmount },
        closeDenominations: dto.closeDenominations ?? undefined,
        employeeNote: trimNullable(dto.employeeNote) ?? shift.employeeNote ?? null,
        notes: trimNullable(dto.notes) ?? shift.notes ?? null,
        closedAt: now,
        lastReclosedAt: shift.status === 'CLOSED' ? now : null,
        closeCount: { increment: 1 },
        status: 'CLOSED',
        reviewStatus: 'PENDING',
      },
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    })

    return { success: true, data: this.normalizeShift(updated, { ...summary, differenceAmount }) }
  }

  async getShiftSummary(id: string, staffId: string, user?: BranchScopedUser) {
    const shift = await this.findShiftOrThrow(id)
    assertBranchAccess(shift.branchId, user)
    if (shift.staffId !== staffId && !canManageShift(user)) {
      throw new ForbiddenException('Ban chi duoc xem ca cua minh')
    }
    const shouldUseNow = shift.status === 'CLOSED' && shift.closedAt && shift.reviewStatus !== 'APPROVED' && isSameLocalDay(new Date(shift.closedAt), new Date())
    return { success: true, data: this.normalizeShift(shift, await this.buildShiftSummary(shift, shouldUseNow ? new Date() : undefined)) }
  }

  async findShiftSessions(query: FindShiftSessionsDto, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const page = toPositiveInt(query.page, 1)
    const limit = toPositiveInt(query.limit, 20)
    const scopedBranchIds = getScopedBranchIds(user, query.branchId ?? requestedBranchId)
    const where: any = {}

    if (scopedBranchIds) {
      where.branchId = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }
    }
    if (query.staffId?.trim()) where.staffId = query.staffId.trim()
    if (query.status && query.status !== 'ALL') where.status = query.status
    if (query.reviewStatus && query.reviewStatus !== 'ALL') where.reviewStatus = query.reviewStatus
    if (query.dateFrom || query.dateTo) {
      where.openedAt = {}
      if (query.dateFrom) where.openedAt.gte = startOfDay(query.dateFrom)
      if (query.dateTo) where.openedAt.lte = endOfDay(query.dateTo)
    }

    const [rows, total] = await Promise.all([
      (this.db as any).shiftSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ openedAt: 'desc' }],
        include: {
          branch: { select: { id: true, name: true } },
          staff: { select: { id: true, fullName: true } },
        },
      }),
      (this.db as any).shiftSession.count({ where }),
    ])

    return {
      success: true,
      data: {
        shifts: rows.map((shift: any) => this.normalizeShift(shift)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async updateShiftReview(id: string, dto: UpdateShiftReviewDto, reviewerId: string, user?: BranchScopedUser) {
    const shift = await this.findShiftOrThrow(id)
    assertBranchAccess(shift.branchId, user)

    const data: any = {}
    if (dto.openAmount !== undefined) data.openAmount = toMoney(dto.openAmount)
    if (dto.closeAmount !== undefined) data.closeAmount = dto.closeAmount === null ? null : toMoney(dto.closeAmount)
    if (dto.openDenominations !== undefined) data.openDenominations = dto.openDenominations
    if (dto.closeDenominations !== undefined) data.closeDenominations = dto.closeDenominations
    if (dto.employeeNote !== undefined) data.employeeNote = trimNullable(dto.employeeNote)
    if (dto.managerNote !== undefined) data.managerNote = trimNullable(dto.managerNote)
    if (dto.managerConclusion !== undefined) data.managerConclusion = trimNullable(dto.managerConclusion)
    if (dto.notes !== undefined) data.notes = trimNullable(dto.notes)
    if (dto.reviewStatus !== undefined) {
      data.reviewStatus = dto.reviewStatus
      data.reviewedAt = new Date()
      data.reviewedById = reviewerId
    }

    const amountChanged = dto.openAmount !== undefined || dto.closeAmount !== undefined
    if (amountChanged) {
      const summary = await this.buildShiftSummary({ ...shift, ...data })
      data.expectedCloseAmount = summary.expectedCloseAmount
      data.differenceAmount = data.closeAmount === null || data.closeAmount === undefined
        ? null
        : data.closeAmount - summary.expectedCloseAmount
      data.cashIncomeAmount = summary.cashIncome
      data.cashExpenseAmount = summary.cashExpense
      data.orderCount = summary.orderCount
      data.refundCount = summary.refundCount
      data.manualIncomeCount = summary.manualIncomeCount
      data.manualExpenseCount = summary.manualExpenseCount
      data.nonCashSummary = summary.otherPayments
      data.summarySnapshot = {
        ...summary,
        differenceAmount: data.differenceAmount,
      }
    }

    const updated = await (this.db as any).shiftSession.update({
      where: { id },
      data,
      include: {
        branch: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
      },
    })

    return { success: true, data: this.normalizeShift(updated, await this.buildShiftSummary(updated)) }
  }

  async deleteShift(id: string, user?: BranchScopedUser) {
    const shift = await this.findShiftOrThrow(id)
    assertBranchAccess(shift.branchId, user)

    if (!canDeleteShift(user)) {
      throw new ForbiddenException('Chi Admin moi duoc xoa ca tien mat')
    }
    if (shift.status !== 'CLOSED') {
      throw new BadRequestException('Chi duoc xoa ca da chot')
    }

    await (this.db as any).shiftSession.delete({ where: { id } })
    return { success: true, data: { id } }
  }

  private async buildShiftSummary(shift: any, overrideEndAt?: Date) {
    const endAt = overrideEndAt ?? shift.closedAt ?? new Date()
    const cashPaymentMethods = await (this.db as any).paymentMethod.findMany({
      where: { type: 'CASH' },
      select: { id: true, name: true },
    })
    const cashPaymentIds = cashPaymentMethods.map((method: any) => method.id).filter(Boolean)

    const transactions = await this.db.transaction.findMany({
      where: {
        branchId: shift.branchId,
        staffId: shift.staffId,
        date: { gte: shift.openedAt, lte: endAt },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        source: true,
        paymentMethod: true,
        paymentAccountId: true,
        paymentAccountLabel: true,
        refType: true,
        refId: true,
      },
    })

    let cashIncome = 0
    let cashExpense = 0
    let manualCashIncome = 0
    let manualCashExpense = 0
    let orderCashIncome = 0
    let orderCashExpense = 0
    let nonCashIncome = 0
    let nonCashExpense = 0
    let manualCashIncomeCount = 0
    let manualCashExpenseCount = 0
    const orderIds = new Set<string>()
    const refundIds = new Set<string>()
    const otherPayments = new Map<string, { label: string; income: number; expense: number; count: number }>()

    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0
      const isIncome = tx.type === 'INCOME'
      const isCash =
        String(tx.paymentMethod ?? '').toUpperCase() === 'CASH' ||
        (tx.paymentAccountId ? cashPaymentIds.includes(tx.paymentAccountId) : false) ||
        cashPaymentMethods.some((method: any) => method.name && method.name === tx.paymentAccountLabel)
      const isOrder = tx.refType === 'ORDER' || tx.source === 'ORDER_PAYMENT' || tx.source === 'ORDER_ADJUSTMENT'

      if (isCash) {
        if (isIncome) cashIncome += amount
        else cashExpense += amount

        if (tx.source === 'MANUAL') {
          if (isIncome) {
            manualCashIncome += amount
            manualCashIncomeCount += 1
          } else {
            manualCashExpense += amount
            manualCashExpenseCount += 1
          }
        }

        if (isOrder) {
          if (isIncome) {
            orderCashIncome += amount
            if (tx.refId) orderIds.add(tx.refId)
          } else {
            orderCashExpense += amount
            if (tx.refId) refundIds.add(tx.refId)
          }
        }
      } else {
        if (isIncome) nonCashIncome += amount
        else nonCashExpense += amount
        const key = tx.paymentAccountLabel || tx.paymentMethod || 'OTHER'
        const current = otherPayments.get(key) ?? { label: key, income: 0, expense: 0, count: 0 }
        if (isIncome) current.income += amount
        else current.expense += amount
        current.count += 1
        otherPayments.set(key, current)
      }
    }

    const expectedCloseAmount = toMoney(shift.openAmount) + cashIncome - cashExpense
    const closeAmount = shift.closeAmount === null || shift.closeAmount === undefined ? null : toMoney(shift.closeAmount)

    return {
      openedAt: shift.openedAt,
      closedAt: shift.closedAt ?? null,
      calculatedUntil: endAt,
      openAmount: toMoney(shift.openAmount),
      closeAmount,
      cashIncome,
      cashExpense,
      manualCashIncome,
      manualCashExpense,
      orderCashIncome,
      orderCashExpense,
      nonCashIncome,
      nonCashExpense,
      expectedCloseAmount,
      differenceAmount: closeAmount === null ? null : closeAmount - expectedCloseAmount,
      orderCount: orderIds.size,
      refundCount: refundIds.size,
      manualIncomeCount: manualCashIncomeCount,
      manualExpenseCount: manualCashExpenseCount,
      transactionCount: transactions.length,
      otherPayments: Array.from(otherPayments.values()),
    }
  }
}
