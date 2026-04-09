'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Package, Scissors, ArrowLeft, ArrowLeftCircle, Check } from 'lucide-react';
import { usePosProducts, usePosServices } from '../_hooks/use-pos-queries';
import { useActiveTab, usePosStore } from '@/stores/pos.store';

export interface PosProductSearchProps {
  onSelect: (item: any) => void;
}

export function PosProductSearch({ onSelect }: PosProductSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const isMultiSelect = usePosStore(s => s.isMultiSelect);
  const setIsMultiSelect = usePosStore(s => s.setIsMultiSelect);
  const [sessionAdded, setSessionAdded] = useState<Record<string, number>>({});
  const [errorId, setErrorId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const isProgrammaticFocus = useRef(false);

  const { data: products = [], isLoading: loadingProducts } = usePosProducts(query);
  const { data: services = [], isLoading: loadingServices } = usePosServices(query);

  const results = [...products, ...services].slice(0, 15);
  const loading = loadingProducts || loadingServices;
  
  const activeTab = useActiveTab();
  const getCartQty = (catalogItem: any) => {
    return activeTab.cart.reduce((total, cartItem) => {
      const sameProduct = catalogItem.duration === undefined && cartItem.productId === catalogItem.id;
      const sameService = catalogItem.duration !== undefined && cartItem.serviceId === catalogItem.id;
      return sameProduct || sameService ? total + cartItem.quantity : total;
    }, 0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        const input = containerRef.current?.querySelector('input');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close on click outside if we are in mobile view full screen, it's safer
      if (window.innerWidth < 1024) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When opened on mobile, focus the new mobile input
  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (item: any) => {
    const qty = getCartQty(item);
    const availableStock = item.availableStock !== undefined 
      ? item.availableStock 
      : Math.max(0, (item.stock || 0) - (item.trading || item.reserved || 0));

    // Only block if this item actually tracks stock
    if ((item.stock !== undefined || item.availableStock !== undefined) && qty >= availableStock) {
      setErrorId(item.id);
      setTimeout(() => setErrorId(null), 500);
      return;
    }

    onSelect(item);
    
    // We don't actually need sessionAdded for rollback anymore, 
    // but just in case we need it later we can leave it or remove it. Let's keep it simple.
    if (isMultiSelect) {
      setSessionAdded(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
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
    setSessionAdded({}); // commit items
    setIsOpen(false);
  };

  const handleResetSearch = () => {
    setQuery('');
    if (window.innerWidth < 1024) mobileInputRef.current?.focus();
  };

  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return (
    <div className="relative flex-1 max-w-[400px]" ref={containerRef}>
      {/* Desktop & default header input */}
      <div className="flex items-center bg-white rounded-md overflow-hidden h-9 w-full border-b-2 border-transparent transition-colors focus-within:border-amber-400">
        <div className="pl-3 pr-2 text-gray-400">
          <Search size={16} />
        </div>
        <input
          className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder:text-gray-400 h-full"
          placeholder="Thêm sản phẩm vào đơn (F1)"
          value={query}
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
        <div 
          className="fixed inset-0 z-50 bg-[#f0f2f5] flex flex-col lg:block lg:absolute lg:top-full lg:left-0 lg:mt-1 lg:w-[500px] lg:bg-white lg:border lg:border-gray-200 lg:rounded-lg lg:shadow-xl lg:h-auto lg:max-h-[550px] lg:-left-2 lg:right-auto"
        >
          
          {/* Mobile Only Header inside the Full-screen Modal */}
          <div className="flex lg:hidden items-center bg-white px-3 py-2 space-x-3 border-b border-gray-200">
            <button onClick={handleClose} className="p-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft size={22} />
            </button>
            <div className="flex-1 flex items-center bg-gray-100 rounded-[8px] h-[36px] px-3">
              <Search size={16} className="text-gray-400 mr-2 shrink-0" />
              <input
                ref={mobileInputRef}
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-800 placeholder:text-gray-500 h-full w-full"
                placeholder="Tìm và thêm sản phẩm vào đơn"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Multi-select Toolbar (Mobile only, Desktop relies on header) */}
          <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
            <span className="text-[14px] text-gray-700 font-medium cursor-pointer">Tất cả loại sản phẩm ▾</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[14px] text-gray-700">Chọn nhiều</span>
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

          <div className="flex-1 lg:block overflow-y-auto w-full bg-white flex flex-col relative no-scrollbar lg:max-h-[400px]">
            {loading && (
               <div className="p-6 text-[14px] text-gray-500 text-center">Đang tìm kiếm...</div>
            )}
            
            {!loading && query.length > 0 && results.length === 0 && (
               <div className="p-6 text-[14px] text-gray-500 text-center">Không tìm thấy &quot;{query}&quot;</div>
            )}

            {!loading && results.length > 0 && (
              <ul className="w-full">
                {results.map((item: any) => {
                  const isService = item.duration !== undefined;
                  const qty = getCartQty(item);
                  const isSelected = qty > 0;
                  
                  const availableStock = item.availableStock !== undefined 
                    ? item.availableStock 
                    : Math.max(0, (item.stock || 0) - (item.trading || item.reserved || 0));
                  const hasStock = item.stock !== undefined || item.availableStock !== undefined;
                  
                  return (
                    <li key={item.id}>
                      <button
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-start gap-4 transition-all duration-300 last:border-0 group bg-white ${errorId === item.id ? 'bg-red-50 translate-x-2' : isSelected && isMultiSelect ? 'bg-primary-50/20' : 'hover:bg-[#f0f9fa]'}`}
                        onClick={() => handleSelect(item)}
                      >
                        <div className="relative w-[50px] h-[50px] lg:w-[48px] lg:h-[48px] rounded-md overflow-visible bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 mt-0.5">
                          {item.image ? (
                             <img src={item.image} alt={item.name} className="w-[85%] h-[85%] object-cover rounded-sm" />
                          ) : (
                             isService ? <Scissors size={20} className="text-amber-500/50" /> : <Package size={20} className="text-orange-400/50" />
                          )}
                          
                          {/* Selected Badge */}
                          {isSelected && isMultiSelect && (
                            <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm border-2 border-white transition-colors duration-300 ${errorId === item.id ? 'bg-red-500' : 'bg-primary-500'}`}>
                              {qty > 99 ? '99+' : qty}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-start overflow-hidden pt-0.5">
                          <span className={`${errorId === item.id ? 'text-red-600 font-bold' : 'text-[#333333] font-medium'} text-[15px] lg:text-[14px] leading-snug pr-2 transition-colors duration-300`}>{item.name}</span>
                          <span className="text-[12px] text-gray-500 mt-1 uppercase tracking-wide">
                            SKU: {item.sku || 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex-shrink-0 flex flex-col items-end justify-start pt-0.5 min-w-[70px]">
                          <span className="text-[15px] lg:text-[14px] font-bold text-[#333333] tracking-tight">{money(item.sellingPrice ?? item.price ?? 0)}</span>
                          {hasStock ? (
                            <span className={`text-[12px] mt-1 font-medium transition-colors duration-300 ${errorId === item.id || availableStock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {availableStock <= 0 ? 'Hết hàng' : `Có thể bán: ${availableStock}`}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            
            {/* Some padding at the bottom on mobile to ensure last item is readable above sticky footer */}
            <div className="h-[80px] lg:hidden w-full"></div>
          </div>

          {/* Sticky Bottom Actions inside the modal/dropdown (shows heavily on Mobile or when Multi-select is active on Desktop) */}
          {isMultiSelect && (
            <div className="flex items-center gap-2 p-3 bg-white border-t border-gray-200 mt-auto shadow-[0_-4px_10px_rgba(0,0,0,0.03)] lg:shadow-none">
              <button 
                onClick={handleResetSearch}
                className="flex-1 py-2.5 text-[15px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-[8px] hover:bg-gray-50 transition-colors"
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
