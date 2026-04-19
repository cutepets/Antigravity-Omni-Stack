/**
 * Shared types for POS Cart sub-components.
 * Exported here so each sub-file can import without circular deps.
 */
import type { CartItem } from '@petshop/shared';

export type CartItemCallbacks = {
    onRemoveItem: (id: string) => void;
    onUpdateQuantity: (id: string, qty: number) => void;
    onUpdateDiscountItem: (id: string, discount: number) => void;
    onUpdateItemVariant: (id: string, variantId: string) => void;
    onUpdateItemNotes: (id: string, notes: string) => void;
};

export type PosCartRowProps = {
    item: CartItem;
    idx: number;
    branchId?: string;
    activeBranches: any[];
    selectedRowIndex: number;
    noteEditingId: string | null;
    setNoteEditingId: (id: string | null) => void;
    discountEditingId: string | null;
    setDiscountEditingId: (id: string | null) => void;
    store: any; // may be null when callbacks provided
    callbacks?: CartItemCallbacks;
    isFlashing?: boolean;
};

export type PosCartDiscountEditorProps = {
    item: CartItem;
    discountedUnitPrice: number;
    itemDiscountAmount: number;
    itemDiscountPercent: number;
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    store: any;
    callbacks?: CartItemCallbacks;
    mobile?: boolean;
};

export type PosCartQuantityControlProps = {
    item: CartItem;
    isOverSellableQty: boolean;
    store: any;
    callbacks?: CartItemCallbacks;
    mobile?: boolean;
};
