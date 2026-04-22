import type { SpaPriceRule } from '@/lib/api/pricing.api'
import { SPA_PACKAGES } from '../shared/pricing-constants'
import {
  buildServicePricingSku,
  getSpaRuleKey,
  mapSpaFlatRateRuleToDraft,
  parseWeightInput,
} from '../shared/pricing-helpers'
import type {
  BandDraft,
  FlatRateDraft,
  SpaDraft,
  SpaServiceColumn,
} from '../shared/pricing-types'
import { formatCurrencyInput, formatIntegerInput } from '../service-pricing-format'

export function buildSpaServiceColumns(packageCodes: string[]): SpaServiceColumn[] {
  const seen = new Set<string>()
  const columns: SpaServiceColumn[] = []
  for (const packageCode of packageCodes) {
    const normalized = String(packageCode ?? '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    columns.push({ key: normalized, packageCode: normalized })
  }
  return columns
}

function getRuleSpecies(rule: SpaPriceRule) {
  return rule.species?.trim() || rule.weightBand?.species?.trim() || null
}

function getFlatRateRuleKey(rule: SpaPriceRule) {
  return `${rule.packageCode.trim().toLowerCase()}:${rule.minWeight ?? 'NULL'}:${rule.maxWeight ?? 'INF'}`
}

export function createGroomingPricingState(spaRules: SpaPriceRule[], species: string) {
  const weightBandedRules = spaRules.filter((rule) => rule.weightBandId && getRuleSpecies(rule) === species)
  const sourcePackageCodes = weightBandedRules.length > 0
    ? weightBandedRules.map((rule) => rule.packageCode)
    : SPA_PACKAGES.map((pkg) => pkg.code)
  const serviceColumns = buildSpaServiceColumns(sourcePackageCodes)
  const serviceKeyByCode = new Map(serviceColumns.map((column) => [column.packageCode, column.key]))
  const spaDrafts: Record<string, SpaDraft> = {}

  for (const rule of weightBandedRules) {
    const serviceKey = serviceKeyByCode.get(rule.packageCode)
    if (!serviceKey || !rule.weightBandId) continue
    spaDrafts[getSpaRuleKey(rule.weightBandId, serviceKey)] = {
      id: rule.id,
      sku: rule.sku ?? '',
      price: formatCurrencyInput(rule.price),
      durationMinutes: formatIntegerInput(rule.durationMinutes),
    }
  }

  const flatRateDrafts = Array.from(
    spaRules
      .filter((rule) => !rule.weightBandId)
      .sort((left, right) => {
        const leftSpecies = getRuleSpecies(left)
        const rightSpecies = getRuleSpecies(right)
        const leftPriority = leftSpecies === null ? 0 : leftSpecies === species ? 1 : 2
        const rightPriority = rightSpecies === null ? 0 : rightSpecies === species ? 1 : 2
        if (leftPriority !== rightPriority) return leftPriority - rightPriority
        return String(leftSpecies ?? '').localeCompare(String(rightSpecies ?? ''))
      })
      .reduce((map, rule) => {
        const key = getFlatRateRuleKey(rule)
        if (!map.has(key)) map.set(key, rule)
        return map
      }, new Map<string, SpaPriceRule>())
      .values(),
  )
    .sort((left, right) => {
      const leftMinWeight = left.minWeight ?? -1
      const rightMinWeight = right.minWeight ?? -1
      if (leftMinWeight !== rightMinWeight) return leftMinWeight - rightMinWeight
      return left.packageCode.localeCompare(right.packageCode)
    })
    .map((rule) => mapSpaFlatRateRuleToDraft(rule))

  return {
    serviceColumns,
    spaDrafts,
    flatRateDrafts,
  }
}

export function fillEmptyGroomingSkus(
  bandDrafts: BandDraft[],
  spaServiceColumns: SpaServiceColumn[],
  spaDrafts: Record<string, SpaDraft>,
  flatRateDrafts: FlatRateDraft[],
) {
  let filledCount = 0
  const nextSpaDrafts = { ...spaDrafts }

  for (const band of bandDrafts) {
    const minWeight = parseWeightInput(band.minWeight)
    const maxWeight = parseWeightInput(band.maxWeight)
    if (!band.label.trim() || minWeight === null) continue

    for (const column of spaServiceColumns) {
      const packageCode = column.packageCode.trim()
      if (!packageCode) continue
      const key = getSpaRuleKey(band.key, column.key)
      const existing = nextSpaDrafts[key] || { sku: '', price: '', durationMinutes: '' }
      if (existing.sku.trim()) continue
      nextSpaDrafts[key] = {
        ...existing,
        sku: buildServicePricingSku('SPA', packageCode, band.label, undefined, minWeight, maxWeight),
      }
      filledCount += 1
    }
  }

  const nextFlatRateDrafts = flatRateDrafts.map((draft) => {
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
    spaDrafts: nextSpaDrafts,
    flatRateDrafts: nextFlatRateDrafts,
    filledCount,
  }
}
