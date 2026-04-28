type OrderServiceDetailLinkInput = {
  kind: 'grooming' | 'hotel'
  id?: string | null
  code?: string | null
}

export function buildOrderServiceDetailHref({ kind, id, code }: OrderServiceDetailLinkInput) {
  if (!id) return null

  const params = new URLSearchParams()
  const searchValue = (code || id).trim()

  if (kind === 'grooming') {
    params.set('view', 'list')
    params.set('search', searchValue)
    params.set('sessionId', id)
    return `/grooming?${params.toString()}`
  }

  params.set('view', 'list')
  params.set('search', searchValue)
  params.set('stayId', id)
  return `/hotel?${params.toString()}`
}
