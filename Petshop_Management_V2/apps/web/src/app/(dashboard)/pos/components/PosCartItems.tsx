'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { CartItem } from '@petshop/shared';
import { getProductVariantOptionLabel } from '@petshop/shared';
import { FileText, Info, Minus, Package, Plus, Scissors, ShoppingCart, Trash2, X, ChevronDown } from 'lucide-react';
import { money, moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils';
import {
  formatCartQuantityInput,
  getCartQuantityStep,
  parseCartQuantityInput,
  roundCartQuantity,
} from '@/app/(dashboard)/_shared/cart/cart.utils';
import { resolveCartItemStockState } from '@/app/(dashboard)/_shared/cart/stock.utils';
import { usePosStore } from '@/stores/pos.store';
import { getCartItemWeightBandLabel } from '../utils/pos.utils';

// ── Callback interface (dùng khi override store) ──────────────────────────────
export type CartItemCallbacks = {
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateDiscountItem: (id: string, discount: number) => void;
  onUpdateItemVariant: (id: string, variantId: string) => void;
  onUpdateItemNotes: (id: string, notes: string) => void;
};

type PosCartItemsProps = {
  cart: CartItem[];
  branchId?: string;
  branches: any[];
  selectedRowIndex: number;
  noteEditingId: string | null;
  setNoteEditingId: (id: string | null) => void;
  discountEditingId: string | null;
  setDiscountEditingId: (id: string | null) => void;
  // Optional — when provided, bypasses usePosStore (used by OrderWorkspace)
  callbacks?: CartItemCallbacks;
};

type PosCartRowProps = {
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
};

type PosCartDiscountEditorProps = {
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

type PosCartQuantityControlProps = {
  item: CartItem;
  isOverSellableQty: boolean;
  store: any;
  callbacks?: CartItemCallbacks;
  mobile?: boolean;
};

const normalizeLabel = (value?: string | null) => `${value ?? ''}`.trim().toLowerCase();

const getVariantOptionText = (productName: string, variant: any) => {
  const label = getProductVariantOptionLabel(productName, variant);
  return label || variant?.unitLabel || variant?.variantLabel || variant?.name || '—';
};

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
  // Always call hook unconditionally (Rules of Hooks)
  // When callbacks is provided (e.g. OrderWorkspace), store methods won't be used
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
      {cart.map((item, idx) => (
        <PosCartRow
          key={item.id}
          item={item}
          idx={idx}
          branchId={branchId}
          activeBranches={activeBranches}
          selectedRowIndex={selectedRowIndex}
          noteEditingId={noteEditingId}
          setNoteEditingId={setNoteEditingId}
          discountEditingId={discountEditingId}
          setDiscountEditingId={setDiscountEditingId}
          store={store}
          callbacks={callbacks}
        />
      ))}
    </>
  );
}

