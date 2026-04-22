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
import { resolveProductVariantLabels } from '@petshop/shared';
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

    // ── Flash animation tracking ───────────────────────────────────────────────
    const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
    const flashItem = useCallback((id: string) => {
        setLastAddedItemId(id);
        setTimeout(() => setLastAddedItemId(null), 700);
    }, []);

    // ── Add to cart ───────────────────────────────────────────────────────────
    const handleAddItem = useCallback(
        (item: any) => {
            const activePetId = activeTab?.activePetIds?.[0];

            if (isHotelService(item)) {
                const cartItem = buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId);
                store.addItem(cartItem);
                flashItem(cartItem.id);
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }

            if (isGroomingService(item)) {
                const cartItem = buildGroomingCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId);
                store.addItem(cartItem);
                flashItem(cartItem.id);
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }

            if (isCatalogService(item)) {
                const cartItem = buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activePetId);
                store.addItem(cartItem);
                flashItem(cartItem.id);
                toast.success('Đã thêm dịch vụ vào giỏ');
                return;
            }
            // Product
            const productId = item.productId ?? item.id;
            const productVariantId = item.productVariantId;
            const unitPrice = item.sellingPrice ?? item.price ?? 0;
            const productName = item.productName ?? item.name;
            const normalizedProductName = `${productName ?? ''}`.trim().toLowerCase();
            const resolvedLabels = resolveProductVariantLabels(productName, {
                variantLabel: item.variantLabel,
                unitLabel: item.unitLabel,
            });
            const variantLabel =
                resolvedLabels.variantLabel &&
                    resolvedLabels.variantLabel.trim().toLowerCase() !== normalizedProductName
                    ? resolvedLabels.variantLabel
                    : undefined;
            const unitLabel = resolvedLabels.unitLabel ?? undefined;
            const variantName = [variantLabel, unitLabel].filter(Boolean).join(' • ') || undefined;
            const baseUnit = item.unit ?? 'cái';

            const newId = buildCartLineId('product', productId, productVariantId ?? 'base');
            store.addItem({
                id: newId,
                productId,
                productVariantId,
                description: productName,
                sku: item.sku,
                barcode: item.barcode,
                unitPrice,
                type: 'product',
                image: item.image,
                unit: unitLabel ?? baseUnit,
                priceBookPrices: item.priceBookPrices,
                basePriceBookPrices: item.baseProductPriceBookPrices ?? item.priceBookPrices,
                variants: item.variants,
                variantName,
                variantLabel,
                unitLabel,
                baseSku: item.sku,
                baseUnitPrice: item.baseProductPrice ?? unitPrice,
                baseUnit,
                stock: item.stock,
                availableStock: item.availableStock,
                trading: item.trading,
                reserved: item.reserved,
                branchStocks: item.branchStocks,
            } as any);
            flashItem(newId);
        },
        [store, activeTab?.activePetIds, flashItem],
    );

    // ── Suggested service selection (from pet profile) ────────────────────────
    const handleSelectSuggestedService = useCallback(
        (service: any, petId: string, petName?: string) => {
            const cart = store.tabs.find((t) => t.id === store.activeTabId)?.cart ?? [];
            const isRepeatableService =
                service?.suggestionGroup === 'OTHER' ||
                service?.serviceRole === 'EXTRA' ||
                service?.isSpaExtraService === true;
            const isDuplicate = !isRepeatableService && cart.some(
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
        // flash
        lastAddedItemId,
    };
}
