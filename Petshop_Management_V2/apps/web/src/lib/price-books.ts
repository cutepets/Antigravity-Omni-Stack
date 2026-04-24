export type PriceBookOption = {
  id: string
  name: string
  isActive?: boolean
  sortOrder?: number | null
}

export const PRICE_BOOK_QUERY_KEY = ['settings', 'inventory', 'price-books'] as const

const PRICE_BOOK_COMPAT_QUERY_KEYS = [
  ['inventory', 'price-books'],
  ['priceBooks'],
] as const

export const PRICE_BOOK_QUERY_KEYS = [
  PRICE_BOOK_QUERY_KEY,
  ...PRICE_BOOK_COMPAT_QUERY_KEYS,
] as const

export function extractPriceBooks(response: unknown): PriceBookOption[] {
  const payload = response as any
  const data = payload?.data?.data ?? payload?.data ?? payload
  if (!Array.isArray(data)) return []

  return data.filter((item): item is PriceBookOption => (
    Boolean(item) &&
    typeof item.id === 'string' &&
    typeof item.name === 'string'
  ))
}

export async function invalidatePriceBookQueries(queryClient: {
  invalidateQueries: (filters: { queryKey: readonly string[] }) => Promise<unknown> | unknown
}) {
  await Promise.all(
    PRICE_BOOK_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}
