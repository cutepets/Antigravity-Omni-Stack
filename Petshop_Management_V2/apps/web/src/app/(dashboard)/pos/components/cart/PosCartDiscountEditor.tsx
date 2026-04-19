'use client'

import { CartDiscountEditor } from '@/app/(dashboard)/_shared/cart/CartDiscountEditor'
import type { PosCartDiscountEditorProps } from './PosCartTypes'

/**
 * PosCartDiscountEditor — Wrapper của CartDiscountEditor dùng trong POS.
 * Chuyển đổi POS store/callbacks sang generic onUpdateDiscountItem callback.
 */
export function PosCartDiscountEditor({
    item,
    discountedUnitPrice,
    itemDiscountAmount,
    itemDiscountPercent,
    isOpen,
    onClose,
    onOpen,
    store,
    callbacks,
    mobile = false,
}: PosCartDiscountEditorProps) {
    const onUpdateDiscountItem = (id: string, discount: number) => {
        if (callbacks) {
            callbacks.onUpdateDiscountItem(id, discount)
        } else {
            store?.updateDiscountItem(id, discount)
        }
    }

    return (
        <CartDiscountEditor
            item={item}
            discountedUnitPrice={discountedUnitPrice}
            itemDiscountAmount={itemDiscountAmount}
            itemDiscountPercent={itemDiscountPercent}
            isOpen={isOpen}
            onClose={onClose}
            onOpen={onOpen}
            onUpdateDiscountItem={onUpdateDiscountItem}
            mobile={mobile}
        />
    )
}
