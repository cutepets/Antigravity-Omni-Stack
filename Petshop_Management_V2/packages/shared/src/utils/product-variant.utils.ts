type ProductVariantLike = {
  name?: string | null
  variantLabel?: string | null
  unitLabel?: string | null
  conversions?: string | null
}

const VARIANT_SEPARATOR = ' - '

function cleanLabel(value?: string | null) {
  const normalized = `${value ?? ''}`.trim()
  return normalized.length > 0 ? normalized : null
}

function equalsIgnoreCase(left?: string | null, right?: string | null) {
  return `${left ?? ''}`.trim().toLowerCase() === `${right ?? ''}`.trim().toLowerCase()
}

function splitLegacyVariantParts(productName?: string | null, variantName?: string | null) {
  const normalizedProductName = cleanLabel(productName)
  const normalizedVariantName = cleanLabel(variantName)
  if (!normalizedVariantName) return [] as string[]

  const prefix = normalizedProductName ? `${normalizedProductName}${VARIANT_SEPARATOR}` : null
  const suffix = prefix && normalizedVariantName.startsWith(prefix)
    ? normalizedVariantName.slice(prefix.length)
    : normalizedVariantName

  return suffix
    .split(VARIANT_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function parseVariantConversionUnit(raw?: string | null) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return cleanLabel(parsed?.unit)
  } catch {
    return null
  }
}

export function buildProductVariantName(
  productName?: string | null,
  variantLabel?: string | null,
  unitLabel?: string | null,
) {
  return [
    cleanLabel(productName),
    cleanLabel(variantLabel),
    cleanLabel(unitLabel),
  ]
    .filter(Boolean)
    .join(VARIANT_SEPARATOR)
}

export function resolveProductVariantLabels(
  productName?: string | null,
  variant?: ProductVariantLike | null,
) {
  const legacyParts = splitLegacyVariantParts(productName, variant?.name)
  const explicitVariantLabel = cleanLabel(variant?.variantLabel)
  const explicitUnitLabel = cleanLabel(variant?.unitLabel)
  const conversionUnit = parseVariantConversionUnit(variant?.conversions)

  let unitLabel = explicitUnitLabel ?? conversionUnit
  let variantLabel = explicitVariantLabel

  if (!variantLabel && legacyParts.length > 0) {
    const nextParts = [...legacyParts]
    if (unitLabel && nextParts.length > 0 && equalsIgnoreCase(nextParts[nextParts.length - 1], unitLabel)) {
      nextParts.pop()
    }
    variantLabel = cleanLabel(nextParts.join(VARIANT_SEPARATOR))
  }

  if (!unitLabel && conversionUnit) {
    unitLabel = conversionUnit
  }

  if (!variantLabel && !unitLabel && legacyParts.length > 0) {
    variantLabel = cleanLabel(legacyParts.join(VARIANT_SEPARATOR))
  }

  return {
    variantLabel,
    unitLabel,
    displayName: buildProductVariantName(productName, variantLabel, unitLabel),
  }
}

export function getProductVariantGroupKey(
  productName?: string | null,
  variant?: ProductVariantLike | null,
) {
  const { variantLabel } = resolveProductVariantLabels(productName, variant)
  return cleanLabel(variantLabel)?.toLowerCase() ?? '__base__'
}

export function getProductVariantOptionLabel(
  productName?: string | null,
  variant?: ProductVariantLike | null,
) {
  const { variantLabel, unitLabel } = resolveProductVariantLabels(productName, variant)
  if (cleanLabel(unitLabel)) return cleanLabel(unitLabel)!
  if (cleanLabel(variantLabel)) return cleanLabel(variantLabel)!
  // Fallback: strip productName prefix from legacy combined variant.name
  const legacyParts = splitLegacyVariantParts(productName, variant?.name)
  const fallback = legacyParts.join(VARIANT_SEPARATOR)
  return cleanLabel(fallback) ?? cleanLabel(variant?.name) ?? ''
}