function PosCartRow({
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

  // Helpers that dispatch to callbacks OR store
  const removeItem = () =>
    callbacks ? callbacks.onRemoveItem(item.id) : store?.removeItem(item.id);
  const updateVariant = (variantId: string) =>
    callbacks ? callbacks.onUpdateItemVariant(item.id, variantId) : store?.updateItemVariant(item.id, variantId);

  return (
    <div
      id={`cart-row-${item.id}`}
      className={`flex flex-col border-b border-gray-100 hover:bg-primary-50/30 transition-colors group ${idx === selectedRowIndex ? 'bg-primary-50/30' : ''
        }`}
    >
      {/* desktop row */}
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
            <span className="truncate shrink">{item.description}</span>
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
                        const newTrueVariantLabel = normalizeLabel(newTrueVariant.variantLabel);
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
          <div className="font-semibold text-[15px] text-gray-800 leading-tight mb-1 flex items-center gap-2 flex-wrap" title={item.description}>
            <span>{item.description}</span>
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
                        const newTrueVariantLabel = normalizeLabel(newTrueVariant.variantLabel);
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

            <Info
              size={16}
              className="text-[#0089A1] ml-1 cursor-pointer"
              onClick={() => window.alert(`Tổng tồn: ${(item as any).stock ?? 'N/A'}\nKhả dụng: ${(item as any).availableStock ?? 'N/A'}`)}
            />

            {conversionVariants.length > 0 ? (
              <div className="relative inline-flex items-center shrink-0 mt-0.5 ml-2 cursor-pointer text-gray-700 hover:text-primary-600 transition-colors">
                <select
                  className="appearance-none bg-transparent text-[14px] font-medium outline-none cursor-pointer pr-4 w-full"
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
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
              </div>
            ) : null}
          </div>
          <div className="text-[13px] text-gray-500 mb-0.5 uppercase tracking-wide">
            SKU: {item.sku || 'N/A'}
            {weightBandLabel ? ` • Hạng cân: ${weightBandLabel}` : ''}
          </div>

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

          {item.hotelDetails ? (
            <div className="text-[10px] text-primary-600 mt-1 bg-primary-50 w-fit px-1.5 py-0.5 rounded">
              In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()} {' - '} Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
            </div>
          ) : null}
        </div>

        <button onClick={removeItem} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500">
          <X size={20} />
        </button>

        <div className="absolute bottom-2 right-2">
          <PosCartQuantityControl item={item} isOverSellableQty={isOverSellableQty} store={store} callbacks={callbacks} mobile />
        </div>
      </div>
    </div>
  );
}

