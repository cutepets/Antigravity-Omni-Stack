export type InventoryHistoryTransaction = {
  type?: string | null
  quantity?: number | string | null
  sourceQuantity?: number | string | null
}

export type InventoryHistoryVariant = {
  id?: string | null
  conversions?: string | null
}

export type InventoryHistoryStockRow = {
  id?: string | null
  branchId?: string | null
  stock?: number | null
  reservedStock?: number | null
  minStock?: number | null
  incomingStock?: number | null
  incoming?: number | null
  onTheWay?: number | null
  branch?: {
    id?: string | null
    name?: string | null
  } | null
}

export type InventoryHistoryRow<T extends InventoryHistoryTransaction = InventoryHistoryTransaction> = {
  transaction: T
  inboundQuantity: number
  outboundQuantity: number
  balanceAfter: number
}

const STOCK_FIELDS = ['stock', 'reservedStock', 'minStock', 'incomingStock', 'incoming', 'onTheWay'] as const

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function hasConversionRate(raw?: string | null) {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    const value = Number(parsed?.rate ?? parsed?.conversionRate ?? parsed?.mainQty)
    return Number.isFinite(value) && value > 0
  } catch {
    return false
  }
}

function getStockBranchKey(row: InventoryHistoryStockRow, index: number) {
  return row.branch?.id ?? row.branchId ?? row.branch?.name ?? row.id ?? `branch-${index}`
}

function getDisplayDelta(transaction: InventoryHistoryTransaction) {
  const rawQuantity = toFiniteNumber(transaction.sourceQuantity ?? transaction.quantity)
  return (
    transaction.type === 'OUT'
      ? -Math.abs(rawQuantity)
      : transaction.type === 'IN'
        ? Math.abs(rawQuantity)
        : rawQuantity
  )
}

export function isSingleProductVariantSet(variants?: InventoryHistoryVariant[] | null) {
  return Array.isArray(variants) && variants.length === 1 && !hasConversionRate(variants[0]?.conversions)
}

export function mergeInventoryHistoryStockRows(
  ...rowGroups: Array<InventoryHistoryStockRow[] | undefined | null>
) {
  const merged = new Map<string, InventoryHistoryStockRow>()

  rowGroups.flatMap((rows) => rows ?? []).forEach((row, index) => {
    const key = getStockBranchKey(row, index)
    const existing = merged.get(key)

    if (!existing) {
      merged.set(key, { ...row })
      return
    }

    for (const field of STOCK_FIELDS) {
      const nextValue = row[field]
      if (nextValue === undefined || nextValue === null) continue
      existing[field] = toFiniteNumber(existing[field]) + toFiniteNumber(nextValue)
    }

    existing.branchId = existing.branchId ?? row.branchId ?? row.branch?.id ?? null
    existing.branch = existing.branch ?? row.branch ?? null
  })

  return Array.from(merged.values())
}

export function buildInventoryHistoryRows<T extends InventoryHistoryTransaction>(
  transactions: T[],
  currentStock: number,
): InventoryHistoryRow<T>[] {
  let runningBalance = toFiniteNumber(currentStock)

  return transactions.map((transaction) => {
    const displayDelta = getDisplayDelta(transaction)
    const row: InventoryHistoryRow<T> = {
      transaction,
      inboundQuantity: displayDelta > 0 ? displayDelta : 0,
      outboundQuantity: displayDelta < 0 ? Math.abs(displayDelta) : 0,
      balanceAfter: runningBalance,
    }

    runningBalance -= displayDelta
    return row
  })
}
