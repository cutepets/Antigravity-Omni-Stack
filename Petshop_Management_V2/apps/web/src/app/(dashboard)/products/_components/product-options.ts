export function getUniqueOptionValues(items: unknown): string[] {
  const values = Array.isArray(items) ? items : []
  const seen = new Set<string>()

  return values.reduce<string[]>((options, item) => {
    const value =
      typeof item === 'string'
        ? item
        : typeof item === 'object' && item
          ? String((item as { name?: unknown; value?: unknown }).name ?? (item as { value?: unknown }).value ?? '')
          : ''
    const normalized = value.trim()

    if (!normalized || seen.has(normalized)) return options
    seen.add(normalized)
    options.push(normalized)
    return options
  }, [])
}
