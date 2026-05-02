import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
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

const PRICING_EXCEL_VERSION = 'PRICING_EXCEL_V1'
const PRICING_EXCEL_SPECIES = ['Chó', 'Mèo'] as const
const GROOMING_SHEETS = {
  dog: 'Grooming Chó',
  cat: 'Grooming Mèo',
  other: 'Grooming Khác',
  decode: 'Giải mã',
} as const
const HOTEL_SHEETS = {
  hotel: 'Hotel',
  decode: 'Giải mã',
} as const

type PricingExcelMode = 'GROOMING' | 'HOTEL'
type PricingExcelIssue = {
  sheet: string
  row?: number
  column?: string
  message: string
}
type PricingExcelBand = {
  sourceId: string | null
  species: string | null
  label: string
  minWeight: number
  maxWeight: number | null
  sortOrder: number
}
type PricingExcelSpaRule = {
  sourceId: string | null
  species: string | null
  packageCode: string
  weightBandSourceId: string | null
  bandSignature: string
  minWeight: number | null
  maxWeight: number | null
  sku: string | null
  price: number
  durationMinutes: number | null
}
type PricingExcelHotelRule = {
  sourceId: string | null
  species: string
  dayType: PricingDayType
  weightBandSourceId: string | null
  bandSignature: string
  sku: string | null
  fullDayPrice: number
}
type PricingExcelPayload = {
  mode: PricingExcelMode
  year: number
  bands: PricingExcelBand[]
  spaRules: PricingExcelSpaRule[]
  spaImages: Array<{ species: string | null; packageCode: string; imageUrl: string }>
  hotelRules: PricingExcelHotelRule[]
  hotelImages: Array<{ species: string; packageCode: string; imageUrl: string; label?: string | null }>
}
type PricingExcelPreviewResult = {
  errors: PricingExcelIssue[]
  warnings: PricingExcelIssue[]
  summary: {
    mode: PricingExcelMode
    year: number
    sheetCount: number
    bandCount: number
    ruleCount: number
    imageCount: number
    errorCount: number
    warningCount: number
  }
  normalizedPayload: PricingExcelPayload | null
  checksum: string
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

  private normalizeExcelMode(value?: string | null): PricingExcelMode {
    const normalized = String(value ?? '').trim().toUpperCase()
    if (normalized === 'GROOMING' || normalized === 'HOTEL') return normalized
    throw new BadRequestException('Loại file Excel không hợp lệ')
  }

  private excelCellText(cell: any) {
    const value = cell?.value ?? cell
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      if ('text' in value) return String(value.text ?? '').trim()
      if ('result' in value) return String(value.result ?? '').trim()
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((part: any) => part?.text ?? '').join('').trim()
      }
    }
    return String(value).trim()
  }

  private excelCellNumber(cell: any) {
    const raw = cell?.value ?? cell
    if (raw === null || raw === undefined || raw === '') return null
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
    const normalized = String(raw).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')
    if (!normalized) return null
    const value = Number(normalized)
    return Number.isFinite(value) ? value : null
  }

  private getWorksheetHeaders(sheet: any) {
    const headers: string[] = []
    sheet?.getRow(1).eachCell((cell: any, colNumber: number) => {
      headers[colNumber] = this.excelCellText(cell)
    })
    return headers
  }

  private getExcelCell(row: any, headers: string[], header: string) {
    const index = headers.indexOf(header)
    return index > 0 ? row.getCell(index) : { value: '' }
  }

  private getExcelChecksum(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest('hex')
  }

  private makeBandSignature(serviceType: PricingServiceType, species: string | null, label: string, minWeight: number, maxWeight: number | null) {
    return `${serviceType}:${species ?? 'NULL'}:${label.trim().toLocaleLowerCase()}:${minWeight}:${maxWeight ?? 'INF'}`
  }

  private assertExcelHeaders(sheet: any, sheetName: string, requiredHeaders: string[], errors: PricingExcelIssue[]) {
    if (!sheet) {
      errors.push({ sheet: sheetName, message: `Thiếu sheet ${sheetName}` })
      return []
    }
    const headers = this.getWorksheetHeaders(sheet)
    const available = new Set(headers.filter(Boolean))
    for (const header of requiredHeaders) {
      if (!available.has(header)) {
        errors.push({ sheet: sheetName, column: header, message: `Thiếu cột ${header}` })
      }
    }
    return headers
  }

  private addExcelHeaderStyle(sheet: any) {
    const row = sheet.getRow(1)
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    row.alignment = { horizontal: 'center', vertical: 'middle' }
    row.commit()
  }

  private addExcelSheet(workbook: any, name: string, columns: Array<{ header: string; key: string; width?: number }>) {
    const sheet = workbook.addWorksheet(name)
    sheet.columns = columns
    this.addExcelHeaderStyle(sheet)
    return sheet
  }

  private readDecodeRows(sheet: any, headers: string[]) {
    const rows: Array<{ key: string; value: string; note: string }> = []
    if (!sheet) return rows
    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return
      const key = this.excelCellText(this.getExcelCell(row, headers, 'Khóa'))
      const value = this.excelCellText(this.getExcelCell(row, headers, 'Giá trị'))
      const note = this.excelCellText(this.getExcelCell(row, headers, 'Ghi chú'))
      if (key || value || note) rows.push({ key, value, note })
    })
    return rows
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

  async exportPricingExcel(input: { mode: PricingExcelMode | string; year?: number }): Promise<Buffer> {
    const mode = this.normalizeExcelMode(input.mode)
    const year = Math.floor(Number(input.year ?? new Date().getFullYear()))
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    workbook.creator = 'Petshop Management'
    workbook.created = new Date()

    if (mode === 'GROOMING') {
      await this.exportGroomingPricingWorkbook(workbook)
    } else {
      await this.exportHotelPricingWorkbook(workbook, year)
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  private async exportGroomingPricingWorkbook(workbook: any) {
    const [bands, spaRules, serviceImages] = await Promise.all([
      this.db.serviceWeightBand.findMany({
        where: { serviceType: 'GROOMING', isActive: true },
        orderBy: [{ species: 'asc' }, { sortOrder: 'asc' }, { minWeight: 'asc' }, { createdAt: 'asc' }],
      } as any),
      this.db.spaPriceRule.findMany({
        where: { isActive: true },
        include: { weightBand: true },
        orderBy: [{ species: 'asc' }, { packageCode: 'asc' }, { weightBand: { sortOrder: 'asc' } }, { minWeight: 'asc' }],
      } as any),
      this.listSpaServiceImages(),
    ])
    const imageByKey = new Map(serviceImages.map((image) => [`${image.species ?? 'NULL'}:${image.packageCode}`, image.imageUrl]))

    for (const species of PRICING_EXCEL_SPECIES) {
      const sheetName = species === 'Chó' ? GROOMING_SHEETS.dog : GROOMING_SHEETS.cat
      const speciesBands = bands.filter((band: any) => band.species === species)
      const speciesRules = spaRules.filter((rule: any) => rule.weightBandId && (rule.species ?? rule.weightBand?.species) === species)
      const services = Array.from(new Set(speciesRules.map((rule: any) => rule.packageCode))).sort((left, right) => left.localeCompare(right))
      const sheet = this.addExcelSheet(workbook, sheetName, [
        { header: 'Mã hạng cân', key: 'bandId', width: 28 },
        { header: 'Tên hạng cân', key: 'label', width: 20 },
        { header: 'Từ kg', key: 'minWeight', width: 12 },
        { header: 'Đến kg', key: 'maxWeight', width: 12 },
        ...services.flatMap((service) => [
          { header: `Link ảnh - ${service}`, key: `image:${service}`, width: 38 },
          { header: `Số tiền - ${service}`, key: `price:${service}`, width: 16 },
          { header: `SKU - ${service}`, key: `sku:${service}`, width: 16 },
          { header: `Thời gian - ${service}`, key: `duration:${service}`, width: 18 },
        ]),
      ])
      const ruleByBandAndService = new Map(speciesRules.map((rule: any) => [`${rule.weightBandId}:${rule.packageCode}`, rule]))
      for (const band of speciesBands) {
        const row: Record<string, unknown> = {
          bandId: band.id,
          label: band.label,
          minWeight: band.minWeight,
          maxWeight: band.maxWeight ?? '',
        }
        for (const service of services) {
          const rule = ruleByBandAndService.get(`${band.id}:${service}`)
          row[`image:${service}`] = imageByKey.get(`${species}:${service}`) ?? ''
          row[`price:${service}`] = rule?.price ?? ''
          row[`sku:${service}`] = rule?.sku ?? ''
          row[`duration:${service}`] = rule?.durationMinutes ?? ''
        }
        sheet.addRow(row)
      }
    }

    const otherSheet = this.addExcelSheet(workbook, GROOMING_SHEETS.other, [
      { header: 'Mã rule', key: 'id', width: 28 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Link ảnh', key: 'imageUrl', width: 38 },
      { header: 'Tên dịch vụ', key: 'name', width: 28 },
      { header: 'Từ kg', key: 'minWeight', width: 12 },
      { header: 'Đến kg', key: 'maxWeight', width: 12 },
      { header: 'Giá', key: 'price', width: 16 },
      { header: 'Phút', key: 'durationMinutes', width: 12 },
    ])
    for (const rule of spaRules.filter((item: any) => !item.weightBandId)) {
      const name = rule.label ?? rule.packageCode
      otherSheet.addRow({
        id: rule.id,
        sku: rule.sku ?? '',
        imageUrl: imageByKey.get(`NULL:${rule.packageCode}`) ?? '',
        name,
        minWeight: rule.minWeight ?? '',
        maxWeight: rule.maxWeight ?? '',
        price: rule.price,
        durationMinutes: rule.durationMinutes ?? '',
      })
    }

    const decodeSheet = this.addExcelSheet(workbook, GROOMING_SHEETS.decode, [
      { header: 'Khóa', key: 'key', width: 28 },
      { header: 'Giá trị', key: 'value', width: 48 },
      { header: 'Ghi chú', key: 'note', width: 64 },
    ])
    decodeSheet.addRow({ key: 'version', value: PRICING_EXCEL_VERSION, note: 'Không sửa giá trị này' })
    decodeSheet.addRow({ key: 'exportedAt', value: new Date().toISOString(), note: 'Thời điểm xuất file' })
    for (const species of PRICING_EXCEL_SPECIES) {
      decodeSheet.addRow({ key: 'species', value: species, note: `Sheet Grooming ${species}` })
    }
    for (const image of serviceImages) {
      decodeSheet.addRow({ key: `image:${image.species ?? 'NULL'}:${image.packageCode}`, value: image.imageUrl, note: image.label ?? '' })
    }
  }

  private async exportHotelPricingWorkbook(workbook: any, year: number) {
    const [bands, hotelRules, hotelImages] = await Promise.all([
      this.db.serviceWeightBand.findMany({
        where: { serviceType: 'HOTEL', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { minWeight: 'asc' }, { createdAt: 'asc' }],
      } as any),
      this.db.hotelPriceRule.findMany({
        where: { year, isActive: true },
        include: { weightBand: true },
        orderBy: [{ weightBand: { sortOrder: 'asc' } }, { species: 'asc' }, { dayType: 'asc' }],
      } as any),
      this.listHotelServiceImages(),
    ])
    const sheet = this.addExcelSheet(workbook, HOTEL_SHEETS.hotel, [
      { header: 'Mã hạng cân', key: 'bandId', width: 28 },
      { header: 'Hạng cân', key: 'label', width: 20 },
      { header: 'Từ kg', key: 'minWeight', width: 12 },
      { header: 'Đến kg', key: 'maxWeight', width: 12 },
      { header: 'Chó - SKU', key: 'dogSku', width: 16 },
      { header: 'Chó - Ngày thường', key: 'dogRegular', width: 18 },
      { header: 'Chó - Ngày lễ', key: 'dogHoliday', width: 18 },
      { header: 'Mèo - SKU', key: 'catSku', width: 16 },
      { header: 'Mèo - Ngày thường', key: 'catRegular', width: 18 },
      { header: 'Mèo - Ngày lễ', key: 'catHoliday', width: 18 },
    ])
    const ruleByKey = new Map(hotelRules.map((rule: any) => [`${rule.weightBandId}:${rule.species}:${rule.dayType}`, rule]))
    for (const band of bands) {
      const dogRegular = ruleByKey.get(`${band.id}:Chó:REGULAR`)
      const dogHoliday = ruleByKey.get(`${band.id}:Chó:HOLIDAY`)
      const catRegular = ruleByKey.get(`${band.id}:Mèo:REGULAR`)
      const catHoliday = ruleByKey.get(`${band.id}:Mèo:HOLIDAY`)
      sheet.addRow({
        bandId: band.id,
        label: band.label,
        minWeight: band.minWeight,
        maxWeight: band.maxWeight ?? '',
        dogSku: dogRegular?.sku ?? dogHoliday?.sku ?? '',
        dogRegular: dogRegular?.fullDayPrice ?? '',
        dogHoliday: dogHoliday?.fullDayPrice ?? '',
        catSku: catRegular?.sku ?? catHoliday?.sku ?? '',
        catRegular: catRegular?.fullDayPrice ?? '',
        catHoliday: catHoliday?.fullDayPrice ?? '',
      })
    }

    const decodeSheet = this.addExcelSheet(workbook, HOTEL_SHEETS.decode, [
      { header: 'Khóa', key: 'key', width: 28 },
      { header: 'Giá trị', key: 'value', width: 48 },
      { header: 'Ghi chú', key: 'note', width: 64 },
    ])
    decodeSheet.addRow({ key: 'version', value: PRICING_EXCEL_VERSION, note: 'Không sửa giá trị này' })
    decodeSheet.addRow({ key: 'year', value: year, note: 'Năm áp dụng bảng giá Hotel' })
    decodeSheet.addRow({ key: 'dayType', value: 'REGULAR', note: 'Ngày thường' })
    decodeSheet.addRow({ key: 'dayType', value: 'HOLIDAY', note: 'Ngày lễ' })
    for (const image of hotelImages) {
      decodeSheet.addRow({ key: `hotelImage:${image.species}`, value: image.imageUrl, note: image.label ?? '' })
    }
  }

  async previewPricingExcelImport(input: { mode: PricingExcelMode | string; year?: number; buffer: Buffer }): Promise<PricingExcelPreviewResult> {
    const mode = this.normalizeExcelMode(input.mode)
    const year = Math.floor(Number(input.year ?? new Date().getFullYear()))
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.default.Workbook()
    await workbook.xlsx.load(input.buffer as any)
    const errors: PricingExcelIssue[] = []
    const warnings: PricingExcelIssue[] = []
    const payload = mode === 'GROOMING'
      ? this.parseGroomingPricingWorkbook(workbook, year, errors, warnings)
      : this.parseHotelPricingWorkbook(workbook, year, errors, warnings)
    const normalizedPayload = errors.length > 0 ? null : payload
    const imageCount = normalizedPayload ? normalizedPayload.spaImages.length + normalizedPayload.hotelImages.length : 0
    const ruleCount = normalizedPayload ? normalizedPayload.spaRules.length + normalizedPayload.hotelRules.length : 0
    return {
      errors,
      warnings,
      summary: {
        mode,
        year,
        sheetCount: workbook.worksheets.length,
        bandCount: normalizedPayload?.bands.length ?? 0,
        ruleCount,
        imageCount,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
      normalizedPayload,
      checksum: this.getExcelChecksum(input.buffer),
    }
  }

  private parseGroomingPricingWorkbook(workbook: any, year: number, errors: PricingExcelIssue[], warnings: PricingExcelIssue[]): PricingExcelPayload {
    const bands: PricingExcelBand[] = []
    const spaRules: PricingExcelSpaRule[] = []
    const spaImages: Array<{ species: string | null; packageCode: string; imageUrl: string }> = []
    const seenBandSignatures = new Set<string>()
    const seenOtherSignatures = new Set<string>()

    for (const species of PRICING_EXCEL_SPECIES) {
      const sheetName = species === 'Chó' ? GROOMING_SHEETS.dog : GROOMING_SHEETS.cat
      const sheet = workbook.getWorksheet(sheetName)
      const headers = this.assertExcelHeaders(sheet, sheetName, ['Mã hạng cân', 'Tên hạng cân', 'Từ kg', 'Đến kg'], errors)
      if (!sheet) continue
      const serviceNames = headers
        .filter((header) => header.startsWith('Số tiền - '))
        .map((header) => header.replace('Số tiền - ', '').trim())
        .filter(Boolean)
      for (const serviceName of serviceNames) {
        if (!headers.includes(`Link ảnh - ${serviceName}`)) errors.push({ sheet: sheetName, column: `Link ảnh - ${serviceName}`, message: `Thiếu cột Link ảnh - ${serviceName}` })
        if (!headers.includes(`SKU - ${serviceName}`)) errors.push({ sheet: sheetName, column: `SKU - ${serviceName}`, message: `Thiếu cột SKU - ${serviceName}` })
        if (!headers.includes(`Thời gian - ${serviceName}`)) errors.push({ sheet: sheetName, column: `Thời gian - ${serviceName}`, message: `Thiếu cột Thời gian - ${serviceName}` })
      }
      
      sheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return
        const label = this.excelCellText(this.getExcelCell(row, headers, 'Tên hạng cân'))
        const minWeight = this.excelCellNumber(this.getExcelCell(row, headers, 'Từ kg'))
        if (!label && minWeight === null) return
        const sourceId = this.excelCellText(this.getExcelCell(row, headers, 'Mã hạng cân')) || null
        const maxWeight = this.excelCellNumber(this.getExcelCell(row, headers, 'Đến kg'))
        if (!label) errors.push({ sheet: sheetName, row: rowNumber, column: 'Tên hạng cân', message: 'Tên hạng cân không được trống' })
        if (minWeight === null) errors.push({ sheet: sheetName, row: rowNumber, column: 'Từ kg', message: 'Từ kg không hợp lệ' })
        if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) {
          errors.push({ sheet: sheetName, row: rowNumber, column: 'Đến kg', message: 'Đến kg phải lớn hơn Từ kg' })
        }
        if (!label || minWeight === null) return
        const bandSignature = this.makeBandSignature('GROOMING', species, label, minWeight, maxWeight)
        if (seenBandSignatures.has(bandSignature)) {
          errors.push({ sheet: sheetName, row: rowNumber, message: 'Trùng hạng cân trong cùng loài' })
        }
        seenBandSignatures.add(bandSignature)
        bands.push({ sourceId, species, label, minWeight, maxWeight, sortOrder: bands.filter((band) => band.species === species).length })
        for (const serviceName of serviceNames) {
          const imageUrl = this.excelCellText(this.getExcelCell(row, headers, `Link ảnh - ${serviceName}`))
          if (imageUrl) {
            const imageKey = `${species}:${serviceName}`
            const existingImage = spaImages.find((image) => `${image.species ?? 'NULL'}:${image.packageCode}` === imageKey)
            if (existingImage && existingImage.imageUrl !== imageUrl) {
              warnings.push({ sheet: sheetName, row: rowNumber, column: `Link ảnh - ${serviceName}`, message: 'Phát hiện nhiều link ảnh khác nhau cho cùng dịch vụ, sẽ dùng giá trị ở dòng sau cùng' })
              existingImage.imageUrl = imageUrl
            } else if (!existingImage) {
              spaImages.push({ species, packageCode: serviceName, imageUrl })
            }
          }
          const price = this.excelCellNumber(this.getExcelCell(row, headers, `Số tiền - ${serviceName}`))
          if (price === null) continue
          if (price < 0) {
            errors.push({ sheet: sheetName, row: rowNumber, column: `Số tiền - ${serviceName}`, message: 'Giá phải lớn hơn hoặc bằng 0' })
            continue
          }
          spaRules.push({
            sourceId: null,
            species,
            packageCode: serviceName,
            weightBandSourceId: sourceId,
            bandSignature,
            minWeight: null,
            maxWeight: null,
            sku: this.excelCellText(this.getExcelCell(row, headers, `SKU - ${serviceName}`)) || null,
            price,
            durationMinutes: this.excelCellNumber(this.getExcelCell(row, headers, `Thời gian - ${serviceName}`)),
          })
        }
      })
    }

    const otherSheet = workbook.getWorksheet(GROOMING_SHEETS.other)
    const otherHeaders = this.assertExcelHeaders(otherSheet, GROOMING_SHEETS.other, ['Mã rule', 'SKU', 'Link ảnh', 'Tên dịch vụ', 'Từ kg', 'Đến kg', 'Giá', 'Phút'], errors)
    if (otherSheet) {
      otherSheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return
        const name = this.excelCellText(this.getExcelCell(row, otherHeaders, 'Tên dịch vụ'))
        const price = this.excelCellNumber(this.getExcelCell(row, otherHeaders, 'Giá'))
        if (!name && price === null) return
        const minWeight = this.excelCellNumber(this.getExcelCell(row, otherHeaders, 'Từ kg'))
        const maxWeight = this.excelCellNumber(this.getExcelCell(row, otherHeaders, 'Đến kg'))
        if (!name) errors.push({ sheet: GROOMING_SHEETS.other, row: rowNumber, column: 'Tên dịch vụ', message: 'Tên dịch vụ không được trống' })
        if (price === null || price < 0) errors.push({ sheet: GROOMING_SHEETS.other, row: rowNumber, column: 'Giá', message: 'Giá không hợp lệ' })
        if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) {
          errors.push({ sheet: GROOMING_SHEETS.other, row: rowNumber, column: 'Đến kg', message: 'Đến kg phải lớn hơn Từ kg' })
        }
        if (!name || price === null || price < 0) return
        const signature = `${name.trim().toLocaleLowerCase()}:${minWeight ?? 'NULL'}:${maxWeight ?? 'INF'}`
        if (seenOtherSignatures.has(signature)) errors.push({ sheet: GROOMING_SHEETS.other, row: rowNumber, message: 'Trùng dịch vụ khác cùng khoảng cân' })
        seenOtherSignatures.add(signature)
        spaRules.push({
          sourceId: this.excelCellText(this.getExcelCell(row, otherHeaders, 'Mã rule')) || null,
          species: null,
          packageCode: name,
          weightBandSourceId: null,
          bandSignature: '',
          minWeight,
          maxWeight,
          sku: this.excelCellText(this.getExcelCell(row, otherHeaders, 'SKU')) || null,
          price,
          durationMinutes: this.excelCellNumber(this.getExcelCell(row, otherHeaders, 'Phút')),
        })
        const imageUrl = this.excelCellText(this.getExcelCell(row, otherHeaders, 'Link ảnh'))
        if (imageUrl) spaImages.push({ species: null, packageCode: name, imageUrl })
      })
    }

    if (spaRules.length === 0) warnings.push({ sheet: GROOMING_SHEETS.decode, message: 'File không có dòng giá Grooming nào' })
    const decodeSheet = workbook.getWorksheet(GROOMING_SHEETS.decode)
    const decodeHeaders = this.assertExcelHeaders(decodeSheet, GROOMING_SHEETS.decode, ['Khóa', 'Giá trị', 'Ghi chú'], errors)
    const imageByKey = new Map(spaImages.map((image) => [`${image.species ?? 'NULL'}:${image.packageCode}`, image]))
    for (const row of this.readDecodeRows(decodeSheet, decodeHeaders)) {
      if (!row.key.startsWith('image:') || !row.value) continue
      const [, speciesToken, ...packageParts] = row.key.split(':')
      const packageCode = packageParts.join(':').trim()
      if (!packageCode) continue
      const species: string | null = !speciesToken || speciesToken === 'NULL' ? null : speciesToken
      const imageKey = `${species ?? 'NULL'}:${packageCode}`
      if (imageByKey.has(imageKey)) continue
      imageByKey.set(imageKey, { species, packageCode, imageUrl: row.value })
    }
    return { mode: 'GROOMING', year, bands, spaRules, spaImages: Array.from(imageByKey.values()), hotelRules: [], hotelImages: [] }
  }

  private parseHotelPricingWorkbook(workbook: any, year: number, errors: PricingExcelIssue[], warnings: PricingExcelIssue[]): PricingExcelPayload {
    const bands: PricingExcelBand[] = []
    const hotelRules: PricingExcelHotelRule[] = []
    const seenBandSignatures = new Set<string>()
    const sheet = workbook.getWorksheet(HOTEL_SHEETS.hotel)
    const headers = this.assertExcelHeaders(sheet, HOTEL_SHEETS.hotel, ['Mã hạng cân', 'Hạng cân', 'Từ kg', 'Đến kg', 'Chó - SKU', 'Chó - Ngày thường', 'Chó - Ngày lễ', 'Mèo - SKU', 'Mèo - Ngày thường', 'Mèo - Ngày lễ'], errors)
    if (sheet) {
      sheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return
        const label = this.excelCellText(this.getExcelCell(row, headers, 'Hạng cân'))
        const minWeight = this.excelCellNumber(this.getExcelCell(row, headers, 'Từ kg'))
        if (!label && minWeight === null) return
        const sourceId = this.excelCellText(this.getExcelCell(row, headers, 'Mã hạng cân')) || null
        const maxWeight = this.excelCellNumber(this.getExcelCell(row, headers, 'Đến kg'))
        if (!label) errors.push({ sheet: HOTEL_SHEETS.hotel, row: rowNumber, column: 'Hạng cân', message: 'Hạng cân không được trống' })
        if (minWeight === null) errors.push({ sheet: HOTEL_SHEETS.hotel, row: rowNumber, column: 'Từ kg', message: 'Từ kg không hợp lệ' })
        if (minWeight !== null && maxWeight !== null && maxWeight <= minWeight) errors.push({ sheet: HOTEL_SHEETS.hotel, row: rowNumber, column: 'Đến kg', message: 'Đến kg phải lớn hơn Từ kg' })
        if (!label || minWeight === null) return
        const bandSignature = this.makeBandSignature('HOTEL', null, label, minWeight, maxWeight)
        if (seenBandSignatures.has(bandSignature)) errors.push({ sheet: HOTEL_SHEETS.hotel, row: rowNumber, message: 'Trùng hạng cân Hotel' })
        seenBandSignatures.add(bandSignature)
        bands.push({ sourceId, species: null, label, minWeight, maxWeight, sortOrder: bands.length })
        for (const species of PRICING_EXCEL_SPECIES) {
          const sku = this.excelCellText(this.getExcelCell(row, headers, `${species} - SKU`)) || null
          for (const [dayType, header] of [['REGULAR', `${species} - Ngày thường`], ['HOLIDAY', `${species} - Ngày lễ`]] as const) {
            const fullDayPrice = this.excelCellNumber(this.getExcelCell(row, headers, header))
            if (fullDayPrice === null) continue
            if (fullDayPrice < 0) {
              errors.push({ sheet: HOTEL_SHEETS.hotel, row: rowNumber, column: header, message: 'Giá phải lớn hơn hoặc bằng 0' })
              continue
            }
            hotelRules.push({ sourceId: null, species, dayType, weightBandSourceId: sourceId, bandSignature, sku, fullDayPrice })
          }
        }
      })
    }
    const decodeSheet = workbook.getWorksheet(HOTEL_SHEETS.decode)
    const decodeHeaders = this.assertExcelHeaders(decodeSheet, HOTEL_SHEETS.decode, ['Khóa', 'Giá trị', 'Ghi chú'], errors)
    const hotelImages = this.readDecodeRows(decodeSheet, decodeHeaders).flatMap((row) => {
      if (!row.key.startsWith('hotelImage:') || !row.value) return []
      const species = row.key.replace('hotelImage:', '').trim()
      if (!species) return []
      return [{ species, packageCode: 'HOTEL', imageUrl: row.value, label: row.note || null }]
    })
    if (hotelRules.length === 0) warnings.push({ sheet: HOTEL_SHEETS.hotel, message: 'File không có dòng giá Hotel nào' })
    return { mode: 'HOTEL', year, bands, spaRules: [], spaImages: [], hotelRules, hotelImages }
  }

  async applyPricingExcelImport(input: { mode: PricingExcelMode | string; year?: number; buffer: Buffer }): Promise<PricingExcelPreviewResult & { applied: boolean }> {
    const preview = await this.previewPricingExcelImport(input)
    if (!preview.normalizedPayload || preview.errors.length > 0) {
      throw new BadRequestException('File Excel còn lỗi, cần preview thành công trước khi áp dụng')
    }

    await this.writePricingBackupFile()
    const run = async (tx: any) => {
      if (preview.normalizedPayload!.mode === 'GROOMING') {
        await this.replaceGroomingPricingFromExcel(tx, preview.normalizedPayload!)
      } else {
        await this.replaceHotelPricingFromExcel(tx, preview.normalizedPayload!)
      }
    }

    if (typeof (this.db as any).$transaction === 'function') {
      await (this.db as any).$transaction(run)
    } else {
      await run(this.db)
    }

    return { ...preview, applied: true }
  }

  private async replaceGroomingPricingFromExcel(tx: any, payload: PricingExcelPayload) {
    const bandIdBySource = await this.replacePricingBandsFromExcel(tx, 'GROOMING', payload.bands)
    const existingRules = await tx.spaPriceRule.findMany({ where: { isActive: true } } as any)
    const existingById = new Map(existingRules.map((rule: any) => [rule.id, rule]))
    const existingByCombo = new Map(existingRules.map((rule: any) => [this.getExcelSpaRuleComboKey(rule), rule]))
    const savedRuleIds: string[] = []

    for (const rule of payload.spaRules) {
      const weightBandId = rule.weightBandSourceId
        ? bandIdBySource.get(rule.weightBandSourceId) ?? null
        : rule.bandSignature
          ? bandIdBySource.get(rule.bandSignature) ?? null
          : null
      const data = {
        species: rule.species,
        packageCode: rule.packageCode,
        label: rule.packageCode,
        weightBandId,
        minWeight: weightBandId ? null : rule.minWeight,
        maxWeight: weightBandId ? null : rule.maxWeight,
        sku: rule.sku,
        price: rule.price,
        durationMinutes: rule.durationMinutes,
        isActive: rule.price > 0,
      }
      const comboKey = this.getExcelSpaRuleComboKey(data)
      const current = ((rule.sourceId ? existingById.get(rule.sourceId) : null) ?? existingByCombo.get(comboKey)) as any
      if (rule.price <= 0 && !current) continue
      const saved = current
        ? await tx.spaPriceRule.update({ where: { id: current.id }, data })
        : await tx.spaPriceRule.create({ data })
      if (saved?.id && rule.price > 0) savedRuleIds.push(saved.id)
    }

    await tx.spaPriceRule.updateMany({
      where: { id: { notIn: savedRuleIds }, isActive: true },
      data: { isActive: false },
    })

    if (payload.spaImages.length > 0) {
      await this.saveSpaServiceImagesWithTx(tx, payload.spaImages)
    }
  }

  private async replaceHotelPricingFromExcel(tx: any, payload: PricingExcelPayload) {
    const bandIdBySource = await this.replacePricingBandsFromExcel(tx, 'HOTEL', payload.bands)
    const existingRules = await tx.hotelPriceRule.findMany({ where: { year: payload.year, isActive: true } } as any)
    const existingByCombo = new Map(existingRules.map((rule: any) => [`${rule.year}:${rule.species}:${rule.dayType}:${rule.weightBandId}`, rule]))
    const savedRuleIds: string[] = []

    for (const rule of payload.hotelRules) {
      const weightBandId = (rule.weightBandSourceId ? bandIdBySource.get(rule.weightBandSourceId) : null)
        ?? bandIdBySource.get(rule.bandSignature)
      if (!weightBandId) continue
      const data = {
        year: payload.year,
        species: rule.species,
        branchId: null,
        weightBandId,
        dayType: rule.dayType,
        sku: rule.sku,
        halfDayPrice: this.deriveHalfDayPrice(rule.fullDayPrice),
        fullDayPrice: rule.fullDayPrice,
        isActive: rule.fullDayPrice > 0,
      }
      const current = existingByCombo.get(`${payload.year}:${rule.species}:${rule.dayType}:${weightBandId}`) as any
      if (rule.fullDayPrice <= 0 && !current) continue
      const saved = current
        ? await tx.hotelPriceRule.update({ where: { id: current.id }, data })
        : await tx.hotelPriceRule.create({ data })
      if (saved?.id && rule.fullDayPrice > 0) savedRuleIds.push(saved.id)
    }

    await tx.hotelPriceRule.updateMany({
      where: { year: payload.year, id: { notIn: savedRuleIds }, isActive: true },
      data: { isActive: false },
    })

    if (payload.hotelImages.length > 0) {
      await this.saveHotelServiceImagesWithTx(tx, payload.hotelImages)
    }
  }

  private async replacePricingBandsFromExcel(tx: any, serviceType: PricingServiceType, bands: PricingExcelBand[]) {
    const existingBands = await tx.serviceWeightBand.findMany({ where: { serviceType, isActive: true } } as any)
    const existingById = new Map(existingBands.map((band: any) => [band.id, band]))
    const existingBySignature = new Map(existingBands.map((band: any) => [
      this.makeBandSignature(serviceType, band.species ?? null, band.label, band.minWeight, band.maxWeight ?? null),
      band,
    ]))
    const idBySource = new Map<string, string>()
    const savedIds: string[] = []

    for (const band of bands) {
      const signature = this.makeBandSignature(serviceType, band.species, band.label, band.minWeight, band.maxWeight)
      const current = ((band.sourceId ? existingById.get(band.sourceId) : null) ?? existingBySignature.get(signature)) as any
      const data = {
        serviceType,
        species: band.species,
        label: band.label,
        minWeight: band.minWeight,
        maxWeight: band.maxWeight,
        sortOrder: band.sortOrder,
        isActive: true,
      }
      const saved = current
        ? await tx.serviceWeightBand.update({ where: { id: current.id }, data })
        : await tx.serviceWeightBand.create({ data })
      savedIds.push(saved.id)
      if (band.sourceId) idBySource.set(band.sourceId, saved.id)
      idBySource.set(signature, saved.id)
    }

    await tx.serviceWeightBand.updateMany({
      where: { serviceType, id: { notIn: savedIds }, isActive: true },
      data: { isActive: false },
    })
    return idBySource
  }

  private getExcelSpaRuleComboKey(rule: { species?: string | null; packageCode: string; weightBandId?: string | null; minWeight?: number | null; maxWeight?: number | null }) {
    if (rule.weightBandId) return `${rule.species ?? 'NULL'}:${rule.packageCode}:${rule.weightBandId}`
    return `${rule.species ?? 'NULL'}:${rule.packageCode}:${rule.minWeight ?? 'NULL'}:${rule.maxWeight ?? 'INF'}`
  }

  private async saveSpaServiceImagesWithTx(tx: any, images: Array<{ species: string | null; packageCode: string; imageUrl: string }>) {
    const payload = JSON.stringify(images)
    const existing = await tx.systemConfig.findFirst({ select: { id: true } })
    if (existing) {
      await tx.systemConfig.update({ where: { id: existing.id }, data: { spaServiceImages: payload } })
    } else {
      await tx.systemConfig.create({ data: { spaServiceImages: payload } })
    }
  }

  private async saveHotelServiceImagesWithTx(tx: any, images: Array<{ species: string; packageCode: string; imageUrl: string; label?: string | null }>) {
    const payload = JSON.stringify(images.map((image) => ({
      species: image.species,
      packageCode: image.packageCode || 'HOTEL',
      imageUrl: image.imageUrl,
      ...(image.label ? { label: image.label } : {}),
    })))
    if (typeof tx.$executeRawUnsafe === 'function' && typeof tx.$queryRawUnsafe === 'function') {
      await tx.$executeRawUnsafe(`ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS "hotelServiceImages" TEXT`)
      const rows = await tx.$queryRawUnsafe(`SELECT id FROM system_configs ORDER BY "updatedAt" DESC LIMIT 1`) as Array<{ id: string }>
      const existing = rows[0]
      if (existing) {
        await tx.$executeRawUnsafe(
          `UPDATE system_configs SET "hotelServiceImages" = $1, "updatedAt" = NOW() WHERE id = $2`,
          payload,
          existing.id,
        )
      } else {
        await tx.$executeRawUnsafe(
          `INSERT INTO system_configs (id, "hotelServiceImages", "updatedAt") VALUES ($1, $2, NOW())`,
          randomUUID(),
          payload,
        )
      }
      return
    }
    const existing = await tx.systemConfig.findFirst({ select: { id: true } })
    if (existing) {
      await tx.systemConfig.update({ where: { id: existing.id }, data: { hotelServiceImages: payload } })
    } else {
      await tx.systemConfig.create({ data: { hotelServiceImages: payload } })
    }
  }

}
