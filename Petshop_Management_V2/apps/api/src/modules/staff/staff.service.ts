import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { extname } from 'path'
import { DatabaseService } from '../../database/database.service.js'
import type { AuthUser } from '@petshop/shared'
import type { DocumentType } from '@petshop/database'
import {
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MIME_TYPES,
} from '../../common/utils/upload.util.js'

export interface CreateStaffDto {
  username: string
  password?: string
  fullName: string
  role?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]

  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
}

export interface UpdateStaffDto {
  fullName?: string
  role?: string
  status?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]

  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
  password?: string
  avatar?: string
}

@Injectable()
export class StaffService {
  constructor(private readonly db: DatabaseService) { }

  async findAll() {
    return this.db.user.findMany({
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, avatar: true, createdAt: true,
        gender: true, employmentType: true, shiftStart: true, shiftEnd: true, baseSalary: true, branchId: true,
        branch: { select: { id: true, name: true } },
        authorizedBranches: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(idOrUsername: string) {
    const user = await this.db.user.findFirst({
      where: {
        OR: [{ id: idOrUsername }, { username: idOrUsername }]
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, avatar: true,
        branchId: true, joinDate: true, createdAt: true,
        gender: true, dob: true, identityCode: true, emergencyContactTitle: true, emergencyContactPhone: true,
        shiftStart: true, shiftEnd: true, baseSalary: true, spaCommissionRate: true, employmentType: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên')
    return user
  }

  async create(dto: CreateStaffDto) {
    const exists = await this.db.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.phone ? [{ phone: dto.phone }] : [])
        ],
      },
    })
    if (exists) throw new ConflictException('Username hoặc số điện thoại đã tồn tại')

    const count = await this.db.user.count()
    const staffCode = `NV${String(count + 1).padStart(5, '0')}`

    const passwordToHash = dto.password || 'Petshop@123'
    const passwordHash = await bcrypt.hash(passwordToHash, 12)

    return this.db.user.create({
      data: {
        staffCode,
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        roleId: dto.role || null,
        phone: dto.phone || null,
        email: dto.email || null,
        branchId: dto.branchId || null,
        ...(dto.authorizedBranchIds && {
          authorizedBranches: { connect: dto.authorizedBranchIds.map(id => ({ id })) },
        }),

        gender: dto.gender || null,
        dob: dto.dob ? new Date(dto.dob) : null,
        identityCode: dto.identityCode || null,
        emergencyContactTitle: dto.emergencyContactTitle || null,
        emergencyContactPhone: dto.emergencyContactPhone || null,
        shiftStart: dto.shiftStart || null,
        shiftEnd: dto.shiftEnd || null,
        baseSalary: dto.baseSalary ? Number(dto.baseSalary) : null,
        spaCommissionRate: dto.spaCommissionRate ? Number(dto.spaCommissionRate) : null,
        employmentType: (dto.employmentType as any) || 'FULL_TIME',
        joinDate: dto.joinDate ? new Date(dto.joinDate) : null,
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, createdAt: true, branchId: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
  }

  async update(id: string, dto: UpdateStaffDto) {
    const user = await this.findById(id)

    if (dto.phone) {
      const exists = await this.db.user.findFirst({
        where: { phone: dto.phone, id: { not: id } },
      })
      if (exists) throw new ConflictException('Số điện thoại đã được sử dụng bởi người khác')
    }

    let passwordHash
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12)
    }

    return this.db.user.update({
      where: { id },
      data: {
        ...(passwordHash && { passwordHash }),
        ...('fullName' in dto && dto.fullName !== undefined && { fullName: dto.fullName }),
        ...('role' in dto && { roleId: dto.role || null }),
        ...('status' in dto && dto.status !== undefined && { status: dto.status as any }),
        ...('phone' in dto && { phone: dto.phone || null }),
        ...('email' in dto && { email: dto.email || null }),
        ...('branchId' in dto && { branchId: dto.branchId || null }),
        ...('avatar' in dto && { avatar: dto.avatar || null }),
        ...('authorizedBranchIds' in dto && {
          authorizedBranches: {
            set: (dto.authorizedBranchIds ?? []).map(bid => ({ id: bid })),
          },
        }),

        ...('gender' in dto && { gender: dto.gender || null }),
        ...('dob' in dto && { dob: dto.dob ? new Date(dto.dob) : null }),
        ...('identityCode' in dto && { identityCode: dto.identityCode || null }),
        ...('emergencyContactTitle' in dto && { emergencyContactTitle: dto.emergencyContactTitle || null }),
        ...('emergencyContactPhone' in dto && { emergencyContactPhone: dto.emergencyContactPhone || null }),
        ...('shiftStart' in dto && { shiftStart: dto.shiftStart || null }),
        ...('shiftEnd' in dto && { shiftEnd: dto.shiftEnd || null }),
        ...('baseSalary' in dto && { baseSalary: dto.baseSalary ? Number(dto.baseSalary) : null }),
        ...('spaCommissionRate' in dto && { spaCommissionRate: dto.spaCommissionRate ? Number(dto.spaCommissionRate) : null }),
        ...('employmentType' in dto && { employmentType: dto.employmentType as any }),
        ...('joinDate' in dto && { joinDate: dto.joinDate ? new Date(dto.joinDate) : null }),
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, branchId: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
  }

  async deactivate(id: string) {
    await this.findById(id) // Ensure exists
    return this.db.user.update({
      where: { id },
      data: { status: 'RESIGNED' as any }, // Soft delete by marking as RESIGNED or QUIT
      select: { id: true, staffCode: true, status: true }
    })
  }

  // =========================================================================
  // Document Management
  // =========================================================================

  async getDocuments(userId: string) {
    await this.findById(userId) // Ensure user exists

    return this.db.employeeDocument.findMany({
      where: { userId, isActive: true },
      orderBy: { uploadedAt: 'desc' },
    })
  }

  async uploadDocument(
    userId: string,
    uploadedBy: string,
    file: Express.Multer.File,
    dto: { type: DocumentType; description?: string; expiresAt?: Date },
  ) {
    await this.findById(userId) // Ensure user exists

    if (!file) {
      throw new BadRequestException('File is required')
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size must be less than 10MB')
    }

    const extension = extname(file.originalname).toLowerCase()
    const mimeType = (file.mimetype || '').toLowerCase()
    if (!DOCUMENT_UPLOAD_MIME_TYPES.has(mimeType) || !DOCUMENT_UPLOAD_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        'Invalid file type. Only images (JPEG, PNG, WebP) and PDFs are allowed',
      )
    }

    if (!file.filename) {
      throw new BadRequestException('Uploaded file is missing filename metadata')
    }

    const fileUrl = `/uploads/documents/${userId}/${file.filename}`

    return this.db.employeeDocument.create({
      data: {
        userId,
        uploadedBy,
        type: dto.type,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        description: dto.description || null,
        expiresAt: dto.expiresAt || null,
      },
    })
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.db.employeeDocument.findFirst({
      where: { id: documentId, userId },
    })

    if (!doc) {
      throw new NotFoundException('Document not found')
    }

    // Soft delete
    return this.db.employeeDocument.update({
      where: { id: documentId },
      data: { isActive: false },
    })
  }

  async getDocumentById(userId: string, documentId: string) {
    const doc = await this.db.employeeDocument.findFirst({
      where: { id: documentId, userId, isActive: true },
    })

    if (!doc) {
      throw new NotFoundException('Document not found')
    }

    return doc
  }

  // =========================================================================
  // Attendance / Timekeeping
  // =========================================================================

  async getAttendance(userId: string, month?: number, year?: number) {
    await this.findById(userId)

    const targetMonth = month || new Date().getMonth() + 1
    const targetYear = year || new Date().getFullYear()

    // Get all shift sessions for this user in the specified month
    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

    const shiftSessions = await this.db.shiftSession.findMany({
      where: {
        staffId: userId,
        openedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { openedAt: 'asc' },
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        status: true,
        branchId: true,
        orderCount: true,
        collectedAmount: true,
        differenceAmount: true,
        reviewStatus: true,
      },
    })

    // Calculate stats
    const totalShifts = shiftSessions.length
    const completedShifts = shiftSessions.filter((s) => s.closedAt).length
    const openShifts = shiftSessions.filter((s) => !s.closedAt && s.status === 'OPEN').length

    // Calculate total hours worked (only for closed shifts)
    let totalHours = 0
    const dailyHours: Record<string, number> = {}

    shiftSessions.forEach((session) => {
      if (session.closedAt && session.openedAt) {
        const hours =
          (new Date(session.closedAt).getTime() - new Date(session.openedAt).getTime()) /
          (1000 * 60 * 60)
        totalHours += hours

        const dateStr = new Date(session.openedAt).toISOString()
        const dayKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10)
        if (dayKey) {
          dailyHours[dayKey] = (dailyHours[dayKey] || 0) + hours
        }
      }
    })

    // Total revenue from orders during shifts
    const totalRevenue = shiftSessions.reduce((sum, s) => sum + (s.collectedAmount || 0), 0)

    // Calculate working days (unique days with at least one shift)
    const workingDays = new Set(
      shiftSessions.map((s) => {
        const dateStr = new Date(s.openedAt).toISOString()
        return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.slice(0, 10)
      }),
    ).size

    return {
      month: targetMonth,
      year: targetYear,
      totalShifts,
      completedShifts,
      openShifts,
      totalHours: Math.round(totalHours * 100) / 100,
      workingDays,
      totalRevenue: Math.round(totalRevenue),
      dailyHours,
      shifts: shiftSessions,
    }
  }

  // =========================================================================
  // Salary Calculation
  // =========================================================================

  async getSalary(userId: string, month?: number, year?: number) {
    await this.findById(userId)

    const targetMonth = month || new Date().getMonth() + 1
    const targetYear = year || new Date().getFullYear()

    // Get user base info
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        baseSalary: true,
        spaCommissionRate: true,
        employmentType: true,
      },
    })

    // Get attendance data
    const attendance = await this.getAttendance(userId, targetMonth, targetYear)

    // Calculate base salary (pro-rated by working days)
    const baseSalary = user?.baseSalary || 0
    const expectedWorkingDays = 26 // Standard working days per month
    const actualWorkingDays = attendance.workingDays
    const proRatedBaseSalary =
      actualWorkingDays > 0
        ? Math.round((baseSalary / expectedWorkingDays) * actualWorkingDays)
        : 0

    // Calculate commission from grooming sessions
    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

    const groomingSessions = await this.db.groomingSession.findMany({
      where: {
        staffId: userId,
        status: 'COMPLETED',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        price: true,
        startTime: true,
      },
    })

    const totalGroomingRevenue = groomingSessions.reduce(
      (sum, g) => sum + (g.price || 0),
      0,
    )
    const commissionRate = user?.spaCommissionRate || 0
    const commissionAmount = Math.round(
      (totalGroomingRevenue * commissionRate) / 100,
    )

    // Calculate bonuses
    // Bonus for completing all shifts on time
    const fullAttendanceBonus =
      attendance.totalShifts > 0 &&
        attendance.completedShifts === attendance.totalShifts
        ? 500000
        : 0

    // Bonus for high revenue (if totalRevenue > 50M)
    const revenueBonus = attendance.totalRevenue > 50000000 ? 1000000 : 0

    // Total bonuses
    const totalBonuses = fullAttendanceBonus + revenueBonus

    // Deductions
    // Penalty for late shifts (differenceAmount < 0 means shortage)
    const shortages = attendance.shifts
      .filter((s) => s.differenceAmount && s.differenceAmount < 0)
      .reduce((sum, s) => sum + Math.abs(s.differenceAmount || 0), 0)

    const totalDeductions = Math.round(shortages)

    // Net salary
    const netSalary = proRatedBaseSalary + commissionAmount + totalBonuses - totalDeductions

    return {
      month: targetMonth,
      year: targetYear,
      baseSalary: Math.round(baseSalary),
      proRatedBaseSalary,
      actualWorkingDays,
      expectedWorkingDays,
      commission: {
        rate: commissionRate,
        groomingRevenue: Math.round(totalGroomingRevenue),
        amount: commissionAmount,
        sessionCount: groomingSessions.length,
      },
      bonuses: {
        fullAttendance: fullAttendanceBonus,
        revenue: revenueBonus,
        total: totalBonuses,
      },
      deductions: {
        shortages: totalDeductions,
        total: totalDeductions,
      },
      netSalary,
      attendance: {
        totalShifts: attendance.totalShifts,
        completedShifts: attendance.completedShifts,
        workingDays: attendance.workingDays,
        totalHours: attendance.totalHours,
      },
    }
  }

