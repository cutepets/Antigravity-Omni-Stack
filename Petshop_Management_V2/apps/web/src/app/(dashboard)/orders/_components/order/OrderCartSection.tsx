'use client'

import { useMemo } from 'react'
import type { CartItem } from '@petshop/shared'
import { OrderCartItems, type CartItemCallbacks } from './OrderCartItems'

type OrderCartSectionProps = {
    draft: any
    branches: any[]
    selectedRowIndex: number
    isEditing: boolean
    noteEditingId: string | null
    setNoteEditingId: (id: string | null) => void
    discountEditingId: string | null
    setDiscountEditingId: (id: string | null) => void
    onChangeQuantity: (index: number, value: string) => void
    onChangeItemDiscount: (index: number, value: string) => void
    onRemoveItem: (index: number) => void
    onSwapItem?: (item: any) => void
}

/**
 * Adapter: maps useOrderWorkspace draft items → CartItem format consumed by OrderCartItems.
 * Tách từ order-workspace.tsx để giảm kích thước file main.
 */
export function OrderCartSection({
    draft,
    branches,
    selectedRowIndex,
    isEditing,
    noteEditingId,
    setNoteEditingId,
    discountEditingId,
    setDiscountEditingId,
    onChangeQuantity,
    onChangeItemDiscount,
    onRemoveItem,
}: OrderCartSectionProps) {
    // Map draft items to CartItem shape expected by OrderCartItems
    const cartItems = useMemo<CartItem[]>(
        () =>
            (draft.items ?? []).map((item: any) => ({
                id: item.id,
                productId: item.productId ?? undefined,
                serviceId: item.serviceId ?? undefined,
                productVariantId: item.productVariantId ?? undefined,
                description: item.description,
                sku: item.sku ?? undefined,
                image: item.image ?? undefined,
                unit: item.unit ?? undefined,
                unitPrice: Number(item.unitPrice || 0),
                quantity: Number(item.quantity || 1),
                discountItem: Number(item.discountItem || 0),
                itemNotes: item.itemNotes ?? item.note ?? undefined,
                type: item.type ?? 'product',
                variants: item.variants ?? undefined,
                branchStocks: item.branchStocks ?? undefined,
                stock: item.stock ?? undefined,
                availableStock: item.availableStock ?? undefined,
                hotelDetails: item.hotelDetails ?? undefined,
                // Pass extra fields through for swap badge rendering
                isTemp: item.isTemp,
                stockExportedAt: item.stockExportedAt,
                orderItemId: item.orderItemId,
            })),
        [draft.items],
    )

    // Map callbacks — OrderCartItems works with item.id, OrderWorkspace with index
    const callbacks = useMemo<CartItemCallbacks>(() => {
        const findIndex = (id: string) => (draft.items ?? []).findIndex((item: any) => item.id === id)
        return {
            onRemoveItem: (id) => {
                const idx = findIndex(id)
                if (idx >= 0) onRemoveItem(idx)
            },
            onUpdateQuantity: (id, qty) => {
                const idx = findIndex(id)
                if (idx >= 0) onChangeQuantity(idx, String(qty))
            },
            onUpdateDiscountItem: (id, discount) => {
                const idx = findIndex(id)
                if (idx >= 0) onChangeItemDiscount(idx, String(discount))
            },
            onUpdateItemVariant: (_id, _variantId) => {
                // Order variant switching not yet supported — no-op
            },
            onUpdateItemNotes: (_id, _notes) => {
                // Order item notes not yet wired — no-op
            },
        }
    }, [draft.items, onChangeItemDiscount, onChangeQuantity, onRemoveItem])

    if (!isEditing && cartItems.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-foreground-muted">
                <div className="text-sm font-semibold text-foreground">Chưa có sản phẩm hoặc dịch vụ</div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <OrderCartItems
                cart={cartItems}
                branchId={draft.branchId ?? undefined}
                branches={branches}
                selectedRowIndex={selectedRowIndex}
                noteEditingId={noteEditingId}
                setNoteEditingId={setNoteEditingId}
                discountEditingId={discountEditingId}
                setDiscountEditingId={setDiscountEditingId}
                callbacks={callbacks}
            />
        </div>
    )
}
