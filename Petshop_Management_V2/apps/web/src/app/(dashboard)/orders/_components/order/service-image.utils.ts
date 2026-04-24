const normalizeImageKey = (value?: string | null) => `${value ?? ''}`.trim().toLowerCase()

const getCartItemImageCandidates = (item: any) => {
  const groomingDetails = item?.groomingDetails
  const pricingSnapshot = groomingDetails?.pricingSnapshot ?? item?.pricingSnapshot

  return [
    item?.packageCode,
    groomingDetails?.packageCode,
    pricingSnapshot?.packageCode,
    pricingSnapshot?.serviceName,
    item?.name,
    item?.description,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

export function buildServiceImageMap(items: Array<{ packageCode?: string | null; imageUrl?: string | null; label?: string | null }>) {
  const map = new Map<string, string>()

  for (const item of items) {
    if (!item.imageUrl) continue

    for (const key of [item.packageCode, item.label]) {
      if (!key) continue
      map.set(key, item.imageUrl)
      map.set(normalizeImageKey(key), item.imageUrl)
    }
  }

  return map
}

export function resolveCartServiceImage(item: any, serviceImageMap: Map<string, string>) {
  if (item?.image) return item.image
  if (item?.type !== 'service' && item?.type !== 'grooming' && item?.type !== 'hotel') return undefined

  for (const key of getCartItemImageCandidates(item)) {
    const image = serviceImageMap.get(key) ?? serviceImageMap.get(normalizeImageKey(key))
    if (image) return image
  }

  return undefined
}
