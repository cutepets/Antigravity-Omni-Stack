/**
 * Normalize Vietnamese string for diacritic-insensitive search
 * "thành" → "thanh", "Hồ Chí Minh" → "ho chi minh"
 */
export const normalizeVietnamese = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * Multi-term AND search — all terms must match target
 * e.g. "tha pho" matches "Thành phố" ✅, "Thanh Long" ❌
 */
export const matchSearch = (query: string, target: string): boolean => {
  const terms = query.split(' ').filter(Boolean)
  const normalTarget = normalizeVietnamese(target)
  return terms.every((term) => normalTarget.includes(normalizeVietnamese(term)))
}
