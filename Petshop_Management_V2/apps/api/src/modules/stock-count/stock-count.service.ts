import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import {
  CreateStockCountSessionDto,
  AssignShiftsDto,
  SubmitCountItemDto,
  ApproveSessionDto,
  StartShiftSessionDto,
} from './dto/index.js'

// Shift labels for display
const SHIFT_LABELS: Record<string, string> = {
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

// Day-of-week mapping (Monday=1 to Saturday=6)
const SHIFT_DAY_ORDER: Record<string, number> = {
  MON_A: 1, MON_B: 1, MON_C: 1, MON_D: 1,
  TUE_A: 2, TUE_B: 2, TUE_C: 2, TUE_D: 2,
  WED_A: 3, WED_B: 3, WED_C: 3, WED_D: 3,
  THU_A: 4, THU_B: 4, THU_C: 4, THU_D: 4,
  FRI_A: 5, FRI_B: 5, FRI_C: 5, FRI_D: 5,
  SAT_A: 6, SAT_B: 6, SAT_C: 6, SAT_D: 6,
}

const ALL_SHIFTS = Object.keys(SHIFT_LABELS)

@Injectable()
export class StockCountService {
  constructor(private readonly prisma: DatabaseService) { }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Create a weekly stock count session
   */
  async createSession(userId: string, dto: CreateStockCountSessionDto) {
    // Check if session already exists for this branch/week/year
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

    // Count total products across all branches (active, not deleted)
    const totalProducts = await this.prisma.product.count({
      where: { isActive: true, deletedAt: null },
    })

    const session = await this.prisma.stockCountSession.create({
      data: {
        branchId: dto.branchId,
        weekNumber: dto.weekNumber,
        year: dto.year,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        createdBy: userId,
        totalProducts,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    return session
  }

  /**
   * List sessions for a branch with pagination
   */
  async findSessions(branchId: string, weekNumber?: number, year?: number, page = 1, limit = 20) {
    const where: any = { branchId }
    if (weekNumber) where.weekNumber = weekNumber
    if (year) where.year = year

    const [sessions, total] = await Promise.all([
      this.prisma.stockCountSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get session detail with shifts
   */
  async findSessionById(sessionId: string) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        shifts: {
          orderBy: { countDate: 'asc' },
          include: {
            _count: { select: { items: true } },
            counter: { select: { id: true, fullName: true, staffCode: true } },
          },
        },
        creator: { select: { id: true, fullName: true, staffCode: true } },
        approver: { select: { id: true, fullName: true, staffCode: true } },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    return session
  }

  // ===========================================================================
  // SHIFT ASSIGNMENT (RANDOM)
  // ===========================================================================

  /**
   * Randomly assign products to shifts, excluding already-assigned shifts
   */
  async assignShiftsToProducts(sessionId: string, dto: AssignShiftsDto) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
      include: {
        shifts: { select: { shift: true } },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (session.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể phân ca cho phiếu ở trạng thái nháp')
    }

    // Get already-used shifts for this session
    const usedShifts = session.shifts.map((s) => s.shift)
    const availableShifts = ALL_SHIFTS.filter((s) => !usedShifts.includes(s as any))

    if (availableShifts.length === 0) {
      throw new BadRequestException('Tất cả ca đã được sử dụng. Không thể phân thêm.')
    }

    // Get products for this session's branch
    const branchStocks = await this.prisma.branchStock.findMany({
      where: {
        branchId: session.branchId,
        product: { isActive: true, deletedAt: null },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
    })

    if (branchStocks.length === 0) {
      throw new BadRequestException('Không có sản phẩm trong kho chi nhánh này')
    }

    // Filter by productIds if provided
    let productsToAssign = branchStocks
    if (dto.productIds && dto.productIds.length > 0) {
      productsToAssign = branchStocks.filter((bs) =>
        dto.productIds.includes(bs.productId ?? ''),
      )
    }

    // Distribute products evenly across available shifts
    const shiftAssignments: {
      shift: any
      countDate: Date
      items: { productId: string; productVariantId: string | null; systemQuantity: number }[]
    }[] = []

    // Initialize shift assignments
    for (const shiftKey of availableShifts) {
      const dayOffset = SHIFT_DAY_ORDER[shiftKey] ?? 1
      const countDate = new Date(session.startDate)
      countDate.setDate(countDate.getDate() + (dayOffset - 1))

      shiftAssignments.push({
        shift: shiftKey,
        countDate,
        items: [],
      })
    }

    // Round-robin assignment
    productsToAssign.forEach((bs, index) => {
      const shiftIndex = index % shiftAssignments.length
      if (bs.productId) {
        shiftAssignments[shiftIndex]!.items.push({
          productId: bs.productId,
          productVariantId: bs.productVariantId,
          systemQuantity: bs.stock,
        })
      }
    })

    // Create shift sessions and items in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const createdShifts = []

      for (const assignment of shiftAssignments) {
        if (assignment.items.length === 0) continue

        const shiftSession = await tx.stockCountShiftSession.create({
          data: {
            sessionId,
            shift: assignment.shift as any,
            countDate: assignment.countDate,
            countedBy: session.createdBy, // Default to session creator
            totalItems: assignment.items.length,
            items: {
              create: assignment.items.map((item) => ({
                productId: item.productId,
                productVariantId: item.productVariantId,
                systemQuantity: item.systemQuantity,
                categoryId: 'PRODUCT',
              })),
            },
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
                variant: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        })

        createdShifts.push(shiftSession)

        // Update lastCountShift on products
        const productIds = assignment.items.map((item) => item.productId).filter(Boolean)
        if (productIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: productIds } },
            data: { lastCountShift: assignment.shift as any },
          })
        }
      }

      // Update session total
      await tx.stockCountSession.update({
        where: { id: sessionId },
        data: { totalProducts: productsToAssign.length },
      })

      return createdShifts
    })

    return {
      shiftsCreated: result.length,
      totalProductsAssigned: productsToAssign.length,
      availableShiftsRemaining: availableShifts.length - result.length,
    }
  }

  // ===========================================================================
  // SHIFT SESSION OPERATIONS
  // ===========================================================================

  /**
   * Get shift session detail
   */
  async getShiftSessionDetail(shiftSessionId: string) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, image: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        session: true,
        counter: { select: { id: true, fullName: true, staffCode: true } },
      },
    })
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }
    return shift
  }

  /**
   * Start a shift counting session
   */
  async startShiftSession(shiftSessionId: string, userId: string, dto?: StartShiftSessionDto) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: { session: true },
    })

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }

    if (shift.session.status !== 'DRAFT') {
      throw new BadRequestException('Phiếu kiểm không ở trạng thái nháp')
    }

    const updated = await this.prisma.stockCountShiftSession.update({
      where: { id: shiftSessionId },
      data: {
        status: 'DRAFT',
        startedAt: new Date(),
        countedBy: userId,
        notes: dto?.notes ?? shift.notes,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, image: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
          orderBy: {
            product: { name: 'asc' },
          },
        },
        session: { select: { branchId: true, weekNumber: true, year: true } },
        counter: { select: { id: true, fullName: true, staffCode: true } },
      },
    })

    return updated
  }

  /**
   * Complete a shift counting session
   */
  async completeShiftSession(shiftSessionId: string) {
    const shift = await this.prisma.stockCountShiftSession.findUnique({
      where: { id: shiftSessionId },
      include: { items: true, session: true },
    })

    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca kiểm')
    }

    const allCounted = shift.items.every((item) => item.countedQuantity !== null)
    if (!allCounted) {
      throw new BadRequestException('Vẫn còn sản phẩm chưa kiểm. Vui lòng kiểm hết trước khi hoàn thành.')
    }

    await this.prisma.stockCountShiftSession.update({
      where: { id: shiftSessionId },
      data: {
        status: 'SUBMITTED',
        completedAt: new Date(),
        countedItems: shift.items.length,
      },
    })

    // Update session progress
    await this.updateSessionProgress(shift.sessionId)

    return { success: true, message: 'Ca kiểm đã hoàn thành' }
  }

  // ===========================================================================
  // COUNTING ITEMS
  // ===========================================================================

  /**
   * Submit a count for a specific item
   */
  async submitCountItem(itemId: string, userId: string, dto: SubmitCountItemDto) {
    const item = await this.prisma.stockCountItem.findUnique({
      where: { id: itemId },
      include: { shiftSession: { include: { session: true } } },
    })

    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm kiểm')
    }

    if (item.shiftSession.status !== 'DRAFT') {
      throw new BadRequestException('Ca kiểm này đã hoàn thành, không thể sửa')
    }

    const variance = dto.countedQuantity - item.systemQuantity

    const updated = await this.prisma.stockCountItem.update({
      where: { id: itemId },
      data: {
        countedQuantity: dto.countedQuantity,
        variance,
        notes: dto.notes ?? item.notes,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
      },
    })

    return updated
  }

  // ===========================================================================
  // APPROVAL WORKFLOW
  // ===========================================================================

  /**
   * Approve a stock count session
   */
  async approveSession(sessionId: string, approverId: string) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
      include: { shifts: { include: { items: true } } },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException('Phiếu kiểm phải ở trạng thái đã gửi duyệt')
    }

    // Check all shifts are submitted
    const allSubmitted = session.shifts.every((s) => s.status === 'SUBMITTED')
    if (!allSubmitted) {
      throw new BadRequestException('Tất cả ca kiểm phải hoàn thành trước khi duyệt')
    }

    await this.prisma.stockCountSession.update({
      where: { id: sessionId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    })

    return { success: true, message: 'Phiếu kiểm đã được duyệt' }
  }

  /**
   * Reject a stock count session
   */
  async rejectSession(sessionId: string, approverId: string, dto: ApproveSessionDto) {
    if (!dto.rejectionReason) {
      throw new BadRequestException('Bắt buộc phải có lý do từ chối')
    }

    const session = await this.prisma.stockCountSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm kho')
    }

    if (session.status !== 'SUBMITTED') {
      throw new BadRequestException('Phiếu kiểm phải ở trạng thái đã gửi duyệt')
    }

    await this.prisma.stockCountSession.update({
      where: { id: sessionId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.rejectionReason,
      },
    })

    return { success: true, message: 'Phiếu kiểm đã bị từ chối' }
  }

  // ===========================================================================
  // PROGRESS TRACKING
  // ===========================================================================

  /**
   * Update session progress based on shift completions
   */
  private async updateSessionProgress(sessionId: string) {
    const shifts = await this.prisma.stockCountShiftSession.findMany({
      where: { sessionId },
      select: { status: true, countedItems: true, totalItems: true },
    })

    const completedShifts = shifts.filter((s) => s.status === 'SUBMITTED').length
    const countedProducts = shifts.reduce((sum, s) => sum + (s.countedItems || 0), 0)

    await this.prisma.stockCountSession.update({
      where: { id: sessionId },
      data: {
        countedProducts,
      },
    })

    return { completedShifts, totalShifts: shifts.length, countedProducts }
  }

  /**
   * Get weekly progress for a branch
   */
  async getWeeklyProgress(branchId: string, weekNumber: number, year: number) {
    const session = await this.prisma.stockCountSession.findUnique({
      where: {
        branchId_weekNumber_year: { branchId, weekNumber, year },
      },
      include: {
        shifts: {
          orderBy: { countDate: 'asc' },
          include: {
            _count: { select: { items: true } },
            counter: { select: { id: true, fullName: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
    })

    if (!session) {
      throw new NotFoundException('Không tìm thấy phiếu kiểm cho tuần này')
    }

    const totalShifts = session.shifts.length
    const completedShifts = session.shifts.filter((s) => s.status === 'SUBMITTED').length
    const progressPercent = totalShifts > 0 ? Math.round((completedShifts / totalShifts) * 100) : 0

    // Group shifts by day
    const shiftsByDay: Record<string, any[]> = {}
    for (const shift of session.shifts) {
      const shiftKey = shift.shift as string
      const dayKey = shiftKey.split('_')[0] // MON, TUE, etc.
      if (!shiftsByDay[dayKey!]) shiftsByDay[dayKey!] = []
      shiftsByDay[dayKey!]!.push({
        id: shift.id,
        shift: shiftKey,
        shiftLabel: SHIFT_LABELS[shiftKey] || shiftKey,
        status: shift.status,
        countDate: shift.countDate,
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
        progressPercent,
      },
      shiftsByDay,
      summary: {
        totalShifts,
        completedShifts,
        remainingShifts: totalShifts - completedShifts,
      },
    }
  }

  // ===========================================================================
  // HELPER: Get date for a shift within a session
  // ===========================================================================

  getDateForShift(session: { startDate: Date }, shift: string): Date {
    const dayOffset = SHIFT_DAY_ORDER[shift] ?? 1
    const date = new Date(session.startDate)
    date.setDate(date.getDate() + (dayOffset - 1))
    return date
  }
}
