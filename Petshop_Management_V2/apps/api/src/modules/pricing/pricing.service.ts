import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import {
  BulkUpsertHotelRulesDto,
  BulkUpsertSpaRulesDto,
  CreateHolidayDto,
  CreatePresetWeightBandsDto,
  PricingDayType,
  PricingServiceType,
  UpdateHolidayDto,
  UpsertWeightBandDto,
} from './dto/pricing.dto.js'

const GROOMING_PACKAGES = ['BATH', 'BATH_CLEAN', 'SHAVE', 'BATH_SHAVE_CLEAN', 'SPA'] as const

const PRESET_BANDS: Record<PricingServiceType, Array<{ label: string; minWeight: number; maxWeight: number | null }>> = {
  GROOMING: [
    { label: '1-3kg', minWeight: 1, maxWeight: 3 },
    { label: '3-6kg', minWeight: 3, maxWeight: 6 },
    { label: '6-10kg', minWeight: 6, maxWeight: 10 },
    { label: '10-15kg', minWeight: 10, maxWeight: 15 },
    { label: '15-20kg', minWeight: 15, maxWeight: 20 },
    { label: '20-30kg', minWeight: 20, maxWeight: 30 },
    { label: '30-40kg', minWeight: 30, maxWeight: 40 },
    { label: '40-50kg', minWeight: 40, maxWeight: 50 },
    { label: '>50kg', minWeight: 50, maxWeight: null },
  ],
  HOTEL: [
    { label: '<2kg', minWeight: 0, maxWeight: 2 },
    { label: '2-4kg', minWeight: 2, maxWeight: 4 },
    { label: '4-6kg', minWeight: 4, maxWeight: 6 },
    { label: '6-9kg', minWeight: 6, maxWeight: 9 },
    { label: '9-12kg', minWeight: 9, maxWeight: 12 },
    { label: '12-15kg', minWeight: 12, maxWeight: 15 },
    { label: '15-20kg', minWeight: 15, maxWeight: 20 },
    { label: '20-30kg', minWeight: 20, maxWeight: 30 },
    { label: '30-40kg', minWeight: 30, maxWeight: 40 },
    { label: '40-50kg', minWeight: 40, maxWeight: 50 },
    { label: '>50kg', minWeight: 50, maxWeight: null },
  ],
}

@Injectable()
export class PricingService {
  constructor(private readonly db: DatabaseService) {}

  private deriveHalfDayPrice(fullDayPrice: number) {
    return Math.round(fullDayPrice / 2)
  }

  private normalizeServiceType(value?: string | null): PricingServiceType {
    const normalized = String(value ?? '').trim().toUpperCase()
    if (normalized === 'SPA' || normalized === 'GROOMING') return 'GROOMING'
    if (normalized === 'HOTEL') return 'HOTEL'
    throw new BadRequestException('Loại bảng giá không hợp lệ')
  }

  private normalizeDayType(value?: string | null): PricingDayType | undefined {
    const normalized = String(value ?? '').trim().toUpperCase()
    if (!normalized) return undefined
    if (normalized === 'REGULAR' || normalized === 'HOLIDAY') return normalized
    throw new BadRequestException('Loại ngày không hợp lệ')
  }

  private normalizeSpecies(value?: string | null) {
    const normalized = String(value ?? '').trim()
    return normalized || null
  }

  private normalizeText(value: string | null | undefined, label: string) {
    const normalized = String(value ?? '').trim()
    if (!normalized) throw new BadRequestException(`${label} không được để trống`)
    return normalized
  }

  private normalizeOptionalText(value: string | null | undefined) {
    const normalized = String(value ?? '').trim()
    return normalized || null
  }

