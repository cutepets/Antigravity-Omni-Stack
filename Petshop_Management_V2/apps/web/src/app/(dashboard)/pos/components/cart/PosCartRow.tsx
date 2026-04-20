'use client';

import Image from 'next/image';
import { FileText, Package, Scissors, Trash2, ChevronDown } from 'lucide-react';
import { getProductVariantOptionLabel } from '@petshop/shared';
import { moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils';
import { resolveCartItemStockState } from '@/app/(dashboard)/_shared/cart/stock.utils';
import { getCartItemWeightBandLabel } from '../../utils/pos.utils';
import type { PosCartRowProps } from './PosCartTypes';
import { PosCartQuantityControl } from './PosCartQuantityControl';
import { PosCartDiscountEditor } from './PosCartDiscountEditor';
import { PosCartStockPopover } from './PosCartStockPopover';
import { TempCartRow, TempItemNameEditor } from './PosCartTempRow';

const normalizeLabel = (value?: string | null) => `${value ?? ''}`.trim().toLowerCase();

const getVariantOptionText = (productName: string, variant: any) => {
    const label = getProductVariantOptionLabel(productName, variant);
    return label || variant?.unitLabel || variant?.variantLabel || variant?.name || '—';
};

export function PosCartRow({
    item,
    idx,
    branchId,
    activeBranches,
    selectedRowIndex,
    noteEditingId,
    setNoteEditingId,
    discountEditingId,
    setDiscountEditingId,
    store,
    callbacks,
    isFlashing,
}: PosCartRowProps) {
    const {
        trueVariants,
        allConversionVariants,
        currentVariantObj,
        isCurrentConversion,
        currentTrueVariant,
        conversionVariants,
        isOverSellableQty,
    } = resolveCartItemStockState(item, branchId);
    const weightBandLabel = getCartItemWeightBandLabel(item);
    const currentQuantity = item.quantity || 1;
    const itemDiscountAmount = item.discountItem || 0;
    const discountedUnitPrice = Math.max(0, (item.unitPrice || 0) - itemDiscountAmount);
    const itemDiscountPercent =
        item.unitPrice && item.unitPrice > 0 ? Math.round((itemDiscountAmount / item.unitPrice) * 100) : 0;
    const baseUnit = (item as any).baseUnit ?? item.unit ?? 'cái';
    const normalizedDescription = normalizeLabel(item.description);
    const displayTrueVariants = trueVariants.filter((variant: any) => {
        const optionLabel = normalizeLabel(getVariantOptionText(item.description, variant));
        return optionLabel.length > 0 && optionLabel !== normalizedDescription;
    });

    const removeItem = () =>
        callbacks ? callbacks.onRemoveItem(item.id) : store?.removeItem(item.id);
    const updateVariant = (variantId: string) =>
        callbacks ? callbacks.onUpdateItemVariant(item.id, variantId) : store?.updateItemVariant(item.id, variantId);

    // ── Temp (no-SKU) product row ────────────────────────────────────────────────
    if ((item as any).isTemp) {
        return (
            <TempCartRow
                item={item}
                idx={idx}
                selectedRowIndex={selectedRowIndex}
                store={store}
                callbacks={callbacks}
                removeItem={removeItem}
            />
        );
    }

    return (
        <div
            id={`cart-row-${item.id}`}
            className={`flex flex-col border-b border-gray-100 hover:bg-primary-50/40 transition-colors group ${idx === selectedRowIndex ? 'bg-primary-100 border-l-2 border-l-primary-500' : 'border-l-2 border-l-transparent'
                } ${isFlashing ? 'cart-row-flash' : ''}`}
        >
            {/* Desktop row */}
            <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-3">
                <div className="text-center text-gray-500 text-[15px] font-medium">{idx + 1}</div>

                <div className="flex justify-center">
                    <button
                        onClick={removeItem}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Xóa"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div className="flex items-center justify-center">
                    <div className="w-10 h-10 rounded border border-gray-200 flex items-center justify-center bg-white text-gray-400 relative group/img cursor-pointer hover:z-50">
                        {item.image ? (
                            <>
                                <Image src={item.image} alt={item.description} width={40} height={40} unoptimized className="h-full w-full rounded object-cover" />
                                <div className="absolute top-1/2 left-full ml-2 w-[200px] h-[200px] -translate-y-1/2 shadow-2xl rounded-lg border-4 border-white overflow-hidden opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible pointer-events-none transition-all z-999 origin-left">
                                    <Image src={item.image} alt={item.description} width={200} height={200} unoptimized className="h-full w-full object-cover" />
                                </div>
                            </>
                        ) : item.type === 'service' || item.type === 'grooming' ? (
                            <Scissors size={18} />
                        ) : (
                            <Package size={18} />
                        )}
                    </div>
                </div>

                <div className="flex flex-col pr-2 min-w-0">
                    <div className="font-semibold text-[15px] text-gray-800 flex items-center gap-2 min-w-0" title={item.description}>
                        {(item as any).isTemp ? (
                            <TempItemNameEditor
                                description={item.description}
                                onSave={(newDesc) => {
                                    callbacks
                                        ? callbacks.onUpdateItemNotes(item.id, newDesc)
                                        : store?.updateItemDescription?.(item.id, newDesc);
                                }}
                            />
                        ) : (
                            <span className="truncate shrink">{item.description}</span>
                        )}
                        {displayTrueVariants.length > 0 ? (
                            <div className="relative inline-flex items-center shrink-0 group cursor-pointer -ml-1">
                                <select
                                    className="appearance-none bg-transparent text-primary-600 text-[15px] font-semibold pr-4 pl-1 outline-none cursor-pointer hover:text-primary-700 transition-colors leading-normal"
                                    value={currentTrueVariant?.id || (!isCurrentConversion && item.productVariantId) || ''}
                                    onChange={(event) => {
                                        const newTrueVariantId = event.target.value;
                                        let targetVariantId = newTrueVariantId;
                                        if (isCurrentConversion && currentTrueVariant && currentVariantObj) {
                                            const newTrueVariant = displayTrueVariants.find((variant: any) => variant.id === newTrueVariantId);
                                            if (newTrueVariant && allConversionVariants) {
                                                const currentConversionLabel = normalizeLabel(getVariantOptionText(item.description, currentVariantObj));
                                                const newTrueVariantLabel = normalizeLabel(newTrueVariant.variantLabel as string | null | undefined);
                                                const matchingConversion = allConversionVariants.find((conversion: any) =>
                                                    normalizeLabel(getVariantOptionText(item.description, conversion)) === currentConversionLabel &&
                                                    normalizeLabel(conversion.variantLabel) === newTrueVariantLabel,
                                                );
                                                if (matchingConversion) targetVariantId = matchingConversion.id;
                                            }
                                        }
                                        updateVariant(targetVariantId);
                                    }}
                                >
                                    <option value="base" className="hidden">Phiên bản</option>
                                    {displayTrueVariants.map((variant: any) => (
                                        <option key={variant.id} value={variant.id}>{getVariantOptionText(item.description, variant)}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-primary-500/50 group-hover:text-primary-600 pointer-events-none transition-colors" size={14} />
                            </div>
                        ) : null}

                        <PosCartStockPopover item={item} currentTrueVariant={currentTrueVariant} activeBranches={activeBranches} />
                    </div>

                    <div className="text-xs flex items-center mt-0.5 mb-1 w-full gap-2 group/note min-h-[20px]">
                        <span className="text-gray-500 shrink-0 font-medium text-[13px]">{item.sku || 'N/A'}</span>
                        {weightBandLabel ? (
                            <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary-700">{weightBandLabel}</span>
                        ) : null}
                        {noteEditingId === item.id ? (
                            <input
                                type="text"
                                placeholder="Ghi chú sản phẩm..."
                                defaultValue={item.itemNotes || ''}
                                autoFocus
                                onBlur={(event) => {
                                    const newNotes = event.target.value;
                                    if (newNotes !== item.itemNotes) {
                                        callbacks ? callbacks.onUpdateItemNotes(item.id, newNotes) : store?.updateItemNotes(item.id, newNotes);
                                    }
                                    setNoteEditingId(null);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        callbacks ? callbacks.onUpdateItemNotes(item.id, event.currentTarget.value) : store?.updateItemNotes(item.id, event.currentTarget.value);
                                        setNoteEditingId(null);
                                    } else if (event.key === 'Escape') {
                                        setNoteEditingId(null);
                                    }
                                }}
                                className="flex-1 min-w-[80px] h-6 px-1.5 text-[11px] bg-white/50 border border-amber-300 focus:border-amber-500 focus:bg-white focus:outline-none rounded transition-all text-amber-700 placeholder:text-gray-400"
                            />
                        ) : (
                            <div className="flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => setNoteEditingId(item.id)} title={item.itemNotes ? 'Sửa ghi chú' : 'Thêm ghi chú'}>
                                {item.itemNotes ? (
                                    <span className="text-[11px] text-amber-600 font-medium italic truncate max-w-[200px] flex items-center gap-1">
                                        <FileText size={12} className="shrink-0 text-amber-500" />
                                        {item.itemNotes}
                                    </span>
                                ) : (
                                    <button className="text-gray-300 hover:text-[#0089A1] transition-colors p-0.5" type="button">
                                        <FileText size={12} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {item.hotelDetails ? (
                        <div className="text-[10px] text-primary-600 mt-0.5 bg-primary-50 w-fit px-1 rounded">
                            In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()} {' - '} Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
                        </div>
                    ) : null}
                </div>

                <div className="text-center text-[15px] font-medium text-gray-700 flex justify-center">
                    {conversionVariants.length > 0 ? (
                        <div className="relative inline-flex items-center group cursor-pointer text-gray-700 hover:text-primary-600 transition-colors">
                            <select
                                className="appearance-none bg-transparent text-[15px] font-medium outline-none cursor-pointer pr-4 w-full text-center"
                                value={isCurrentConversion ? item.productVariantId : 'base'}
                                onChange={(event) => {
                                    if (event.target.value === 'base') updateVariant(currentTrueVariant ? currentTrueVariant.id : 'base');
                                    else updateVariant(event.target.value);
                                }}
                            >
                                <option value="base">{baseUnit}</option>
                                {conversionVariants.map((variant: any) => (
                                    <option key={variant.id} value={variant.id}>{getVariantOptionText(item.description, variant)}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100" size={14} />
                        </div>
                    ) : (
                        <span className="text-gray-700">{item.unit || baseUnit}</span>
                    )}
                </div>

                <div className="flex items-center justify-center">
                    <PosCartQuantityControl item={item} isOverSellableQty={isOverSellableQty} store={store} callbacks={callbacks} />
                </div>

                <div className="relative text-right flex items-center justify-end">
                    <PosCartDiscountEditor
                        item={item}
                        discountedUnitPrice={discountedUnitPrice}
                        itemDiscountAmount={itemDiscountAmount}
                        itemDiscountPercent={itemDiscountPercent}
                        isOpen={discountEditingId === item.id}
                        onClose={() => setDiscountEditingId(null)}
                        onOpen={() => setDiscountEditingId(item.id)}
                        store={store}
                        callbacks={callbacks}
                    />
                </div>

                <div className="text-right text-[15px] font-bold text-gray-800">{moneyRaw(discountedUnitPrice * currentQuantity)}</div>
            </div>

            {/* Mobile row */}
            <div className="flex lg:hidden p-3 gap-3 relative">
                <div className="w-[60px] h-[60px] shrink-0 rounded border border-gray-200 flex items-center justify-center bg-white text-gray-400 relative group/img cursor-pointer hover:z-50">
                    {item.image ? (
                        <>
                            <Image src={item.image} alt={item.description} width={60} height={60} unoptimized className="h-full w-full rounded object-cover" />
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] shadow-2xl rounded-xl border-4 border-white overflow-hidden opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible pointer-events-none transition-all z-999">
                                <Image src={item.image} alt={item.description} width={300} height={300} unoptimized className="h-full w-full object-cover" />
                            </div>
                        </>
                    ) : item.type === 'service' || item.type === 'grooming' ? (
                        <Scissors size={24} />
                    ) : (
                        <Package size={24} />
                    )}
                </div>

                <div className="flex-1 flex flex-col pr-8">
                    <div className="font-semibold text-[15px] text-gray-800 leading-tight mb-1" title={item.description}>
                        {item.description}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{item.sku || 'N/A'}</div>
                    <div className="flex items-center gap-3">
                        <PosCartQuantityControl item={item} isOverSellableQty={isOverSellableQty} store={store} callbacks={callbacks} mobile />
                        <div className="relative">
                            <PosCartDiscountEditor
                                item={item}
                                discountedUnitPrice={discountedUnitPrice}
                                itemDiscountAmount={itemDiscountAmount}
                                itemDiscountPercent={itemDiscountPercent}
                                isOpen={discountEditingId === item.id}
                                onClose={() => setDiscountEditingId(null)}
                                onOpen={() => setDiscountEditingId(item.id)}
                                store={store}
                                callbacks={callbacks}
                                mobile
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={removeItem}
                    className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Xóa"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
