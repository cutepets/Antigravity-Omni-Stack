import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import {
  BulkUpsertHotelDaycareRulesDto,
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
export class PricingService implements OnModuleInit {
  private readonly logger = new Logger(PricingService.name)
  constructor(private readonly db: DatabaseService) { }

  async onModuleInit() {
    // Ensure the spaServiceImages column exists (idempotent — safe to run on every startup)
    // Note: actual postgres table is "system_configs" (@@map in schema.prisma)
    try {
      await this.db.$executeRawUnsafe(`ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS "spaServiceImages" TEXT`)
      this.logger.log('spaServiceImages column ensured in system_configs')
    } catch (err: unknown) {
      this.logger.warn(`Could not ensure spaServiceImages column: ${String(err)}`)
    }
  }

  private deriveHalfDayPrice(fullDayPrice: number) {
    return Math.round(fullDayPrice / 2)
  }

  private serializeHotelRule<T extends { branchId?: string | null; fullDayPrice: number }>(rule: T) {
    const { branchId: _branchId, ...rest } = rule
    return {
      ...rest,
      halfDayPrice: this.deriveHalfDayPrice(rest.fullDayPrice),
    }
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

  private getSpaRuleComboKey(rule: {
    species?: string | null
    weightBandId?: string | null
    packageCode: string
    minWeight?: number | null
    maxWeight?: number | null
  }) {
    const speciesKey = rule.species ?? 'NULL'
    if (rule.weightBandId) {
      return `BAND:${speciesKey}:${rule.weightBandId}:${rule.packageCode}`
    }

    return `FLAT:${speciesKey}:${rule.packageCode}:${rule.minWeight ?? 'NULL'}:${rule.maxWeight ?? 'INF'}`
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
    const speciesFilter = species === null ? undefined : { OR: [{ species }, { species: null }] }

    const weightBandedRules = await this.db.spaPriceRule.findMany({
      where: {
        ...(speciesFilter ?? {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isActive !== false ? { weightBand: { is: { isActive: true } } } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    })

    const flatRateRules = await this.db.spaPriceRule.findMany({
      where: {
        weightBandId: null,
        ...(speciesFilter ?? {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ minWeight: 'asc' }, { createdAt: 'asc' }],
    })

    return [...weightBandedRules, ...flatRateRules]
  }

  async bulkUpsertSpaRules(dto: BulkUpsertSpaRulesDto) {
    const normalizedRules: Array<{
      id?: string | undefined
      species: string | null
      packageCode: string
      label?: string | null
      weightBandId: string | null
      minWeight: number | null
      maxWeight: number | null
      sku?: string | null
      price: number
      durationMinutes: number | null
      isActive: boolean
    }> = []

    for (const rule of dto.rules ?? []) {
      const ruleSpecies = Object.prototype.hasOwnProperty.call(rule, 'species')
        ? this.normalizeSpecies(rule.species)
        : this.normalizeSpecies(dto.species)

      if (rule.weightBandId) {
        const weightBand = await this.assertWeightBandScope(rule.weightBandId, 'GROOMING')
        const normalizedSpecies = ruleSpecies ?? weightBand.species ?? null
        if (!normalizedSpecies) {
          throw new BadRequestException('Bang gia Grooming theo hang can phai luu rieng cho tung loai thu cung')
        }
        normalizedRules.push({
          id: rule.id,
          species: normalizedSpecies,
          packageCode: this.normalizeText(rule.packageCode, 'Gói SPA'),
          label: this.normalizeOptionalText(rule.label),
          weightBandId: rule.weightBandId ?? null,
          minWeight: null,
          maxWeight: null,
          sku: rule.sku ?? null,
          price: this.normalizeNumber(rule.price, 'Giá SPA'),
          durationMinutes: this.normalizeOptionalNumber(rule.durationMinutes, 'Thời lượng', 1),
          isActive: rule.isActive ?? true,
        })
        continue
      }
      const { minWeight, maxWeight } = this.normalizeSpaRuleWeightRange(rule)
      normalizedRules.push({
        id: rule.id,
        species: ruleSpecies,
        packageCode: this.normalizeText(rule.packageCode, 'Gói SPA'),
        label: this.normalizeOptionalText(rule.label),
        weightBandId: rule.weightBandId ?? null,
        minWeight,
        maxWeight,
        sku: rule.sku ?? null,
        price: this.normalizeNumber(rule.price, 'Giá SPA'),
        durationMinutes: this.normalizeOptionalNumber(rule.durationMinutes, 'Thời lượng', 1),
        isActive: rule.isActive ?? true,
      })
    }

    if (normalizedRules.length === 0) {
      throw new BadRequestException('Can nhap it nhat mot dong gia Grooming truoc khi luu')
    }

    return this.db.$transaction(async (tx) => {
      const speciesVariants = Array.from(new Set(normalizedRules.map((rule) => rule.species ?? null)))
      const existingRules = await tx.spaPriceRule.findMany({
        where: {
          isActive: true,
          OR: speciesVariants.map((currentSpecies) => ({ species: currentSpecies })),
        } as any,
        include: { weightBand: true },
        orderBy: [{ weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
      })
      const existingByCombo = new Map(existingRules.map((rule) => [this.getSpaRuleComboKey(rule), rule]))
      const results = []

      for (const rule of normalizedRules) {
        const data: any = {
          species: rule.species,
          packageCode: rule.packageCode,
          label: rule.label,
          weightBandId: rule.weightBandId ?? null,
          minWeight: rule.minWeight,
          maxWeight: rule.maxWeight,
          sku: rule.sku ?? null,
          price: rule.price,
          durationMinutes: rule.durationMinutes,
          isActive: rule.isActive,
        }
        let savedRule: (typeof existingRules)[number]

        if (rule.id) {
          const current = await tx.spaPriceRule.findUnique({ where: { id: rule.id } })
          if (!current) throw new NotFoundException('Không tìm thấy dòng giá SPA')
          savedRule = await tx.spaPriceRule.update({ where: { id: current.id }, data, include: { weightBand: true } })
        } else {
          const comboKey = this.getSpaRuleComboKey(rule)
          const current = existingByCombo.get(comboKey)
          if (current) {
            savedRule = await tx.spaPriceRule.update({ where: { id: current.id }, data, include: { weightBand: true } })
          } else {
            savedRule = await tx.spaPriceRule.create({ data, include: { weightBand: true } })
          }
        }

        if (!rule.weightBandId && rule.species === null) {
          await tx.spaPriceRule.updateMany({
            where: {
              id: { not: savedRule.id },
              weightBandId: null,
              packageCode: rule.packageCode,
              minWeight: rule.minWeight,
              maxWeight: rule.maxWeight,
              isActive: true,
              NOT: { species: null },
            } as any,
            data: { isActive: false },
          })
        }

        results.push(savedRule)
      }

      return results.sort((left, right) => {
        if ((left.species ?? '') !== (right.species ?? '')) {
          return String(left.species ?? '').localeCompare(String(right.species ?? ''))
        }
        const bandOrder = (left.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER)
        if (bandOrder !== 0) return bandOrder
        const minWeightOrder = (left.minWeight ?? -1) - (right.minWeight ?? -1)
        if (minWeightOrder !== 0) return minWeightOrder
        return left.createdAt.getTime() - right.createdAt.getTime()
      })
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
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    const canonicalRules = new Map<string, (typeof rules)[number]>()
    const prioritizedRules = [...rules].sort((left, right) => {
      const leftScore = (left.branchId === null ? 2 : 0) + (left.species ? 1 : 0)
      const rightScore = (right.branchId === null ? 2 : 0) + (right.species ? 1 : 0)
      if (leftScore !== rightScore) return rightScore - leftScore
      return right.updatedAt.getTime() - left.updatedAt.getTime()
    })

    for (const rule of prioritizedRules) {
      const comboKey = `${rule.year}:${rule.species ?? 'NULL'}:${rule.dayType}:${rule.weightBandId}`
      if (canonicalRules.has(comboKey)) continue
      canonicalRules.set(comboKey, rule)
    }

    return Array.from(canonicalRules.values())
      .sort((left, right) => {
        const leftBandOrder = left.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER
        const rightBandOrder = right.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (leftBandOrder !== rightBandOrder) return leftBandOrder - rightBandOrder
        if (left.dayType !== right.dayType) return left.dayType.localeCompare(right.dayType)
        return String(left.species ?? '').localeCompare(String(right.species ?? ''))
      })
      .map((rule) => this.serializeHotelRule(rule))
  }

  async bulkUpsertHotelRules(dto: BulkUpsertHotelRulesDto) {
    for (const rule of dto.rules ?? []) {
      await this.assertWeightBandScope(rule.weightBandId, 'HOTEL')
    }

    return this.db.$transaction(async (tx) => {
      const incomingYears = Array.from(
        new Set((dto.rules ?? []).map((rule) => Math.floor(this.normalizeNumber(rule.year, 'Năm', 2000)))),
      )
      const existingRules = await tx.hotelPriceRule.findMany({
        where: {
          year: { in: incomingYears.length > 0 ? incomingYears : [Math.floor(new Date().getFullYear())] },
          isActive: true,
        },
        include: { weightBand: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })
      const existingByCombo = new Map<string, typeof existingRules>()
      for (const existingRule of existingRules) {
        const comboKey = `${existingRule.year}:${existingRule.species ?? 'NULL'}:${existingRule.dayType}:${existingRule.weightBandId}`
        existingByCombo.set(comboKey, [...(existingByCombo.get(comboKey) ?? []), existingRule])
      }

      const results = []
      for (const rule of dto.rules ?? []) {
        const fullDayPrice = this.normalizeNumber(rule.fullDayPrice, 'Giá một ngày')
        const year = Math.floor(this.normalizeNumber(rule.year, 'Năm', 2000))
        const normalizedSpecies = this.normalizeSpecies(rule.species)
        if (!normalizedSpecies) {
          throw new BadRequestException('Bang gia Hotel phai luu rieng cho tung loai thu cung')
        }
        const normalizedDayType = this.normalizeDayType(rule.dayType) ?? 'REGULAR'
        const data = {
          year,
          species: normalizedSpecies,
          branchId: null,
          weightBandId: rule.weightBandId,
          dayType: normalizedDayType,
          sku: rule.sku ?? null,
          halfDayPrice: this.deriveHalfDayPrice(fullDayPrice),
          fullDayPrice,
          isActive: rule.isActive ?? true,
        }
        const comboKey = `${year}:${normalizedSpecies ?? 'NULL'}:${normalizedDayType}:${rule.weightBandId}`
        const legacyComboKey = `${year}:NULL:${normalizedDayType}:${rule.weightBandId}`
        const matchedRule = rule.id
          ? await tx.hotelPriceRule.findUnique({ where: { id: rule.id } })
          : rule.isActive === false
            ? (existingByCombo.get(comboKey) ?? existingByCombo.get(legacyComboKey) ?? [])[0] ?? null
            : (existingByCombo.get(comboKey) ?? [])[0] ?? null

        if (!matchedRule && rule.isActive === false) {
          continue
        }
        const savedRule = matchedRule
          ? await tx.hotelPriceRule.update({
            where: { id: matchedRule.id },
            data,
            include: { weightBand: true },
          })
          : await tx.hotelPriceRule.create({
            data,
            include: { weightBand: true },
          })

        await tx.hotelPriceRule.updateMany({
          where: {
            id: { not: savedRule.id },
            year,
            weightBandId: rule.weightBandId,
            dayType: normalizedDayType,
            isActive: true,
            OR: [{ species: normalizedSpecies }, { species: null }],
          },
          data: { isActive: false },
        })

        results.push(savedRule)
      }
      return results.map((rule) => this.serializeHotelRule(rule))
    })
  }

  async listHotelDaycareRules(query: { species?: string; packageDays?: string | number; isActive?: string }) {
    const species = this.normalizeSpecies(query.species)
    const packageDays = Math.max(1, Math.floor(this.normalizeNumber(query.packageDays ?? 10, 'So ngay goi', 1)))
    const isActive = query.isActive === undefined ? undefined : String(query.isActive) !== 'false'

    const rules = await this.db.hotelDaycarePriceRule.findMany({
      where: {
        packageDays,
        ...(species !== null ? { species } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    const canonicalRules = new Map<string, (typeof rules)[number]>()
    const prioritizedRules = [...rules].sort((left, right) => {
      const leftScore = (left.branchId === null ? 2 : 0) + (left.species ? 1 : 0)
      const rightScore = (right.branchId === null ? 2 : 0) + (right.species ? 1 : 0)
      if (leftScore !== rightScore) return rightScore - leftScore
      return right.updatedAt.getTime() - left.updatedAt.getTime()
    })

    for (const rule of prioritizedRules) {
      const comboKey = `${rule.packageDays}:${rule.species ?? 'NULL'}:${rule.weightBandId}`
      if (canonicalRules.has(comboKey)) continue
      canonicalRules.set(comboKey, rule)
    }

    return Array.from(canonicalRules.values())
      .sort((left, right) => {
        const leftBandOrder = left.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER
        const rightBandOrder = right.weightBand?.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (leftBandOrder !== rightBandOrder) return leftBandOrder - rightBandOrder
        return String(left.species ?? '').localeCompare(String(right.species ?? ''))
      })
      .map((rule) => ({
        ...rule,
        weightBandLabel: rule.weightBand?.label ?? null,
      }))
  }

  async bulkUpsertHotelDaycareRules(dto: BulkUpsertHotelDaycareRulesDto) {
    for (const rule of dto.rules ?? []) {
      await this.assertWeightBandScope(rule.weightBandId, 'HOTEL')
    }

    return this.db.$transaction(async (tx) => {
      const incomingPackageDays = Array.from(
        new Set((dto.rules ?? []).map((rule) => Math.max(1, Math.floor(this.normalizeNumber(rule.packageDays, 'So ngay goi', 1))))),
      )
      const existingRules = await tx.hotelDaycarePriceRule.findMany({
        where: {
          packageDays: { in: incomingPackageDays.length > 0 ? incomingPackageDays : [10] },
          isActive: true,
        },
        include: { weightBand: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })
      const existingByCombo = new Map<string, typeof existingRules>()
      for (const existingRule of existingRules) {
        const comboKey = `${existingRule.packageDays}:${existingRule.species ?? 'NULL'}:${existingRule.weightBandId}`
        existingByCombo.set(comboKey, [...(existingByCombo.get(comboKey) ?? []), existingRule])
      }

      const results = []
      for (const rule of dto.rules ?? []) {
        const packageDays = Math.max(1, Math.floor(this.normalizeNumber(rule.packageDays, 'So ngay goi', 1)))
        const price = this.normalizeNumber(rule.price, 'Gia combo')
        const normalizedSpecies = this.normalizeSpecies(rule.species)
        if (!normalizedSpecies) {
          throw new BadRequestException('Bang gia nha tre phai luu rieng cho tung loai thu cung')
        }
        const data = {
          species: normalizedSpecies,
          branchId: null,
          weightBandId: rule.weightBandId,
          packageDays,
          sku: rule.sku ?? null,
          price,
          isActive: rule.isActive ?? true,
        }
        const comboKey = `${packageDays}:${normalizedSpecies}:${rule.weightBandId}`
        const legacyComboKey = `${packageDays}:NULL:${rule.weightBandId}`
        const matchedRule = rule.id
          ? await tx.hotelDaycarePriceRule.findUnique({ where: { id: rule.id } })
          : rule.isActive === false
            ? (existingByCombo.get(comboKey) ?? existingByCombo.get(legacyComboKey) ?? [])[0] ?? null
            : (existingByCombo.get(comboKey) ?? [])[0] ?? null

        if (!matchedRule && rule.isActive === false) {
          continue
        }

        const savedRule = matchedRule
          ? await tx.hotelDaycarePriceRule.update({
            where: { id: matchedRule.id },
            data,
            include: { weightBand: true },
          })
          : await tx.hotelDaycarePriceRule.create({
            data,
            include: { weightBand: true },
          })

        await tx.hotelDaycarePriceRule.updateMany({
          where: {
            id: { not: savedRule.id },
            packageDays,
            weightBandId: rule.weightBandId,
            isActive: true,
            OR: [{ species: normalizedSpecies }, { species: null }],
          },
          data: { isActive: false },
        })

        results.push(savedRule)
      }

      return results.map((rule) => ({
        ...rule,
        weightBandLabel: rule.weightBand?.label ?? null,
      }))
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

  // ─── Spa Service Images ───────────────────────────────────────────────────

  private parseSpaServiceImages(rawValue: string | null | undefined): Array<{ packageCode: string; imageUrl: string; label?: string }> {
    if (!rawValue) return []
    try {
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.packageCode === 'string' &&
          typeof item.imageUrl === 'string',
      )
        .map((item) => ({
          packageCode: item.packageCode,
          imageUrl: item.imageUrl,
          ...(typeof item.label === 'string' && item.label.trim() ? { label: item.label } : {}),
        }))
    } catch {
      return []
    }
  }

  async listSpaServiceImages(): Promise<Array<{ packageCode: string; imageUrl: string; label?: string }>> {
    const config = await (this.db as any).systemConfig.findFirst({
      select: { spaServiceImages: true },
    })
    const images = this.parseSpaServiceImages(config?.spaServiceImages)
    if (images.length === 0) return images

    const rules = await this.db.spaPriceRule.findMany({
      where: { packageCode: { in: images.map((item) => item.packageCode) } },
      select: { packageCode: true, label: true },
      distinct: ['packageCode'],
    })
    const labelByPackageCode = new Map(rules.map((rule) => [rule.packageCode, rule.label]))
    return images.map((image) => ({
      ...image,
      label: labelByPackageCode.get(image.packageCode) ?? image.label,
    }))
  }

  async uploadSpaServiceImage(packageCode: string, imageUrl: string, label?: string): Promise<{ packageCode: string; imageUrl: string; label?: string }> {
    const normalizedCode = this.normalizeText(packageCode, 'Tên dịch vụ')
    const normalizedLabel = this.normalizeOptionalText(label)
    const existing = await this.listSpaServiceImages()
    const updated = existing.filter((item) => item.packageCode !== normalizedCode)
    const entry: { packageCode: string; imageUrl: string; label?: string } = { packageCode: normalizedCode, imageUrl }
    if (normalizedLabel) entry.label = normalizedLabel
    updated.push(entry)
    await this.saveSpaServiceImages(updated)
    if (normalizedLabel) {
      await this.db.spaPriceRule.updateMany({
        where: { packageCode: normalizedCode },
        data: { label: normalizedLabel },
      })
    }
    return entry
  }

  async bulkUpdateSpaServiceImages(images: Array<{ packageCode: string; imageUrl: string }>) {
    const normalized = images.map((item) => ({
      packageCode: this.normalizeText(item.packageCode, 'Tên dịch vụ'),
      imageUrl: this.normalizeText(item.imageUrl, 'URL ảnh dịch vụ'),
    }))
    await this.saveSpaServiceImages(normalized)
    return normalized
  }

  private async saveSpaServiceImages(images: Array<{ packageCode: string; imageUrl: string; label?: string }>) {
    const payload = JSON.stringify(images)
    const existing = await (this.db as any).systemConfig.findFirst({ select: { id: true } })
    if (existing) {
      await (this.db as any).systemConfig.update({
        where: { id: existing.id },
        data: { spaServiceImages: payload },
      })
    } else {
      await (this.db as any).systemConfig.create({
        data: { spaServiceImages: payload },
      })
    }
  }

  // ─── Excel Export / Import ────────────────────────────────────────────────

  async exportToExcel(type: 'grooming' | 'hotel' | 'all' = 'all'): Promise<Buffer> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()

    // Helper: style header row
    const styleHeader = (sheet: any) => {
      const row = sheet.getRow(1)
      row.font = { bold: true, size: 12 }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      row.alignment = { horizontal: 'center' }
      row.commit()
    }

    if (type === 'grooming' || type === 'all') {
      // Weight Bands (Grooming)
      const groomingBands = await this.db.serviceWeightBand.findMany({
        where: { serviceType: 'GROOMING', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }],
      })

      const spaRules = await this.db.spaPriceRule.findMany({
        where: { isActive: true },
        include: { weightBand: true },
        orderBy: [{ packageCode: 'asc' }, { weightBand: { sortOrder: 'asc' } }],
      })

      // Get unique package codes
      const packageCodes = Array.from(new Set(spaRules.map((r) => r.packageCode)))

      const groomingSheet = workbook.addWorksheet('Grooming')
      // Column: Gói dịch vụ | Band1 | Band2 | ...
      groomingSheet.columns = [
        { header: 'Gói dịch vụ', key: 'packageCode', width: 20 },
        { header: 'Tên hiển thị', key: 'label', width: 20 },
        ...groomingBands.flatMap((b) => [
          { header: b.label, key: `band_${b.id}`, width: 15 },
          { header: `${b.label} - Thời lượng (phút)`, key: `band_${b.id}_duration`, width: 24 },
        ]),
      ]
      styleHeader(groomingSheet)

      for (const pkg of packageCodes) {
        const pkgRules = spaRules.filter((r) => r.packageCode === pkg)
        const row: any = {
          packageCode: pkg,
          label: pkgRules[0]?.label ?? '',
        }
        for (const band of groomingBands) {
          const rule = pkgRules.find((r) => r.weightBandId === band.id)
          row[`band_${band.id}`] = rule?.price ?? ''
          row[`band_${band.id}_duration`] = rule?.durationMinutes ?? ''
        }
        groomingSheet.addRow(row)
      }
    }

    if (type === 'hotel' || type === 'all') {
      const hotelBands = await this.db.serviceWeightBand.findMany({
        where: { serviceType: 'HOTEL', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }],
      })

      const year = new Date().getFullYear()
      const hotelRules = await this.db.hotelPriceRule.findMany({
        where: { year, isActive: true },
        include: { weightBand: true },
        orderBy: [{ dayType: 'asc' }, { weightBand: { sortOrder: 'asc' } }],
      })

      const hotelSheet = workbook.addWorksheet('Hotel')
      hotelSheet.columns = [
        { header: 'Loại ngày', key: 'dayType', width: 18 },
        { header: 'Loại thú cưng', key: 'species', width: 18 },
        ...hotelBands.map((b) => ({ header: b.label, key: `band_${b.id}`, width: 15 })),
      ]
      styleHeader(hotelSheet)

      // Group by dayType + species
      const groups = new Map<string, typeof hotelRules>()
      for (const rule of hotelRules) {
        const key = `${rule.dayType}:${rule.species ?? 'Chó'}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(rule)
      }

      for (const [key, rules] of groups) {
        const [dayType, species] = key.split(':')
        const row: any = {
          dayType: dayType === 'REGULAR' ? 'Thường' : 'Lễ',
          species,
        }
        for (const band of hotelBands) {
          const rule = rules.find((r) => r.weightBandId === band.id)
          row[`band_${band.id}`] = rule?.fullDayPrice ?? ''
        }
        hotelSheet.addRow(row)
      }

      // Hotel Daycare
      const daycareRules = await this.db.hotelDaycarePriceRule.findMany({
        where: { isActive: true },
        include: { weightBand: true },
        orderBy: [{ packageDays: 'asc' }, { weightBand: { sortOrder: 'asc' } }],
      })

      if (daycareRules.length > 0) {
        const daycareSheet = workbook.addWorksheet('Hotel Nhà trẻ')
        daycareSheet.columns = [
          { header: 'Số ngày gói', key: 'packageDays', width: 18 },
          { header: 'Loại thú cưng', key: 'species', width: 18 },
          ...hotelBands.map((b) => ({ header: b.label, key: `band_${b.id}`, width: 15 })),
        ]
        styleHeader(daycareSheet)

        const daycareGroups = new Map<string, typeof daycareRules>()
        for (const rule of daycareRules) {
          const key = `${rule.packageDays}:${rule.species ?? 'Chó'}`
          if (!daycareGroups.has(key)) daycareGroups.set(key, [])
          daycareGroups.get(key)!.push(rule)
        }

        for (const [key, rules] of daycareGroups) {
          const [days, species] = key.split(':')
          const row: any = { packageDays: Number(days), species }
          for (const band of hotelBands) {
            const rule = rules.find((r) => r.weightBandId === band.id)
            row[`band_${band.id}`] = rule?.price ?? ''
          }
          daycareSheet.addRow(row)
        }
      }
    }

    // Weight Bands reference sheet
    const allBands = await this.db.serviceWeightBand.findMany({
      where: { isActive: true },
      orderBy: [{ serviceType: 'asc' }, { sortOrder: 'asc' }],
    })
    const bandsSheet = workbook.addWorksheet('Hạng cân')
    bandsSheet.columns = [
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Loại dịch vụ', key: 'serviceType', width: 15 },
      { header: 'Nhãn', key: 'label', width: 15 },
      { header: 'Min (kg)', key: 'minWeight', width: 12 },
      { header: 'Max (kg)', key: 'maxWeight', width: 12 },
    ]
    styleHeader(bandsSheet)
    for (const band of allBands) {
      bandsSheet.addRow({
        id: band.id,
        serviceType: band.serviceType,
        label: band.label,
        minWeight: band.minWeight,
        maxWeight: band.maxWeight ?? '∞',
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async importFromExcel(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)

    let imported = 0
    const errors: string[] = []

    // Build band lookup: label → id
    const allBands = await this.db.serviceWeightBand.findMany({
      where: { isActive: true },
    })
    const bandByLabel = new Map(allBands.map((b) => [b.label, b]))

    // ─── Grooming sheet
    const groomingSheet = workbook.getWorksheet('Grooming')
    if (groomingSheet) {
      const headerRow = groomingSheet.getRow(1)
      const bandColumns: Array<{ priceCol: number; durationCol?: number; bandId: string }> = []
      let sharedDurationCol: number | undefined
      const normalizeHeaderValue = (value: unknown) => String(value ?? '').trim()
      const isDurationHeader = (value: string) => value.toLocaleLowerCase('vi-VN').includes('thời lượng')

      for (let colNumber = 3; colNumber <= headerRow.cellCount; colNumber += 1) {
        const label = normalizeHeaderValue(headerRow.getCell(colNumber).value)
        if (!label) continue
        if (isDurationHeader(label) && !bandByLabel.has(label)) {
          sharedDurationCol = colNumber
          continue
        }
        const band = bandByLabel.get(label)
        if (band && band.serviceType === 'GROOMING') {
          const nextHeader = normalizeHeaderValue(headerRow.getCell(colNumber + 1).value)
          const durationCol = nextHeader.startsWith(`${label} -`) && isDurationHeader(nextHeader)
            ? colNumber + 1
            : sharedDurationCol
          bandColumns.push({ priceCol: colNumber, durationCol, bandId: band.id })
          if (durationCol === colNumber + 1) colNumber += 1
        }
      }

      const spaRules: Array<any> = []
      groomingSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return
        const packageCode = String(row.getCell(1).value ?? '').trim()
        const label = String(row.getCell(2).value ?? '').trim() || undefined
        if (!packageCode) return

        for (const { priceCol, durationCol, bandId } of bandColumns) {
          const price = Number(row.getCell(priceCol).value)
          if (!price || price <= 0) continue
          const duration = durationCol ? Number(row.getCell(durationCol).value) || undefined : undefined
          spaRules.push({
            packageCode,
            label,
            weightBandId: bandId,
            price,
            durationMinutes: duration,
            isActive: true,
          })
        }
      })

      if (spaRules.length > 0) {
        try {
          // Group by species (null = all species) for bulk upsert
          await this.bulkUpsertSpaRules({ rules: spaRules } as any)
          imported += spaRules.length
        } catch (e: any) {
          errors.push(`Grooming: ${e.message}`)
        }
      }
    }

    // ─── Hotel sheet
    const hotelSheet = workbook.getWorksheet('Hotel')
    if (hotelSheet) {
      const headerRow = hotelSheet.getRow(1)
      const bandColumns: Array<{ col: number; bandId: string }> = []

      headerRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) return // skip dayType, species
        const label = String(cell.value ?? '').trim()
        const band = bandByLabel.get(label)
        if (band && band.serviceType === 'HOTEL') {
          bandColumns.push({ col: colNumber, bandId: band.id })
        }
      })

      const hotelRules: Array<any> = []
      const year = new Date().getFullYear()
      hotelSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return
        const rawDayType = String(row.getCell(1).value ?? '').trim()
        const dayType = rawDayType === 'Lễ' || rawDayType === 'HOLIDAY' ? 'HOLIDAY' : 'REGULAR'
        const species = String(row.getCell(2).value ?? '').trim() || 'Chó'

        for (const { col, bandId } of bandColumns) {
          const price = Number(row.getCell(col).value)
          if (!price || price <= 0) continue
          hotelRules.push({
            year,
            species,
            weightBandId: bandId,
            dayType,
            fullDayPrice: price,
            isActive: true,
          })
        }
      })

      if (hotelRules.length > 0) {
        try {
          await this.bulkUpsertHotelRules({ rules: hotelRules } as any)
          imported += hotelRules.length
        } catch (e: any) {
          errors.push(`Hotel: ${e.message}`)
        }
      }
    }

    // ─── Hotel Daycare sheet
    const daycareSheet = workbook.getWorksheet('Hotel Nhà trẻ')
    if (daycareSheet) {
      const headerRow = daycareSheet.getRow(1)
      const bandColumns: Array<{ col: number; bandId: string }> = []

      headerRow.eachCell((cell, colNumber) => {
        if (colNumber <= 2) return
        const label = String(cell.value ?? '').trim()
        const band = bandByLabel.get(label)
        if (band && band.serviceType === 'HOTEL') {
          bandColumns.push({ col: colNumber, bandId: band.id })
        }
      })

      const daycareRules: Array<any> = []
      daycareSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return
        const packageDays = Number(row.getCell(1).value) || 10
        const species = String(row.getCell(2).value ?? '').trim() || 'Chó'

        for (const { col, bandId } of bandColumns) {
          const price = Number(row.getCell(col).value)
          if (!price || price <= 0) continue
          daycareRules.push({
            species,
            weightBandId: bandId,
            packageDays,
            price,
            isActive: true,
          })
        }
      })

      if (daycareRules.length > 0) {
        try {
          await this.bulkUpsertHotelDaycareRules({ rules: daycareRules } as any)
          imported += daycareRules.length
        } catch (e: any) {
          errors.push(`Hotel Nhà trẻ: ${e.message}`)
        }
      }
    }

    return { imported, errors }
  }
}