  private normalizeNumber(value: unknown, label: string, min = 0) {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized < min) {
      throw new BadRequestException(`${label} không hợp lệ`)
    }
    return normalized
  }

  private normalizeOptionalNumber(value: unknown, label: string, min = 0) {
    if (value === undefined || value === null || value === '') return null
    return this.normalizeNumber(value, label, min)
  }

  private parseHolidayDate(value: string) {
    const normalized = this.normalizeText(value, 'Ngày lễ')
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
    if (!match) throw new BadRequestException('Ngày lễ phải có định dạng YYYY-MM-DD')

    const [, year, month, day] = match
    const yearValue = Number(year)
    const monthIndex = Number(month) - 1
    const dayValue = Number(day)
    const date = new Date(Date.UTC(yearValue, monthIndex, dayValue))
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== yearValue ||
      date.getUTCMonth() !== monthIndex ||
      date.getUTCDate() !== dayValue
    ) {
      throw new BadRequestException('Ngày lễ không hợp lệ')
    }
    return date
  }

  private async assertWeightBandScope(weightBandId: string, serviceType: PricingServiceType) {
    const band = await this.db.serviceWeightBand.findUnique({ where: { id: weightBandId } })
    if (!band || band.serviceType !== serviceType) {
      throw new BadRequestException('Hạng cân không thuộc đúng loại bảng giá')
    }
    return band
  }

  private async assertNoOverlappingBand(dto: UpsertWeightBandDto) {
    const serviceType = this.normalizeServiceType(dto.serviceType)
    const species = this.normalizeSpecies(dto.species)
    const minWeight = this.normalizeNumber(dto.minWeight, 'Cân nặng tối thiểu')
    const maxWeight = this.normalizeOptionalNumber(dto.maxWeight, 'Cân nặng tối đa')

    if (maxWeight !== null && maxWeight <= minWeight) {
      throw new BadRequestException('Cân nặng tối đa phải lớn hơn cân nặng tối thiểu')
    }

    const bands = await this.db.serviceWeightBand.findMany({
      where: {
        serviceType,
        species,
        isActive: true,
        ...(dto.id ? { NOT: { id: dto.id } } : {}),
      } as any,
    })

    const hasOverlap = bands.some((band) => {
      const leftMax = maxWeight ?? Number.POSITIVE_INFINITY
      const rightMax = band.maxWeight ?? Number.POSITIVE_INFINITY
      return minWeight < rightMax && band.minWeight < leftMax
    })

    if (hasOverlap) {
      throw new BadRequestException('Khoảng cân nặng bị trùng với hạng cân khác')
    }
  }

  async listWeightBands(query: { serviceType?: string; species?: string; isActive?: string }) {
    const serviceType = this.normalizeServiceType(query.serviceType)
    const species = this.normalizeSpecies(query.species)
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'

    return this.db.serviceWeightBand.findMany({
      where: {
        serviceType,
        ...(species !== null ? { species } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async upsertWeightBand(dto: UpsertWeightBandDto) {
    await this.assertNoOverlappingBand(dto)

    const data = {
      serviceType: this.normalizeServiceType(dto.serviceType),
      species: this.normalizeSpecies(dto.species),
      label: this.normalizeText(dto.label, 'Tên hạng cân'),
      minWeight: this.normalizeNumber(dto.minWeight, 'Cân nặng tối thiểu'),
      maxWeight: this.normalizeOptionalNumber(dto.maxWeight, 'Cân nặng tối đa'),
      sortOrder: Math.max(0, Math.floor(Number(dto.sortOrder ?? 0))),
      isActive: dto.isActive ?? true,
    }

    if (dto.id) {
      const current = await this.db.serviceWeightBand.findUnique({ where: { id: dto.id } })
      if (!current) throw new NotFoundException('Không tìm thấy hạng cân')
      return this.db.serviceWeightBand.update({ where: { id: dto.id }, data })
    }

    return this.db.serviceWeightBand.create({ data })
  }

  async createPresetWeightBands(dto: CreatePresetWeightBandsDto) {
    const serviceType = this.normalizeServiceType(dto.serviceType)
    const species = serviceType === 'HOTEL' ? null : this.normalizeSpecies(dto.species)
    if (serviceType !== 'HOTEL' && !species) throw new BadRequestException('Cần chọn loại thú cưng')

    const existingCount = await this.db.serviceWeightBand.count({
      where: { serviceType, species, isActive: true } as any,
    })
    if (existingCount > 0) {
      return this.db.serviceWeightBand.findMany({
        where: { serviceType, species, isActive: true } as any,
        orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }, { createdAt: 'asc' }],
      })
    }

    await this.db.serviceWeightBand.createMany({
      data: PRESET_BANDS[serviceType].map((band, index) => ({
        serviceType,
        species,
        label: band.label,
        minWeight: band.minWeight,
        maxWeight: band.maxWeight,
        sortOrder: index,
        isActive: true,
      })),
    })

    return this.db.serviceWeightBand.findMany({
      where: { serviceType, species, isActive: true } as any,
      orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async deactivateWeightBand(id: string) {
    const current = await this.db.serviceWeightBand.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Không tìm thấy hạng cân')
    return this.db.serviceWeightBand.update({ where: { id }, data: { isActive: false } })
  }

  async listSpaRules(query: { species?: string; isActive?: string }) {
    const species = this.normalizeSpecies(query.species)
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'
    return this.db.spaPriceRule.findMany({
      where: {
        ...(species !== null ? { species } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ weightBand: { sortOrder: 'asc' } }, { packageCode: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async bulkUpsertSpaRules(dto: BulkUpsertSpaRulesDto) {
    for (const rule of dto.rules ?? []) {
      if (!GROOMING_PACKAGES.includes(rule.packageCode as any)) {
        throw new BadRequestException('Gói SPA không hợp lệ')
      }
      await this.assertWeightBandScope(rule.weightBandId, 'GROOMING')
    }

    return this.db.$transaction(async (tx) => {
      const results = []
      for (const rule of dto.rules ?? []) {
        const data = {
          species: this.normalizeSpecies(rule.species),
          packageCode: this.normalizeText(rule.packageCode, 'Gói SPA'),
          weightBandId: rule.weightBandId,
          price: this.normalizeNumber(rule.price, 'Giá SPA'),
          durationMinutes: this.normalizeOptionalNumber(rule.durationMinutes, 'Thời lượng', 1),
          isActive: rule.isActive ?? true,
        }

        if (rule.id) {
          const current = await tx.spaPriceRule.findUnique({ where: { id: rule.id } })
          if (!current) throw new NotFoundException('Không tìm thấy dòng giá SPA')
          results.push(await tx.spaPriceRule.update({ where: { id: rule.id }, data, include: { weightBand: true } }))
        } else {
          results.push(await tx.spaPriceRule.create({ data, include: { weightBand: true } }))
        }
      }
      return results
    })
  }

  async listHotelRules(query: { species?: string; year?: string | number; dayType?: string; isActive?: string }) {
    const species = this.normalizeSpecies(query.species)
    const year = Math.floor(Number(query.year ?? new Date().getFullYear()))
    const dayType = this.normalizeDayType(query.dayType)
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'

    const rules = await this.db.hotelPriceRule.findMany({
      where: {
        year,
        ...(species !== null ? { species } : {}),
        ...(dayType ? { dayType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ dayType: 'asc' }, { weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    })

    return rules.map((rule) => ({
      ...rule,
      halfDayPrice: this.deriveHalfDayPrice(rule.fullDayPrice),
    }))
  }

  async bulkUpsertHotelRules(dto: BulkUpsertHotelRulesDto) {
    for (const rule of dto.rules ?? []) {
      await this.assertWeightBandScope(rule.weightBandId, 'HOTEL')
    }

    return this.db.$transaction(async (tx) => {
      const results = []
      for (const rule of dto.rules ?? []) {
        const fullDayPrice = this.normalizeNumber(rule.fullDayPrice, 'Giá một ngày')
        const data = {
          year: Math.floor(this.normalizeNumber(rule.year, 'Năm', 2000)),
          species: this.normalizeSpecies(rule.species),
          weightBandId: rule.weightBandId,
          dayType: this.normalizeDayType(rule.dayType) ?? 'REGULAR',
          halfDayPrice: this.deriveHalfDayPrice(fullDayPrice),
          fullDayPrice,
          isActive: rule.isActive ?? true,
        }

        if (rule.id) {
          const current = await tx.hotelPriceRule.findUnique({ where: { id: rule.id } })
          if (!current) throw new NotFoundException('Không tìm thấy dòng giá Hotel')
          results.push(await tx.hotelPriceRule.update({ where: { id: rule.id }, data, include: { weightBand: true } }))
        } else {
          results.push(await tx.hotelPriceRule.create({ data, include: { weightBand: true } }))
        }
      }
      return results
    })
  }

  async listHolidays(query: { year?: string | number; isActive?: string }) {
    const year = Math.floor(Number(query.year ?? new Date().getFullYear()))
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'
    return this.db.holidayCalendarDate.findMany({
      where: {
        year,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: [{ date: 'asc' }],
    })
  }

  async createHoliday(dto: CreateHolidayDto) {
    const date = this.parseHolidayDate(dto.date)
    const data = {
      date,
      year: date.getUTCFullYear(),
      name: this.normalizeText(dto.name, 'Tên ngày lễ'),
      notes: this.normalizeOptionalText(dto.notes),
      isActive: dto.isActive ?? true,
    }

    return this.db.holidayCalendarDate.upsert({
      where: { date },
      create: data,
      update: data,
    })
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto) {
    const current = await this.db.holidayCalendarDate.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Không tìm thấy ngày lễ')
    const date = dto.date ? this.parseHolidayDate(dto.date) : current.date

    return this.db.holidayCalendarDate.update({
      where: { id },
      data: {
        date,
        year: date.getUTCFullYear(),
        name: dto.name !== undefined ? this.normalizeText(dto.name, 'Tên ngày lễ') : current.name,
        notes: dto.notes !== undefined ? this.normalizeOptionalText(dto.notes) : current.notes,
        isActive: dto.isActive ?? current.isActive,
      },
    })
  }

  async deactivateHoliday(id: string) {
    const current = await this.db.holidayCalendarDate.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Không tìm thấy ngày lễ')
    return this.db.holidayCalendarDate.update({ where: { id }, data: { isActive: false } })
  }
}
