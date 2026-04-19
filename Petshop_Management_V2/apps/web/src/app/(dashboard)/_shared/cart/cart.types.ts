/**
 * cart.types.ts — Shared types for cart components dùng chung giữa POS và Orders module.
 * Di chuyển từ PosCartTypes.ts để các module khác có thể import.
 */
import type { CartItem } from '@petshop/shared'

/**
 * Interface callbacks chuẩn cho các cart item operations.
 * Dùng chung giữa POS (qua PosCartRow) và Orders (qua OrderCartItems).
 */
export type CartItemCallbacks = {
    onRemoveItem: (id: string) => void
    onUpdateQuantity: (id: string, qty: number) => void
    onUpdateDiscountItem: (id: string, discount: number) => void
    onUpdateItemVariant: (id: string, variantId: string) => void
    onUpdateItemNotes: (id: string, notes: string) => void
}

export type CartQuantityControlProps = {
    item: CartItem
    isOverSellableQty: boolean
    /** Gọi khi quantity thay đổi — dùng thay cho store.updateQuantity */
    onUpdateQuantity: (id: string, qty: number) => void
    mobile?: boolean
}

export type CartDiscountEditorProps = {
    item: CartItem
    discountedUnitPrice: number
    itemDiscountAmount: number
    itemDiscountPercent: number
    isOpen: boolean
    onClose: () => void
    onOpen: () => void
    onUpdateDiscountItem: (id: string, discount: number) => void
    mobile?: boolean
}

export type CartStockPopoverProps = {
    item: CartItem
    currentTrueVariant: any
    activeBranches: any[]
}
