import type {
  HolidayCalendarDate,
  ServiceWeightBand,
} from '@/lib/api/pricing.api'
import { SPA_PACKAGES } from './pricing-constants'
import type { BandDraft, HolidayDraft, HotelExtraServiceDraft } from './pricing-types'
import { formatCurrencyInput, formatIntegerInput, formatWeightInput } from '../service-pricing-format'

export function normalizeSkuText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function resolveSkuDisplayName(kind: 'HOTEL' | 'SPA', label: string, species?: string | null) {
  if (kind === 'HOTEL') return `Hotel ${species ?? label}`.trim()
  const normalized = normalizeSkuText(label).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const matchedPackage = SPA_PACKAGES.find(
    (pkg) => normalizeSkuText(pkg.code).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') === normalized,
  )
  return matchedPackage?.label ?? label
}

function getWeightBandSkuSuffix(
  label?: string | null,
  minWeight?: number | string | null,
  maxWeight?: number | string | null,
) {
  const stringifyWeight = (value?: number | string | null) => {
    if (value === null || value === undefined || String(value).trim() === '') return ''
    return String(value).replace(/[^0-9]/g, '')
  }

  const minSuffix = stringifyWeight(minWeight)
  const maxSuffix = stringifyWeight(maxWeight)
  if (minSuffix || maxSuffix) return `${minSuffix}${maxSuffix}`

  const numbers = String(label ?? '').match(/\d+(?:[.,]\d+)?/g)
  return numbers?.map((value) => value.replace(/[.,]/g, '')).join('') ?? ''
}

function getSkuInitials(value?: string | null) {
  return normalizeSkuText(value)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
}

function getSpeciesSkuPrefix(species?: string | null) {
  const normalized = normalizeSkuText(species)
  if (normalized === 'CHO' || normalized === 'DOG') return 'C'
  if (normalized === 'MEO' || normalized === 'CAT') return 'M'
  return ''
}

export function buildServicePricingSku(
  kind: 'HOTEL' | 'SPA',
  label: string,
  weightBandLabel?: string | null,
  species?: string | null,
  minWeight?: number | string | null,
  maxWeight?: number | string | null,
) {
  const prefix = getSkuInitials(resolveSkuDisplayName(kind, label, species)) || (kind === 'HOTEL' ? 'HT' : 'SKU')
  return `${getSpeciesSkuPrefix(species)}${prefix}${getWeightBandSkuSuffix(weightBandLabel, minWeight, maxWeight)}`
}

export function normalizeCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(digits))
}

export function deriveHalfDayPrice(fullDayPrice: number | null | undefined) {
  return fullDayPrice === null || fullDayPrice === undefined ? null : Math.round(fullDayPrice / 2)
}

export function parseWeightInput(value: string) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function parseCurrencyInput(value: string) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  const numberValue = Number(digits)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function parseIntegerInput(value: string) {
  const normalized = String(value ?? '').replace(/[^\d-]/g, '')
  if (!normalized) return null
  const numberValue = Number(normalized)
  return Number.isFinite(numberValue) ? Math.round(numberValue) : null
}

export function toDateInputValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 10)
}

export function formatHolidayRange(holiday: HolidayCalendarDate) {
  const start = new Date(holiday.date).toLocaleDateString('vi-VN')
  const end = holiday.endDate ? new Date(holiday.endDate).toLocaleDateString('vi-VN') : start
  return start === end ? start : `${start} - ${end}`
}

export function parseDateInputValue(value: string) {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  return new Date(year, Math.max(0, (month ?? 1) - 1), day ?? 1)
}

export function getMonthTitle(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}

export function createHolidayDraft(baseDate = new Date()): HolidayDraft {
  const normalizedDate = toDateInputValue(baseDate)
  return {
    startDate: normalizedDate,
    endDate: normalizedDate,
    name: '',
    isRecurring: true,
  }
}

export function getHolidayDraftFromCalendarDate(holiday: HolidayCalendarDate): HolidayDraft {
  const startDate = toDateInputValue(new Date(holiday.date))
  const endDate = holiday.endDate ? toDateInputValue(new Date(holiday.endDate)) : startDate
  return {
    startDate,
    endDate,
    name: holiday.name,
    isRecurring: holiday.isRecurring,
  }
}

export function createDraftKey(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function getSpaRuleKey(bandKey: string, serviceKey: string) {
  return `${bandKey}:${serviceKey}`
}

export function getHotelRuleKey(weightBandId: string, dayType: string, species = '') {
  return `${weightBandId}:${dayType}:${species}`
}

export function getHotelBandGroupKey(band: Pick<ServiceWeightBand, 'label' | 'minWeight' | 'maxWeight'>) {
  return `${band.label}:${band.minWeight}:${band.maxWeight ?? 'INF'}`
}

export function getSpaFlatRuleMatchKey(name: string, minWeight: number | null, maxWeight: number | null) {
  return `${name.trim().toLocaleLowerCase()}:${minWeight ?? 'NULL'}:${maxWeight ?? 'INF'}`
}

export function createHotelExtraServiceDraft(base?: Partial<HotelExtraServiceDraft>): HotelExtraServiceDraft {
  return {
    key: base?.key ?? createDraftKey('hotel-extra'),
    sku: base?.sku ?? '',
    imageUrl: base?.imageUrl ?? null,
    name: base?.name ?? '',
    minWeight: base?.minWeight ?? '',
    maxWeight: base?.maxWeight ?? '',
    price: base?.price ?? '',
  }
}

export function hasHotelExtraServiceContent(draft: HotelExtraServiceDraft) {
  return Boolean(
    draft.sku.trim()
    || draft.name.trim()
    || draft.minWeight.trim()
    || draft.maxWeight.trim()
    || draft.price.trim(),
  )
}

export function buildBandDraft(band: ServiceWeightBand): BandDraft {
  return {
    key: band.id,
    id: band.id,
    label: band.label,
    minWeight: formatWeightInput(band.minWeight),
    maxWeight: formatWeightInput(band.maxWeight),
    sortOrder: String(band.sortOrder ?? 0),
  }
}

export function mapWeightBandToDraft(band: ServiceWeightBand) {
  return buildBandDraft(band)
}

export function mapHotelExtraServiceToDraft(service: {
  sku?: string | null
  imageUrl?: string | null
  name: string
  minWeight?: number | null
  maxWeight?: number | null
  price: number
}) {
  return createHotelExtraServiceDraft({
    sku: service.sku ?? '',
    imageUrl: service.imageUrl ?? null,
    name: service.name,
    minWeight: formatWeightInput(service.minWeight),
    maxWeight: formatWeightInput(service.maxWeight),
    price: formatCurrencyInput(service.price),
  })
}

export function mapSpaFlatRateRuleToDraft(rule: {
  id: string
  sku?: string | null
  imageUrl?: string | null
  packageCode: string
  minWeight?: number | null
  maxWeight?: number | null
  price: number
  durationMinutes: number | null
}) {
  return {
    key: rule.id,
    id: rule.id,
    sku: rule.sku ?? '',
    imageUrl: rule.imageUrl ?? null,
    name: rule.packageCode,
    minWeight: formatWeightInput(rule.minWeight),
    maxWeight: formatWeightInput(rule.maxWeight),
    price: formatCurrencyInput(rule.price),
    durationMinutes: formatIntegerInput(rule.durationMinutes),
  }
}
