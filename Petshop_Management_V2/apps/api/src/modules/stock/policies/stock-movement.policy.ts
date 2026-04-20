import { BadRequestException } from '@nestjs/common'

export interface BranchStockSnapshot {
  stock?: number | null
}

export function assertSufficientBranchStock(
  current: BranchStockSnapshot | null | undefined,
  quantityDelta: number,
) {
  if (quantityDelta >= 0) return

  const availableStock = Number(current?.stock ?? 0)
  const requiredStock = Math.abs(quantityDelta)

  if (!current || availableStock < requiredStock) {
    throw new BadRequestException('Insufficient stock for inventory movement')
  }
}
