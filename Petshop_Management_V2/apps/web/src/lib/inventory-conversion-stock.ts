import {
  getProductVariantGroupKey,
  getProductVariantOptionLabel,
  parseVariantConversionUnit,
  resolveProductVariantLabels,
} from '@petshop/shared'

type BranchRef = {
  id?: string | null
  name?: string | null
}

export type BranchStockLike = {
  id?: string | null
  branchId?: string | null
  productVariantId?: string | null
  stock?: number | null
  reservedStock?: number | null
  minStock?: number | null
  availableStock?: number | null
  incomingStock?: number | null
  incoming?: number | null
  onTheWay?: number | null
  branch?: BranchRef | null
}

export type VariantLike = {
  id: string
  name?: string | null
  sku?: string | null
  variantLabel?: string | null
  unitLabel?: string | null
  conversions?: string | null
  branchStocks?: BranchStockLike[] | null
}

export type ProductLike = {
  name?: string | null
  branchStocks?: BranchStockLike[] | null
  variants?: VariantLike[] | null
}

export type VariantGroupTree<TVariant extends VariantLike = VariantLike> = {
  item: TVariant
  children: TVariant[]
}

const NUMERIC_FIELDS = [
  'stock',
  'reservedStock',
  'minStock',
  'availableStock',
  'incomingStock',
  'incoming',
  'onTheWay',
] as const

function toNumber(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function getBranchKey(row: BranchStockLike, index: number) {
  return (
    row.branch?.id ??
    row.branchId ??
    row.branch?.name ??
    row.id ??
    `branch-${index}`
  )
}

function cloneScaledBranchStocks(
  rows: BranchStockLike[],
  factor: number,
  options: { resetMinStock?: boolean } = {},
) {
  const { resetMinStock = true } = options

  return rows.map((row) => {
    const next = { ...row }

    for (const field of NUMERIC_FIELDS) {
      if (next[field] === undefined || next[field] === null) continue
      const scaledValue = toNumber(next[field]) * factor
      next[field] = field === 'minStock' && resetMinStock ? 0 : scaledValue
    }

    return next
  })
}

export function parseConversionRate(raw?: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.rate ?? parsed?.conversionRate ?? parsed?.mainQty)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function parseConversionSourceSku(raw?: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const sourceSku = `${parsed?.sourceSku ?? ''}`.trim()
    return sourceSku.length > 0 ? sourceSku : null
  } catch {
    return null
  }
}

export function isConversionVariant(variant?: VariantLike | null) {
  return !!parseConversionRate(variant?.conversions)
}

export function getTrueVariants<TVariant extends VariantLike>(variants?: TVariant[] | null): TVariant[] {
  return (variants ?? []).filter((variant) => !isConversionVariant(variant))
}

function getEquivalentVariantGroupKeys(
  productName?: string | null,
  variant?: VariantLike | null,
) {
  const groupKey = getProductVariantGroupKey(productName, variant)
  const normalizedProductKey = `${productName ?? ''}`.trim().toLowerCase()
  const keys = new Set<string>([groupKey])

  if (!normalizedProductKey) {
    return keys
  }

  if (groupKey === '__base__') {
    keys.add(normalizedProductKey)
  } else if (groupKey === normalizedProductKey) {
    keys.add('__base__')
  }

  return keys
}

export function findParentTrueVariant<TVariant extends VariantLike>(
  variants: TVariant[],
  selectedVariant?: TVariant | null,
  productName?: string | null,
): TVariant | null {
  if (!selectedVariant) return null
  if (!isConversionVariant(selectedVariant)) return selectedVariant

  const trueVariants = getTrueVariants(variants)
  const sourceSku = parseConversionSourceSku(selectedVariant.conversions)
  if (sourceSku) {
    const sourceMatch = trueVariants.find((variant) => `${variant.sku ?? ''}`.trim() === sourceSku)
    if (sourceMatch) return sourceMatch
  }

  const selectedGroupKeys = getEquivalentVariantGroupKeys(productName, selectedVariant)
  return trueVariants.find((variant) => selectedGroupKeys.has(getProductVariantGroupKey(productName, variant))) ?? null
}

