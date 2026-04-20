import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import {
  getInventorySourceKey,
  resolveInventoryLedgerMovement,
} from '../../common/utils/inventory-ledger.util.js'
import {
  CreateStockCountSessionDto,
  AssignShiftsDto,
  SubmitCountItemDto,
  ApproveSessionDto,
  StartShiftSessionDto,
  ClaimRandomShiftDto,
} from './dto/index.js'
import { resolveProductVariantLabels } from '@petshop/shared'

const SHIFT_SEQUENCE = [
  'MON_A',
  'MON_B',
  'MON_C',
  'MON_D',
  'TUE_A',
  'TUE_B',
  'TUE_C',
  'TUE_D',
  'WED_A',
  'WED_B',
  'WED_C',
  'WED_D',
  'THU_A',
  'THU_B',
  'THU_C',
  'THU_D',
  'FRI_A',
  'FRI_B',
  'FRI_C',
  'FRI_D',
  'SAT_A',
  'SAT_B',
  'SAT_C',
  'SAT_D',
] as const

type ShiftKey = (typeof SHIFT_SEQUENCE)[number]

const SHIFT_LABELS: Record<ShiftKey, string> = {
  MON_A: 'Thứ 2 | Ca A',
  MON_B: 'Thứ 2 | Ca B',
  MON_C: 'Thứ 2 | Ca C',
  MON_D: 'Thứ 2 | Ca D',
  TUE_A: 'Thứ 3 | Ca A',
  TUE_B: 'Thứ 3 | Ca B',
  TUE_C: 'Thứ 3 | Ca C',
  TUE_D: 'Thứ 3 | Ca D',
  WED_A: 'Thứ 4 | Ca A',
  WED_B: 'Thứ 4 | Ca B',
  WED_C: 'Thứ 4 | Ca C',
  WED_D: 'Thứ 4 | Ca D',
  THU_A: 'Thứ 5 | Ca A',
  THU_B: 'Thứ 5 | Ca B',
  THU_C: 'Thứ 5 | Ca C',
  THU_D: 'Thứ 5 | Ca D',
  FRI_A: 'Thứ 6 | Ca A',
  FRI_B: 'Thứ 6 | Ca B',
  FRI_C: 'Thứ 6 | Ca C',
  FRI_D: 'Thứ 6 | Ca D',
  SAT_A: 'Thứ 7 | Ca A',
  SAT_B: 'Thứ 7 | Ca B',
  SAT_C: 'Thứ 7 | Ca C',
  SAT_D: 'Thứ 7 | Ca D',
}

const SHIFT_DAY_INDEX: Record<ShiftKey, number> = {
  MON_A: 0,
  MON_B: 0,
  MON_C: 0,
  MON_D: 0,
  TUE_A: 1,
  TUE_B: 1,
  TUE_C: 1,
  TUE_D: 1,
  WED_A: 2,
  WED_B: 2,
  WED_C: 2,
  WED_D: 2,
  THU_A: 3,
  THU_B: 3,
  THU_C: 3,
  THU_D: 3,
  FRI_A: 4,
  FRI_B: 4,
  FRI_C: 4,
  FRI_D: 4,
  SAT_A: 5,
  SAT_B: 5,
  SAT_C: 5,
  SAT_D: 5,
}

const DAY_SHIFT_GROUPS: Record<string, ShiftKey[]> = {
  MON: ['MON_A', 'MON_B', 'MON_C', 'MON_D'],
  TUE: ['TUE_A', 'TUE_B', 'TUE_C', 'TUE_D'],
  WED: ['WED_A', 'WED_B', 'WED_C', 'WED_D'],
  THU: ['THU_A', 'THU_B', 'THU_C', 'THU_D'],
  FRI: ['FRI_A', 'FRI_B', 'FRI_C', 'FRI_D'],
  SAT: ['SAT_A', 'SAT_B', 'SAT_C', 'SAT_D'],
}

const DAY_LABELS: Record<string, string> = {
  MON: 'Thứ 2',
  TUE: 'Thứ 3',
  WED: 'Thứ 4',
  THU: 'Thứ 5',
  FRI: 'Thứ 6',
  SAT: 'Thứ 7',
}

