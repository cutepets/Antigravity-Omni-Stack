'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import { CatalogSearchResults } from '@/components/search/catalog-search-results';
import { usePosProducts } from '@/components/search/use-commerce-search';
import { useActiveTab, usePosStore } from '@/stores/pos.store';

export interface PosProductSearchProps {
  onSelect: (item: any) => void;
  // Optional overrides — khi dùng ngoài POS (e.g. OrderWorkspace)
  branchId?: string;
  priceBookId?: string;
  cartItems?: { productId?: string; productVariantId?: string; serviceId?: string; quantity: number }[];
  isMultiSelectControlled?: boolean;        // nếu true → dùng isMultiSelectValue/onSetMultiSelect
  isMultiSelectValue?: boolean;
  onSetMultiSelect?: (v: boolean) => void;
  outOfStockHidden?: boolean;
  disabled?: boolean;
  // Style overrides — cho phép override màu container và dropdown panel từ bên ngoài
  containerClassName?: string;
  inputClassName?: string;    // override wrapper input (mặc định bg-white cho POS)
  panelClassName?: string;
  resultsVariant?: 'pos' | 'order' | 'kiosk';
}

function getSellableQuantity(stockSource: any, branchId?: string) {
  if (!stockSource) return null;

  if (branchId && Array.isArray(stockSource.branchStocks) && stockSource.branchStocks.length > 0) {
    const branchStock = stockSource.branchStocks.find(
      (entry: any) => entry.branchId === branchId || entry.branch?.id === branchId,
    );

    if (!branchStock) return 0;

    const available =
      branchStock.availableStock ?? ((branchStock.stock ?? 0) - (branchStock.reservedStock ?? branchStock.reserved ?? 0));

    return Math.max(0, Number(available) || 0);
  }

  if (stockSource.availableStock !== undefined && stockSource.availableStock !== null) {
    return Math.max(0, Number(stockSource.availableStock) || 0);
  }

  if (stockSource.stock !== undefined && stockSource.stock !== null) {
    return Math.max(0, Number(stockSource.stock || 0) - Number(stockSource.trading ?? stockSource.reserved ?? 0));
  }

  return null;
}

