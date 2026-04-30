import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { DatabaseService } from '../../database/database.service.js'
import { CreatePromotionDto, GenerateVouchersDto, PromotionPreviewDto, UpdatePromotionDto } from './dto/promotion.dto.js'
import { PromotionApplicationService } from './promotion-application.service.js'

const normalizeCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

function normalizeScheduleRows(promotionId: string, schedules: CreatePromotionDto['schedules'] | undefined) {
  return (schedules ?? [])
    .filter((schedule) => schedule && typeof schedule === 'object')
    .map((schedule) => ({
      promotionId,
      months: schedule.months?.length ? schedule.months : null,
      monthDays: schedule.monthDays?.length ? schedule.monthDays : null,
      weekdays: schedule.weekdays?.length ? schedule.weekdays : null,
      timeRanges: schedule.timeRanges?.length ? schedule.timeRanges : null,
    }))
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly application: PromotionApplicationService,
  ) {}

  async list(query: Record<string, unknown>) {
    const where: Record<string, unknown> = {}
    if (query['status']) where['status'] = String(query['status']).toUpperCase()
    if (query['type']) where['type'] = String(query['type']).toUpperCase()

    const data = await (this.db as any).promotion.findMany({
      where,
      include: {
        schedules: true,
        assets: true,
        _count: { select: { redemptions: true, voucherCodes: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })
    return { success: true, data }
  }

  async findOne(id: string) {
    const promotion = await (this.db as any).promotion.findUnique({
      where: { id },
      include: { schedules: true, voucherBatches: true, voucherCodes: true, assets: true },
    })
    if (!promotion) throw new NotFoundException('Khong tim thay chuong trinh khuyen mai')
    return { success: true, data: promotion }
  }

  async create(dto: CreatePromotionDto, staffId?: string | null) {
    const code = normalizeCode(dto.code)
    if (!code) throw new BadRequestException('Ma khuyen mai khong hop le')
    const created = await (this.db as any).promotion.create({
      data: {
        code,
        name: dto.name.trim(),
        type: dto.type,
        status: dto.status ?? 'DRAFT',
        description: dto.description?.trim() || null,
        priority: dto.priority ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        branchIds: dto.branchIds ?? null,
        customerGroupIds: dto.customerGroupIds ?? null,
        conditions: dto.conditions ?? {},
        reward: dto.reward,
        allowStacking: dto.allowStacking ?? false,
        usageLimit: dto.usageLimit ?? null,
        budgetLimit: dto.budgetLimit ?? null,
        createdBy: staffId ?? null,
        updatedBy: staffId ?? null,
      },
    })
    const scheduleRows = normalizeScheduleRows(created.id, dto.schedules)
    if (scheduleRows.length) {
      await (this.db as any).promotionSchedule.createMany({ data: scheduleRows })
    }
    if (dto.voucherBatch && dto.type === 'VOUCHER') {
      await this.generateVouchers({ promotionId: created.id, ...dto.voucherBatch }, staffId)
    }
    return { success: true, data: created }
  }

  async update(id: string, dto: UpdatePromotionDto, staffId?: string | null) {
    await this.assertPromotionExists(id)
    const data: Record<string, unknown> = { updatedBy: staffId ?? null }
    if (dto.code !== undefined) data['code'] = normalizeCode(dto.code)
    if (dto.name !== undefined) data['name'] = dto.name.trim()
    if (dto.type !== undefined) data['type'] = dto.type
    if (dto.status !== undefined) data['status'] = dto.status
    if (dto.description !== undefined) data['description'] = dto.description?.trim() || null
    if (dto.priority !== undefined) data['priority'] = dto.priority
    if (dto.startsAt !== undefined) data['startsAt'] = dto.startsAt ? new Date(dto.startsAt) : null
    if (dto.endsAt !== undefined) data['endsAt'] = dto.endsAt ? new Date(dto.endsAt) : null
    if (dto.branchIds !== undefined) data['branchIds'] = dto.branchIds
    if (dto.customerGroupIds !== undefined) data['customerGroupIds'] = dto.customerGroupIds
    if (dto.conditions !== undefined) data['conditions'] = dto.conditions
    if (dto.reward !== undefined) data['reward'] = dto.reward
    if (dto.allowStacking !== undefined) data['allowStacking'] = dto.allowStacking
    if (dto.usageLimit !== undefined) data['usageLimit'] = dto.usageLimit
    if (dto.budgetLimit !== undefined) data['budgetLimit'] = dto.budgetLimit

    const updated = await (this.db as any).promotion.update({ where: { id }, data })
    if (dto.schedules !== undefined) {
      await (this.db as any).promotionSchedule.deleteMany({ where: { promotionId: id } })
      const scheduleRows = normalizeScheduleRows(id, dto.schedules)
      if (scheduleRows.length) {
        await (this.db as any).promotionSchedule.createMany({ data: scheduleRows })
      }
    }
    if (dto.voucherBatch && (dto.type === undefined || dto.type === 'VOUCHER')) {
      await this.generateVouchers({ promotionId: id, ...dto.voucherBatch }, staffId)
    }
    return { success: true, data: updated }
  }

  async activate(id: string, staffId?: string | null) {
    await this.assertPromotionExists(id)
    const data = await (this.db as any).promotion.update({
      where: { id },
      data: { status: 'ACTIVE', activatedAt: new Date(), updatedBy: staffId ?? null },
    })
    return { success: true, data }
  }

  async deactivate(id: string, staffId?: string | null) {
    await this.assertPromotionExists(id)
    const data = await (this.db as any).promotion.update({
      where: { id },
      data: { status: 'PAUSED', updatedBy: staffId ?? null },
    })
    return { success: true, data }
  }

  async preview(dto: PromotionPreviewDto) {
    const result = await this.application.preview({
      branchId: dto.branchId ?? null,
      customerId: dto.customerId ?? null,
      voucherCode: dto.voucherCode ?? null,
      manualDiscount: dto.manualDiscount ?? 0,
      items: dto.items ?? [],
    })
    return { success: true, data: result }
  }

  async generateVouchers(dto: GenerateVouchersDto, staffId?: string | null) {
    await this.assertPromotionExists(dto.promotionId)
    const prefix = normalizeCode(dto.prefix || 'VC')
    const quantity = Math.min(10_000, Math.max(1, Number(dto.quantity) || 1))
    const created = await (this.db as any).$transaction(async (tx: any) => {
      const batch = await tx.promotionVoucherBatch.create({
        data: {
          promotionId: dto.promotionId,
          name: dto.name.trim(),
          prefix,
          quantity,
          usageLimitPerCode: dto.usageLimitPerCode ?? 1,
          customerId: dto.customerId ?? null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          createdBy: staffId ?? null,
        },
      })
      const codes = Array.from({ length: quantity }, () => ({
        promotionId: dto.promotionId,
        batchId: batch.id,
        code: `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`,
        customerId: dto.customerId ?? null,
        endsAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        usageLimit: dto.usageLimitPerCode ?? 1,
      }))
      await tx.promotionVoucherCode.createMany({ data: codes, skipDuplicates: true })
      return { batch, codes }
    })
    return { success: true, data: created }
  }

  async listVouchers(query: Record<string, unknown>) {
    const where: Record<string, unknown> = {}
    if (query['promotionId']) where['promotionId'] = String(query['promotionId'])
    if (query['status']) where['status'] = String(query['status']).toUpperCase()
    if (query['code']) where['code'] = { contains: String(query['code']).trim().toUpperCase() }
    const data = await (this.db as any).promotionVoucherCode.findMany({
      where,
      include: { promotion: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, Number(query['limit'] ?? 100))),
    })
    return { success: true, data }
  }

  async reportSummary() {
    const [promotionCount, activeCount, redemptionCount, totals] = await Promise.all([
      (this.db as any).promotion.count(),
      (this.db as any).promotion.count({ where: { status: 'ACTIVE' } }),
      (this.db as any).promotionRedemption.count(),
      (this.db as any).promotionRedemption.aggregate({
        _sum: { discountAmount: true, giftValue: true },
      }),
    ])
    return {
      success: true,
      data: {
        promotionCount,
        activeCount,
        redemptionCount,
        discountAmount: totals._sum.discountAmount ?? 0,
        giftValue: totals._sum.giftValue ?? 0,
      },
    }
  }

  private async assertPromotionExists(id: string) {
    const promotion = await (this.db as any).promotion.findUnique({ where: { id }, select: { id: true } })
    if (!promotion) throw new NotFoundException('Khong tim thay chuong trinh khuyen mai')
  }
}