function PosCartStockPopover({
  item,
  currentTrueVariant,
  activeBranches,
}: {
  item: CartItem;
  currentTrueVariant: any;
  activeBranches: any[];
}) {
  const currentVariantObj =
    Array.isArray((item as any).variants)
      ? (item as any).variants.find((variant: any) => variant.id === (item as any).productVariantId)
      : null;
  const headerName = currentVariantObj?.name || item.description;
  const headerSku = item.sku || currentVariantObj?.sku || currentTrueVariant?.sku || 'N/A';

  return (
    <div className="group/stock relative shrink-0 z-60 flex">
      <Info size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover/stock:text-[#0089A1] cursor-help transition-all" />
      <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto transition-all duration-200 p-0 pointer-events-none before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-100">
        <div className="bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden w-full h-full">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
            <Link href={item.productId ? `/products/${item.productId}` : '#'} target="_blank" className="font-bold text-[13px] text-gray-800 hover:text-[#0089A1] hover:underline leading-tight block cursor-pointer transition-colors">
              {headerName}
            </Link>
            <div className="text-[10px] text-gray-500 mt-0.5 font-medium tracking-wide uppercase">
              {headerSku}
            </div>
          </div>

          <div className="px-4 py-3">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="text-left font-semibold pb-2"></th>
                  <th className="font-semibold pb-2 px-2">TỒN</th>
                  <th className="font-semibold pb-2 px-2 text-[#0089A1]">KHẢ DỤNG</th>
                  <th className="font-semibold pb-2 pl-2">ĐỂ BÁN</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const targetStockInfo = currentTrueVariant ?? item;
                  const targetBranchStocks = Array.isArray((targetStockInfo as any).branchStocks) ? (targetStockInfo as any).branchStocks : [];
                  const isService = item.type !== 'product';
                  const defaultFallback = isService ? '∞' : '—';

                  return (
                    <>
                      <tr className="border-b border-gray-50">
                        <td className="text-left py-2.5 font-semibold text-gray-800">Tổng tồn kho</td>
                        <td className="px-2 py-2.5">{isService ? defaultFallback : (targetStockInfo as any).stock ?? defaultFallback}</td>
                        <td className="px-2 py-2.5 text-[#0089A1] font-bold">
                          {isService
                            ? defaultFallback
                            : (targetStockInfo as any).availableStock !== undefined
                              ? (targetStockInfo as any).availableStock
                              : (targetStockInfo as any).stock !== undefined && (targetStockInfo as any).stock !== null
                                ? (targetStockInfo as any).stock - ((targetStockInfo as any).trading || (targetStockInfo as any).reserved || 0)
                                : defaultFallback}
                        </td>
                        <td className="pl-2 py-2.5">{isService ? defaultFallback : (targetStockInfo as any).trading ?? defaultFallback}</td>
                      </tr>
                      {activeBranches.map((branch: any) => {
                        const branchStock = targetBranchStocks.find((stock: any) => stock.branchId === branch.id || stock.branch?.id === branch.id);
                        const stock = branchStock ? branchStock.stock ?? 0 : 0;
                        const reserved = branchStock ? branchStock.reservedStock ?? 0 : 0;
                        const availableStock =
                          branchStock !== undefined && branchStock !== null && branchStock.availableStock !== undefined && branchStock.availableStock !== null
                            ? branchStock.availableStock
                            : stock - reserved;

                        return (
                          <tr key={branch.id} className="border-b border-gray-50 last:border-0 border-dashed">
                            <td className="text-left py-2 font-medium text-gray-600 truncate max-w-[120px]">{branch.name}</td>
                            <td className="px-2 py-2">{isService ? defaultFallback : stock}</td>
                            <td className="px-2 py-2 text-[#0089A1]/80">{isService ? defaultFallback : availableStock}</td>
                            <td className="pl-2 py-2">{defaultFallback}</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PosCartQuantityControl({
  item,
  isOverSellableQty,
  store,
  callbacks,
  mobile = false,
}: PosCartQuantityControlProps) {
  const quantityStep = getCartQuantityStep(item);
  const [draftQuantity, setDraftQuantity] = useState(() =>
    formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep),
  );

  useEffect(() => {
    setDraftQuantity(formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep));
  }, [item.quantity, quantityStep]);

  const commitQuantity = (rawValue: string) => {
    const parsed = parseCartQuantityInput(rawValue);
    const nextQuantity = Number.isNaN(parsed)
      ? quantityStep
      : roundCartQuantity(Math.max(quantityStep, parsed), quantityStep);

    callbacks ? callbacks.onUpdateQuantity(item.id, nextQuantity) : store?.updateQuantity(item.id, nextQuantity);
    setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep));
  };

  return (
    <div
      className={`flex items-center rounded overflow-hidden transition-colors ${mobile ? 'h-[32px]' : 'h-8'
        } ${item.type === 'hotel'
          ? 'border-gray-200 bg-gray-50'
          : isOverSellableQty
            ? 'border border-red-500 bg-red-50 text-red-600'
            : 'border border-gray-300 bg-white text-gray-700'
        } ${!mobile && !isOverSellableQty && item.type !== 'hotel' ? 'focus-within:border-primary-500' : ''}`}
    >
      <button
        className={`h-full transition-colors ${mobile ? 'px-2.5 flex items-center justify-center' : 'px-2'} ${item.type === 'hotel'
          ? 'text-gray-400 cursor-not-allowed opacity-50'
          : isOverSellableQty
            ? mobile
              ? 'hover:bg-red-100'
              : 'text-red-600 hover:bg-red-100'
            : mobile
              ? 'hover:bg-gray-100'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        disabled={item.type === 'hotel'}
        onClick={() => {
          const nextQuantity = roundCartQuantity(
            Math.max(quantityStep, (item.quantity ?? quantityStep) - quantityStep),
            quantityStep,
          );
          callbacks ? callbacks.onUpdateQuantity(item.id, nextQuantity) : store?.updateQuantity(item.id, nextQuantity);
          setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep));
        }}
      >
        <Minus size={mobile ? 16 : 14} />
      </button>
      <input
        id={`${mobile ? 'quantity-input-mobile' : 'quantity-input'}-${item.id}`}
        type="text"
        disabled={item.type === 'hotel'}
        inputMode="decimal"
        value={draftQuantity}
        onChange={(event) => setDraftQuantity(event.target.value)}
        onBlur={(event) => commitQuantity(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitQuantity(event.currentTarget.value);
            event.currentTarget.blur();
          }

          if (event.key === 'Escape') {
            setDraftQuantity(formatCartQuantityInput(item.quantity ?? quantityStep, quantityStep));
            event.currentTarget.blur();
          }
        }}
        className={`text-center font-bold outline-none border-none h-full ${mobile ? 'w-10 text-[14px]' : 'w-10 text-[15px]'
          } ${item.type === 'hotel'
            ? 'bg-gray-50 text-gray-500'
            : isOverSellableQty
              ? 'bg-red-50 text-red-600'
              : mobile
                ? 'bg-transparent text-gray-700'
                : 'bg-transparent text-gray-900'
          }`}
      />
      <button
        className={`h-full transition-colors ${mobile ? 'px-2.5 flex items-center justify-center' : 'px-2'} ${item.type === 'hotel'
          ? 'text-gray-400 cursor-not-allowed opacity-50'
          : isOverSellableQty
            ? mobile
              ? 'hover:bg-red-100'
              : 'text-red-600 hover:bg-red-100'
            : mobile
              ? 'hover:bg-gray-100'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        disabled={item.type === 'hotel'}
        onClick={() => {
          const nextQuantity = roundCartQuantity((item.quantity ?? quantityStep) + quantityStep, quantityStep);
          callbacks ? callbacks.onUpdateQuantity(item.id, nextQuantity) : store?.updateQuantity(item.id, nextQuantity);
          setDraftQuantity(formatCartQuantityInput(nextQuantity, quantityStep));
        }}
      >
        <Plus size={mobile ? 16 : 14} />
      </button>
    </div>
  );
}

function PosCartDiscountEditor({
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
  const updateDiscount = (value: number) =>
    callbacks ? callbacks.onUpdateDiscountItem(item.id, value) : store?.updateDiscountItem(item.id, value);

  return (
    <>
      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
          <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 w-72 z-50 p-4 animate-in fade-in zoom-in-95 duration-200 cursor-default text-left shadow-primary-500/10">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
              <h4 className="font-bold text-gray-800 text-[15px]">Cài đặt giá & Chiết khấu</h4>
              <button className="text-gray-400 hover:text-gray-600 transition-colors" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (VNĐ)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                      placeholder="0"
                      value={item.discountItem ? money(item.discountItem) : ''}
                      onChange={(event) => {
                        const value = parseInt(event.target.value.replace(/\D/g, ''), 10);
                        updateDiscount(Number.isNaN(value) ? 0 : value);
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">đ</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (%)</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                      placeholder="0"
                      value={itemDiscountAmount > 0 && item.unitPrice ? itemDiscountPercent : ''}
                      onChange={(event) => {
                        const value = parseFloat(event.target.value.replace(/[^\d.]/g, ''));
                        const percent = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
                        updateDiscount(Math.round((item.unitPrice || 0) * (percent / 100)));
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">%</span>
                  </div>
                </div>
              </div>
              {(item.discountItem ?? 0) > 0 ? (
                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[13px]">
                  <span className="text-gray-500">Giảm giá:</span>
                  <span className="font-bold text-amber-600">-{money(itemDiscountAmount)} ({itemDiscountPercent}%)</span>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {mobile ? (
        <>
          <div className="text-[15px] font-medium text-gray-800 cursor-pointer border-b border-dashed border-gray-300 hover:border-primary-500 group-hover:border-primary-500 transition-colors w-fit pb-0.5" onClick={onOpen}>
            {moneyRaw(discountedUnitPrice)}
          </div>
          {itemDiscountAmount > 0 ? (
            <div className="text-[11px] flex items-center gap-1 font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded w-fit mt-0.5">
              <span>-{itemDiscountPercent}%</span>
              <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="group/price relative cursor-pointer flex flex-col items-end" onClick={onOpen}>
          <div className="text-[15px] font-medium text-gray-800 border-b border-dashed border-gray-300 hover:border-primary-500 group-hover/price:border-primary-500 transition-colors pb-0.5">
            {money(discountedUnitPrice)}
          </div>
          {itemDiscountAmount > 0 ? (
            <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded max-w-full">
              <span>-{itemDiscountPercent}%</span>
              <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
