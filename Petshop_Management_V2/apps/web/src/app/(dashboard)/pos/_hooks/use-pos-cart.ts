/**
 * use-pos-cart — Cart management hook for POS.
 *
 * Encapsulates all cart-level state and handlers:
 *   - item CRUD (add, remove, update quantity/price/note/discount)
 *   - hotel checkout flow state
 *   - keyboard navigation state (selectedRowIndex)
 *   - suggested service selection
 *
 * Does NOT own payment state — see use-pos-payment.ts.
 */

import { useState, useCallback } from 'react';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { buildProductVariantName } from '@petshop/shared';
import {
    isHotelService,
    isGroomingService,
    isCatalogService,
    getCartQuantityStep,
} from '@/app/(dashboard)/_shared/cart/cart.utils';
import {
    buildCartLineId,
    buildDirectServiceCartItem,
    buildGroomingCartItem,
} from '@/app/(dashboard)/_shared/cart/cart.builders';
import { usePosStore, useActiveTab } from '@/stores/pos.store';

export function usePosCart() {
    const store = usePosStore();
    const activeTab = useActiveTab();

    // ── Hotel checkout modal ──────────────────────────────────────────────────
    const [showHotelCheckout, setShowHotelCheckout] = useState(false);
    const [selectedHotelPetId, setSelectedHotelPetId] = useState<string | undefined>();

    // ── Row editing state ─────────────────────────────────────────────────────
    const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
    const [discountEditingId, setDiscountEditingId] = useState<string | null>(null);

    // ── Keyboard nav ──────────────────────────────────────────────────────────
    const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);

    // ── Add to cart ───────────────────────────────────────────────────────────
    const handleAddItem = useCallback(
        (item: any) => {
            const activePetId = activeTab?.activePetIds?.[0];

            if (isHotelService(item)) {
                store.addItem(buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId));
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }

            if (isGroomingService(item)) {
                store.addItem(buildGroomingCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId));
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }

            if (isCatalogService(item)) {
                store.addItem(buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId));
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }

            // Product
            const productId = item.productId ?? item.id;
            const productVariantId = item.productVariantId;
            const unitPrice = item.sellingPrice ?? item.price ?? 0;

            store.addItem({
                id: buildCartLineId('product', productId, productVariantId ?? 'base'),
                productId,
                productVariantId,
                description: item.productName ?? item.name,
                sku: item.sku,
                barcode: item.barcode,
                unitPrice,
                type: 'product',
                image: item.image,
                unit: item.unit ?? 'cái',
                variants: item.variants,
                variantName: buildProductVariantName(item.productName ?? item.name, item.variantLabel, item.unitLabel) || undefined,
                variantLabel: item.variantLabel,
                unitLabel: item.unitLabel,
                baseSku: item.sku,
                baseUnitPrice: unitPrice,
                stock: item.stock,
                availableStock: item.availableStock,
                trading: item.trading,
                reserved: item.reserved,
                branchStocks: item.branchStocks,
            } as any);
        },
        [store, activeTab?.activePetIds],
    );

    // ── Suggested service selection (from pet profile) ────────────────────────
    const handleSelectSuggestedService = useCallback(
        (service: any, petId: string, petName?: string) => {
            const cart = store.tabs.find((t) => t.id === store.activeTabId)?.cart ?? [];
            const isDuplicate = cart.some(
                (item) =>
                    item.petId === petId &&
                    (item.serviceId === service.id ||
                        (item.sku && service.sku && item.sku === service.sku) ||
                        item.description === service.name ||
                        (item.type === 'hotel' && service.suggestionKind === 'HOTEL') ||
                        (item.type === 'grooming' && service.suggestionKind === 'SPA')),
            );

            if (isDuplicate) {
                toast.warning(`Dịch vụ "${service.name}" đã có trong giỏ hàng.`);
                return;
            }

            if (isHotelService(service)) {
                const cartItem = buildDirectServiceCartItem(service, petId);
                if (petName) cartItem.itemNotes = `Thú cưng: ${petName}`;
                store.addItem(cartItem);
                toast.success('Đã thêm dịch vụ lưu chuồng vào giỏ');
                return;
            }

            const cartItem = buildGroomingCartItem(service, petId);
            if (petName) cartItem.itemNotes = `Thú cưng: ${petName}`;
            store.addItem(cartItem);
            toast.success('Đã thêm dịch vụ vào giỏ');
        },
        [store],
    );

    // ── Keyboard navigation ───────────────────────────────────────────────────
    const navigateRowUp = useCallback(() => {
        if (!activeTab || activeTab.cart.length === 0) return;
        setSelectedRowIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            document.getElementById(`cart-row-${activeTab.cart[next].id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
        });
    }, [activeTab]);

    const navigateRowDown = useCallback(() => {
        if (!activeTab || activeTab.cart.length === 0) return;
        setSelectedRowIndex((prev) => {
            const next = prev < activeTab.cart.length - 1 ? prev + 1 : activeTab.cart.length - 1;
            document.getElementById(`cart-row-${activeTab.cart[next].id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
        });
    }, [activeTab]);

    const decrementSelectedRow = useCallback(() => {
        if (!activeTab) return;
        if (selectedRowIndex >= 0 && selectedRowIndex < activeTab.cart.length) {
            const item = activeTab.cart[selectedRowIndex];
            const step = getCartQuantityStep(item);
            store.updateQuantity(item.id, Math.max(0, (item.quantity ?? 1) - step));
        }
    }, [activeTab, selectedRowIndex, store]);

    const incrementSelectedRow = useCallback(() => {
        if (!activeTab) return;
        if (selectedRowIndex >= 0 && selectedRowIndex < activeTab.cart.length) {
            const item = activeTab.cart[selectedRowIndex];
            const step = getCartQuantityStep(item);
            store.updateQuantity(item.id, (item.quantity ?? 1) + step);
        }
    }, [activeTab, selectedRowIndex, store]);

    return {
        // hotel
        showHotelCheckout,
        setShowHotelCheckout,
        selectedHotelPetId,
        setSelectedHotelPetId,
        // editing
        noteEditingId,
        setNoteEditingId,
        discountEditingId,
        setDiscountEditingId,
        // keyboard nav
        selectedRowIndex,
        setSelectedRowIndex,
        navigateRowUp,
        navigateRowDown,
        decrementSelectedRow,
        incrementSelectedRow,
        // handlers
        handleAddItem,
        handleSelectSuggestedService,
    };
}
