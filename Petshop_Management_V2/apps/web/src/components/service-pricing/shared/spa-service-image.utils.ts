type SpaServiceImageEntry = {
  species?: string | null
  packageCode?: string | null
  imageUrl?: string | null
}

function normalizeSpaImageToken(value?: string | null) {
  return `${value ?? ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getSpaServiceImageLookupKey(species?: string | null, packageCode?: string | null) {
  return `${normalizeSpaImageToken(species || 'shared')}:${normalizeSpaImageToken(packageCode)}`
}

export function getGroomingColumnAvatarKey(species: string, columnKey: string) {
  return `${normalizeSpaImageToken(species)}:${normalizeSpaImageToken(columnKey)}`
}

export function buildSpaServiceImageMap(items: SpaServiceImageEntry[]) {
  const map = new Map<string, string>()

  for (const item of items) {
    if (!item.imageUrl || !item.packageCode) continue
    map.set(getSpaServiceImageLookupKey(item.species ?? null, item.packageCode), item.imageUrl)
  }

  return map
}

export function resolveSpaServiceImage(
  imageMap: Map<string, string>,
  species: string | null | undefined,
  packageCode: string | null | undefined,
  options?: { allowSharedFallback?: boolean },
) {
  const exactImage = imageMap.get(getSpaServiceImageLookupKey(species, packageCode))
  if (exactImage) return exactImage
  if (options?.allowSharedFallback === false) return undefined
  return imageMap.get(getSpaServiceImageLookupKey(null, packageCode))
}
