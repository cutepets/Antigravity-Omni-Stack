import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import type { JwtPayload } from '@petshop/shared'
import { DatabaseService } from '../../database/database.service.js'
import { getNextSequentialCode } from '../../common/utils/sequential-code.util.js'
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js'

// ─── Accent-insensitive search (ported from Petshop_Service_Management) ───────
const removeAccents = (str: string): string => {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

const startOfDay = (value: string) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const endOfDay = (value: string) => {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

export interface FindCustomersDto {
  search?: string
  page?: number
  limit?: number
  tier?: any
  groupId?: string
  isActive?: boolean
  minSpent?: number
  maxSpent?: number
  branchId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CreateCustomerDto {
  fullName: string
  phone: string
  email?: string
  address?: string
  tier?: any
  points?: number
  debt?: number
  groupId?: string
  notes?: string
  // Extended fields
  taxCode?: string
  description?: string
  isActive?: boolean
  isSupplier?: boolean
  supplierCode?: string
  companyName?: string
  companyAddress?: string
  representativeName?: string
  representativePhone?: string
  bankAccount?: string
  bankName?: string
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}

export interface ImportCustomerRow {
  fullName: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  tier?: string
  groupId?: string
  taxCode?: string
}

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerService {
  constructor(private readonly db: DatabaseService) {}

  private resolveUserPermissions(user?: AccessUser): Set<string> {
    return new Set(resolvePermissions(user?.permissions ?? []))
  }

  private getAuthorizedBranchIds(user?: AccessUser): string[] {
    return [...new Set([...(user?.authorizedBranchIds ?? []), ...(user?.branchId ? [user.branchId] : [])])]
  }

  private buildLegacyBranchCustomerScope(authorizedBranchIds: string[]) {
    return {
      OR: [
        {
          orders: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
        {
          hotelStays: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
        {
          pets: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
      ],
    }
  }

  private shouldRestrictToCustomerBranches(user?: AccessUser): boolean {
    if (!user) return false
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return false

    const permissions = this.resolveUserPermissions(user)
    return !permissions.has('branch.access.all')
  }

  private buildBranchCustomerScope(user?: AccessUser, requestedBranchId?: string | null): any {
    const normalizedRequestedBranchId = requestedBranchId?.trim() || null
    const restrictByPermission = this.shouldRestrictToCustomerBranches(user)

    if (!restrictByPermission && !normalizedRequestedBranchId) return null

    if (restrictByPermission && normalizedRequestedBranchId) {
      const authorizedBranchIds = this.getAuthorizedBranchIds(user)
      if (!authorizedBranchIds.includes(normalizedRequestedBranchId)) {
        throw new ForbiddenException('Ban chi duoc truy cap du lieu thuoc chi nhanh duoc phan quyen')
      }
    }

    const scopedBranchIds = normalizedRequestedBranchId ? [normalizedRequestedBranchId] : this.getAuthorizedBranchIds(user)
    const legacyScope = this.buildLegacyBranchCustomerScope(scopedBranchIds)
    const branchIdFilter: any = scopedBranchIds.length === 1 ? scopedBranchIds[0] : { in: scopedBranchIds }

    return {
      OR: [
        {
          branchId: branchIdFilter,
        },
        {
          AND: [
            { branchId: null },
            legacyScope,
          ],
        },
      ],
    }
  }

  private async resolveWriteBranchId(user?: AccessUser, requestedBranchId?: string | null): Promise<string> {
    const branchId = requestedBranchId?.trim() || null

    if (this.shouldRestrictToCustomerBranches(user)) {
      const authorizedBranchIds = this.getAuthorizedBranchIds(user)
      const targetBranchId = branchId ?? user?.branchId ?? authorizedBranchIds[0] ?? null

      if (!targetBranchId || !authorizedBranchIds.includes(targetBranchId)) {
        throw new ForbiddenException('Bạn chỉ được thao tác dữ liệu thuộc chi nhánh được phân quyền')
      }

      return targetBranchId
    }

    const branch = await resolveBranchIdentity(this.db, branchId ?? user?.branchId ?? null)
    return branch.id
  }

  private mergeCustomerScope(where: Record<string, any>, user?: AccessUser, requestedBranchId?: string | null): any {
    const scope = this.buildBranchCustomerScope(user, requestedBranchId)
    if (!scope) return where
    if (Object.keys(where).length === 0) return scope
    return { AND: [where, scope] }
  }

  private async assertCustomerScope(id: string, user?: AccessUser) {
    if (!this.shouldRestrictToCustomerBranches(user)) return

    const accessible = await this.db.customer.findFirst({
      where: this.mergeCustomerScope({ id }, user),
      select: { id: true },
    })

    if (!accessible) {
      throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền')
    }
  }

  // ── List (paginated + accent-insensitive search) ───────────────────────────
  async findAll(query: FindCustomersDto, user?: AccessUser, requestedBranchId?: string | null) {
    const {
      search,
      page = 1,
      limit = 20,
      tier,
      groupId,
      isActive,
      minSpent,
      maxSpent,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query

    const skip = (Number(page) - 1) * Number(limit)

    const baseWhere: any = {}
    if (tier) baseWhere.tier = tier
    if (groupId) baseWhere.groupId = groupId
    if (isActive !== undefined) baseWhere.isActive = isActive === true || isActive === ('true' as any)
    if (minSpent !== undefined || maxSpent !== undefined) {
      baseWhere.totalSpent = {}
      if (minSpent !== undefined) baseWhere.totalSpent.gte = Number(minSpent)
      if (maxSpent !== undefined) baseWhere.totalSpent.lte = Number(maxSpent)
    }
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {}

      if (dateFrom) {
        const from = startOfDay(dateFrom)
        if (Number.isNaN(from.getTime())) throw new BadRequestException('dateFrom khong hop le')
        createdAt.gte = from
      }

      if (dateTo) {
        const to = endOfDay(dateTo)
        if (Number.isNaN(to.getTime())) throw new BadRequestException('dateTo khong hop le')
        createdAt.lte = to
      }

      if (createdAt.gte && createdAt.lte && createdAt.gte.getTime() > createdAt.lte.getTime()) {
        throw new BadRequestException('dateFrom khong duoc lon hon dateTo')
      }

      baseWhere.orders = {
        some: {
          createdAt,
          ...(requestedBranchId ? { branchId: requestedBranchId } : {}),
        },
      }
    }

    const where = this.mergeCustomerScope(baseWhere, user, requestedBranchId)

    const orderBy: any = { [sortBy]: sortOrder }

    // No search: use DB pagination directly
    if (!search) {
      const [data, total] = await Promise.all([
        this.db.customer.findMany({
          where,
          skip: Number(skip),
          take: Number(limit),
          orderBy,
          include: {
            group: {
              select: {
                id: true,
                name: true,
                color: true,
                discount: true,
                pricePolicy: true,
                priceBookId: true,
                priceBook: { select: { id: true, name: true } },
              },
            },
            pets: { 
              select: { 
                id: true, 
                name: true,
                _count: { select: { groomingSessions: true, hotelStays: true } }
              } 
            },
            _count: { select: { orders: true, hotelStays: true } },
          },
        }),
        this.db.customer.count({ where }),
      ])

      return {
        success: true,
        data,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    }

    // With search: accent-insensitive in-memory filter (port từ dự án cũ)
    const dbSearch = search.trim()
    const allCustomers = await this.db.customer.findMany({
      where: {
        ...where,
      },
      orderBy,
      take: 500,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            color: true,
            discount: true,
            pricePolicy: true,
            priceBookId: true,
            priceBook: { select: { id: true, name: true } },
          },
        },
        pets: { 
          select: { 
            id: true, 
            name: true,
            _count: { select: { groomingSessions: true, hotelStays: true } }
          } 
        },
        _count: { select: { orders: true, hotelStays: true } },
      },
    })

    const searchTerms = removeAccents(search).split(/\s+/).filter(Boolean)
    const filtered = allCustomers.filter((c) => {
      const haystack = [
        removeAccents(c.fullName),
        c.phone || '',
        removeAccents(c.email || ''),
        c.customerCode || '',
      ].join(' ')
      return searchTerms.every((term) => haystack.includes(term))
    })

    const total = filtered.length
    const data = filtered.slice(Number(skip), Number(skip) + Number(limit))

    return {
      success: true,
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    }
  }

  // ── Find by ID (with periodSpent) ──────────────────────────────────────────
  async findById(id: string, tierRetentionMonths = 6, user?: AccessUser) {
    // Support lookup by customerCode (e.g. KH000001)
    const isCode = id.startsWith('KH')
    const customerWhere = this.mergeCustomerScope(isCode ? { customerCode: id } : { id }, user)
    const customer = isCode
      ? await this.db.customer.findFirst({
          where: customerWhere,
          include: this._fullInclude(),
        })
      : await this.db.customer.findFirst({
          where: customerWhere,
          include: this._fullInclude(),
        })

    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng')

    // Calculate periodSpent (N months)
    const periodStart = new Date()
    periodStart.setMonth(periodStart.getMonth() - tierRetentionMonths)
    const periodSpent = (((customer as any).orders as any[]) || [])
      .filter((o: any) => new Date(o.createdAt) >= periodStart && o.paymentStatus === 'PAID')
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0)

    return { success: true, data: { ...customer, periodSpent } }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(dto: CreateCustomerDto, user?: AccessUser, requestedBranchId?: string) {
    if (dto.phone) {
      const exists = await this.db.customer.findUnique({ where: { phone: dto.phone } })
      if (exists) throw new ConflictException(`Số điện thoại "${dto.phone}" đã được sử dụng`)
    }

    if (dto.supplierCode) {
      const exists = await this.db.customer.findFirst({ where: { supplierCode: dto.supplierCode } })
      if (exists) throw new ConflictException(`Mã nhà cung cấp "${dto.supplierCode}" đã tồn tại`)
    }

    const customerCode = await this._nextCustomerCode()
    const branchId = await this.resolveWriteBranchId(user, requestedBranchId)

    const customer = await this.db.customer.create({
      data: {
        branchId,
        customerCode,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email || null,
        address: dto.address || null,
        tier: dto.tier ?? 'BRONZE',
        points: dto.points ?? 0,
        pointsUsed: 0,
        debt: dto.debt ?? 0,
        groupId: dto.groupId || null,
        notes: dto.notes || null,
        taxCode: dto.taxCode || null,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
        isSupplier: dto.isSupplier ?? false,
        supplierCode: dto.supplierCode || null,
        companyName: dto.companyName || null,
        companyAddress: dto.companyAddress || null,
        representativeName: dto.representativeName || null,
        representativePhone: dto.representativePhone || null,
        bankAccount: dto.bankAccount || null,
        bankName: dto.bankName || null,
      } as any,
    })

    return { success: true, data: customer }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateCustomerDto, user?: AccessUser) {
    await this.assertCustomerScope(id, user)
    const customer = await this.db.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng')

    if (dto.phone && dto.phone !== customer.phone) {
      const exists = await this.db.customer.findUnique({ where: { phone: dto.phone } })
      if (exists) throw new ConflictException('Số điện thoại đã tồn tại trong hệ thống')
    }

    const updated = await this.db.customer.update({
      where: { id },
      data: dto as any,
    })

    return { success: true, data: updated }
  }

  // ── Delete (safe — check relations first) ──────────────────────────────────
  async remove(id: string, user?: AccessUser) {
    await this.assertCustomerScope(id, user)
    const customer = await this.db.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng')

    // GroomingSession & HotelStay gắn với Pet, không phải Customer trực tiếp
    const [pets, orders] = await Promise.all([
      this.db.pet.count({ where: { customerId: id } }),
      this.db.order.count({ where: { customerId: id } }),
    ])

    const reasons: string[] = []
    if (pets > 0) reasons.push(`${pets} thú cưng`)
    if (orders > 0) reasons.push(`${orders} đơn hàng`)

    if (reasons.length > 0) {
      throw new BadRequestException(
        `Không thể xóa khách hàng "${customer.fullName}" vì đã có: ${reasons.join(', ')}. ` +
        `Hãy chuyển sang trạng thái "Vô hiệu hoá" nếu muốn ẩn khỏi hệ thống.`,
      )
    }

    await this.db.customer.delete({ where: { id } })
    return { success: true, message: `Đã xóa khách hàng "${customer.fullName}"` }
  }

  // ── Export all (no pagination) ─────────────────────────────────────────────
  async exportAll(params?: { tier?: string; isActive?: boolean }, user?: AccessUser) {
    const baseWhere: any = {}
    if (params?.tier) baseWhere.tier = params.tier
    if (params?.isActive !== undefined) baseWhere.isActive = params.isActive
    const where = this.mergeCustomerScope(baseWhere, user)

    const customers = await this.db.customer.findMany({
      where,
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { pets: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: customers }
  }

  // ── Batch import ───────────────────────────────────────────────────────────
  async importBatch(rows: ImportCustomerRow[], user?: AccessUser, requestedBranchId?: string) {
    let created = 0
    let updated = 0
    const errors: string[] = []
    const branchId = await this.resolveWriteBranchId(user, requestedBranchId)

    for (const row of rows) {
      try {
        if (!row.fullName) {
          errors.push(`Dòng thiếu tên: ${JSON.stringify(row)}`)
          continue
        }

        if (row.phone) {
          const existing = await this.db.customer.findUnique({ where: { phone: row.phone } })
          if (existing) {
            const accessibleExisting = await this.db.customer.findFirst({
              where: this.mergeCustomerScope({ id: existing.id }, user),
              select: { id: true, branchId: true },
            })

            if (!accessibleExisting) {
              errors.push(`Số điện thoại "${row.phone}" đã thuộc chi nhánh khác hoặc bạn không có quyền cập nhật`)
              continue
            }

            await this.db.customer.update({
              where: { phone: row.phone },
              data: {
                ...(accessibleExisting.branchId ? {} : { branchId }),
                fullName: row.fullName,
                email: row.email || existing.email,
                address: row.address || existing.address,
                notes: row.notes || existing.notes,
                tier: (row.tier as any) || existing.tier,
              },
            })
            updated++
            continue
          }
        }

        const customerCode = await this._nextCustomerCode()
        await this.db.customer.create({
          data: {
            branchId,
            customerCode,
            fullName: row.fullName,
            phone: row.phone || `NOPHONE-${Date.now()}`,
            email: row.email || null,
            address: row.address || null,
            notes: row.notes || null,
            tier: (row.tier as any) || 'BRONZE',
            groupId: row.groupId || null,
            taxCode: row.taxCode || null,
          },
        })
        created++
      } catch (e: any) {
        errors.push(`Lỗi dòng "${row.fullName}": ${e.message}`)
      }
    }

    return { success: true, data: { created, updated, errors } }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _nextCustomerCode(): Promise<string> {
    return getNextSequentialCode(this.db, {
      table: 'customers',
      column: 'customerCode',
      prefix: 'KH',
    })
  }

  private _fullInclude() {
    return {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
          discount: true,
          pricePolicy: true,
          priceBookId: true,
          priceBook: { select: { id: true, name: true } },
        },
      },
      pets: true,
      orders: {
        orderBy: { createdAt: 'desc' as const },
        take: 50,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paymentStatus: true,
          status: true,
          createdAt: true,
        },
      },
    }
  }
}
