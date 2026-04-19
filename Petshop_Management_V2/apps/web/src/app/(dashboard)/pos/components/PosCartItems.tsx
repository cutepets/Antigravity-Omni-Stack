'use client';

import { useMemo } from 'react';
import type { CartItem } from '@petshop/shared';
import { ShoppingCart } from 'lucide-react';
import { usePosStore } from '@/stores/pos.store';
import { PosCartRow } from './cart/PosCartRow';

// ── Re-exports để giữ back-compat cho các module khác ──────────────────────────
export type { CartItemCallbacks } from './cart/PosCartTypes';
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
  /** Optional — khi cung cấp sẽ bypass usePosStore (dùng cho OrderWorkspace) */
  callbacks?: import('./cart/PosCartTypes').CartItemCallbacks;
};

// ── PosCartItems: container duy nhất ─────────────────────────────────────────

export function PosCartItems({
  cart,
  branchId,
  branches,
  selectedRowIndex,
  noteEditingId,
  setNoteEditingId,
  discountEditingId,
  setDiscountEditingId,
  lastAddedItemId,
  callbacks,
}: PosCartItemsProps) {
  const store = usePosStore();
  const activeBranches = useMemo(() => branches.filter((branch: any) => branch.isActive), [branches]);

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
        <ShoppingCart size={64} className="opacity-20" />
        <p className="text-lg">Đơn hàng trống</p>
        <p className="text-sm">Hãy tìm kiếm sản phẩm hoặc quét mã vạch (F1)</p>
      </div>
    );
  }

  return (
    <>
      {[...cart].reverse().map((item, idx) => (
        <PosCartRow
          key={item.id}
          item={item}
          idx={cart.length - 1 - idx}
          branchId={branchId}
          activeBranches={activeBranches}
          selectedRowIndex={selectedRowIndex}
          noteEditingId={noteEditingId}
          setNoteEditingId={setNoteEditingId}
          discountEditingId={discountEditingId}
          setDiscountEditingId={setDiscountEditingId}
          store={store}
          callbacks={callbacks}
          isFlashing={lastAddedItemId === item.id}
        />
      ))}
    </>
  );
}
