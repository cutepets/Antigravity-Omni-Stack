import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js'
import { DatabaseService } from '../../database/database.service.js'

type ShiftStatus = 'OPEN' | 'CLOSED'
type ShiftReviewStatus = 'PENDING' | 'CHECKED' | 'APPROVED' | 'REJECTED'
type CashVaultEntryType = 'SHIFT_CLOSE' | 'VAULT_COLLECTION' | 'ADJUSTMENT'

const DEFAULT_TARGET_RESERVE_AMOUNT = 2_000_000

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

export interface FindCashVaultEntriesDto {
  page?: number | string
  limit?: number | string
  branchId?: string
  entryType?: CashVaultEntryType | 'ALL'
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

export interface CreateVaultCollectionDto {
  branchId?: string
  amount?: number
  actualCashBefore?: number
  targetReserveAmount?: number
  note?: string
  occurredAt?: string
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function toMoney(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function toSignedMoney(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
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

function calculateReserveMetrics(shift: any, summary: any, closeAmount?: number | null) {
  const reserveTargetAmount = toMoney(shift.reserveTargetAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT)
  const openAmount = toMoney(shift.openAmount)
  const netCashAmount = toSignedMoney((summary?.cashIncome ?? 0) - (summary?.cashExpense ?? 0))
  const reserveShortageAtOpen = Math.max(0, reserveTargetAmount - openAmount)
  const reserveTopUpAmount = Math.min(reserveShortageAtOpen, Math.max(0, netCashAmount))
  const resolvedCloseAmount = closeAmount === undefined
    ? shift.closeAmount === null || shift.closeAmount === undefined
      ? null
      : toMoney(shift.closeAmount)
    : closeAmount === null
      ? null
      : toMoney(closeAmount)
  const withdrawableAmount = resolvedCloseAmount === null ? 0 : Math.max(0, resolvedCloseAmount - reserveTargetAmount)
  const collectedAmount = toMoney(shift.collectedAmount ?? 0)

  return {
    reserveTargetAmount,
    reserveShortageAtOpen,
    netCashAmount,
    reserveTopUpAmount,
    withdrawableAmount,
    collectedAmount,
    pendingCollectionAmount: Math.max(0, withdrawableAmount - collectedAmount),
  }
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
      reserveTargetAmount: shift.reserveTargetAmount ?? summary?.reserveTargetAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT,
      reserveShortageAtOpen: shift.reserveShortageAtOpen ?? summary?.reserveShortageAtOpen ?? 0,
      netCashAmount: shift.netCashAmount ?? summary?.netCashAmount ?? 0,
      reserveTopUpAmount: shift.reserveTopUpAmount ?? summary?.reserveTopUpAmount ?? 0,
      withdrawableAmount: shift.withdrawableAmount ?? summary?.withdrawableAmount ?? 0,
      collectedAmount: shift.collectedAmount ?? 0,
      pendingCollectionAmount: shift.pendingCollectionAmount ?? summary?.pendingCollectionAmount ?? 0,
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

  private normalizeVaultEntry(entry: any) {
    const cashAfterAmount = toMoney(entry.cashAfterAmount)
    const targetReserveAmount = entry.targetReserveAmount === null || entry.targetReserveAmount === undefined
      ? DEFAULT_TARGET_RESERVE_AMOUNT
      : toMoney(entry.targetReserveAmount)
    const isShiftCloseEntry = entry.entryType === 'SHIFT_CLOSE' && entry.shiftSession

    return {
      id: entry.id,
      branchId: entry.branchId,
      branchName: entry.branch?.name ?? null,
      entryType: entry.entryType as CashVaultEntryType,
      shiftSessionId: entry.shiftSessionId ?? null,
      shiftStaffName: entry.shiftSession?.staff?.fullName ?? null,
      shiftOpenedAt: entry.shiftSession?.openedAt ?? null,
      shiftClosedAt: entry.shiftSession?.closedAt ?? null,
      cashBeforeAmount: entry.cashBeforeAmount === null || entry.cashBeforeAmount === undefined ? null : toMoney(entry.cashBeforeAmount),
      cashAfterAmount,
      deltaAmount: Math.round(Number(entry.deltaAmount) || 0),
      collectedAmount: isShiftCloseEntry ? toMoney(entry.shiftSession.collectedAmount) : toMoney(entry.collectedAmount),
      targetReserveAmount,
      netCashAmount: isShiftCloseEntry ? toSignedMoney(entry.shiftSession.netCashAmount) : 0,
      reserveTopUpAmount: isShiftCloseEntry ? toMoney(entry.shiftSession.reserveTopUpAmount) : 0,
      withdrawableAmount: isShiftCloseEntry ? toMoney(entry.shiftSession.withdrawableAmount) : 0,
      pendingAmount: isShiftCloseEntry ? toMoney(entry.shiftSession.pendingCollectionAmount) : Math.max(0, cashAfterAmount - targetReserveAmount),
      reserveShortageAmount: Math.max(0, targetReserveAmount - cashAfterAmount),
      note: entry.note ?? null,
      performedById: entry.performedById ?? null,
      performedByName: entry.performedBy?.fullName ?? null,
      occurredAt: entry.occurredAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  }

  private async findLatestVaultEntry(branchId: string, options?: { before?: Date; excludeId?: string }) {
    const where: any = { branchId }
    if (options?.before) {
      where.occurredAt = { lt: options.before }
    }
    if (options?.excludeId) {
      where.id = { not: options.excludeId }
    }

    return (this.db as any).cashVaultEntry.findFirst({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  private async upsertShiftCloseVaultEntry(shift: any, closeAmount: number, performedById?: string, occurredAt = new Date()) {
    const existing = await (this.db as any).cashVaultEntry.findUnique({
      where: { shiftSessionId: shift.id },
    })
    const previous = await this.findLatestVaultEntry(shift.branchId, {
      before: occurredAt,
      excludeId: existing?.id,
    })
    const cashBeforeAmount = previous?.cashAfterAmount === null || previous?.cashAfterAmount === undefined
      ? existing?.cashBeforeAmount ?? null
      : toMoney(previous.cashAfterAmount)
    const targetReserveAmount = shift.reserveTargetAmount ?? existing?.targetReserveAmount ?? previous?.targetReserveAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT
    const cashAfterAmount = toMoney(closeAmount)
    const deltaAmount = cashBeforeAmount === null || cashBeforeAmount === undefined
      ? cashAfterAmount
      : cashAfterAmount - toMoney(cashBeforeAmount)

    await (this.db as any).cashVaultEntry.upsert({
      where: { shiftSessionId: shift.id },
      create: {
        branchId: shift.branchId,
        entryType: 'SHIFT_CLOSE',
        shiftSessionId: shift.id,
        cashBeforeAmount,
        cashAfterAmount,
        deltaAmount,
        collectedAmount: 0,
        targetReserveAmount,
        performedById,
        occurredAt,
      },
      update: {
        branchId: shift.branchId,
        cashBeforeAmount,
        cashAfterAmount,
        deltaAmount,
        targetReserveAmount,
        performedById,
        occurredAt,
      },
    })
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

    const branch = await (this.db as any).branch.findUnique({
      where: { id: branchId },
      select: { id: true, cashReserveTargetAmount: true },
    })
    if (!branch) {
      throw new NotFoundException('Khong tim thay chi nhanh')
    }

    const reserveTargetAmount = toMoney(branch.cashReserveTargetAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT)

    const shift = await (this.db as any).shiftSession.create({
      data: {
        branchId,
        staffId,
        openAmount: toMoney(dto.openAmount),
        reserveTargetAmount,
        reserveShortageAtOpen: Math.max(0, reserveTargetAmount - toMoney(dto.openAmount)),
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
    const reserveMetrics = calculateReserveMetrics(shift, summary, closeAmount)

    const updated = await (this.db as any).shiftSession.update({
      where: { id },
      data: {
        closeAmount,
        expectedCloseAmount,
        differenceAmount,
        reserveTargetAmount: reserveMetrics.reserveTargetAmount,
        reserveShortageAtOpen: reserveMetrics.reserveShortageAtOpen,
        netCashAmount: reserveMetrics.netCashAmount,
        reserveTopUpAmount: reserveMetrics.reserveTopUpAmount,
        withdrawableAmount: reserveMetrics.withdrawableAmount,
        collectedAmount: reserveMetrics.collectedAmount,
        pendingCollectionAmount: reserveMetrics.pendingCollectionAmount,
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

    await this.upsertShiftCloseVaultEntry(updated, closeAmount, staffId, now)

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
      const reserveMetrics = calculateReserveMetrics({ ...shift, ...data }, summary, data.closeAmount)
      data.expectedCloseAmount = summary.expectedCloseAmount
      data.differenceAmount = data.closeAmount === null || data.closeAmount === undefined
        ? null
        : data.closeAmount - summary.expectedCloseAmount
      data.reserveTargetAmount = reserveMetrics.reserveTargetAmount
      data.reserveShortageAtOpen = reserveMetrics.reserveShortageAtOpen
      data.netCashAmount = reserveMetrics.netCashAmount
      data.reserveTopUpAmount = reserveMetrics.reserveTopUpAmount
      data.withdrawableAmount = reserveMetrics.withdrawableAmount
      data.collectedAmount = reserveMetrics.collectedAmount
      data.pendingCollectionAmount = reserveMetrics.pendingCollectionAmount
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

    if (amountChanged && updated.status === 'CLOSED' && updated.closeAmount !== null && updated.closeAmount !== undefined) {
      await this.upsertShiftCloseVaultEntry(updated, toMoney(updated.closeAmount), reviewerId, updated.closedAt ?? new Date())
    }

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

    await (this.db as any).cashVaultEntry.deleteMany({ where: { shiftSessionId: id } })
    await (this.db as any).shiftSession.delete({ where: { id } })
    return { success: true, data: { id } }
  }

  async getVaultSummary(query: Pick<FindCashVaultEntriesDto, 'branchId' | 'dateFrom' | 'dateTo'>, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const scopedBranchIds = getScopedBranchIds(user, query.branchId ?? requestedBranchId)
    const branchWhere: any = {}
    if (scopedBranchIds) {
      branchWhere.id = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }
    }

    const branches = await (this.db as any).branch.findMany({
      where: branchWhere,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, cashReserveTargetAmount: true },
    })
    const branchIds = branches.map((branch: any) => branch.id)

    if (branchIds.length === 0) {
      return {
        success: true,
        data: {
          branches: [],
          totalCurrentCashAmount: 0,
          totalPendingAmount: 0,
          totalReserveShortageAmount: 0,
          totalCollectedAmount: 0,
        },
      }
    }

    const entryWhere: any = { branchId: { in: branchIds } }
    const collectedWhere: any = { branchId: { in: branchIds }, entryType: 'VAULT_COLLECTION' }
    if (query.dateFrom || query.dateTo) {
      collectedWhere.occurredAt = {}
      if (query.dateFrom) collectedWhere.occurredAt.gte = startOfDay(query.dateFrom)
      if (query.dateTo) collectedWhere.occurredAt.lte = endOfDay(query.dateTo)
    }

    const [latestEntries, collectionEntries] = await Promise.all([
      (this.db as any).cashVaultEntry.findMany({
        where: entryWhere,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          branch: { select: { id: true, name: true } },
          performedBy: { select: { id: true, fullName: true } },
        },
      }),
      (this.db as any).shiftSession.groupBy({
        by: ['branchId'],
        where: { branchId: { in: branchIds }, status: 'CLOSED' },
        _sum: {
          collectedAmount: true,
          pendingCollectionAmount: true,
          withdrawableAmount: true,
        },
      }),
    ])

    const latestByBranch = new Map<string, any>()
    for (const entry of latestEntries) {
      if (!latestByBranch.has(entry.branchId)) {
        latestByBranch.set(entry.branchId, entry)
      }
    }

    const collectionByBranch = new Map<string, any>()
    for (const item of collectionEntries) {
      collectionByBranch.set(item.branchId, item)
    }

    const rows = branches.map((branch: any) => {
      const latest = latestByBranch.get(branch.id)
      const collection = collectionByBranch.get(branch.id)
      const cashAfterAmount = latest ? toMoney(latest.cashAfterAmount) : 0
      const targetReserveAmount = toMoney(branch.cashReserveTargetAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT)
      return {
        branchId: branch.id,
        branchName: branch.name,
        currentCashAmount: cashAfterAmount,
        targetReserveAmount,
        pendingAmount: toMoney(collection?._sum?.pendingCollectionAmount ?? Math.max(0, cashAfterAmount - targetReserveAmount)),
        reserveShortageAmount: Math.max(0, targetReserveAmount - cashAfterAmount),
        collectedAmount: toMoney(collection?._sum?.collectedAmount ?? 0),
        withdrawableAmount: toMoney(collection?._sum?.withdrawableAmount ?? 0),
        lastEntryAt: latest?.occurredAt ?? null,
        lastEntryType: latest?.entryType ?? null,
      }
    })

    return {
      success: true,
      data: {
        branches: rows,
        totalCurrentCashAmount: rows.reduce((sum: number, row: any) => sum + row.currentCashAmount, 0),
        totalPendingAmount: rows.reduce((sum: number, row: any) => sum + row.pendingAmount, 0),
        totalReserveShortageAmount: rows.reduce((sum: number, row: any) => sum + row.reserveShortageAmount, 0),
        totalCollectedAmount: rows.reduce((sum: number, row: any) => sum + row.collectedAmount, 0),
      },
    }
  }

  async findVaultEntries(query: FindCashVaultEntriesDto, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const page = toPositiveInt(query.page, 1)
    const limit = toPositiveInt(query.limit, 50)
    const scopedBranchIds = getScopedBranchIds(user, query.branchId ?? requestedBranchId)
    const where: any = {}

    if (scopedBranchIds) {
      where.branchId = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }
    }
    if (query.entryType && query.entryType !== 'ALL') where.entryType = query.entryType
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {}
      if (query.dateFrom) where.occurredAt.gte = startOfDay(query.dateFrom)
      if (query.dateTo) where.occurredAt.lte = endOfDay(query.dateTo)
    }

    const [rows, total] = await Promise.all([
      (this.db as any).cashVaultEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          branch: { select: { id: true, name: true } },
          performedBy: { select: { id: true, fullName: true } },
          shiftSession: {
            select: {
              id: true,
              openedAt: true,
              closedAt: true,
              netCashAmount: true,
              reserveTopUpAmount: true,
              withdrawableAmount: true,
              collectedAmount: true,
              pendingCollectionAmount: true,
              staff: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      (this.db as any).cashVaultEntry.count({ where }),
    ])

    return {
      success: true,
      data: {
        entries: rows.map((entry: any) => this.normalizeVaultEntry(entry)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  private async allocateVaultCollection(branchId: string, amount: number) {
    let remainingAmount = toMoney(amount)
    if (remainingAmount <= 0) return

    const pendingShifts = await (this.db as any).shiftSession.findMany({
      where: {
        branchId,
        status: 'CLOSED',
        pendingCollectionAmount: { gt: 0 },
      },
      orderBy: [{ closedAt: 'asc' }, { openedAt: 'asc' }],
      select: {
        id: true,
        collectedAmount: true,
        pendingCollectionAmount: true,
      },
    })

    for (const shift of pendingShifts) {
      if (remainingAmount <= 0) break
      const pendingAmount = toMoney(shift.pendingCollectionAmount)
      const allocatedAmount = Math.min(remainingAmount, pendingAmount)
      if (allocatedAmount <= 0) continue

      await (this.db as any).shiftSession.update({
        where: { id: shift.id },
        data: {
          collectedAmount: toMoney(shift.collectedAmount) + allocatedAmount,
          pendingCollectionAmount: pendingAmount - allocatedAmount,
        },
      })
      remainingAmount -= allocatedAmount
    }
  }

  async collectVault(dto: CreateVaultCollectionDto, performedById: string, user?: BranchScopedUser, requestedBranchId?: string | null) {
    const branchId = resolveWritableBranchId(user, dto.branchId ?? requestedBranchId)
    if (!branchId) {
      throw new BadRequestException('Vui long chon chi nhanh')
    }
    assertBranchAccess(branchId, user)
    if (!canManageShift(user)) {
      throw new ForbiddenException('Ban khong co quyen thu tien ket')
    }

    const amount = toMoney(dto.amount)
    if (amount <= 0) {
      throw new BadRequestException('So tien thu phai lon hon 0')
    }

    const branchExists = await (this.db as any).branch.findUnique({ where: { id: branchId }, select: { id: true } })
    if (!branchExists) {
      throw new NotFoundException('Khong tim thay chi nhanh')
    }

    const pendingAggregate = await (this.db as any).shiftSession.aggregate({
      where: { branchId, status: 'CLOSED' },
      _sum: { pendingCollectionAmount: true },
    })
    const totalPendingCollectionAmount = toMoney(pendingAggregate?._sum?.pendingCollectionAmount ?? 0)
    if (amount > totalPendingCollectionAmount) {
      throw new BadRequestException('So tien thu khong duoc lon hon tien cho thu cua cac ca')
    }

    const [latest, branchConfig] = await Promise.all([
      this.findLatestVaultEntry(branchId),
      (this.db as any).branch.findUnique({
        where: { id: branchId },
        select: { id: true, cashReserveTargetAmount: true },
      }),
    ])
    const actualCashBefore = dto.actualCashBefore === undefined || dto.actualCashBefore === null
      ? toMoney(latest?.cashAfterAmount ?? 0)
      : toMoney(dto.actualCashBefore)
    const targetReserveAmount = dto.targetReserveAmount === undefined || dto.targetReserveAmount === null
      ? toMoney(branchConfig?.cashReserveTargetAmount ?? latest?.targetReserveAmount ?? DEFAULT_TARGET_RESERVE_AMOUNT)
      : toMoney(dto.targetReserveAmount)

    if (amount > actualCashBefore) {
      throw new BadRequestException('So tien thu khong duoc lon hon tien thuc te trong ket')
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Thoi gian thu ket khong hop le')
    }

    const cashAfterAmount = actualCashBefore - amount
    const entry = await (this.db as any).cashVaultEntry.create({
      data: {
        branchId,
        entryType: 'VAULT_COLLECTION',
        cashBeforeAmount: actualCashBefore,
        cashAfterAmount,
        deltaAmount: -amount,
        collectedAmount: amount,
        targetReserveAmount,
        note: trimNullable(dto.note),
        performedById,
        occurredAt,
      },
      include: {
        branch: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true } },
        shiftSession: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            netCashAmount: true,
            reserveTopUpAmount: true,
            withdrawableAmount: true,
            collectedAmount: true,
            pendingCollectionAmount: true,
            staff: { select: { id: true, fullName: true } },
          },
        },
      },
    })

    await this.allocateVaultCollection(branchId, amount)

    return { success: true, data: this.normalizeVaultEntry(entry) }
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
    const reserveMetrics = calculateReserveMetrics(shift, { cashIncome, cashExpense }, closeAmount)

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
      reserveTargetAmount: reserveMetrics.reserveTargetAmount,
      reserveShortageAtOpen: reserveMetrics.reserveShortageAtOpen,
      netCashAmount: reserveMetrics.netCashAmount,
      reserveTopUpAmount: reserveMetrics.reserveTopUpAmount,
      withdrawableAmount: reserveMetrics.withdrawableAmount,
      collectedAmount: reserveMetrics.collectedAmount,
      pendingCollectionAmount: reserveMetrics.pendingCollectionAmount,
      orderCount: orderIds.size,
      refundCount: refundIds.size,
      manualIncomeCount: manualCashIncomeCount,
      manualExpenseCount: manualCashExpenseCount,
      transactionCount: transactions.length,
      otherPayments: Array.from(otherPayments.values()),
    }
  }
}
