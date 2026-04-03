import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'

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

export interface FindCustomersDto {
  search?: string
  page?: number
  limit?: number
  tier?: any
  groupId?: string
  isActive?: boolean
  minSpent?: number
  maxSpent?: number
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
  groupId?: string
  notes?: string
  // Extended fields
  taxCode?: string
  description?: string
  isActive?: boolean
  isSupplier?: boolean
  supplierCode?: string
  companyName?: string
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

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerService {
  constructor(private readonly db: DatabaseService) {}

  // ── List (paginated + accent-insensitive search) ───────────────────────────
  async findAll(query: FindCustomersDto) {
    const {
      search,
      page = 1,
      limit = 20,
      tier,
      groupId,
      isActive,
      minSpent,
      maxSpent,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query

    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (tier) where.tier = tier
    if (groupId) where.groupId = groupId
    if (isActive !== undefined) where.isActive = isActive === true || isActive === ('true' as any)
    if (minSpent !== undefined || maxSpent !== undefined) {
      where.totalSpent = {}
      if (minSpent !== undefined) where.totalSpent.gte = Number(minSpent)
      if (maxSpent !== undefined) where.totalSpent.lte = Number(maxSpent)
    }

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
            group: { select: { id: true, name: true, color: true, discount: true, pricePolicy: true } },
            pets: { select: { id: true } },
            _count: { select: { orders: true } },
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
    const allCustomers = await this.db.customer.findMany({
      where,
      orderBy,
      include: {
        group: { select: { id: true, name: true, color: true, discount: true, pricePolicy: true } },
        pets: { select: { id: true } },
        _count: { select: { orders: true } },
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
  async findById(id: string, tierRetentionMonths = 6) {
    // Support lookup by customerCode (e.g. KH-000001)
    const isCode = id.startsWith('KH')
    const customer = isCode
      ? await this.db.customer.findFirst({
          where: { customerCode: id },
          include: this._fullInclude(),
        })
      : await this.db.customer.findUnique({
          where: { id },
          include: this._fullInclude(),
        })

    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng')

    // Calculate periodSpent (N months)
    const periodStart = new Date()
    periodStart.setMonth(periodStart.getMonth() - tierRetentionMonths)
    const periodSpent = (customer.orders || [])
      .filter((o: any) => new Date(o.createdAt) >= periodStart && o.paymentStatus === 'PAID')
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0)

    return { success: true, data: { ...customer, periodSpent } }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(dto: CreateCustomerDto) {
    if (dto.phone) {
      const exists = await this.db.customer.findUnique({ where: { phone: dto.phone } })
      if (exists) throw new ConflictException(`Số điện thoại "${dto.phone}" đã được sử dụng`)
    }

    if (dto.supplierCode) {
      const exists = await this.db.customer.findFirst({ where: { supplierCode: dto.supplierCode } })
      if (exists) throw new ConflictException(`Mã nhà cung cấp "${dto.supplierCode}" đã tồn tại`)
    }

    const customerCode = await this._nextCustomerCode()

    const customer = await this.db.customer.create({
      data: {
        customerCode,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email || null,
        address: dto.address || null,
        tier: dto.tier ?? 'BRONZE',
        points: dto.points ?? 0,
        pointsUsed: 0,
        groupId: dto.groupId || null,
        notes: dto.notes || null,
        taxCode: dto.taxCode || null,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
        isSupplier: dto.isSupplier ?? false,
        supplierCode: dto.supplierCode || null,
        companyName: dto.companyName || null,
        bankAccount: dto.bankAccount || null,
        bankName: dto.bankName || null,
      },
    })

    return { success: true, data: customer }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.db.customer.findUnique({ where: { id } })
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng')

    if (dto.phone && dto.phone !== customer.phone) {
      const exists = await this.db.customer.findUnique({ where: { phone: dto.phone } })
      if (exists) throw new ConflictException('Số điện thoại đã tồn tại trong hệ thống')
    }

    const updated = await this.db.customer.update({
      where: { id },
      data: dto,
    })

    return { success: true, data: updated }
  }

  // ── Delete (safe — check relations first) ──────────────────────────────────
  async remove(id: string) {
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
  async exportAll(params?: { tier?: string; isActive?: boolean }) {
    const where: any = {}
    if (params?.tier) where.tier = params.tier
    if (params?.isActive !== undefined) where.isActive = params.isActive

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
  async importBatch(rows: ImportCustomerRow[]) {
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const row of rows) {
      try {
        if (!row.fullName) {
          errors.push(`Dòng thiếu tên: ${JSON.stringify(row)}`)
          continue
        }

        if (row.phone) {
          const existing = await this.db.customer.findUnique({ where: { phone: row.phone } })
          if (existing) {
            await this.db.customer.update({
              where: { phone: row.phone },
              data: {
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
    const last = await this.db.customer.findFirst({
      where: { customerCode: { startsWith: 'KH-' } },
      orderBy: { customerCode: 'desc' },
      select: { customerCode: true },
    })
    const lastNum = last?.customerCode ? parseInt(last.customerCode.slice(3)) : 0
    return `KH-${String(lastNum + 1).padStart(6, '0')}`
  }

  private _fullInclude() {
    return {
      group: { select: { id: true, name: true, color: true, discount: true, pricePolicy: true } },
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