export function getConversionVariants<TVariant extends VariantLike>(
  variants: TVariant[],
  currentTrueVariant?: TVariant | null,
  productName?: string | null,
): TVariant[] {
  const allConversions = (variants ?? []).filter((variant) => isConversionVariant(variant))
  const directSourceMatches = currentTrueVariant?.sku
    ? allConversions.filter((variant) => parseConversionSourceSku(variant.conversions) === currentTrueVariant.sku)
    : []
  const targetGroupKeys = currentTrueVariant
    ? getEquivalentVariantGroupKeys(productName, currentTrueVariant)
    : new Set<string>(['__base__', `${productName ?? ''}`.trim().toLowerCase()].filter(Boolean))

  const legacyMatches = allConversions.filter((variant) => {
    const sourceSku = parseConversionSourceSku(variant.conversions)
    if (sourceSku && currentTrueVariant?.sku && sourceSku !== currentTrueVariant.sku) return false
    return targetGroupKeys.has(getProductVariantGroupKey(productName, variant))
  })

  return Array.from(new Map([...directSourceMatches, ...legacyMatches].map((variant) => [variant.id, variant])).values())
}

export function groupVariantsWithConversions<TVariant extends VariantLike>(
  variants?: TVariant[] | null,
  productName?: string | null,
) {
  const allVariants = variants ?? []
  const trueVariants = getTrueVariants(allVariants)
  const conversionVariants = allVariants.filter((variant) => isConversionVariant(variant))
  const usedConversionIds = new Set<string>()

  const groups: VariantGroupTree<TVariant>[] = trueVariants.map((item) => {
    const children = getConversionVariants(allVariants, item, productName)
    children.forEach((child) => usedConversionIds.add(child.id))
    return { item, children }
  })

  return {
    groups,
    looseConversions: conversionVariants.filter((item) => !usedConversionIds.has(item.id)),
    totalItems: trueVariants.length + conversionVariants.length,
  }
}

export function normalizeBranchStocks(rows?: BranchStockLike[] | null) {
  return Array.isArray(rows) ? rows : []
}

export function aggregateBranchStocks(rows: BranchStockLike[]) {
  const grouped = new Map<string, BranchStockLike>()

  rows.forEach((row, index) => {
    const key = getBranchKey(row, index)
    const existing = grouped.get(key)

    if (existing) {
      for (const field of NUMERIC_FIELDS) {
        existing[field] = toNumber(existing[field]) + toNumber(row[field])
      }
      return
    }

    const seeded = { ...row }
    seeded.id = row.id ?? key
    for (const field of NUMERIC_FIELDS) {
      if (seeded[field] === undefined || seeded[field] === null) continue
      seeded[field] = toNumber(seeded[field])
    }
    grouped.set(key, seeded)
  })

  return Array.from(grouped.values())
}

export function sumBranchStockRows(
  rows: BranchStockLike[] | undefined | null,
  field: 'stock' | 'reservedStock' | 'minStock' | 'availableStock' = 'stock',
): number {
  return normalizeBranchStocks(rows).reduce((sum, row) => sum + toNumber(row[field]), 0)
}

export function getDisplayBranchStocks(
  product: ProductLike,
  targetVariantId?: string | null,
): BranchStockLike[] {
  const variants = product.variants ?? []
  const productRows = normalizeBranchStocks(product.branchStocks).filter((row) => !row.productVariantId)

  if (targetVariantId) {
    const variant = variants.find((item) => item.id === targetVariantId) ?? null
    if (!variant) return []

    if (isConversionVariant(variant)) {
      const rate = parseConversionRate(variant.conversions) ?? 1
      const parentVariant = findParentTrueVariant(variants, variant, product.name)
      const parentRows = parentVariant
        ? normalizeBranchStocks(parentVariant.branchStocks)
        : productRows
      const parentRowsInConversionUnit = cloneScaledBranchStocks(parentRows, 1 / rate, {
        resetMinStock: false,
      })

      return aggregateBranchStocks(parentRowsInConversionUnit)
    }

    return aggregateBranchStocks(normalizeBranchStocks(variant.branchStocks))
  }

  const trueVariants = getTrueVariants(variants)
  if (trueVariants.length > 0) {
    return aggregateBranchStocks(
      trueVariants.flatMap((variant) => getDisplayBranchStocks(product, variant.id)),
    )
  }

  return aggregateBranchStocks(productRows)
}

export function getResolvedVariantLabels(productName?: string | null, variant?: VariantLike | null) {
  return resolveProductVariantLabels(productName, variant)
}

export function getVariantDisplayName(productName?: string | null, variant?: VariantLike | null) {
  return resolveProductVariantLabels(productName, variant).displayName || `${productName ?? ''}`.trim()
}

export function getVariantOptionLabel(productName?: string | null, variant?: VariantLike | null) {
  return getProductVariantOptionLabel(productName, variant)
}

export function getVariantConversionUnit(variant?: VariantLike | null) {
  return parseVariantConversionUnit(variant?.conversions)
}
