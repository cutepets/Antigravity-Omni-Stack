import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { randomUUID } from 'crypto'
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

const LEGACY_TECHNICAL_SPA_PACKAGE_CODES = new Set([
  'BATH',
  'HYGIENE',
  'SHAVE',
  'FULL',
  'BATH_HYGIENE',
  'BATH_CLEAN',
  'BATH_SHAVE',
  'BATH_CLIP',
  'BATH_CLIP_HYGIENE',
  'BATH_SHAVE_HYGIENE',
])

const normalizePricingCode = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const isLegacyTechnicalSpaRule = (rule: { packageCode?: string | null; label?: string | null }) => {
  const packageCode = normalizePricingCode(rule.packageCode)
  const label = normalizePricingCode(rule.label)
  return LEGACY_TECHNICAL_SPA_PACKAGE_CODES.has(packageCode) && (!label || label === packageCode)
}

const getSpaRuleBandScope = (rule: { species?: string | null; weightBandId?: string | null }) =>
  `${rule.species ?? 'NULL'}:${rule.weightBandId ?? 'NULL'}`

const filterLegacySpaRulesWithCustomNames = <TRule extends { packageCode?: string | null; label?: string | null; species?: string | null; weightBandId?: string | null }>(
  rules: TRule[],
) => {
  const scopesWithCustomNamedRules = new Set(
    rules
      .filter((rule) => Boolean(rule.weightBandId) && !isLegacyTechnicalSpaRule(rule))
      .map(getSpaRuleBandScope),
  )

  return rules.filter(
    (rule) =>
      !(
        rule.weightBandId &&
        isLegacyTechnicalSpaRule(rule) &&
        scopesWithCustomNamedRules.has(getSpaRuleBandScope(rule))
      ),
  )
}

type SpaServiceImageEntry = {
  species: string | null
  packageCode: string
  imageUrl: string
  label?: string
}

type HotelServiceImageEntry = {
  species: string
  packageCode: string
  imageUrl: string
  label?: string
}

type HotelExtraServiceConfig = {
  sku: string | null
  imageUrl: string | null
  name: string
  minWeight: number | null
  maxWeight: number | null
  price: number
}

const PRICING_EXCEL_SHEETS = {
  readme: 'README',
  groomingMatrix: 'Grooming Matrix',
  groomingOther: 'Grooming Other',
  hotelMatrix: 'Hotel Matrix',
  hotelExtra: 'Hotel Extra',
  weightBands: 'Weight Bands',
  holidays: 'Holidays',
  serviceImages: 'Service Images',
} as const

type PricingImportDetail = {
  sheet: string
  row?: number
  imported?: number
  errors?: number
  message?: string
}