export function PosProductSearch({
  onSelect,
  branchId: branchIdProp,
  priceBookId: priceBookIdProp,
  cartItems: cartItemsProp,
  isMultiSelectControlled = false,
  isMultiSelectValue = false,
  onSetMultiSelect,
  outOfStockHidden: outOfStockHiddenProp,
  disabled = false,
  containerClassName,
  inputClassName,
  panelClassName,
  resultsVariant = 'kiosk',
}: PosProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // POS store — only used when not in controlled mode
  const posIsMultiSelect = usePosStore(s => s.isMultiSelect);
  const setPosIsMultiSelect = usePosStore(s => s.setIsMultiSelect);
  const posOutOfStockHidden = usePosStore(s => s.outOfStockHidden);
  const activeTab = useActiveTab();

  // Resolved values: prefer props, fall back to POS store
  const effectiveBranchId = branchIdProp ?? activeTab?.branchId;
  const effectivePriceBookId =
    priceBookIdProp ??
    (branchIdProp === undefined && cartItemsProp === undefined ? activeTab?.customerPricing?.priceBookId : undefined);
  const effectiveCartItems = cartItemsProp ?? activeTab?.cart ?? [];
  const isMultiSelect = isMultiSelectControlled ? isMultiSelectValue : posIsMultiSelect;
  const setIsMultiSelect = isMultiSelectControlled
    ? (v: boolean) => onSetMultiSelect?.(v)
    : setPosIsMultiSelect;
  const outOfStockHidden = outOfStockHiddenProp ?? posOutOfStockHidden;

  const [sessionAdded, setSessionAdded] = useState<Record<string, number>>({});
  const [errorId, setErrorId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const isProgrammaticFocus = useRef(false);

  const { data: products = [], isLoading: loadingProducts } = usePosProducts(query, effectivePriceBookId);

  const results = products
    .filter((item: any) => {
      if (!outOfStockHidden) return true;
      const sellableQty = getSellableQuantity(item, effectiveBranchId);
      return sellableQty === null || sellableQty > 0;
    })
    .slice(0, 15);
  const loading = loadingProducts;
  const resolvedInputClassName =
    inputClassName ??
    (resultsVariant === 'kiosk'
      ? 'border border-white/35 bg-white shadow-sm'
      : 'bg-background');
  const resolvedPanelClassName =
    panelClassName ??
    (resultsVariant === 'kiosk'
      ? 'fixed inset-0 z-50 flex flex-col bg-[#f3f7f9] lg:absolute lg:left-0 lg:top-full lg:right-auto lg:mt-2 lg:h-auto lg:max-h-[560px] lg:w-[520px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#d6e5ea] lg:bg-white lg:shadow-[0_18px_48px_rgba(0,56,77,0.18)]'
      : 'fixed inset-0 z-50 bg-background flex flex-col lg:block lg:absolute lg:top-full lg:left-0 lg:mt-1 lg:w-[500px] lg:bg-background lg:border lg:border-border lg:rounded-lg lg:shadow-xl lg:h-auto lg:max-h-[550px] lg:right-auto');
  const mobileHeaderClassName =
    resultsVariant === 'kiosk'
      ? 'flex lg:hidden items-center bg-white px-3 py-2 space-x-3 border-b border-slate-200'
      : 'flex lg:hidden items-center bg-background px-3 py-2 space-x-3 border-b border-border';
  const mobileSearchClassName =
    resultsVariant === 'kiosk'
      ? 'flex-1 flex items-center bg-slate-100 rounded-[10px] h-[38px] px-3'
      : 'flex-1 flex items-center bg-background-secondary rounded-[8px] h-[36px] px-3';
  const mobileToolbarClassName =
    resultsVariant === 'kiosk'
      ? 'lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white'
      : 'lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-border bg-background';
  const scrollAreaClassName =
    resultsVariant === 'kiosk'
      ? 'flex-1 lg:block overflow-y-auto w-full bg-white flex flex-col relative no-scrollbar lg:max-h-[420px]'
      : 'flex-1 lg:block overflow-y-auto w-full bg-background flex flex-col relative no-scrollbar lg:max-h-[400px]';
  const stickyActionClassName =
    resultsVariant === 'kiosk'
      ? 'flex items-center gap-2 p-3 bg-white border-t border-slate-200 mt-auto shadow-[0_-4px_10px_rgba(15,23,42,0.03)] lg:shadow-none'
      : 'flex items-center gap-2 p-3 bg-background border-t border-border mt-auto shadow-[0_-4px_10px_rgba(0,0,0,0.03)] lg:shadow-none';

  const getCartQty = (catalogItem: any) => {
    return effectiveCartItems.reduce((total: number, cartItem: any) => {
      const sameProduct =
        catalogItem.duration === undefined &&
        cartItem.productId === (catalogItem.productId ?? catalogItem.id) &&
        (catalogItem.productVariantId
          ? cartItem.productVariantId === catalogItem.productVariantId
          : !cartItem.productVariantId);
      const sameService = catalogItem.duration !== undefined && cartItem.serviceId === catalogItem.id;
      return sameProduct || sameService ? total + (cartItem.quantity ?? 0) : total;
    }, 0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'F1') {
        e.preventDefault();
        const input = containerRef.current?.querySelector('input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: any) => {
    if (disabled) return;
    const entryId = item.entryId ?? item.id;
    const qty = getCartQty(item);
    const availableStock = getSellableQuantity(item, effectiveBranchId);

    if (availableStock !== null && qty >= availableStock) {
      setErrorId(entryId);
      setTimeout(() => setErrorId(null), 500);
      return;
    }

    onSelect(item);

    if (isMultiSelect) {
      setSessionAdded(prev => ({ ...prev, [entryId]: (prev[entryId] || 0) + 1 }));
    }

    if (!isMultiSelect) {
      setQuery('');
      setSessionAdded({});
      setIsOpen(false);

      const input = containerRef.current?.querySelector('input');
      if (window.innerWidth >= 1024 && input) {
        isProgrammaticFocus.current = true;
        input.focus();
        isProgrammaticFocus.current = false;
      }
    } else {
      const input = window.innerWidth < 1024 ? mobileInputRef.current : containerRef.current?.querySelector('input');
      if (input) {
        isProgrammaticFocus.current = true;
        input.focus();
        isProgrammaticFocus.current = false;
      }
    }
  };

  const handleClose = () => {
    setQuery('');
    setSessionAdded({});
    setIsOpen(false);
  };

  const handleResetSearch = () => {
    setQuery('');
    if (window.innerWidth < 1024) mobileInputRef.current?.focus();
  };

  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return (
    <div className={`relative flex-1 max-w-[400px] ${containerClassName ?? ''}`} ref={containerRef}>
      {/* Desktop & default header input */}
      <div className={`flex items-center rounded-md overflow-hidden h-9 w-full border-b-2 border-transparent transition-colors focus-within:border-amber-400 ${resolvedInputClassName} ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className={`pl-3 pr-2 ${resultsVariant === 'kiosk' ? 'text-slate-400' : 'text-foreground-muted'}`}>
          <Search size={16} />
        </div>
        <input
          className={`flex-1 bg-transparent border-none outline-none text-sm h-full ${resultsVariant === 'kiosk' ? 'text-slate-900 placeholder:text-slate-400' : 'text-foreground placeholder:text-foreground-muted'}`}
          placeholder="Thêm sản phẩm vào đơn (F1)"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!isProgrammaticFocus.current) setIsOpen(true);
          }}
        />
      </div>

      {isOpen && (
        <div className={resolvedPanelClassName}>

          {/* Mobile Only Header inside the Full-screen Modal */}
          <div className={mobileHeaderClassName}>
            <button onClick={handleClose} className={`p-1 rounded-full transition-colors ${resultsVariant === 'kiosk' ? 'text-slate-500 hover:bg-slate-100' : 'text-foreground-muted hover:bg-background-secondary'}`}>
              <ArrowLeft size={22} />
            </button>
            <div className={mobileSearchClassName}>
              <Search size={16} className={`mr-2 shrink-0 ${resultsVariant === 'kiosk' ? 'text-slate-400' : 'text-foreground-muted'}`} />
              <input
                ref={mobileInputRef}
                className={`flex-1 bg-transparent border-none outline-none text-[15px] h-full w-full ${resultsVariant === 'kiosk' ? 'text-slate-900 placeholder:text-slate-400' : 'text-foreground placeholder:text-foreground-muted'}`}
                placeholder="Tìm và thêm sản phẩm vào đơn"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Multi-select Toolbar (Mobile only) */}
          <div className={mobileToolbarClassName}>
            <span className={`text-[14px] font-medium cursor-pointer ${resultsVariant === 'kiosk' ? 'text-slate-700' : 'text-foreground'}`}>Tất cả loại sản phẩm ▾</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className={`text-[14px] ${resultsVariant === 'kiosk' ? 'text-slate-700' : 'text-foreground'}`}>Chọn nhiều</span>
              <input
                type="checkbox"
                className="hidden"
                checked={isMultiSelect}
                onChange={(e) => setIsMultiSelect(e.target.checked)}
              />
              <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${isMultiSelect ? 'bg-[#006E82]' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isMultiSelect ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>

          <div className={scrollAreaClassName}>
            <CatalogSearchResults
              sections={[{ key: 'catalog', entries: results }]}
              query={query}
              loading={loading}
              variant={resultsVariant}
              showSectionLabels={false}
              loadingText="Đang tìm kiếm..."
              emptyText={<>Không tìm thấy &quot;{query}&quot;</>}
              bottomSpacer
              onSelect={handleSelect}
              formatPrice={(value) => money(value)}
              getEntryState={(item) => {
                const entryId = item.entryId ?? item.id;
                const qty = getCartQty(item);
                const availableStock = getSellableQuantity(item, effectiveBranchId);

                return {
                  isSelected: qty > 0 && isMultiSelect,
                  selectedCount: qty,
                  isError: errorId === entryId,
                  availableStock,
                  stockLabel: `Có thể bán: ${availableStock}`,
                };
              }}
            />
          </div>

          {/* Sticky Bottom Actions */}
          {isMultiSelect && (
            <div className={stickyActionClassName}>
              <button
                onClick={handleResetSearch}
                className={`flex-1 py-2.5 text-[15px] font-semibold rounded-[8px] transition-colors ${resultsVariant === 'kiosk' ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'text-foreground bg-background border border-border hover:bg-background-secondary'}`}
              >
                Chọn lại
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 text-[15px] font-semibold text-white bg-[#006E82] border border-[#006E82] rounded-[8px] hover:bg-[#005767] transition-colors shadow-sm"
              >
                Xong
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
