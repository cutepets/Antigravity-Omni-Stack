export interface BranchStockScaleOptions {
  resetMinStock?: boolean
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function toInt(value: unknown) {
  return Math.trunc(toNumber(value))
}

export function aggregateBranchStocks<T extends Record<string, any>>(rows: T[]) {
  const grouped = new Map<string, T & { id: string; stock: number; reservedStock: number; minStock: number }>()

  rows.forEach((row, index) => {
    const key = row.branchId ?? row.branch?.id ?? row.id ?? `branch-${index}`
    const existing = grouped.get(key)

    if (existing) {
      existing.stock = toInt(existing.stock) + toInt(row.stock)
      existing.reservedStock = toInt(existing.reservedStock) + toInt(row.reservedStock)
      existing.minStock = toInt(existing.minStock) + toInt(row.minStock)
      return
    }

    grouped.set(key, {
      ...row,
      id: row.id ?? key,
      stock: toInt(row.stock),
      reservedStock: toInt(row.reservedStock),
      minStock: toInt(row.minStock),
    })
  })

  return Array.from(grouped.values())
}

export function scaleBranchStocks<T extends Record<string, any>>(
  rows: T[],
  factor: number,
  options: BranchStockScaleOptions = {},
) {
  const { resetMinStock = true } = options

  return rows.map((row) => ({
    ...row,
    stock: toNumber(row.stock) * factor,
    reservedStock: toNumber(row.reservedStock) * factor,
    minStock: resetMinStock ? 0 : toNumber(row.minStock) * factor,
  }))
}
