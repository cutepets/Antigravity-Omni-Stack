'use client';

import { useMemo } from 'react';
import type { CartItem } from '@petshop/shared';
import { usePosStore } from '@/stores/pos.store';
import { OrderCartItems } from '@/app/(dashboard)/orders/_components/order/OrderCartItems';
import type { CartItemCallbacks } from '@/app/(dashboard)/_shared/cart/cart.types';

// ── Re-exports để giữ back-compat cho các module khác ──────────────────────────
export type { CartItemCallbacks } from '@/app/(dashboard)/_shared/cart/cart.types';
export { PosCartQuantityControl } from './cart/PosCartQuantityControl';
export { PosCartDiscountEditor } from './cart/PosCartDiscountEditor';
export { PosCartStockPopover } from './cart/PosCartStockPopover';
export { TempCartRow, TempProductInlineRow, TempItemNameEditor } from './cart/PosCartTempRow';

// ── Types ─────────────────────────────────────────────────────────────────────

type PosCartItemsProps = {
  cart: CartItem[];
  branchId?: string;
  branches: any[];
  selectedRowIndex: number;
  noteEditingId: string | null;
  setNoteEditingId: (id: string | null) => void;
  discountEditingId: string | null;
  setDiscountEditingId: (id: string | null) => void;
  lastAddedItemId?: string | null;
  /** Optional — khi cung cấp sẽ bypass usePosStore */
  callbacks?: CartItemCallbacks;
};

// ── PosCartItems: thin wrapper → OrderCartItems ───────────────────────────────

export function PosCartItems({
  cart,
  branchId,
  branches,
  selectedRowIndex,
  noteEditingId,
  setNoteEditingId,
  discountEditingId,
  setDiscountEditingId,
  callbacks,
}: PosCartItemsProps) {
  const store = usePosStore();

  // Build callbacks từ POS store nếu không truyền vào ngoài
  const resolvedCallbacks: CartItemCallbacks = useMemo(
    () =>
      callbacks ?? {
        onRemoveItem: (id) => store.removeItem(id),
        onUpdateQuantity: (id, qty) => store.updateQuantity(id, qty),
        onUpdateDiscountItem: (id, discount) => store.updateDiscountItem(id, discount),
        onUpdateItemVariant: (id, variantId) => store.updateItemVariant(id, variantId),
        onUpdateItemNotes: (id, notes) => store.updateItemNotes(id, notes),
      },
    [callbacks, store],
  );

  return (
    <OrderCartItems
      cart={cart}
      branchId={branchId}
      branches={branches}
      selectedRowIndex={selectedRowIndex}
      noteEditingId={noteEditingId}
      setNoteEditingId={setNoteEditingId}
      discountEditingId={discountEditingId}
      setDiscountEditingId={setDiscountEditingId}
      callbacks={resolvedCallbacks}
    />
  );
}