type PricingImportResult = {
  imported: number
  errors: string[]
  summary: {
    imported: number
    errors: number
  }
  details: PricingImportDetail[]
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
    try {
      await this.db.$executeRawUnsafe(`ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS "hotelServiceImages" TEXT`)
      this.logger.log('hotelServiceImages column ensured in system_configs')
    } catch (err: unknown) {
      this.logger.warn(`Could not ensure hotelServiceImages column: ${String(err)}`)
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

  private normalizeOptionalUrl(value: unknown) {
    return this.normalizeOptionalText(typeof value === 'string' ? value : null)
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

  private excelText(row: any, key: string) {
    const value = row?.[key]
    if (value === null || value === undefined) return ''
    if (typeof value === 'object' && 'text' in value) return String(value.text ?? '').trim()
    return String(value).trim()
  }

  private excelNumber(row: any, key: string) {
    const raw = row?.[key]
    if (raw === null || raw === undefined || raw === '') return null
    const normalized = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
    return Number.isFinite(normalized) ? normalized : null
  }

  private excelBoolean(row: any, key: string, defaultValue = true) {
    const raw = row?.[key]
    if (raw === null || raw === undefined || raw === '') return defaultValue
    if (typeof raw === 'boolean') return raw
    const normalized = String(raw).trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'active', 'x'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false
    return defaultValue
  }

  private dateToExcelInput(value?: Date | string | null) {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
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
            imageUrl: this.normalizeOptionalUrl(normalizedItem.imageUrl),
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

  async createPricingBackupSnapshot() {
    const [weightBands, spaRules, hotelRules, holidays, systemConfig] = await Promise.all([
      this.db.serviceWeightBand.findMany({
        orderBy: [{ serviceType: 'asc' }, { species: 'asc' }, { sortOrder: 'asc' }, { minWeight: 'asc' }],
      } as any),
      this.db.spaPriceRule.findMany({
        orderBy: [{ species: 'asc' }, { packageCode: 'asc' }, { createdAt: 'asc' }],
      } as any),
      this.db.hotelPriceRule.findMany({
        orderBy: [{ year: 'asc' }, { species: 'asc' }, { dayType: 'asc' }, { createdAt: 'asc' }],
      } as any),
      this.db.holidayCalendarDate.findMany({
        orderBy: [{ date: 'asc' }, { endDate: 'asc' }],
      } as any),
      (this.db as any).systemConfig.findFirst({
        select: { id: true, hotelExtraServices: true, spaServiceImages: true, hotelServiceImages: true, updatedAt: true },
      }),
    ])

    return {
      createdAt: new Date().toISOString(),
      weightBands,
      spaRules,
      hotelRules,
      holidays,
      systemConfig,
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

    const weightBandedRules = await this.db.spaPriceRule.findMany({
      where: {
        weightBandId: { not: null },
        ...(species === null ? {} : { species }),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isActive !== false ? { weightBand: { is: { isActive: true } } } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ weightBand: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    })

    const flatRateRules = await this.db.spaPriceRule.findMany({
      where: {
        weightBandId: null,
        ...(species === null ? {} : { OR: [{ species }, { species: null }] }),
        ...(isActive !== undefined ? { isActive } : {}),
      } as any,
      include: { weightBand: true },
      orderBy: [{ minWeight: 'asc' }, { createdAt: 'asc' }],
    })

    return filterLegacySpaRulesWithCustomNames([...weightBandedRules, ...flatRateRules])
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

  async bulkUpsertHotelExtraServices(dto: BulkUpsertHotelExtraServicesDto) {
    const services = (dto.services ?? []).map((service) => {
      const { minWeight, maxWeight } = this.normalizeHotelExtraServiceWeightRange(service)
      return {
        sku: this.normalizeOptionalText(service.sku),
        name: this.normalizeText(service.name, 'Ten dich vu khac'),
        minWeight,
        maxWeight,
        price: this.normalizeNumber(service.price, 'Gia dich vu khac'),
        imageUrl: this.normalizeOptionalText(service.imageUrl),
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

  private parseSpaServiceImages(rawValue: string | null | undefined): SpaServiceImageEntry[] {
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
          species: typeof item.species === 'string' && item.species.trim() ? item.species.trim() : null,
          packageCode: item.packageCode,
          imageUrl: item.imageUrl,
          ...(typeof item.label === 'string' && item.label.trim() ? { label: item.label } : {}),
        }))
    } catch {
      return []
    }
  }

  async listSpaServiceImages(): Promise<SpaServiceImageEntry[]> {
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

  async uploadSpaServiceImage(packageCode: string, imageUrl: string, label?: string, species?: string | null): Promise<SpaServiceImageEntry> {
    const normalizedCode = this.normalizeText(packageCode, 'Tên dịch vụ')
    const normalizedLabel = this.normalizeOptionalText(label)
    const normalizedSpecies = this.normalizeSpecies(species)
    const existing = await this.listSpaServiceImages()
    const updated = existing.filter((item) => !(item.packageCode === normalizedCode && item.species === normalizedSpecies))
    const entry: SpaServiceImageEntry = { species: normalizedSpecies, packageCode: normalizedCode, imageUrl }
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

  async bulkUpdateSpaServiceImages(images: Array<{ species?: string | null; packageCode: string; imageUrl: string }>) {
    const normalized = images.map((item) => ({
      species: this.normalizeSpecies(item.species),
      packageCode: this.normalizeText(item.packageCode, 'Tên dịch vụ'),
      imageUrl: this.normalizeText(item.imageUrl, 'URL ảnh dịch vụ'),
    }))
    await this.saveSpaServiceImages(normalized)
    return normalized
  }

  private async saveSpaServiceImages(images: SpaServiceImageEntry[]) {
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

  // Hotel Service Images

  private parseHotelServiceImages(rawValue: string | null | undefined): HotelServiceImageEntry[] {
    if (!rawValue) return []
    try {
      const parsed = JSON.parse(rawValue)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.species === 'string' &&
          typeof item.imageUrl === 'string',
      )
        .map((item) => ({
          species: item.species.trim(),
          packageCode: typeof item.packageCode === 'string' && item.packageCode.trim() ? item.packageCode.trim() : 'HOTEL',
          imageUrl: item.imageUrl,
          ...(typeof item.label === 'string' && item.label.trim() ? { label: item.label } : {}),
        }))
        .filter((item) => item.species)
    } catch {
      return []
    }
  }

  async listHotelServiceImages(): Promise<HotelServiceImageEntry[]> {
    const config = await this.readHotelServiceImagesConfig()
    return this.parseHotelServiceImages(config?.hotelServiceImages)
  }

  async uploadHotelServiceImage(species: string, imageUrl: string, label?: string): Promise<HotelServiceImageEntry> {
    const normalizedSpecies = this.normalizeText(species, 'Loài thú cưng')
    const normalizedLabel = this.normalizeOptionalText(label)
    const existing = await this.listHotelServiceImages()
    const updated = existing.filter((item) => item.species !== normalizedSpecies)
    const entry: HotelServiceImageEntry = { species: normalizedSpecies, packageCode: 'HOTEL', imageUrl }
    if (normalizedLabel) entry.label = normalizedLabel
    updated.push(entry)
    await this.saveHotelServiceImages(updated)
    return entry
  }

  async bulkUpdateHotelServiceImages(images: Array<{ species?: string | null; packageCode?: string | null; imageUrl: string; label?: string | null }>) {
    const normalized = images.map((item) => {
      const entry: HotelServiceImageEntry = {
        species: this.normalizeText(item.species, 'Loài thú cưng'),
        packageCode: this.normalizeOptionalText(item.packageCode) ?? 'HOTEL',
        imageUrl: this.normalizeText(item.imageUrl, 'URL ảnh Hotel'),
      }
      const label = this.normalizeOptionalText(item.label)
      if (label) entry.label = label
      return entry
    })
    await this.saveHotelServiceImages(normalized)
    return normalized
  }

  private async saveHotelServiceImages(images: HotelServiceImageEntry[]) {
    const payload = JSON.stringify(images)
    const existing = await this.readHotelServiceImagesConfig()
    if (existing) {
      await this.db.$executeRawUnsafe(
        `UPDATE system_configs SET "hotelServiceImages" = $1, "updatedAt" = NOW() WHERE id = $2`,
        payload,
        existing.id,
      )
    } else {
      await this.db.$executeRawUnsafe(
        `INSERT INTO system_configs (id, "hotelServiceImages", "updatedAt") VALUES ($1, $2, NOW())`,
        randomUUID(),
        payload,
      )
    }
  }

  private async ensureHotelServiceImagesColumn() {
    await this.db.$executeRawUnsafe(`ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS "hotelServiceImages" TEXT`)
  }

  private async readHotelServiceImagesConfig(): Promise<{ id: string; hotelServiceImages: string | null } | null> {
    await this.ensureHotelServiceImagesColumn()
    const rows = await this.db.$queryRawUnsafe<Array<{ id: string; hotelServiceImages: string | null }>>(
      `SELECT id, "hotelServiceImages" FROM system_configs ORDER BY "updatedAt" DESC LIMIT 1`,
    )
    return rows[0] ?? null
  }

  private addPricingSheet(workbook: any, name: string, columns: Array<{ header: string; key: string; width?: number }>) {
    const sheet = workbook.addWorksheet(name)
    sheet.columns = columns
    const row = sheet.getRow(1)
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    row.alignment = { horizontal: 'center' }
    row.commit()
    return sheet
  }

  private addPricingReadmeSheet(workbook: any) {
    const sheet = workbook.addWorksheet(PRICING_EXCEL_SHEETS.readme)
    sheet.columns = [
      { header: 'Huong dan', key: 'guide', width: 42 },
      { header: 'Chi tiet', key: 'detail', width: 92 },
    ]
    const row = sheet.getRow(1)
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    row.alignment = { horizontal: 'center' }
    row.commit()
    sheet.addRow({
      guide: 'File backup bang gia',
      detail: 'Day la file backup co the sua nhanh roi import lai de cap nhat hoac khoi phuc bang gia Grooming/Hotel.',
    })
    sheet.addRow({
      guide: 'Cot id',
      detail: 'Nen giu nguyen id khi sua gia. Neu id trong, he thong se match bang serviceType/species/label/minWeight/maxWeight hoac rule key.',
    })
    sheet.addRow({
      guide: 'Gia tri hop le',
      detail: 'serviceType: GROOMING/HOTEL. dayType: REGULAR/HOLIDAY. isActive: true/false, 1/0, yes/no.',
    })
    sheet.addRow({
      guide: 'Xoa/mat hieu luc',
      detail: 'Dat isActive=false cho dong can tat. Import khong xoa cac dong khong co trong file.',
    })
    sheet.addRow({
      guide: 'Hang can',
      detail: 'Weight Bands la nguon that cho hang can. Cac sheet gia can weightBandId hoac weightBandLabel + minWeight + maxWeight de tim hang can.',
    })
    return sheet
  }

  private worksheetRecords(sheet: any) {
    if (!sheet) return []
    const headers: string[] = []
    sheet.getRow(1).eachCell((cell: any, colNumber: number) => {
      headers[colNumber] = String(cell.value ?? '').trim()
    })
    const rows: Record<string, unknown>[] = []
    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber <= 1) return
      const record: Record<string, unknown> = {}
      let hasValue = false
      headers.forEach((header, colNumber) => {
        if (!header) return
        const cell = row.getCell(colNumber)
        const value = cell.value && typeof cell.value === 'object' && 'text' in cell.value
          ? (cell.value as any).text
          : cell.value
        if (value !== null && value !== undefined && String(value).trim() !== '') hasValue = true
        record[header] = value
      })
      if (hasValue) rows.push({ ...record, __rowNumber: rowNumber })
    })
    return rows
  }

  private async exportToExcelRoundtrip(type: 'grooming' | 'hotel' | 'all') {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    this.addPricingReadmeSheet(workbook)
    const serviceImages = await this.listSpaServiceImages()
    const hotelServiceImages = await this.listHotelServiceImages()
    const imageByKey = new Map(serviceImages.map((image) => [`${image.species ?? 'NULL'}:${image.packageCode}`, image.imageUrl]))
    const hotelImageBySpecies = new Map(hotelServiceImages.map((image) => [image.species, image.imageUrl]))

    if (type === 'grooming' || type === 'all') {
      const spaRules: any[] = await this.db.spaPriceRule.findMany({
        where: { isActive: true },
        include: { weightBand: true },
        orderBy: [{ species: 'asc' }, { packageCode: 'asc' }, { weightBand: { sortOrder: 'asc' } }, { minWeight: 'asc' }],
      } as any)
      const matrixSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.groomingMatrix, [
        { header: 'id', key: 'id', width: 28 },
        { header: 'species', key: 'species', width: 14 },
        { header: 'packageCode', key: 'packageCode', width: 24 },
        { header: 'label', key: 'label', width: 24 },
        { header: 'weightBandId', key: 'weightBandId', width: 28 },
        { header: 'weightBandLabel', key: 'weightBandLabel', width: 18 },
        { header: 'minWeight', key: 'minWeight', width: 12 },
        { header: 'maxWeight', key: 'maxWeight', width: 12 },
        { header: 'sku', key: 'sku', width: 16 },
        { header: 'price', key: 'price', width: 14 },
        { header: 'durationMinutes', key: 'durationMinutes', width: 18 },
        { header: 'imageUrl', key: 'imageUrl', width: 36 },
        { header: 'isActive', key: 'isActive', width: 10 },
      ])
      const otherSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.groomingOther, [
        { header: 'id', key: 'id', width: 28 },
        { header: 'sku', key: 'sku', width: 16 },
        { header: 'name', key: 'name', width: 28 },
        { header: 'minWeight', key: 'minWeight', width: 12 },
        { header: 'maxWeight', key: 'maxWeight', width: 12 },
        { header: 'price', key: 'price', width: 14 },
        { header: 'durationMinutes', key: 'durationMinutes', width: 18 },
        { header: 'imageUrl', key: 'imageUrl', width: 36 },
        { header: 'isActive', key: 'isActive', width: 10 },
      ])
      for (const rule of spaRules) {
        if (rule.weightBandId) {
          const species = rule.species ?? rule.weightBand?.species ?? null
          matrixSheet.addRow({
            id: rule.id,
            species: species ?? '',
            packageCode: rule.packageCode,
            label: rule.label ?? '',
            weightBandId: rule.weightBandId,
            weightBandLabel: rule.weightBand?.label ?? '',
            minWeight: rule.weightBand?.minWeight ?? '',
            maxWeight: rule.weightBand?.maxWeight ?? '',
            sku: rule.sku ?? '',
            price: rule.price,
            durationMinutes: rule.durationMinutes ?? '',
            imageUrl: imageByKey.get(`${species ?? 'NULL'}:${rule.packageCode}`) ?? imageByKey.get(`NULL:${rule.packageCode}`) ?? '',
            isActive: rule.isActive,
          })
        } else {
          otherSheet.addRow({
            id: rule.id,
            sku: rule.sku ?? '',
            name: rule.label ?? rule.packageCode,
            minWeight: rule.minWeight ?? '',
            maxWeight: rule.maxWeight ?? '',
            price: rule.price,
            durationMinutes: rule.durationMinutes ?? '',
            imageUrl: imageByKey.get(`NULL:${rule.packageCode}`) ?? '',
            isActive: rule.isActive,
          })
        }
      }
    }

    if (type === 'hotel' || type === 'all') {
      const year = new Date().getFullYear()
      const hotelRules: any[] = await this.db.hotelPriceRule.findMany({
        where: { year, isActive: true },
        include: { weightBand: true },
        orderBy: [{ species: 'asc' }, { dayType: 'asc' }, { weightBand: { sortOrder: 'asc' } }],
      } as any)
      const hotelSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.hotelMatrix, [
        { header: 'id', key: 'id', width: 28 },
        { header: 'year', key: 'year', width: 10 },
        { header: 'species', key: 'species', width: 14 },
        { header: 'dayType', key: 'dayType', width: 14 },
        { header: 'weightBandId', key: 'weightBandId', width: 28 },
        { header: 'weightBandLabel', key: 'weightBandLabel', width: 18 },
        { header: 'minWeight', key: 'minWeight', width: 12 },
        { header: 'maxWeight', key: 'maxWeight', width: 12 },
        { header: 'sku', key: 'sku', width: 16 },
        { header: 'fullDayPrice', key: 'fullDayPrice', width: 16 },
        { header: 'imageUrl', key: 'imageUrl', width: 36 },
        { header: 'isActive', key: 'isActive', width: 10 },
      ])
      for (const rule of hotelRules) {
        hotelSheet.addRow({
          id: rule.id,
          year: rule.year,
          species: rule.species ?? '',
          dayType: rule.dayType,
          weightBandId: rule.weightBandId,
          weightBandLabel: rule.weightBand?.label ?? '',
          minWeight: rule.weightBand?.minWeight ?? '',
          maxWeight: rule.weightBand?.maxWeight ?? '',
          sku: rule.sku ?? '',
          fullDayPrice: rule.fullDayPrice,
          imageUrl: rule.species ? hotelImageBySpecies.get(rule.species) ?? '' : '',
          isActive: rule.isActive,
        })
      }

      const hotelExtraSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.hotelExtra, [
        { header: 'sku', key: 'sku', width: 16 },
        { header: 'name', key: 'name', width: 28 },
        { header: 'minWeight', key: 'minWeight', width: 12 },
        { header: 'maxWeight', key: 'maxWeight', width: 12 },
        { header: 'price', key: 'price', width: 14 },
        { header: 'imageUrl', key: 'imageUrl', width: 36 },
      ])
      for (const service of await this.listHotelExtraServices()) hotelExtraSheet.addRow(service)
    }

    const bandsSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.weightBands, [
      { header: 'id', key: 'id', width: 28 },
      { header: 'serviceType', key: 'serviceType', width: 14 },
      { header: 'species', key: 'species', width: 14 },
      { header: 'label', key: 'label', width: 18 },
      { header: 'minWeight', key: 'minWeight', width: 12 },
      { header: 'maxWeight', key: 'maxWeight', width: 12 },
      { header: 'sortOrder', key: 'sortOrder', width: 12 },
      { header: 'isActive', key: 'isActive', width: 10 },
    ])
    for (const band of await this.db.serviceWeightBand.findMany({ where: { isActive: true }, orderBy: [{ serviceType: 'asc' }, { species: 'asc' }, { sortOrder: 'asc' }] } as any)) {
      bandsSheet.addRow({
        id: band.id,
        serviceType: String(band.serviceType),
        species: band.species ?? '',
        label: band.label,
        minWeight: band.minWeight,
        maxWeight: band.maxWeight ?? '',
        sortOrder: band.sortOrder ?? 0,
        isActive: band.isActive,
      })
    }

    const holidaysSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.holidays, [
      { header: 'id', key: 'id', width: 28 },
      { header: 'startDate', key: 'startDate', width: 14 },
      { header: 'endDate', key: 'endDate', width: 14 },
      { header: 'name', key: 'name', width: 24 },
      { header: 'isRecurring', key: 'isRecurring', width: 14 },
      { header: 'isActive', key: 'isActive', width: 10 },
    ])
    for (const holiday of await this.db.holidayCalendarDate.findMany({ orderBy: [{ date: 'asc' }, { endDate: 'asc' }] } as any)) {
      holidaysSheet.addRow({
        id: holiday.id,
        startDate: this.dateToExcelInput(holiday.date),
        endDate: this.dateToExcelInput(holiday.endDate ?? holiday.date),
        name: holiday.name,
        isRecurring: holiday.isRecurring,
        isActive: holiday.isActive,
      })
    }

    const imagesSheet = this.addPricingSheet(workbook, PRICING_EXCEL_SHEETS.serviceImages, [
      { header: 'serviceType', key: 'serviceType', width: 14 },
      { header: 'species', key: 'species', width: 14 },
      { header: 'packageCode', key: 'packageCode', width: 28 },
      { header: 'label', key: 'label', width: 28 },
      { header: 'imageUrl', key: 'imageUrl', width: 36 },
    ])
    for (const image of serviceImages) {
      imagesSheet.addRow({
        serviceType: 'GROOMING',
        species: image.species ?? '',
        packageCode: image.packageCode,
        label: image.label ?? '',
        imageUrl: image.imageUrl,
      })
    }
    for (const image of hotelServiceImages) {
      imagesSheet.addRow({
        serviceType: 'HOTEL',
        species: image.species,
        packageCode: image.packageCode,
        label: image.label ?? '',
        imageUrl: image.imageUrl,
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  private async writePricingBackupFile() {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const snapshot = await this.createPricingBackupSnapshot()
      const now = new Date()
      const pad = (value: number) => String(value).padStart(2, '0')
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      const backupDir = path.resolve(process.cwd(), '..', '..', '.backups', 'pricing')
      await fs.mkdir(backupDir, { recursive: true })
      await fs.writeFile(path.join(backupDir, `pricing-backup-${stamp}.json`), JSON.stringify(snapshot, null, 2))
    } catch (error) {
      this.logger.warn(`Could not write pricing backup before import: ${String(error)}`)
    }
  }

  async exportToExcel(type: 'grooming' | 'hotel' | 'all' = 'all'): Promise<Buffer> {
    if (process.env['PRICING_EXCEL_LEGACY_EXPORT'] !== '1') {
      return this.exportToExcelRoundtrip(type)
    }

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

  private emptyImportResult(): PricingImportResult {
    return {
      imported: 0,
      errors: [],
      summary: { imported: 0, errors: 0 },
      details: [],
    }
  }

  private finishImportResult(result: PricingImportResult): PricingImportResult {
    result.summary = { imported: result.imported, errors: result.errors.length }
    return result
  }

  private addImportSheetDetail(result: PricingImportResult, sheet: string, imported: number) {
    if (imported > 0) result.details.push({ sheet, imported })
  }

  private addImportRowError(result: PricingImportResult, sheet: string, row: Record<string, unknown>, message: string) {
    const rowNumber = Number(row['__rowNumber'] ?? 0) || undefined
    const detail = { sheet, row: rowNumber, message }
    result.details.push(detail)
    result.errors.push(rowNumber ? `${sheet} dong ${rowNumber}: ${message}` : `${sheet}: ${message}`)
  }

  private bandSignature(serviceType: PricingServiceType, species: string | null, label: string, minWeight: number, maxWeight: number | null) {
    return `${serviceType}:${species ?? 'NULL'}:${label}:${minWeight}:${maxWeight ?? 'INF'}`
  }

  private async importFromExcelBackup(workbook: any): Promise<PricingImportResult> {
    await this.writePricingBackupFile()
    const result = this.emptyImportResult()
    const existingBands = await this.db.serviceWeightBand.findMany({ where: { isActive: true } } as any)
    const bandById = new Map(existingBands.map((band: any) => [band.id, band]))
    const bandBySignature = new Map(existingBands.map((band: any) => [
      this.bandSignature(band.serviceType, band.species ?? null, band.label, band.minWeight, band.maxWeight ?? null),
      band,
    ]))

    let importedBands = 0
    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.weightBands))) {
      const serviceTypeText = this.excelText(row, 'serviceType')
      const label = this.excelText(row, 'label')
      const minWeight = this.excelNumber(row, 'minWeight')
      if (!serviceTypeText && !label && minWeight === null) continue
      if (!serviceTypeText || !label || minWeight === null) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.weightBands, row, 'Thieu serviceType, label hoac minWeight')
        continue
      }
      try {
        const serviceType = this.normalizeServiceType(serviceTypeText)
        const species = this.excelText(row, 'species') || null
        const maxWeight = this.excelNumber(row, 'maxWeight')
        const id = this.excelText(row, 'id')
        const signature = this.bandSignature(serviceType, species, label, minWeight, maxWeight)
        const existing = id ? bandById.get(id) : bandBySignature.get(signature)
        const saved = await this.upsertWeightBand({
          id: existing?.id ?? (id || undefined),
          serviceType,
          species,
          label,
          minWeight,
          maxWeight,
          sortOrder: this.excelNumber(row, 'sortOrder') ?? 0,
          isActive: this.excelBoolean(row, 'isActive', true),
        })
        bandById.set(saved.id, saved)
        bandBySignature.set(this.bandSignature(saved.serviceType as PricingServiceType, saved.species ?? null, saved.label, saved.minWeight, saved.maxWeight ?? null), saved)
        importedBands += 1
      } catch (error: any) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.weightBands, row, error.message)
      }
    }
    this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.weightBands, importedBands)
    result.imported += importedBands

    const resolveBandId = (row: Record<string, unknown>, serviceType: PricingServiceType, species?: string | null) => {
      const id = this.excelText(row, 'weightBandId')
      if (id && bandById.has(id)) return id
      const label = this.excelText(row, 'weightBandLabel')
      const minWeight = this.excelNumber(row, 'minWeight')
      const maxWeight = this.excelNumber(row, 'maxWeight')
      if (!label || minWeight === null) return undefined
      return bandBySignature.get(this.bandSignature(serviceType, species ?? null, label, minWeight, maxWeight))?.id
    }

    const spaRules: Array<any> = []
    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.groomingMatrix))) {
      const packageCode = this.excelText(row, 'packageCode')
      const species = this.excelText(row, 'species') || null
      const price = this.excelNumber(row, 'price')
      if (!packageCode && price === null) continue
      const weightBandId = resolveBandId(row, 'GROOMING', species)
      if (!packageCode || price === null) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.groomingMatrix, row, 'Thieu packageCode hoac price')
        continue
      }
      if (!weightBandId) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.groomingMatrix, row, `Khong tim thay hang can cho ${packageCode}`)
        continue
      }
      spaRules.push({
        id: this.excelText(row, 'id') || undefined,
        species,
        packageCode,
        label: this.excelText(row, 'label') || packageCode,
        weightBandId,
        sku: this.excelText(row, 'sku') || null,
        price,
        durationMinutes: this.excelNumber(row, 'durationMinutes'),
        isActive: this.excelBoolean(row, 'isActive', true),
      })
    }

    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.groomingOther))) {
      const name = this.excelText(row, 'name')
      const price = this.excelNumber(row, 'price')
      if (!name && price === null) continue
      if (!name || price === null) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.groomingOther, row, 'Thieu name hoac price')
        continue
      }
      spaRules.push({
        id: this.excelText(row, 'id') || undefined,
        species: null,
        packageCode: name,
        label: name,
        weightBandId: null,
        minWeight: this.excelNumber(row, 'minWeight'),
        maxWeight: this.excelNumber(row, 'maxWeight'),
        sku: this.excelText(row, 'sku') || null,
        price,
        durationMinutes: this.excelNumber(row, 'durationMinutes'),
        isActive: this.excelBoolean(row, 'isActive', true),
      })
    }
    if (spaRules.length > 0) {
      try {
        await this.bulkUpsertSpaRules({ rules: spaRules } as any)
        result.imported += spaRules.length
        this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.groomingMatrix, spaRules.length)
      } catch (error: any) {
        result.errors.push(`Grooming: ${error.message}`)
        result.details.push({ sheet: PRICING_EXCEL_SHEETS.groomingMatrix, message: error.message, errors: 1 })
      }
    }

    const hotelRules: Array<any> = []
    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.hotelMatrix))) {
      const species = this.excelText(row, 'species') || null
      const fullDayPrice = this.excelNumber(row, 'fullDayPrice')
      if (!species && fullDayPrice === null) continue
      const weightBandId = resolveBandId(row, 'HOTEL', null)
      if (!species || fullDayPrice === null) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.hotelMatrix, row, 'Thieu species hoac fullDayPrice')
        continue
      }
      if (!weightBandId) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.hotelMatrix, row, `Khong tim thay hang can cho Hotel ${species}`)
        continue
      }
      hotelRules.push({
        id: this.excelText(row, 'id') || undefined,
        year: this.excelNumber(row, 'year') ?? new Date().getFullYear(),
        species,
        weightBandId,
        dayType: (this.excelText(row, 'dayType') || 'REGULAR') as PricingDayType,
        sku: this.excelText(row, 'sku') || null,
        fullDayPrice,
        isActive: this.excelBoolean(row, 'isActive', true),
      })
    }
    if (hotelRules.length > 0) {
      try {
        await this.bulkUpsertHotelRules({ rules: hotelRules } as any)
        result.imported += hotelRules.length
        this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.hotelMatrix, hotelRules.length)
      } catch (error: any) {
        result.errors.push(`Hotel: ${error.message}`)
        result.details.push({ sheet: PRICING_EXCEL_SHEETS.hotelMatrix, message: error.message, errors: 1 })
      }
    }

    const hotelExtra = this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.hotelExtra)).flatMap((row) => {
      const name = this.excelText(row, 'name')
      const price = this.excelNumber(row, 'price')
      if (!name || price === null) return []
      return [{
        sku: this.excelText(row, 'sku') || null,
        name,
        minWeight: this.excelNumber(row, 'minWeight'),
        maxWeight: this.excelNumber(row, 'maxWeight'),
        price,
        imageUrl: this.excelText(row, 'imageUrl') || null,
      }]
    })
    if (hotelExtra.length > 0) {
      try {
        await this.bulkUpsertHotelExtraServices({ services: hotelExtra } as any)
        result.imported += hotelExtra.length
        this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.hotelExtra, hotelExtra.length)
      } catch (error: any) {
        result.errors.push(`${PRICING_EXCEL_SHEETS.hotelExtra}: ${error.message}`)
        result.details.push({ sheet: PRICING_EXCEL_SHEETS.hotelExtra, message: error.message, errors: 1 })
      }
    }

    const serviceImageRows = this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.serviceImages))
    const serviceImages = serviceImageRows.flatMap((row) => {
      const serviceType = this.excelText(row, 'serviceType') || 'GROOMING'
      if (serviceType.toUpperCase() === 'HOTEL') return []
      const packageCode = this.excelText(row, 'packageCode')
      const imageUrl = this.excelText(row, 'imageUrl')
      if (!packageCode || !imageUrl) return []
      return [{ species: this.excelText(row, 'species') || null, packageCode, imageUrl }]
    })
    if (serviceImages.length > 0) {
      await this.bulkUpdateSpaServiceImages(serviceImages)
      result.imported += serviceImages.length
      this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.serviceImages, serviceImages.length)
    }

    const hotelServiceImagesBySpecies = new Map<string, { species: string; packageCode: string; imageUrl: string; label?: string | null }>()
    for (const row of serviceImageRows) {
      const serviceType = this.excelText(row, 'serviceType').toUpperCase()
      if (serviceType !== 'HOTEL') continue
      const species = this.excelText(row, 'species')
      const imageUrl = this.excelText(row, 'imageUrl')
      if (!species || !imageUrl) continue
      hotelServiceImagesBySpecies.set(species, {
        species,
        packageCode: this.excelText(row, 'packageCode') || 'HOTEL',
        label: this.excelText(row, 'label') || null,
        imageUrl,
      })
    }
    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.hotelMatrix))) {
      const species = this.excelText(row, 'species')
      const imageUrl = this.excelText(row, 'imageUrl')
      if (!species || !imageUrl || hotelServiceImagesBySpecies.has(species)) continue
      hotelServiceImagesBySpecies.set(species, { species, packageCode: 'HOTEL', imageUrl })
    }
    const hotelServiceImages = Array.from(hotelServiceImagesBySpecies.values())
    if (hotelServiceImages.length > 0) {
      await this.bulkUpdateHotelServiceImages(hotelServiceImages)
      result.imported += hotelServiceImages.length
    }

    let importedHolidays = 0
    for (const row of this.worksheetRecords(workbook.getWorksheet(PRICING_EXCEL_SHEETS.holidays))) {
      const startDate = this.excelText(row, 'startDate')
      const name = this.excelText(row, 'name')
      if (!startDate && !name) continue
      if (!startDate || !name) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.holidays, row, 'Thieu startDate hoac name')
        continue
      }
      try {
        await this.createHoliday({
          startDate,
          endDate: this.excelText(row, 'endDate') || startDate,
          name,
          isRecurring: this.excelBoolean(row, 'isRecurring', true),
          isActive: this.excelBoolean(row, 'isActive', true),
        })
        importedHolidays += 1
      } catch (error: any) {
        this.addImportRowError(result, PRICING_EXCEL_SHEETS.holidays, row, error.message)
      }
    }
    result.imported += importedHolidays
    this.addImportSheetDetail(result, PRICING_EXCEL_SHEETS.holidays, importedHolidays)

    if (!workbook.getWorksheet(PRICING_EXCEL_SHEETS.weightBands)
      && !workbook.getWorksheet(PRICING_EXCEL_SHEETS.groomingMatrix)
      && !workbook.getWorksheet(PRICING_EXCEL_SHEETS.hotelMatrix)) {
      result.errors.push('File Excel khong dung mau backup bang gia moi')
      result.details.push({ sheet: PRICING_EXCEL_SHEETS.readme, message: 'File Excel khong dung mau backup bang gia moi', errors: 1 })
    }

    return this.finishImportResult(result)
  }

  async importFromExcel(buffer: Buffer): Promise<PricingImportResult> {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(buffer as any)
    return this.importFromExcelBackup(workbook)
  }
}