const CATEGORY_DAY_PREFERENCES: Array<{ keywords: string[]; days: string[] }> = [
  { keywords: ['thuc an', 'food', 'treat', 'snack'], days: ['MON', 'TUE'] },
  { keywords: ['ve sinh', 'litter', 'bath', 'shampoo'], days: ['WED', 'THU'] },
  { keywords: ['cham soc', 'care', 'supplement'], days: ['THU', 'FRI'] },
  { keywords: ['phu kien', 'accessory', 'toy'], days: ['FRI', 'SAT'] },
  { keywords: ['thuoc', 'medicine', 'med'], days: ['SAT', 'FRI'] },
]

type BranchCountRow = {
  productId: string
  productVariantId: string | null
  stock: number
  reservedStock: number
  minStock: number
  product: {
    id: string
    name: string
    sku: string | null
    category: string | null
    lastCountShift: ShiftKey | null
    image: string | null
  }
  variant: {
    id: string
    name: string
    variantLabel?: string | null
    unitLabel?: string | null
    sku: string | null
    conversions?: string | null
  } | null
}

type ProductShiftCandidate = {
  id: string
  name: string
  category: string | null
  lastCountShift: ShiftKey | null
  rowCount: number
}

@Injectable()
export class StockCountService {
  constructor(private readonly prisma: DatabaseService) {}

  private sessionInclude() {
    return {
      branch: { select: { id: true, name: true, code: true } },
      shifts: {
        orderBy: [{ countDate: 'asc' as const }, { shift: 'asc' as const }],
        include: {
          _count: { select: { items: true } },
          counter: { select: { id: true, fullName: true, staffCode: true } },
        },
      },
      creator: { select: { id: true, fullName: true, staffCode: true } },
      approver: { select: { id: true, fullName: true, staffCode: true } },
    }
  }

  private shiftInclude() {
    return {
      items: {
        orderBy: [{ product: { name: 'asc' as const } }, { variant: { name: 'asc' as const } }],
        include: {
          product: { select: { id: true, name: true, sku: true, image: true } },
          variant: { select: { id: true, name: true, variantLabel: true, unitLabel: true, sku: true, image: true } },
        },
      },
      session: {
        select: {
          id: true,
          branchId: true,
          weekNumber: true,
          year: true,
          startDate: true,
          endDate: true,
          status: true,
          branch: { select: { id: true, name: true, code: true } },
        },
      },
      counter: { select: { id: true, fullName: true, staffCode: true } },
    }
  }

  async createSession(userId: string, dto: CreateStockCountSessionDto) {
    const startDate = this.normalizeDate(dto.startDate)
    const endDate = this.normalizeDate(dto.endDate)
    this.assertValidSessionDates(startDate, endDate)

    const existing = await this.prisma.stockCountSession.findUnique({
      where: {
        branchId_weekNumber_year: {
          branchId: dto.branchId,
          weekNumber: dto.weekNumber,
          year: dto.year,
        },
      },
    })

    if (existing) {
      throw new BadRequestException(
        `Phiếu kiểm tuần ${dto.weekNumber}/${dto.year} đã tồn tại cho chi nhánh này`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await this.loadBranchCountRows(tx, dto.branchId)
      if (rows.length === 0) {
        throw new BadRequestException('Chi nhánh này chưa có dữ liệu tồn kho để kiểm')
      }

      await this.ensureProductShiftAssignments(tx, rows)

      const session = await tx.stockCountSession.create({
        data: {
          branchId: dto.branchId,
          weekNumber: dto.weekNumber,
          year: dto.year,
          startDate,
          endDate,
          createdBy: userId,
          totalProducts: rows.length,
          countedProducts: 0,
        },
      })

      await this.syncSessionShifts(tx, session.id)

      const created = await tx.stockCountSession.findUnique({
        where: { id: session.id },
        include: this.sessionInclude(),
      })

      if (!created) {
        throw new NotFoundException('Không thể tạo phiếu kiểm kho')
      }

      return created
    })
  }

