import type {
  HotelDaycarePriceRule,
  HotelExtraService,
  HotelPriceRule,
  ServiceWeightBand,
} from '@/lib/api/pricing.api'
import { HOTEL_SPECIES_COLUMNS, SPECIES_OPTIONS } from '../shared/pricing-constants'
import {
  buildServicePricingSku,
  getHotelBandGroupKey,
  getHotelRuleKey,
  mapHotelExtraServiceToDraft,
  parseWeightInput,
} from '../shared/pricing-helpers'
import type { BandDraft, HotelDaycareDraft, HotelDraft, HotelExtraServiceDraft } from '../shared/pricing-types'
import { formatCurrencyInput } from '../service-pricing-format'

export function getCanonicalHotelBands(rawBands: ServiceWeightBand[]) {
  const grouped = new Map<string, ServiceWeightBand[]>()
  for (const band of rawBands) {
    const key = getHotelBandGroupKey(band)
    grouped.set(key, [...(grouped.get(key) ?? []), band])
  }

  return Array.from(grouped.values())
    .map((group) =>
      [...group].sort((left, right) => {
        const leftPriority = left.species === null ? 0 : left.species === SPECIES_OPTIONS[0].value ? 1 : 2
        const rightPriority = right.species === null ? 0 : right.species === SPECIES_OPTIONS[0].value ? 1 : 2
        if (leftPriority !== rightPriority) return leftPriority - rightPriority
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
        return left.minWeight - right.minWeight
      })[0]!,
    )
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
      return left.minWeight - right.minWeight
    })
}

export function buildHotelBandIdMap(rawBands: ServiceWeightBand[], bands: ServiceWeightBand[]) {
  const next = new Map<string, string>()
  const representativeByGroup = new Map<string, string>()

  for (const band of bands) representativeByGroup.set(getHotelBandGroupKey(band), band.id)
  for (const band of rawBands) {
    const representativeId = representativeByGroup.get(getHotelBandGroupKey(band))
    if (representativeId) next.set(band.id, representativeId)
  }

  return next
}

export function hydrateHotelDrafts(
  bands: ServiceWeightBand[],
  hotelRules: HotelPriceRule[],
  hotelBandIdMap: Map<string, string>,
) {
  const nextDrafts: Record<string, HotelDraft> = {}
  const sortedRules = [...hotelRules].sort((left, right) => {
    const leftSpeciesPriority = left.species?.trim() ? 1 : 0
    const rightSpeciesPriority = right.species?.trim() ? 1 : 0
    return leftSpeciesPriority - rightSpeciesPriority
  })

  for (const rule of sortedRules) {
    const representativeBandId = hotelBandIdMap.get(rule.weightBandId) ?? rule.weightBandId
    const ruleSpecies = rule.species?.trim()
    const draftValue = {
      id: rule.id,
      sku: rule.sku ?? '',
      fullDayPrice: formatCurrencyInput(rule.fullDayPrice),
    }

    if (!ruleSpecies) {
      for (const speciesOption of HOTEL_SPECIES_COLUMNS) {
        nextDrafts[getHotelRuleKey(representativeBandId, rule.dayType, speciesOption.value)] = {
          id: undefined,
          sku: '',
          fullDayPrice: draftValue.fullDayPrice,
        }
      }
      continue
    }

    nextDrafts[getHotelRuleKey(representativeBandId, rule.dayType, ruleSpecies)] = draftValue
  }
  return nextDrafts
}

export function hydrateHotelExtraServiceDrafts(services: HotelExtraService[]) {
  return services.map((service) => mapHotelExtraServiceToDraft(service))
}

export function getHotelDaycareRuleKey(bandKey: string, species: string) {
  return `${bandKey}:DAYCARE:${species}`
}

