'use client'

import { CartStockPopover } from '@/app/(dashboard)/_shared/cart/CartStockPopover'
import type { CartItem } from '@petshop/shared'

/**
 * PosCartStockPopover — Wrapper của CartStockPopover dùng trong POS.
 * Interface giữ nguyên để không break PosCartRow.
 */
export function PosCartStockPopover({
    item,
    currentTrueVariant,
    activeBranches,
}: {
    item: CartItem
    currentTrueVariant: any
    activeBranches: any[]
}) {
    return (
        <CartStockPopover
            item={item}
            currentTrueVariant={currentTrueVariant}
            activeBranches={activeBranches}
        />
    )
}
