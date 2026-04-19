import type { CartItem, CustomerPricingProfile, PriceBookPriceMap } from '@petshop/shared'

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parsePriceBookPrices(raw?: unknown): PriceBookPriceMap {
  if (!raw) return {}

  const source =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            return {}
          }
        })()
      : raw

  if (!source || typeof source !== 'object') return {}

  return Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .map(([priceBookId, value]) => [priceBookId, Math.max(0, toFiniteNumber(value))])
      .filter(([, value]) => Number.isFinite(value)),
  )
}

export function normalizeCustomerPricingProfile(
  profile?: CustomerPricingProfile | null,
): CustomerPricingProfile | null {
  if (!profile) return null

  const groupId = profile.groupId?.trim() || undefined
  const groupName = profile.groupName?.trim() || undefined
  const groupColor = profile.groupColor?.trim() || undefined
  const priceBookId = profile.priceBookId?.trim() || undefined
  const priceBookName = profile.priceBookName?.trim() || undefined
  const discountRate = Math.min(100, Math.max(0, toFiniteNumber(profile.discountRate)))

  if (!groupId && !groupName && !priceBookId && !priceBookName && discountRate <= 0) {
    return null
  }

  return {
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
    ...(groupColor ? { groupColor } : {}),
    ...(priceBookId ? { priceBookId } : {}),
    ...(priceBookName ? { priceBookName } : {}),
    ...(discountRate > 0 ? { discountRate } : {}),
  }
}

export function resolvePriceBookUnitPrice(
  basePrice: unknown,
  rawPriceBookPrices?: unknown,
  priceBookId?: string | null,
): number {
  const normalizedBasePrice = Math.max(0, toFiniteNumber(basePrice))
  if (!priceBookId) return normalizedBasePrice

  const priceBookPrices = parsePriceBookPrices(rawPriceBookPrices)
  const matchedPrice = priceBookPrices[priceBookId]
  return Number.isFinite(matchedPrice) && matchedPrice > 0 ? matchedPrice : normalizedBasePrice
}

export function calculateProductPromotion(unitPrice: unknown, discountRate?: unknown) {
  const normalizedUnitPrice = Math.max(0, toFiniteNumber(unitPrice))
  const normalizedDiscountRate = Math.min(100, Math.max(0, toFiniteNumber(discountRate)))
  if (normalizedUnitPrice <= 0 || normalizedDiscountRate <= 0) return 0
  return Math.round((normalizedUnitPrice * normalizedDiscountRate) / 100)
}

function normalizeCatalogVariants(variants?: unknown): any[] {
  if (!Array.isArray(variants)) return []

  return variants.map((variant) => {
    if (!variant || typeof variant !== 'object') return variant
    const current = variant as Record<string, unknown>

    return {
      ...current,
      priceBookPrices: parsePriceBookPrices(current.priceBookPrices),
      children: normalizeCatalogVariants(current.children),
    }
  })
}

export function resolveCatalogProductPricing<T extends Record<string, unknown>>(
  entry: T,
  priceBookId?: string | null,
) {
  const basePrice = toFiniteNumber(entry.baseProductPrice ?? entry.price ?? entry.sellingPrice)
  const priceBookPrices = parsePriceBookPrices(entry.priceBookPrices)
  const resolvedUnitPrice = resolvePriceBookUnitPrice(basePrice, priceBookPrices, priceBookId)

  return {
    ...entry,
    price: resolvedUnitPrice,
    sellingPrice: resolvedUnitPrice,
    baseProductPrice: basePrice,
    priceBookPrices,
    baseProductPriceBookPrices: parsePriceBookPrices(entry.baseProductPriceBookPrices),
    variants: normalizeCatalogVariants(entry.variants),
  }
}

function findCurrentVariant(item: CartItem) {
  if (!item.productVariantId || !Array.isArray(item.variants)) return null

  for (const variant of item.variants) {
    if (variant?.id === item.productVariantId) return variant
    if (Array.isArray(variant?.children)) {
      const child = variant.children.find((entry: any) => entry?.id === item.productVariantId)
      if (child) return child
    }
  }

  return null
}

export function applyCustomerPricingToCartItem(
  item: CartItem,
  customerPricing?: CustomerPricingProfile | null,
): CartItem {
  if (item.type !== 'product') return item

  const normalizedCustomerPricing = normalizeCustomerPricingProfile(customerPricing)
  const currentVariant = findCurrentVariant(item)
  const baseUnitPrice = currentVariant
    ? toFiniteNumber(currentVariant.sellingPrice ?? currentVariant.price ?? item.unitPrice)
    : toFiniteNumber(item.baseUnitPrice ?? item.unitPrice)
  const priceBookPrices = parsePriceBookPrices(
    currentVariant?.priceBookPrices ??
      (currentVariant ? item.priceBookPrices : item.basePriceBookPrices ?? item.priceBookPrices),
  )
  const resolvedUnitPrice = resolvePriceBookUnitPrice(
    baseUnitPrice,
    priceBookPrices,
    normalizedCustomerPricing?.priceBookId,
  )

  return {
    ...item,
    unitPrice: resolvedUnitPrice,
    discountItem: calculateProductPromotion(resolvedUnitPrice, normalizedCustomerPricing?.discountRate),
    priceBookPrices,
    basePriceBookPrices: parsePriceBookPrices(item.basePriceBookPrices ?? item.priceBookPrices),
  }
}