  // =========================================================================
  // Performance Metrics
  // =========================================================================

  async getPerformanceMetrics(userId: string, month?: number, year?: number) {
    await this.findById(userId)

    const targetMonth = month || new Date().getMonth() + 1
    const targetYear = year || new Date().getFullYear()

    // Get orders count for this staff in the month
    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

    const [orderStats, groomingStats] = await Promise.all([
      // Orders stats
      this.db.order.aggregate({
        where: {
          staffId: userId,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { id: true },
        _sum: { total: true },
      }),

      // Grooming/Spa sessions stats
      this.db.groomingSession.aggregate({
        where: {
          staffId: userId,
          status: 'COMPLETED',
          startTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { id: true },
      }),
    ])

    // Generate real 6-month chart data
    const chartData = []
    for (let i = 5; i >= 0; i--) {
      // Create a date corresponding to i months ago (based on target year & month)
      // JS Date will automatically handle month underflows correctly (e.g., month -1 becomes previous year)
      const dStart = new Date(targetYear, targetMonth - 1 - i, 1)
      const dEnd = new Date(targetYear, targetMonth - i, 0, 23, 59, 59, 999)
      
      const m = dStart.getMonth() + 1
      const y = dStart.getFullYear()

      const [mOrders, mGrooming] = await Promise.all([
        this.db.order.aggregate({
          where: { staffId: userId, status: 'COMPLETED', createdAt: { gte: dStart, lte: dEnd } },
          _count: { id: true }, _sum: { total: true },
        }),
        this.db.groomingSession.aggregate({
          where: { staffId: userId, status: 'COMPLETED', startTime: { gte: dStart, lte: dEnd } },
          _count: { id: true },
        }),
      ])

      chartData.push({
        month: m,
        year: y,
        revenue: Math.round(mOrders._sum.total || 0),
        orders: mOrders._count.id || 0,
        spaSessions: mGrooming._count.id || 0,
      })
    }

    return {
      monthlyRevenue: Math.round(orderStats._sum.total || 0),
      monthlySpaSessions: groomingStats._count.id || 0,
      monthlyOrders: orderStats._count.id || 0,
      month: targetMonth,
      year: targetYear,
      chartData,
    }
  }

  async getBranchRoles(userId: string) {
    await this.findById(userId)

    // TODO: Implement when UserBranchRole model is created
    // For now, return placeholder data based on user's branch
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { branch: { select: { name: true } }, role: { select: { name: true } } },
    })

    if (!user?.branch || !user?.role) {
      return []
    }

    return [{ role: user.role.name, branch: user.branch.name }]
  }
}