export function hydrateHotelDaycareDrafts(
  bands: ServiceWeightBand[],
  daycareRules: HotelDaycarePriceRule[],
  hotelBandIdMap: Map<string, string>,
) {
  const nextDrafts: Record<string, HotelDaycareDraft> = {}

  for (const rule of daycareRules) {
    const representativeBandId = hotelBandIdMap.get(rule.weightBandId) ?? rule.weightBandId
    const ruleSpecies = rule.species?.trim()
    if (!ruleSpecies) continue

    nextDrafts[getHotelDaycareRuleKey(representativeBandId, ruleSpecies)] = {
      id: rule.id,
      sku: rule.sku ?? '',
      price: formatCurrencyInput(rule.price),
    }
  }

  for (const band of bands) {
    for (const speciesOption of HOTEL_SPECIES_COLUMNS) {
      const key = getHotelDaycareRuleKey(band.id, speciesOption.value)
      if (nextDrafts[key]) continue
      nextDrafts[key] = { sku: '', price: '' }
    }
  }

  return nextDrafts
}

export function fillEmptyHotelSkus(
  bandDrafts: BandDraft[],
  hotelDrafts: Record<string, HotelDraft>,
  hotelDaycareDrafts: Record<string, HotelDaycareDraft>,
  hotelExtraServiceDrafts: HotelExtraServiceDraft[],
) {
  let filledCount = 0
  const nextHotelDrafts = { ...hotelDrafts }
  const nextHotelDaycareDrafts = { ...hotelDaycareDrafts }

  for (const band of bandDrafts) {
    const minWeight = parseWeightInput(band.minWeight)
    const maxWeight = parseWeightInput(band.maxWeight)
    if (!band.label.trim() || minWeight === null) continue

    for (const speciesOption of HOTEL_SPECIES_COLUMNS) {
      const generatedSku = buildServicePricingSku('HOTEL', speciesOption.value, band.label, speciesOption.value, minWeight, maxWeight)
      const regularKey = getHotelRuleKey(band.key, 'REGULAR', speciesOption.value)
      const holidayKey = getHotelRuleKey(band.key, 'HOLIDAY', speciesOption.value)
      const regularDraft = nextHotelDrafts[regularKey] ?? { sku: '', fullDayPrice: '' }
      const holidayDraft = nextHotelDrafts[holidayKey] ?? { sku: '', fullDayPrice: '' }
      const pairedSpecies = HOTEL_SPECIES_COLUMNS.find((option) => option.value !== speciesOption.value)?.value
      const pairedRegularDraft = pairedSpecies ? nextHotelDrafts[getHotelRuleKey(band.key, 'REGULAR', pairedSpecies)] : undefined
      const pairedHolidayDraft = pairedSpecies ? nextHotelDrafts[getHotelRuleKey(band.key, 'HOLIDAY', pairedSpecies)] : undefined
      const fallbackPrice = regularDraft.fullDayPrice
        || holidayDraft.fullDayPrice
        || pairedRegularDraft?.fullDayPrice
        || pairedHolidayDraft?.fullDayPrice
        || ''

      if (regularDraft.sku.trim() || holidayDraft.sku.trim()) continue

      nextHotelDrafts[regularKey] = { ...regularDraft, fullDayPrice: regularDraft.fullDayPrice || fallbackPrice, sku: generatedSku }
      nextHotelDrafts[holidayKey] = { ...holidayDraft, fullDayPrice: holidayDraft.fullDayPrice || fallbackPrice, sku: generatedSku }
      filledCount += 1

      const daycareKey = getHotelDaycareRuleKey(band.key, speciesOption.value)
      const daycareDraft = nextHotelDaycareDrafts[daycareKey] ?? { sku: '', price: '' }
      if (!daycareDraft.sku.trim()) {
        nextHotelDaycareDrafts[daycareKey] = {
          ...daycareDraft,
          sku: `${generatedSku}-NT`,
        }
        filledCount += 1
      }
    }
  }

  const nextHotelExtraDrafts = hotelExtraServiceDrafts.map((draft) => {
    if (draft.sku.trim() || !draft.name.trim()) return draft
    filledCount += 1
    return {
      ...draft,
      sku: buildServicePricingSku(
        'SPA',
        draft.name.trim(),
        undefined,
        undefined,
        parseWeightInput(draft.minWeight),
        parseWeightInput(draft.maxWeight),
      ),
    }
  })

  return {
    hotelDrafts: nextHotelDrafts,
    hotelDaycareDrafts: nextHotelDaycareDrafts,
    hotelExtraServiceDrafts: nextHotelExtraDrafts,
    filledCount,
  }
}
