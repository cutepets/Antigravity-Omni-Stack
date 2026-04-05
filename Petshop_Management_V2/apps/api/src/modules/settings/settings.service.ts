import { Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { randomUUID } from 'crypto'

export interface CreateBranchDto {
  name: string
  address?: string
  phone?: string
  isActive?: boolean
}

export interface UpdateBranchDto extends Partial<CreateBranchDto> {}

export interface UpdateConfigDto {
  shopName?: string
  shopPhone?: string
  shopAddress?: string
  shopLogo?: string
  email?: string
  website?: string
  taxRate?: number
  currency?: string
  timezone?: string
  loyaltySpendPerPoint?: number
  loyaltyPointValue?: number
  loyaltyPointExpiryMonths?: number
  loyaltyTierRetentionMonths?: number
  loyaltyTierRules?: string
}

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  // ─── System Configs ───────────────────────────────────────────────────────

  async getConfigs() {
    try {
      const records = await this.db.$queryRaw<any[]>`SELECT * FROM system_configs LIMIT 1`
      return { success: true, data: records.length > 0 ? records[0] : {} }
    } catch {
      return { success: true, data: {} }
    }
  }

  async updateConfigs(dto: UpdateConfigDto) {
    const existing = await this.db.$queryRaw<any[]>`SELECT id FROM system_configs LIMIT 1`

    if (existing.length > 0) {
      await this.db.$executeRaw`
        UPDATE system_configs SET
          "shopName"    = ${dto.shopName    ?? null},
          "shopPhone"   = ${dto.shopPhone   ?? null},
          "shopAddress" = ${dto.shopAddress ?? null},
          "shopLogo"    = ${dto.shopLogo    ?? null},
          "email"       = ${dto.email       ?? null},
          "website"     = ${dto.website     ?? null},
          "taxRate"     = ${dto.taxRate     ?? null},
          "currency"    = ${dto.currency    ?? null},
          "timezone"    = ${dto.timezone    ?? null},
          "loyaltySpendPerPoint"       = ${dto.loyaltySpendPerPoint       ?? null},
          "loyaltyPointValue"          = ${dto.loyaltyPointValue          ?? null},
          "loyaltyPointExpiryMonths"   = ${dto.loyaltyPointExpiryMonths   ?? null},
          "loyaltyTierRetentionMonths" = ${dto.loyaltyTierRetentionMonths ?? null},
          "loyaltyTierRules"           = ${dto.loyaltyTierRules           ?? null},
          "updatedAt"   = NOW()
        WHERE id = ${existing[0].id}
      `
    } else {
      const id = randomUUID()
      await this.db.$executeRaw`
        INSERT INTO system_configs
          (id, "shopName", "shopPhone", "shopAddress", "shopLogo", "email", "website", "taxRate", "currency", "timezone", "loyaltySpendPerPoint", "loyaltyPointValue", "loyaltyPointExpiryMonths", "loyaltyTierRetentionMonths", "loyaltyTierRules", "updatedAt")
        VALUES
          (${id}, ${dto.shopName ?? null}, ${dto.shopPhone ?? null}, ${dto.shopAddress ?? null},
           ${dto.shopLogo ?? null}, ${dto.email ?? null}, ${dto.website ?? null}, ${dto.taxRate ?? null},
           ${dto.currency ?? null}, ${dto.timezone ?? null}, ${dto.loyaltySpendPerPoint ?? null}, ${dto.loyaltyPointValue ?? null},
           ${dto.loyaltyPointExpiryMonths ?? null}, ${dto.loyaltyTierRetentionMonths ?? null}, ${dto.loyaltyTierRules ?? null}, NOW())
      `
    }

    const updated = await this.db.$queryRaw<any[]>`SELECT * FROM system_configs LIMIT 1`
    return { success: true, data: updated[0] }
  }

  // ─── Branches ─────────────────────────────────────────────────────────────

  async findAllBranches() {
    const branches = await this.db.branch.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: branches }
  }

  async createBranch(dto: CreateBranchDto) {
    const branch = await this.db.branch.create({ data: dto as any })
    return { success: true, data: branch }
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const branch = await this.db.branch.findUnique({ where: { id } })
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh')
    const updated = await this.db.branch.update({ where: { id }, data: dto as any })
    return { success: true, data: updated }
  }

  async removeBranch(id: string) {
    const branch = await this.db.branch.findUnique({ where: { id } })
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh')
    await this.db.branch.delete({ where: { id } })
    return { success: true, message: 'Xóa chi nhánh thành công' }
  }

  // ─── Customer Groups ──────────────────────────────────────────────────────

  async findAllCustomerGroups() {
    const groups = await this.db.customerGroup.findMany({ orderBy: { createdAt: 'desc' } })
    return { success: true, data: groups }
  }

  async createCustomerGroup(dto: { name: string; color?: string; discount?: number; description?: string }) {
    const group = await this.db.customerGroup.create({ data: dto as any })
    return { success: true, data: group }
  }

  async updateCustomerGroup(id: string, dto: any) {
    const group = await this.db.customerGroup.findUnique({ where: { id } })
    if (!group) throw new NotFoundException('Không tìm thấy nhóm khách hàng')
    const updated = await this.db.customerGroup.update({ where: { id }, data: dto })
    return { success: true, data: updated }
  }

  async removeCustomerGroup(id: string) {
    const group = await this.db.customerGroup.findUnique({ where: { id } })
    if (!group) throw new NotFoundException('Không tìm thấy nhóm khách hàng')
    await this.db.customerGroup.delete({ where: { id } })
    return { success: true, message: 'Xóa nhóm khách hàng thành công' }
  }

  // ─── Activity Logs ────────────────────────────────────────────────────────

  async findActivityLogs(query: {
    userId?: string; action?: string; target?: string
    dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number
  }): Promise<any> {
    const { userId, action, target, dateFrom, dateTo, search, page = 1, limit = 20 } = query
    const skip = (Number(page) - 1) * Number(limit)
    const where: any = {}

    if (userId) where.userId = userId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (target) where.target = { contains: target, mode: 'insensitive' }
    if (search) where.description = { contains: search, mode: 'insensitive' }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const [data, total] = await Promise.all([
      this.db.activityLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, staffCode: true } } },
      }),
      this.db.activityLog.count({ where }),
    ])

    return { success: true, data, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
  }

  async getActivityLogStats(): Promise<any> {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const [todayCount, totalCount] = await Promise.all([
      this.db.activityLog.count({ where: { createdAt: { gte: startOfDay } } }),
      this.db.activityLog.count(),
    ])
    return { success: true, data: { todayCount, totalCount } }
  }
}
