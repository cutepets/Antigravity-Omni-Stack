import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import {
  BulkUpsertHotelExtraServicesDto,
  BulkUpsertHotelRulesDto,
  BulkUpsertSpaRulesDto,
  CreateHolidayDto,
  CreatePresetWeightBandsDto,
  PricingDayType,
  PricingServiceType,
  UpdateHolidayDto,
  UpsertWeightBandDto,
} from './dto/pricing.dto.js'

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

function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

@Injectable()
export class PricingService {
  constructor(private readonly db: DatabaseService) { }

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

  private parseHolidayDate(value: string, label = 'Ngày lễ') {
    const normalized = this.normalizeText(value, label)
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
    if (!match) throw new BadRequestException(`${label} phải có định dạng YYYY-MM-DD`)

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
      throw new BadRequestException(`${label} không hợp lệ`)
    }
    return date
  }

  private resolveHolidayRange(dto: { date?: string; startDate?: string; endDate?: string }) {
    const startInput = dto.startDate ?? dto.date
    if (!startInput) throw new BadRequestException('Cần nhập ngày bắt đầu ngày lễ')

    const startDate = this.parseHolidayDate(startInput, 'Ngày bắt đầu')
    const endDate = this.parseHolidayDate(dto.endDate ?? startInput, 'Ngày kết thúc')
    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
    }

    return { startDate, endDate }
  }

  private shiftRecurringHolidayToYear(startDate: Date, endDate: Date | null, year: number) {
    const normalizedEndDate = endDate ?? startDate
    const durationDays = Math.max(
      0,
      Math.round((normalizedEndDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
    )
    const shiftedStartDate = new Date(Date.UTC(year, startDate.getUTCMonth(), startDate.getUTCDate()))
    const shiftedEndDate = new Date(shiftedStartDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
    return { date: shiftedStartDate, endDate: shiftedEndDate }
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

  private normalizeSpaRuleWeightRange(rule: { weightBandId?: string | null; minWeight?: unknown; maxWeight?: unknown }) {
    if (rule.weightBandId) {
      return { minWeight: null, maxWeight: null }
    }

    const minWeight = this.normalizeOptionalNumber(rule.minWeight, 'Can nang toi thieu', 0)
    const maxWeight = this.normalizeOptionalNumber(rule.maxWeight, 'Can nang toi da', 0)

    if (minWeight === null && maxWeight !== null) {
      throw new BadRequestException('Can nhap can nang toi thieu khi co can nang toi da')
    }

    if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) {
      throw new BadRequestException('Can nang toi da phai lon hon can nang toi thieu')
    }

    return { minWeight, maxWeight }
  }

  private getSpaRuleComboKey(rule: { weightBandId?: string | null; packageCode: string; minWeight?: number | null; maxWeight?: number | null }) {
    if (rule.weightBandId) {
      return `BAND:${rule.weightBandId}:${rule.packageCode}`
    }

    return `FLAT:${rule.packageCode}:${rule.minWeight ?? 'NULL'}:${rule.maxWeight ?? 'INF'}`
  }

  private normalizeHotelExtraServiceWeightRange(service: { minWeight?: unknown; maxWeight?: unknown }) {
    const minWeight = this.normalizeOptionalNumber(service.minWeight, 'Can nang toi thieu', 0)
    const maxWeight = this.normalizeOptionalNumber(service.maxWeight, 'Can nang toi da', 0)

    if (minWeight === null && maxWeight !== null) {
      throw new BadRequestException('Can nhap can nang toi thieu khi co can nang toi da')
    }

    if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) {
      throw new BadRequestException('Can nang toi da phai lon hon can nang toi thieu')
    }

    return { minWeight, maxWeight }
  }

  private parseHotelExtraServicesConfig(rawValue: string | null | undefined) {
    if (!rawValue) return []

    try {
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((item) => {
          const normalizedItem = item && typeof item === 'object' ? item as Record<string, unknown> : {}
          const { minWeight, maxWeight } = this.normalizeHotelExtraServiceWeightRange(normalizedItem)
          const price = this.normalizeNumber(normalizedItem.price, 'Gia dich vu khac')
          return {
            sku: this.normalizeOptionalText(typeof normalizedItem.sku === 'string' ? normalizedItem.sku : null),
            name: this.normalizeText(typeof normalizedItem.name === 'string' ? normalizedItem.name : '', 'Ten dich vu khac'),
            minWeight,
            maxWeight,
            price,
          }
        })
    } catch {
      return []
    }
  }

  async listHotelExtraServices() {
    const config = await (this.db as any).systemConfig.findFirst({
      select: { hotelExtraServices: true },
    })

    return this.parseHotelExtraServicesConfig(config?.hotelExtraServices)
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

    const weightBandedRules = await this.db.spaPriceRule.findMany({
      where: {
        ...(species !== null ? { species } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isActive !== false ? { weightBand: { is: { isActive: true } } } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    })

    const flatRateRules = await this.db.spaPriceRule.findMany({
      where: {
        weightBandId: null,
        ...(species !== null ? { species } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ minWeight: 'asc' }, { createdAt: 'asc' }],
    })

    return [...weightBandedRules, ...flatRateRules]
  }

  async bulkUpsertSpaRules(dto: BulkUpsertSpaRulesDto) {
    const species = this.normalizeSpecies(dto.species ?? dto.rules?.[0]?.species)
    const normalizedRules: Array<{
      id?: string | undefined
      species: string | null
      packageCode: string
      weightBandId: string | null
      minWeight: number | null
      maxWeight: number | null
      sku?: string | null
      price: number
      durationMinutes: number | null
      isActive: boolean
    }> = []

    for (const rule of dto.rules ?? []) {
      if (rule.weightBandId) {
        await this.assertWeightBandScope(rule.weightBandId, 'GROOMING')
      }
      const { minWeight, maxWeight } = this.normalizeSpaRuleWeightRange(rule)
      normalizedRules.push({
        id: rule.id,
        species,
        packageCode: this.normalizeText(rule.packageCode, 'Gói SPA'),
        weightBandId: rule.weightBandId ?? null,
        minWeight,
        maxWeight,
        sku: rule.sku ?? null,
        price: this.normalizeNumber(rule.price, 'Giá SPA'),
        durationMinutes: this.normalizeOptionalNumber(rule.durationMinutes, 'Thời lượng', 1),
        isActive: rule.isActive ?? true,
      })
    }

    return this.db.$transaction(async (tx) => {
      const existingRules = await tx.spaPriceRule.findMany({
        where: { species, isActive: true } as any,
        include: { weightBand: true },
        orderBy: [{ weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
      })
      const existingByCombo = new Map(existingRules.map((rule) => [this.getSpaRuleComboKey(rule), rule]))
      const retainedIds = new Set<string>()
      const results = []

      for (const rule of normalizedRules) {
        const data: any = {
          species: rule.species,
          packageCode: rule.packageCode,
          weightBandId: rule.weightBandId ?? null,
          minWeight: rule.minWeight,
          maxWeight: rule.maxWeight,
          sku: rule.sku ?? null,
          price: rule.price,
          durationMinutes: rule.durationMinutes,
          isActive: rule.isActive,
        }

        if (rule.id) {
          const current = await tx.spaPriceRule.findUnique({ where: { id: rule.id } })
          if (!current) throw new NotFoundException('Không tìm thấy dòng giá SPA')
          retainedIds.add(current.id)
          results.push(await tx.spaPriceRule.update({ where: { id: current.id }, data, include: { weightBand: true } }))
        } else {
          const comboKey = this.getSpaRuleComboKey(rule)
          const current = existingByCombo.get(comboKey)
          if (current) {
            retainedIds.add(current.id)
            results.push(await tx.spaPriceRule.update({ where: { id: current.id }, data, include: { weightBand: true } }))
          } else {
            results.push(await tx.spaPriceRule.create({ data, include: { weightBand: true } }))
          }
        }
      }

      const idsToDeactivate = existingRules.filter((rule) => !retainedIds.has(rule.id)).map((rule) => rule.id)
      if (idsToDeactivate.length > 0) {
        await tx.spaPriceRule.updateMany({
          where: { id: { in: idsToDeactivate } },
          data: { isActive: false },
        })
      }

      return results.sort((left, right) => {
        const bandOrder = (left.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER)
        if (bandOrder !== 0) return bandOrder
        const minWeightOrder = (left.minWeight ?? -1) - (right.minWeight ?? -1)
        if (minWeightOrder !== 0) return minWeightOrder
        return left.createdAt.getTime() - right.createdAt.getTime()
      })
    })
  }

  async listHotelRules(query: { species?: string; year?: string | number; dayType?: string; isActive?: string; branchId?: string }) {
    const species = this.normalizeSpecies(query.species)
    const branchId = this.normalizeOptionalText(query.branchId)
    const year = Math.floor(Number(query.year ?? new Date().getFullYear()))
    const dayType = this.normalizeDayType(query.dayType)
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'

    const rules = await this.db.hotelPriceRule.findMany({
      where: {
        year,
        ...(branchId !== null ? { branchId } : {}),
        ...(species !== null ? { species } : {}),
        ...(dayType ? { dayType } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { branch: { select: { id: true, code: true, name: true } }, weightBand: true },
      orderBy: [{ branchId: 'asc' }, { dayType: 'asc' }, { weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
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
          branchId: this.normalizeOptionalText(rule.branchId),
          weightBandId: rule.weightBandId,
          dayType: this.normalizeDayType(rule.dayType) ?? 'REGULAR',
          sku: rule.sku ?? null,
          halfDayPrice: this.deriveHalfDayPrice(fullDayPrice),
          fullDayPrice,
          isActive: rule.isActive ?? true,
        }

        if (rule.id) {
          const current = await tx.hotelPriceRule.findUnique({ where: { id: rule.id } })
          if (!current) throw new NotFoundException('Không tìm thấy dòng giá Hotel')
          results.push(await tx.hotelPriceRule.update({
            where: { id: rule.id },
            data,
            include: { branch: { select: { id: true, code: true, name: true } }, weightBand: true },
          }))
        } else {
          results.push(await tx.hotelPriceRule.create({
            data,
            include: { branch: { select: { id: true, code: true, name: true } }, weightBand: true },
          }))
        }
      }
      return results
    })
  }

  async bulkUpsertHotelExtraServices(dto: BulkUpsertHotelExtraServicesDto) {
    const services = (dto.services ?? []).map((service) => {
      const { minWeight, maxWeight } = this.normalizeHotelExtraServiceWeightRange(service)
      return {
        sku: this.normalizeOptionalText(service.sku),
        name: this.normalizeText(service.name, 'Ten dich vu khac'),
        minWeight,
        maxWeight,
        price: this.normalizeNumber(service.price, 'Gia dich vu khac'),
      }
    })

    const duplicateKeys = new Set<string>()
    for (const service of services) {
      const key = `${service.name.trim().toLowerCase()}:${service.minWeight ?? 'NULL'}:${service.maxWeight ?? 'INF'}`
      if (duplicateKeys.has(key)) {
        throw new BadRequestException('Dich vu khac Hotel dang bi trung ten va khoang can')
      }
      duplicateKeys.add(key)
    }

    const payload = JSON.stringify(services)
    const existing = await (this.db as any).systemConfig.findFirst({
      select: { id: true },
    })

    if (existing) {
      await (this.db as any).systemConfig.update({
        where: { id: existing.id },
        data: { hotelExtraServices: payload },
      })
    } else {
      await (this.db as any).systemConfig.create({
        data: { hotelExtraServices: payload },
      })
    }

    return services
  }

  async listHolidays(query: { year?: string | number; isActive?: string }) {
    const year = Math.floor(Number(query.year ?? new Date().getFullYear()))
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31))
    const holidays = await this.db.holidayCalendarDate.findMany({
      where: {
        OR: [
          { isRecurring: true },
          {
            date: { lte: yearEnd },
            OR: [
              { endDate: null, date: { gte: yearStart } },
              { endDate: { gte: yearStart } },
            ],
          },
        ],
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: [{ date: 'asc' }, { endDate: 'asc' }],
    })
    return holidays.map((holiday) => {
      if (!holiday.isRecurring) return holiday
      return {
        ...holiday,
        ...this.shiftRecurringHolidayToYear(holiday.date, holiday.endDate, year),
      }
    })
  }

  async createHoliday(dto: CreateHolidayDto) {
    const { startDate, endDate } = this.resolveHolidayRange(dto)
    const data = {
      date: startDate,
      endDate,
      year: startDate.getUTCFullYear(),
      name: this.normalizeText(dto.name, 'Tên ngày lễ'),
      notes: null,
      isRecurring: dto.isRecurring ?? true,
      isActive: dto.isActive ?? true,
    }

    try {
      const existingHoliday = await this.db.holidayCalendarDate.findUnique({
        where: { date: startDate },
      })

      if (existingHoliday) {
        return this.db.holidayCalendarDate.update({
          where: { id: existingHoliday.id },
          data,
        })
      }

      return this.db.holidayCalendarDate.create({ data })
    } catch (error) {
      const errorCode = getPrismaErrorCode(error)
      if (errorCode === 'P2002') {
        throw new BadRequestException('Ngày bắt đầu này đã tồn tại trong lịch ngày lễ')
      }
      if (errorCode === 'P2022') {
        throw new BadRequestException('Cơ sở dữ liệu chưa cập nhật cấu trúc ngày lễ mới. Hãy chạy migrate deploy')
      }
      throw error
    }
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto) {
    const current = await this.db.holidayCalendarDate.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Không tìm thấy ngày lễ')
    const dateChanged = dto.date !== undefined || dto.startDate !== undefined
    const endDateChanged = dto.endDate !== undefined
    const date = dateChanged
      ? this.parseHolidayDate(dto.startDate ?? dto.date!, 'Ngày bắt đầu')
      : current.date
    const endDate = endDateChanged
      ? this.parseHolidayDate(dto.endDate!, 'Ngày kết thúc')
      : dateChanged
        ? date
        : current.endDate ?? current.date
    if (endDate < date) {
      throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu')
    }

    return this.db.holidayCalendarDate.update({
      where: { id },
      data: {
        date,
        endDate,
        year: date.getUTCFullYear(),
        name: dto.name !== undefined ? this.normalizeText(dto.name, 'Tên ngày lễ') : current.name,
        notes: null,
        isRecurring: dto.isRecurring ?? current.isRecurring,
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
