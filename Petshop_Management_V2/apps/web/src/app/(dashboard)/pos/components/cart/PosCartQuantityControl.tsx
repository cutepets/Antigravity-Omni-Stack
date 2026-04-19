'use client'

import { CartQuantityControl } from '@/app/(dashboard)/_shared/cart/CartQuantityControl'
import type { PosCartQuantityControlProps } from './PosCartTypes'

/**
 * PosCartQuantityControl — Wrapper của CartQuantityControl dùng trong POS.
 * Chuyển đổi POS store/callbacks sang generic onUpdateQuantity callback.
 */
export function PosCartQuantityControl({
    item,
    isOverSellableQty,
    store,
    callbacks,
    mobile = false,
}: PosCartQuantityControlProps) {
    const onUpdateQuantity = (id: string, qty: number) => {
        if (callbacks) {
            callbacks.onUpdateQuantity(id, qty)
        } else {
            store?.updateQuantity(id, qty)
        }
    }

    return (
        <CartQuantityControl
            item={item}
            isOverSellableQty={isOverSellableQty}
            onUpdateQuantity={onUpdateQuantity}
            mobile={mobile}
        />
    )
}