  async findSessions(branchId: string, weekNumber?: number, year?: number, page = 1, limit = 20) {
    const where: Record<string, any> = { branchId }
    if (weekNumber) where.weekNumber = Number(weekNumber)
    if (year) where.year = Number(year)

    const currentPage = Number(page) > 0 ? Number(page) : 1
    const currentLimit = Number(limit) > 0 ? Number(limit) : 20

    const [sessions, total] = await Promise.all([
      this.prisma.stockCountSession.findMany({
        where,
        orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }, { createdAt: 'desc' }],
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          _count: { select: { shifts: true } },
        },
      }),
      this.prisma.stockCountSession.count({ where }),
    ])

    return {
      data: sessions,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages: Math.ceil(total / currentLimit),
    }
  }

  async findSessionById(sessionId: string) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude(),
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    const progressPercent =
      session.totalProducts > 0 ? Math.round((session.countedProducts / session.totalProducts) * 100) : 0

    return {
      ...session,
      progressPercent,
    }
  }

  async assignShiftsToProducts(sessionId: string, dto: AssignShiftsDto) {
    void dto

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.stockCountSession.findUnique({
        where: { id: sessionId },
        include: { shifts: true },
      })

      if (!session) {
        throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
      }

      if (session.status !== 'DRAFT') {
        throw new BadRequestException('Chỉ có thể đồng bộ ca khi phiếu đang ở trạng thái nháp')
      }

      const hasProgress = session.shifts.some(
        (shift) => shift.startedAt || shift.completedAt || shift.countedItems > 0 || shift.status !== 'DRAFT',
      )

      if (hasProgress) {
        throw new BadRequestException('Phiếu đã có dữ liệu kiểm. Không thể phân ca lại')
      }

      const summary = await this.syncSessionShifts(tx, sessionId, true)

      return {
        shiftsCreated: summary.shiftsCreated,
        totalProductsAssigned: summary.totalItems,
      }
    })
  }

  async claimRandomShift(sessionId: string, userId: string, dto: ClaimRandomShiftDto) {
    const targetDate = this.normalizeDate(dto.countDate)

    const pickedShiftId = await this.prisma.$transaction(async (tx) => {
      const session = await tx.stockCountSession.findUnique({
        where: { id: sessionId },
        include: {
          shifts: true,
        },
      })

      if (!session) {
        throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
      }

      if (session.status !== 'DRAFT') {
        throw new BadRequestException('Phiếu kiểm không còn ở trạng thái đang kiểm')
      }

      this.assertDateInsideSession(session.startDate, session.endDate, targetDate)

      const dayKey = this.getDayKeyFromDate(targetDate)
      if (dayKey === 'SUN') {
        throw new BadRequestException('Chủ nhật không thực hiện kiểm kho')
      }

      const ownedShiftForSelectedDay = session.shifts.find(
        (shift) =>
          shift.countedBy === userId &&
          shift.status === 'DRAFT' &&
          !shift.completedAt &&
          shift.shift.startsWith(dayKey),
      )

      if (ownedShiftForSelectedDay) {
        return ownedShiftForSelectedDay.id
      }

      const candidates = session.shifts.filter(
        (shift) =>
          shift.status === 'DRAFT' &&
          !shift.completedAt &&
          shift.totalItems > 0 &&
          shift.shift.startsWith(dayKey) &&
          !shift.countedBy,
      )

      if (candidates.length === 0) {
        throw new BadRequestException(`Không còn ca kiểm khả dụng cho ${DAY_LABELS[dayKey] ?? dayKey}`)
      }

      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      if (!picked) {
        throw new BadRequestException('Không thể chọn ca kiểm khả dụng')
      }
      await tx.stockCountShiftSession.update({
        where: { id: picked.id },
        data: {
          countedBy: userId,
          startedAt: new Date(),
          notes: dto.notes ?? picked.notes ?? null,
        },
      })

      return picked.id
    })

    return this.getShiftSessionDetail(pickedShiftId)
  }

  async getShiftSessionDetail(shiftSessionId: string) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: this.shiftInclude(),
    })

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }

    const items = [...shift.items].sort((left, right) =>
      this.getItemDisplayName(left).localeCompare(this.getItemDisplayName(right), 'vi'),
    )

    return {
      ...shift,
      shiftLabel: this.getShiftLabel(shift.shift as ShiftKey),
      items,
    }
  }

  async startShiftSession(shiftSessionId: string, userId: string, dto?: StartShiftSessionDto) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: { session: true },
    })

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }

    if (shift.session.status !== 'DRAFT') {
      throw new BadRequestException('Phiếu kiểm không còn ở trạng thái đang kiểm')
    }

    if (shift.status !== 'DRAFT') {
      throw new BadRequestException('Ca kiểm này đã hoàn thành')
    }

    if (shift.countedBy && shift.countedBy !== userId) {
      throw new ForbiddenException('Ca kiểm này đang được người khác thực hiện')
    }

    await this.prisma.stockCountShiftSession.update({
      where: { id: shiftSessionId },
      data: {
        countedBy: userId,
        startedAt: shift.startedAt ?? new Date(),
        notes: dto?.notes ?? shift.notes ?? null,
      },
    })

    return this.getShiftSessionDetail(shiftSessionId)
  }

  async completeShiftSession(shiftSessionId: string, userId: string) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: { items: true, session: true },
    })

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }

    if (shift.countedBy && shift.countedBy !== userId) {
      throw new ForbiddenException('Bạn không phải người đang kiểm ca này')
    }

    if (shift.items.some((item) => item.variance === null)) {
      throw new BadRequestException('Vẫn còn sản phẩm chưa nhập chênh lệch kiểm kho')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockCountShiftSession.update({
        where: { id: shiftSessionId },
        data: {
          status: 'SUBMITTED',
          countedBy: userId,
          startedAt: shift.startedAt ?? new Date(),
          completedAt: new Date(),
          countedItems: shift.items.length,
        },
      })

      await this.updateSessionProgress(tx, shift.sessionId)
    })

    return {
      success: true,
      message: 'Ca kiểm đã được gửi quản lý duyệt',
    }
  }

  async submitCountItem(itemId: string, userId: string, dto: SubmitCountItemDto) {
    const item = await this.prisma.stockCountItem.findUnique({
      where: { id: itemId },
      include: {
        shiftSession: {
          include: {
            session: true,
          },
        },
      },
    })

    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm kiểm')
    }

    if (item.shiftSession.session.status !== 'DRAFT' || item.shiftSession.status !== 'DRAFT') {
      throw new BadRequestException('Ca kiểm này đã khóa, không thể cập nhật')
    }

    if (item.shiftSession.countedBy && item.shiftSession.countedBy !== userId) {
      throw new ForbiddenException('Ca kiểm này đang được người khác thực hiện')
    }

    const countedQuantity = item.systemQuantity + dto.variance
    if (countedQuantity < 0) {
      throw new BadRequestException('Chênh lệch đang làm số lượng thực tế âm')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (!item.shiftSession.startedAt || !item.shiftSession.countedBy) {
        await tx.stockCountShiftSession.update({
          where: { id: item.shiftSessionId },
          data: {
            countedBy: userId,
            startedAt: item.shiftSession.startedAt ?? new Date(),
          },
        })
      }

      const result = await tx.stockCountItem.update({
        where: { id: itemId },
        data: {
          countedQuantity,
          variance: dto.variance,
          notes: dto.notes ?? item.notes ?? null,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, variantLabel: true, unitLabel: true, sku: true } },
        },
      })

      await this.syncShiftProgress(tx, item.shiftSessionId)
      await this.updateSessionProgress(tx, item.shiftSession.sessionId)

      return result
    })

    return updated
  }

  async approveSession(sessionId: string, approverId: string) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
      include: {
        shifts: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
                variant: {
                  select: {
                    id: true,
                    name: true,
                    variantLabel: true,
                    unitLabel: true,
                    sku: true,
                    productId: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException('Phiếu kiểm phải ở trạng thái chờ duyệt')
    }

    const allSubmitted = session.shifts.every((shift) => shift.status === 'SUBMITTED')
    if (!allSubmitted) {
      throw new BadRequestException('Tất cả ca kiểm phải hoàn thành trước khi duyệt')
    }

    return this.prisma.$transaction(async (tx) => {
      let adjustedItems = 0
      const countedSourceKeys = new Map<string, string>()

      for (const shift of session.shifts) {
        for (const item of shift.items) {
          const productId = item.productId ?? item.variant?.productId
          if (!productId) {
            throw new BadRequestException('Item kiem kho dang thieu productId de dieu chinh ton')
          }

          const movement = await resolveInventoryLedgerMovement(tx, {
            productId,
            productVariantId: item.productVariantId ?? null,
            quantity: 1,
            quantityLabel: 'SKU kiem kho',
          })
          const sourceKey = getInventorySourceKey(productId, movement.sourceVariantId)
          const existingLabel = countedSourceKeys.get(sourceKey)
          const currentLabel = this.getItemDisplayName(item)

          if (existingLabel) {
            throw new BadRequestException(
              `Nguon ton ${currentLabel} dang duoc kiem trung voi ${existingLabel} trong cung phieu kiem`,
            )
          }

          countedSourceKeys.set(sourceKey, currentLabel)
        }
      }

      for (const shift of session.shifts) {
        for (const item of shift.items) {
          const variance = item.variance ?? 0
          if (variance === 0) {
            continue
          }

          const productId = item.productId ?? item.variant?.productId
          if (!productId) {
            throw new BadRequestException('Item kiểm kho đang thiếu productId để điều chỉnh tồn')
          }

          const movement = await resolveInventoryLedgerMovement(tx, {
            productId,
            productVariantId: item.productVariantId ?? null,
            quantity: variance,
            quantityLabel: 'Chenh lech kiem kho',
          })
          const effectiveVariantId = movement.sourceVariantId
          const effectiveVariance = movement.sourceQuantity

          const branchStock = await tx.branchStock.findFirst({
            where: {
              branchId: session.branchId,
              productId,
              productVariantId: effectiveVariantId,
            },
          })

          if (!branchStock) {
            if (effectiveVariance < 0) {
              throw new BadRequestException(
                `Không thể trừ tồn cho ${this.getItemDisplayName(item)} vì chi nhánh không còn bản ghi tồn kho`,
              )
            }

            await tx.branchStock.create({
              data: {
                branchId: session.branchId,
                productId,
                productVariantId: effectiveVariantId,
                stock: effectiveVariance,
                reservedStock: 0,
                minStock: 5,
              },
            })
          } else {
            const nextStock = branchStock.stock + effectiveVariance
            if (nextStock < 0) {
              throw new BadRequestException(
                `Không thể duyệt vì ${this.getItemDisplayName(item)} hiện chỉ còn ${branchStock.stock}, không đủ để trừ ${Math.abs(
                  effectiveVariance,
                )}`,
              )
            }

            await tx.branchStock.update({
              where: { id: branchStock.id },
              data: {
                stock: {
                  increment: effectiveVariance,
                },
              },
            })
          }

          await tx.stockTransaction.create({
            data: {
              productId,
              productVariantId: movement.actionVariantId,
              sourceProductVariantId: movement.sourceVariantId,
              branchId: session.branchId,
              type: 'ADJUST',
              quantity: Math.abs(movement.sourceQuantity),
              actionQuantity: movement.actionQuantity,
              sourceQuantity: movement.sourceQuantity,
              conversionRate: movement.conversionRate,
              reason: `Dieu chinh tu kiem kho tuan ${session.weekNumber}/${session.year} - ${this.getShiftLabel(
                shift.shift as ShiftKey,
              )}`,
              referenceId: session.id,
            },
          })

          adjustedItems += 1
        }
      }

      await tx.stockCountShiftSession.updateMany({
        where: { sessionId },
        data: {
          status: 'APPROVED',
        },
      })

      await tx.stockCountSession.update({
        where: { id: sessionId },
        data: {
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      })

      return {
        success: true,
        adjustedItems,
        message: 'Phiếu kiểm đã được duyệt và áp chênh lệch vào tồn kho',
      }
    })
  }

  async rejectSession(sessionId: string, approverId: string, dto: ApproveSessionDto) {
    void approverId

    if (!dto.rejectionReason?.trim()) {
      throw new BadRequestException('Bắt buộc phải có lý do từ chối')
    }

    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException('Phiếu kiểm phải ở trạng thái chờ duyệt')
    }

    await this.prisma.stockCountSession.update({
      where: { id: sessionId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.rejectionReason.trim(),
      },
    })

    return {
      success: true,
      message: 'Phiếu kiểm đã bị từ chối',
    }
  }

  async getWeeklyProgress(branchId: string, weekNumber: number, year: number) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: {
        branchId_weekNumber_year: {
          branchId,
          weekNumber: Number(weekNumber),
          year: Number(year),
        },
      },
      include: {
        shifts: {
          orderBy: [{ countDate: 'asc' as const }, { shift: 'asc' as const }],
          include: {
            _count: { select: { items: true } },
            counter: { select: { id: true, fullName: true, staffCode: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm cho tuần này')
    }

    const totalShifts = session.shifts.length
    const completedShifts = session.shifts.filter((shift) =>
      ['SUBMITTED', 'APPROVED'].includes(shift.status),
    ).length
    const inProgressShifts = session.shifts.filter(
      (shift) => shift.status === 'DRAFT' && !!shift.startedAt && !shift.completedAt,
    ).length
    const progressPercent =
      session.totalProducts > 0 ? Math.round((session.countedProducts / session.totalProducts) * 100) : 0

    const shiftsByDay = Object.keys(DAY_SHIFT_GROUPS).reduce<Record<string, any[]>>((acc, dayKey) => {
      acc[dayKey] = []
      return acc
    }, {})

    for (const shift of session.shifts) {
      const dayKey = this.getShiftDayKey(shift.shift as ShiftKey)
      shiftsByDay[dayKey]!.push({
        id: shift.id,
        shift: shift.shift,
        shiftLabel: this.getShiftLabel(shift.shift as ShiftKey),
        status: shift.status,
        countDate: shift.countDate,
        startedAt: shift.startedAt,
        completedAt: shift.completedAt,
        counter: shift.counter,
        totalItems: shift.totalItems,
        countedItems: shift.countedItems,
      })
    }

    return {
      session: {
        id: session.id,
        weekNumber: session.weekNumber,
        year: session.year,
        startDate: session.startDate,
        endDate: session.endDate,
        status: session.status,
        totalProducts: session.totalProducts,
        countedProducts: session.countedProducts,
        rejectionReason: session.rejectionReason,
        progressPercent,
      },
      shiftsByDay,
      summary: {
        totalShifts,
        completedShifts,
        inProgressShifts,
        remainingShifts: Math.max(0, totalShifts - completedShifts),
      },
    }
  }

  getDateForShift(session: { startDate: Date }, shift: string): Date {
    const dayOffset = SHIFT_DAY_INDEX[shift as ShiftKey] ?? 0
    const date = new Date(session.startDate)
    date.setDate(date.getDate() + dayOffset)
    return date
  }

  private async syncSessionShifts(tx: any, sessionId: string, forceReset = false) {
    const session = await tx.stockCountSession.findUnique({
      where: { id: sessionId },
      include: { shifts: true },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (forceReset && session.shifts.length > 0) {
      await tx.stockCountShiftSession.deleteMany({ where: { sessionId } })
    }

    const rows = await this.loadBranchCountRows(tx, session.branchId)
    if (rows.length === 0) {
      throw new BadRequestException('Chi nhánh này chưa có dữ liệu tồn kho để kiểm')
    }

    const fallbackAssignments = await this.ensureProductShiftAssignments(tx, rows)
    const assignments = new Map<
      ShiftKey,
      Array<{ productId: string; productVariantId: string | null; systemQuantity: number }>
    >()

    for (const shift of SHIFT_SEQUENCE) {
      assignments.set(shift, [])
    }

    for (const row of rows) {
      const assignedShift = (row.product.lastCountShift ??
        fallbackAssignments.get(row.productId)) as ShiftKey | undefined
      if (!assignedShift) {
        throw new BadRequestException(`Sản phẩm ${row.product.name} chưa có ca kiểm`)
      }

      assignments.get(assignedShift)!.push({
        productId: row.productId,
        productVariantId: row.productVariantId ?? null,
        systemQuantity: row.stock,
      })
    }

    if (!forceReset && session.shifts.length > 0) {
      throw new BadRequestException('Phiếu đã có ca kiểm. Không thể sinh lại dữ liệu')
    }

    for (const shift of SHIFT_SEQUENCE) {
      const items = assignments.get(shift)!
      if (items.length === 0) {
        continue
      }

      await tx.stockCountShiftSession.create({
        data: {
          sessionId,
          shift,
          countDate: this.getDateForShift(session, shift),
          countedBy: null,
          totalItems: items.length,
          countedItems: 0,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productVariantId: item.productVariantId,
              categoryId: 'PRODUCT',
              systemQuantity: item.systemQuantity,
            })),
          },
        },
      })
    }

    await tx.stockCountSession.update({
      where: { id: sessionId },
      data: {
        totalProducts: rows.length,
        countedProducts: 0,
        status: 'DRAFT',
        rejectionReason: null,
      },
    })

    return {
      shiftsCreated: Array.from(assignments.values()).filter((items) => items.length > 0).length,
      totalItems: rows.length,
    }
  }

  private async loadBranchCountRows(tx: any, branchId: string): Promise<BranchCountRow[]> {
    const rows = await tx.branchStock.findMany({
      where: {
        branchId,
        productId: { not: null },
        product: {
          isActive: true,
          deletedAt: null,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            lastCountShift: true,
            image: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            variantLabel: true,
            unitLabel: true,
            sku: true,
            conversions: true,
          },
        },
      },
      orderBy: [{ product: { category: 'asc' } }, { product: { name: 'asc' } }],
    })

    return rows.filter((row: any) => !row.variant?.conversions) as BranchCountRow[]
  }

  private async ensureProductShiftAssignments(tx: any, rows: BranchCountRow[]) {
    const loadByShift = new Map<ShiftKey, number>()
    for (const shift of SHIFT_SEQUENCE) {
      loadByShift.set(shift, 0)
    }

    const byProduct = new Map<string, ProductShiftCandidate>()
    for (const row of rows) {
      const current = byProduct.get(row.productId)
      if (current) {
        current.rowCount += 1
      } else {
        byProduct.set(row.productId, {
          id: row.product.id,
          name: row.product.name,
          category: row.product.category,
          lastCountShift: row.product.lastCountShift,
          rowCount: 1,
        })
      }

      if (row.product.lastCountShift) {
        loadByShift.set(
          row.product.lastCountShift,
          (loadByShift.get(row.product.lastCountShift) ?? 0) + 1,
        )
      }
    }

    const missingProducts = Array.from(byProduct.values())
      .filter((product) => !product.lastCountShift)
      .sort((left, right) => {
        const categoryCompare = (left.category ?? '').localeCompare(right.category ?? '', 'vi')
        if (categoryCompare !== 0) {
          return categoryCompare
        }
        return left.name.localeCompare(right.name, 'vi')
      })

    const assigned = new Map<string, ShiftKey>()
    if (missingProducts.length === 0) {
      return assigned
    }

    for (const product of missingProducts) {
      const shift = this.pickSuggestedShiftForProduct(product, loadByShift)
      assigned.set(product.id, shift)
      loadByShift.set(shift, (loadByShift.get(shift) ?? 0) + product.rowCount)
    }

    const productIdsByShift = new Map<ShiftKey, string[]>()
    for (const shift of SHIFT_SEQUENCE) {
      productIdsByShift.set(shift, [])
    }

    for (const [productId, shift] of assigned.entries()) {
      productIdsByShift.get(shift)!.push(productId)
    }

    for (const shift of SHIFT_SEQUENCE) {
      const productIds = productIdsByShift.get(shift)!
      if (productIds.length === 0) {
        continue
      }

      await tx.product.updateMany({
        where: {
          id: {
            in: productIds,
          },
        },
        data: {
          lastCountShift: shift,
        },
      })
    }

    return assigned
  }

  private pickLeastLoadedShift(loadByShift: Map<ShiftKey, number>) {
    return SHIFT_SEQUENCE.reduce((bestShift, shift) => {
      const bestLoad = loadByShift.get(bestShift) ?? 0
      const currentLoad = loadByShift.get(shift) ?? 0
      return currentLoad < bestLoad ? shift : bestShift
    }, SHIFT_SEQUENCE[0])
  }

  private pickSuggestedShiftForProduct(
    product: Pick<ProductShiftCandidate, 'category'>,
    loadByShift: Map<ShiftKey, number>,
  ) {
    const preferredDays = this.getPreferredDaysForCategory(product.category)
    if (preferredDays.length > 0) {
      const preferredShifts = preferredDays.flatMap((dayKey) => DAY_SHIFT_GROUPS[dayKey] ?? [])
      if (preferredShifts.length > 0) {
        return preferredShifts.reduce((bestShift, shift) => {
          const bestLoad = loadByShift.get(bestShift) ?? 0
          const currentLoad = loadByShift.get(shift) ?? 0
          return currentLoad < bestLoad ? shift : bestShift
        }, preferredShifts[0]!)
      }
    }

    return this.pickLeastLoadedShift(loadByShift)
  }

  private getPreferredDaysForCategory(category: string | null) {
    const normalizedCategory = this.normalizeCategory(category)
    if (!normalizedCategory) {
      return []
    }

    const matchedRule = CATEGORY_DAY_PREFERENCES.find((rule) =>
      rule.keywords.some((keyword) => normalizedCategory.includes(keyword)),
    )

    return matchedRule?.days ?? []
  }

  private normalizeCategory(value: string | null) {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .trim()
  }

  private async syncShiftProgress(tx: any, shiftSessionId: string) {
    const countedItems = await tx.stockCountItem.count({
      where: {
        shiftSessionId,
        variance: { not: null },
      },
    })

    await tx.stockCountShiftSession.update({
      where: { id: shiftSessionId },
      data: {
        countedItems,
      },
    })
  }

  private async updateSessionProgress(tx: any, sessionId: string) {
    const session = await tx.stockCountSession.findUnique({
      where: { id: sessionId },
      include: {
        shifts: {
          select: {
            status: true,
            countedItems: true,
            totalItems: true,
          },
        },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    const countedProducts = session.shifts.reduce(
      (sum: number, shift: { countedItems: number | null }) => sum + (shift.countedItems ?? 0),
      0,
    )
    const allSubmitted =
      session.shifts.length > 0 &&
      session.shifts.every((shift: { status: string }) => ['SUBMITTED', 'APPROVED'].includes(shift.status))

    const nextStatus =
      session.status === 'APPROVED' || session.status === 'REJECTED'
        ? session.status
        : allSubmitted
          ? 'SUBMITTED'
          : 'DRAFT'

    await tx.stockCountSession.update({
      where: { id: sessionId },
      data: {
        countedProducts,
        status: nextStatus,
      },
    })
  }

  private normalizeDate(value: string | Date) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
  }

  private assertValidSessionDates(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Ngày kiểm kho không hợp lệ')
    }

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu')
    }

    const startDay = startDate.getDay()
    const endDay = endDate.getDay()
    if (startDay !== 1 || endDay !== 6) {
      throw new BadRequestException('Phiếu kiểm tuần phải bắt đầu từ thứ 2 và kết thúc vào thứ 7')
    }
  }

  private assertDateInsideSession(startDate: Date, endDate: Date, targetDate: Date) {
    const normalizedStart = this.normalizeDate(startDate)
    const normalizedEnd = this.normalizeDate(endDate)
    if (targetDate < normalizedStart || targetDate > normalizedEnd) {
      throw new BadRequestException('Ngày kiểm phải nằm trong tuần của phiếu kiểm')
    }
  }

  private getDayKeyFromDate(date: Date) {
    const day = date.getDay()
    switch (day) {
      case 1:
        return 'MON'
      case 2:
        return 'TUE'
      case 3:
        return 'WED'
      case 4:
        return 'THU'
      case 5:
        return 'FRI'
      case 6:
        return 'SAT'
      default:
        return 'SUN'
    }
  }

  private getShiftDayKey(shift: ShiftKey) {
    return shift.split('_')[0]!
  }

  private getShiftLabel(shift: ShiftKey) {
    return SHIFT_LABELS[shift] ?? shift
  }

  private getItemDisplayName(item: {
    product?: { name?: string | null } | null
    variant?: { name?: string | null; variantLabel?: string | null; unitLabel?: string | null; sku?: string | null } | null
  }) {
    const productName = item.product?.name ?? 'San pham'
    if (!item.variant) return productName
    return resolveProductVariantLabels(productName, item.variant).displayName || productName
  }
}
