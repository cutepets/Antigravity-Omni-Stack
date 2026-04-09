'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePosStore, useActiveTab, useCartTotal, useCartItemCount } from '@/stores/pos.store';
import { useCreateOrder } from './_hooks/use-pos-mutations';
import { useBranches } from './_hooks/use-pos-queries';
import type { CreateOrderPayload } from '@/lib/api/order.api';
import { ServiceBookingModal } from './components/ServiceBookingModal';
import { HotelCheckoutModal } from './components/HotelCheckoutModal';
import { PosCustomerV1 } from './components/PosCustomerV1';
import { PosSettingsPanel } from './components/PosSettingsPanel';
import { PosPaymentModal } from './components/PosPaymentModal';
import { PosOrderBookingModal } from './components/PosOrderBookingModal';
import { ReceiptModal } from './components/ReceiptModal';
import { PosProductSearch } from './components/PosProductSearch';
import { PosNotifications } from './components/PosNotifications';
import { PosBranchSelect } from './components/PosBranchSelect';
import { Menu, X, Plus, Minus, Trash2, Home, NotebookText, Info, FileText, Settings, UserCircle2, Bell, LogOut, Scissors, Package, ShoppingCart, Maximize, Store, QrCode, Zap, EyeOff, Eye, ListChecks, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { orderApi } from '@/lib/api/order.api';

// ─── Format helpers ───────────────────────────────────────────────────────────
const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const moneyRaw = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

function buildCartLineId(type: 'product' | 'service' | 'hotel' | 'grooming', ...parts: Array<string | number | null | undefined>) {
  return [type, ...parts.filter((part) => part !== undefined && part !== null && String(part).trim() !== '')]
    .map((part) => String(part).replace(/\s+/g, '-'))
    .join(':');
}

function PosPageContent() {
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<any>(null);
  const [showHotelCheckout, setShowHotelCheckout] = useState(false);
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  // Realtime input fields for customer cash
  const [customerMoneyInput, setCustomerMoneyInput] = useState<string>('');

  // ── Store ──────────────────────────────────────────────────────
  const store = usePosStore();
  const activeTab = useActiveTab();
  const cartTotal = useCartTotal();
  const cartCount = useCartItemCount();

  // ── Mutations ──────────────────────────────────────────────────
  const createOrder = useCreateOrder();
  
  // ── URL Search Params ──────────────────────────────────────────
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && !store.tabs.find(t => t.existingOrderId === orderId)) {
      orderApi.get(orderId).then(data => {
        if (data) {
          store.loadExistingOrder({
            orderId: data.id,
            orderNumber: data.orderNumber || data.id,
            paymentStatus: data.paymentStatus || 'PENDING',
            amountPaid: data.paidAmount ?? data.amountPaid ?? 0,
            branchId: data.branchId,
            customerId: data.customer?.id,
            customerName: data.customer?.name || data.customer?.fullName || 'Khách lẻ',
            cart: data.items.map((i: any) => ({
              id: i.id,
              orderItemId: i.id,
              productId: i.productId,
              productVariantId: i.productVariantId,
              serviceId: i.serviceId,
              serviceVariantId: i.serviceVariantId,
              petId: i.petId,
              description: i.name || i.description,
              sku: i.sku || '',
              unitPrice: i.unitPrice || 0,
              type: i.type || 'product',
              image: i.image || '',
              unit: i.unit || 'cái',
              quantity: i.quantity || 1,
              hotelDetails: i.hotelDetails ? {
                petId: i.hotelDetails.petId,
                checkIn: i.hotelDetails.checkInDate,
                checkOut: i.hotelDetails.checkOutDate,
                stayId: i.hotelStayId,
                lineType: i.hotelDetails.lineType ?? 'REGULAR',
              } : undefined,
              groomingDetails: i.groomingDetails ? {
                petId: i.groomingDetails.petId,
                performerId: i.groomingDetails.performerId,
                startTime: i.groomingDetails.startTime,
                notes: i.groomingDetails.notes,
                serviceItems: i.groomingDetails.serviceItems,
              } : undefined,
            })),
            discountTotal: data.discount || 0,
            shippingFee: data.shippingFee || 0,
            notes: data.notes || '',
          });
          // Xóa param trên URL để không loop nạp lại khi F5 nếu không cần
          window.history.replaceState({}, '', '/pos');
        }
      }).catch(console.error);
    }
  }, [searchParams, store]);
  
  const { data: branches = [] } = useBranches();

  // ── Keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); store.addTab(); }
      if (e.key === 'F8') { 
        e.preventDefault(); 
        document.getElementById('customer_money_input')?.focus(); 
      }
      if (e.key === 'F9') {
        e.preventDefault();
        handleCheckout('CASH');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cartCount, store, activeTab]);

  useEffect(() => {
    if (!customerMoneyInput || Number(customerMoneyInput.replace(/\D/g, '')) < cartTotal) {
       // logic skipped
    }
  }, [cartTotal]);

  const guestMoney = customerMoneyInput ? Number(customerMoneyInput.replace(/\D/g, '')) : 0;
  const returnMoney = guestMoney > cartTotal ? guestMoney - cartTotal : 0;

  // ── Add to cart ────────────────────────────────────────────────
  const handleAddItem = useCallback(
    (item: any) => {
      const isHotel = item.type === 'hotel' || item.name?.toLowerCase().includes('lưu chuồng');
      const isGrooming = item.type === 'grooming' || item.duration !== undefined;

      if (isHotel || isGrooming) {
        setSelectedServiceForBooking(item);
        return;
      }

      store.addItem({
        id: buildCartLineId(
          item.duration === undefined ? 'product' : 'service',
          item.id,
          item.variants?.length ? item.variants[0].id : 'base',
        ),
        productId: item.duration === undefined ? item.id : undefined,
        productVariantId: item.variants?.length ? item.variants[0].id : undefined,
        serviceId: item.duration !== undefined ? item.id : undefined,
        description: item.name,
        sku: item.variants?.length ? item.variants[0].sku || item.sku : item.sku,
        unitPrice: item.variants?.length ? (item.variants[0].sellingPrice ?? item.variants[0].price ?? 0) : (item.sellingPrice ?? item.price ?? 0),
        type: item.duration === undefined ? 'product' : 'service',
        image: item.image,
        unit: item.unit ?? 'cái',
        variants: item.variants,
        variantName: item.variants?.length ? item.variants[0].name : undefined,
        stock: item.stock,
        availableStock: item.availableStock,
        trading: item.trading,
        reserved: item.reserved,
        branchStocks: item.branchStocks,
      });
    },
    [store],
  );

  // ── Checkout ───────────────────────────────────────────────────
  const handleCheckout = useCallback(
    async (paymentMethod: string, overrideNote?: string) => {
      if (!activeTab || activeTab.cart.length === 0) return;

      const payload: CreateOrderPayload = {
        customerName: activeTab.customerName,
        customerId: activeTab.customerId === 'GUEST' ? undefined : activeTab.customerId,
        branchId: activeTab.branchId,
        items: activeTab.cart.map((ci) => ({
          id: ci.orderItemId,
          productId: ci.productId,
          productVariantId: ci.productVariantId,
          serviceId: ci.serviceId && ci.serviceId !== 'EXTERNAL' ? ci.serviceId : undefined,
          serviceVariantId: ci.serviceVariantId,
          petId: ci.petId,
          description: ci.description,
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          discountItem: ci.discountItem,
          vatRate: ci.vatRate,
          type: ci.type,
          groomingDetails: ci.groomingDetails ? {
            petId: ci.groomingDetails.petId,
            performerId: ci.groomingDetails.performerId,
            startTime: ci.groomingDetails.startTime,
            notes: ci.groomingDetails.notes,
          } : undefined,
          hotelDetails: ci.hotelDetails ? {
            petId: ci.hotelDetails.petId,
            checkInDate: ci.hotelDetails.checkIn,
            checkOutDate: ci.hotelDetails.checkOut,
            branchId: activeTab.branchId,
            lineType: ci.hotelDetails.lineType,
          } : undefined,
        })),
        payments: !activeTab.existingOrderId && paymentMethod !== 'UNPAID' ? [{ method: paymentMethod, amount: cartTotal }] : undefined,
        discount: activeTab.discountTotal,
        shippingFee: activeTab.shippingFee,
        notes: overrideNote || activeTab.notes,
      };

      const hasServiceItems = activeTab.cart.some((item) =>
        item.type === 'service' || item.type === 'hotel' || item.type === 'grooming' || item.groomingDetails || item.hotelDetails,
      );

      let orderResult: any;

      if (activeTab.existingOrderId) {
        // Đơn đã tồn tại -> Chỉ cho phép thanh toán thêm
        orderResult = await orderApi.update(activeTab.existingOrderId, payload);
        const outstanding = Math.max(0, (orderResult?.total ?? cartTotal) - (orderResult?.paidAmount ?? orderResult?.amountPaid ?? 0));

        if (paymentMethod !== 'UNPAID') {
          if (hasServiceItems) {
            if (outstanding > 0) {
              orderResult = await orderApi.pay(activeTab.existingOrderId, {
                payments: [{ method: paymentMethod, amount: outstanding }],
              });
            }
          } else {
            const overpaid = Math.max(0, (orderResult?.paidAmount ?? orderResult?.amountPaid ?? 0) - (orderResult?.total ?? cartTotal));
            if (overpaid > 0) {
              const shouldRefund = window.confirm(
                `Đơn đang dư ${money(overpaid)} đ. Nhấn OK để hoàn tiền ngay, hoặc Cancel để giữ lại công nợ âm cho khách.`,
              );
              orderResult = await orderApi.complete(activeTab.existingOrderId, shouldRefund
                ? { overpaymentAction: 'REFUND', refundMethod: paymentMethod }
                : { overpaymentAction: 'KEEP_CREDIT' });
            } else {
              orderResult = await orderApi.complete(activeTab.existingOrderId, outstanding > 0 ? {
                payments: [{ method: paymentMethod, amount: outstanding }],
              } : {});
            }
          }
        }
      } else {
        // Đơn tạo mới
        orderResult = await createOrder.mutateAsync(payload);
      }
      
      store.setReceiptData({
        ...payload,
        id: orderResult?.id,
        code: orderResult?.orderNumber || `ORD-${Math.floor(Math.random() * 10000)}`,
        total: orderResult?.total ?? cartTotal,
        paidAmount: orderResult?.paidAmount ?? orderResult?.amountPaid ?? payload.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) ?? 0,
      });
      setCustomerMoneyInput('');
    },
    [activeTab, cartTotal, createOrder, store],
  );

  if (!activeTab) return null;

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] font-sans text-gray-800 overflow-hidden">
      {/* ═══ HEADER (V1 KiotViet Style) ═══ */}
      <header className="relative z-50 flex items-center justify-between px-2 lg:px-3 h-[50px] bg-[#0089A1] text-white shrink-0 gap-2">
        
        {/* Left: Search Bar & Tabs */}
        <div className="flex-1 lg:flex-none lg:w-2/3 flex items-end h-full">
          {/* Search + Barcode + OutOfStock toggle */}
          <div className="flex items-center gap-2 w-full lg:w-auto h-full py-1.5 pb-2">
            
            {/* Mobile LogOut */}
            <button 
              className="lg:hidden p-1.5 hover:bg-white/20 rounded text-red-100 transition-colors shrink-0" 
              title="Thoát"
              onClick={() => {
                if(window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                   window.location.href = '/';
                }
              }}
            >
              <LogOut size={20} />
            </button>

            {/* Desktop Menu */}
            <Menu size={20} className="cursor-pointer hover:opacity-80 transition-opacity hidden lg:block shrink-0" />
            
            <div className="flex-1 lg:w-[300px] lg:flex-none">
              <PosProductSearch onSelect={handleAddItem} />
            </div>
            
            <button 
              className={`hidden lg:block p-1.5 hover:bg-white/20 rounded border transition-colors shrink-0 ${store.isMultiSelect ? 'border-amber-400 text-amber-400 bg-white/10' : 'border-white/20 text-white'}`} 
              title={store.isMultiSelect ? "Tắt chọn nhiều" : "Bật chọn nhiều (Thêm nhanh nhiều sản phẩm liên tục)"}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                store.setIsMultiSelect(!store.isMultiSelect);
              }}
            >
              <ListChecks size={18} />
            </button>
            
            <button 
              className="p-1.5 hover:bg-white/20 rounded border border-white/20 transition-colors shrink-0" 
              title={store.outOfStockHidden ? "Đang ẩn sản phẩm hết hàng" : "Đang hiện sản phẩm hết hàng"}
              onClick={() => store.setOutOfStockHidden(!store.outOfStockHidden)}
            >
              {store.outOfStockHidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Nav Tabs next to search bar */}
          <div className="hidden lg:flex flex-1 flex-row items-end overflow-hidden ml-3 h-full">
            <div className="flex gap-0.5 h-full items-end no-scrollbar overflow-x-auto">
              {store.tabs.map((tab) => {
                const isActive = tab.id === store.activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => store.setActiveTab(tab.id)}
                    className={`
                      group flex items-center h-[36px] gap-2 px-3 rounded-t-lg cursor-pointer 
                      transition-colors min-w-[100px] max-w-[180px] border-t border-l border-r border-[#006e82]/50
                      ${isActive 
                        ? 'bg-white text-gray-800 font-semibold' 
                        : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}
                    `}
                  >
                    <span className="truncate flex-1 text-[13px] font-medium">{tab.title}</span>
                    <Zap size={12} className={isActive ? "text-amber-500" : "text-white/50"} />
                    {store.tabs.length > 1 && (
                      <button
                        className={`p-0.5 ml-1 rounded-sm flex items-center justify-center
                          ${isActive ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-white/60 hover:text-white hover:bg-white/20"}
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.closeTab(tab.id);
                        }}
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              })}
              
              <button
                onClick={() => store.addTab()}
                className="bg-[#00A1BC] hover:bg-[#00B4D1] text-white rounded-t-lg px-2.5 h-[36px] ml-1 flex items-center justify-center transition-colors border-t border-l border-r border-[#00A1BC]"
                title="Tạo đơn mới (F2)"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 py-1.5">
          <div className="flex items-center gap-2 px-2 border-r border-white/20">
            <span className="text-sm font-medium">Quản trị viên</span>
            <PosBranchSelect />
          </div>
          
          <div className="flex items-center gap-1.5">
            <button className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Toàn màn hình" onClick={() => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen();
              }}>
              <Maximize size={18} />
            </button>
            <Link href="/" target="_blank" className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Về trang quản lý">
              <Home size={18} />
            </Link>
            <div className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Cài đặt">
              <PosSettingsPanel />
            </div>
            <PosNotifications />
          </div>

          <button 
            className="flex items-center gap-2 bg-[#006E82] hover:bg-[#005767] text-white px-3 py-1.5 rounded text-sm font-bold transition-colors ml-1" 
            title="Lưu nháp / Thoát"
            onClick={() => {
                if(window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                   window.location.href = '/';
                }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ═══ MAIN POS AREA ═══ */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr_auto] overflow-y-auto lg:overflow-hidden bg-[#f0f2f5] relative">
        
        {/* 3. CART VIEW (Mobile: 3rd, Desktop: Left Col, Row 1-3) */}
        <div className="order-3 lg:col-start-1 lg:row-start-1 lg:row-span-3 flex flex-col bg-white shadow-sm z-10 lg:overflow-hidden min-h-[400px]">
          
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
            <div className="text-center">#</div>
            <div></div>
            <div className="text-center">Ảnh</div>
            <div>Sản phẩm / SKU</div>
            <div className="text-center">Đơn vị</div>
            <div className="text-center">Số lượng</div>
            <div className="text-right">Đơn giá</div>
            <div className="text-right">Thành tiền</div>
          </div>

          {/* Table Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto w-full no-scrollbar">
            {activeTab.cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <ShoppingCart size={64} className="opacity-20" />
                <p className="text-lg">Đơn hàng trống</p>
                <p className="text-sm">Hãy tìm kiếm sản phẩm hoặc quét mã vạch (F1)</p>
              </div>
            ) : (
              activeTab.cart.map((item, idx) => {
              const itemVariants = item.variants || [];
              const isConversion = (v: any) => {
                if (!v.conversions) return false;
                try {
                  const parsed = JSON.parse(v.conversions);
                  return !!(parsed?.rate || parsed?.conversionRate || parsed?.mainQty);
                } catch { return false; }
              };
              const trueVariants = itemVariants.filter((v: any) => !isConversion(v));
              const allConversionVariants = itemVariants.filter(isConversion);
              
              // We need to figure out if the current selection is a conversion
              const currentVariantObj = itemVariants.find(v => v.id === item.productVariantId);
              const isCurrentConversion = currentVariantObj ? isConversion(currentVariantObj) : false;

              let currentTrueVariant: any = null;
              if (currentVariantObj) {
                if (isCurrentConversion) {
                  currentTrueVariant = trueVariants.find((tv: any) => currentVariantObj.name.startsWith(tv.name + ' - '));
                } else {
                  currentTrueVariant = currentVariantObj;
                }
              }

              // Only show conversions that belong to the currently selected true variant
              // If no true variant is selected, only show loose conversions
              const conversionVariants = currentTrueVariant 
                ? allConversionVariants.filter((cv: any) => cv.name.startsWith(currentTrueVariant.name + ' - '))
                : allConversionVariants.filter((cv: any) => !trueVariants.some((tv: any) => cv.name.startsWith(tv.name + ' - ')));

              return (
                <div key={item.id} className="flex flex-col border-b border-gray-100 hover:bg-primary-50/30 transition-colors group">
                  
                  {/* ─── DESKTOP ROW ─── */}
                  <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-3">
                    <div className="text-center text-gray-500 text-sm">{idx + 1}</div>
                    
                    <div className="flex justify-center">
                      <button 
                        onClick={() => store.removeItem(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Xoá"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="w-10 h-10 rounded border border-gray-200 overflow-hidden flex items-center justify-center bg-white text-gray-400">
                        {item.image ? (
                          <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                        ) : (
                          item.type === 'service' ? <Scissors size={18} /> : <Package size={18} />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col pr-2 min-w-0">
                      <div className="font-medium text-sm text-gray-800 flex items-center gap-2 min-w-0" title={item.description}>
                        <span className="truncate shrink">{item.description}</span>
                        {trueVariants.length > 0 && (
                          <div className="relative inline-block shrink-0">
                            <select 
                              className="appearance-none bg-orange-50 text-orange-600 text-[11px] font-medium px-2 py-0.5 rounded pr-4 outline-none cursor-pointer border border-orange-100 hover:border-orange-200 focus:ring-1 focus:ring-orange-300 transition-all text-center"
                              value={(!isCurrentConversion && item.productVariantId) ? item.productVariantId : ''}
                              onChange={(e) => store.updateItemVariant(item.id, e.target.value)}
                            >
                              <option value="base" className="hidden">Phiên bản</option>
                              {trueVariants.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" size={10} />
                          </div>
                        )}

                        {/* Stock Popover */}
                        <div className="group/stock relative shrink-0 z-[60] flex">
                          <Info size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover/stock:text-[#0089A1] cursor-help transition-all" />
                          <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto transition-all duration-200 p-0 pointer-events-none before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-[100]">
                            <div className="bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden w-full h-full">
                              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                              <Link 
                                href={item.productId ? `/products/${item.productId}` : '#'} 
                                target="_blank" 
                                className="font-bold text-[13px] text-gray-800 hover:text-[#0089A1] hover:underline leading-tight block cursor-pointer transition-colors"
                              >
                                {currentTrueVariant ? currentTrueVariant.name : item.description}
                              </Link>
                              <div className="text-[10px] text-gray-500 mt-0.5 font-medium tracking-wide uppercase">{currentTrueVariant ? (currentTrueVariant.sku || item.sku || 'N/A') : (item.sku || 'N/A')}</div>
                            </div>
                            
                            <div className="px-4 py-3">
                              <table className="w-full text-xs text-right whitespace-nowrap">
                                <thead>
                                  <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="text-left font-semibold pb-2"></th>
                                    <th className="font-semibold pb-2 px-2">TỒN</th>
                                    <th className="font-semibold pb-2 px-2 text-[#0089A1]">KHẢ DỤNG</th>
                                    <th className="font-semibold pb-2 pl-2">ĐÃ BÁN</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const targetStockInfo = currentTrueVariant ? currentTrueVariant : item;
                                    const targetBranchStocks = Array.isArray((targetStockInfo as any).branchStocks) ? (targetStockInfo as any).branchStocks : [];
                                    
                                    return (
                                      <>
                                        <tr className="border-b border-gray-50">
                                          <td className="text-left py-2.5 font-semibold text-gray-800">Tổng tồn kho</td>
                                          <td className="px-2 py-2.5">{(targetStockInfo as any).stock ?? '—'}</td>
                                          <td className="px-2 py-2.5 text-[#0089A1] font-bold">
                                            {(targetStockInfo as any).availableStock !== undefined 
                                              ? (targetStockInfo as any).availableStock 
                                              : (((targetStockInfo as any).stock !== undefined && (targetStockInfo as any).stock !== null) 
                                                  ? (targetStockInfo as any).stock - ((targetStockInfo as any).trading || (targetStockInfo as any).reserved || 0) 
                                                  : '—')}
                                          </td>
                                          <td className="pl-2 py-2.5">{(targetStockInfo as any).trading ?? '—'}</td>
                                        </tr>
                                        {branches.filter((b: any) => b.isActive).map((b: any) => {
                                          const bs = targetBranchStocks.find((s: any) => s.branchId === b.id || s.branch?.id === b.id);
                                          const stock = bs ? bs.stock ?? 0 : 0;
                                          const reserved = bs ? bs.reservedStock ?? 0 : 0;
                                          const availableStock = bs !== undefined && bs !== null && bs.availableStock !== undefined && bs.availableStock !== null
                                            ? bs.availableStock 
                                            : (stock - reserved);
                                            
                                          return (
                                            <tr key={b.id} className="border-b border-gray-50 last:border-0 border-dashed">
                                              <td className="text-left py-2 font-medium text-gray-600 truncate max-w-[120px]">{b.name}</td>
                                              <td className="px-2 py-2">{stock}</td>
                                              <td className="px-2 py-2 text-[#0089A1]/80">{availableStock}</td>
                                              <td className="pl-2 py-2">—</td>
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
                      </div>
                      
                      <div className="text-xs flex items-center mt-0.5 mb-1 w-full gap-2 group/note min-h-[20px]">
                        <span className="text-gray-500 shrink-0 font-medium">{item.sku || 'N/A'}</span>
                        {noteEditingId === item.id ? (
                          <input
                            type="text"
                            placeholder="Ghi chú sản phẩm..."
                            defaultValue={item.itemNotes || ''}
                            autoFocus
                            onBlur={(e) => {
                              if (e.target.value !== item.itemNotes) {
                                store.updateItemNotes(item.id, e.target.value);
                              }
                              setNoteEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                store.updateItemNotes(item.id, e.currentTarget.value);
                                setNoteEditingId(null);
                              } else if (e.key === 'Escape') {
                                setNoteEditingId(null);
                              }
                            }}
                            className="flex-1 min-w-[80px] h-6 px-1.5 text-[11px] bg-white/50 border border-amber-300 focus:border-amber-500 focus:bg-white focus:outline-none rounded transition-all text-amber-700 placeholder:text-gray-400"
                          />
                        ) : (
                          <div 
                            className="flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => setNoteEditingId(item.id)}
                            title={item.itemNotes ? "Sửa ghi chú" : "Thêm ghi chú"}
                          >
                            {item.itemNotes ? (
                              <span className="text-[11px] text-amber-600 font-medium italic truncate max-w-[200px] flex items-center gap-1">
                                <span>📝</span>
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
                      {item.hotelDetails && (
                        <div className="text-[10px] text-primary-600 mt-0.5 bg-primary-50 w-fit px-1 rounded">
                           In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()}
                           {' - '}
                           Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="text-center text-sm text-gray-600 flex justify-center">
                      {conversionVariants.length > 0 ? (
                        <div className="relative inline-block shrink-0">
                          <select 
                            className="appearance-none bg-blue-50 text-blue-600 text-[11px] font-medium px-2 py-0.5 rounded pr-4 outline-none cursor-pointer border border-blue-100 hover:border-blue-200 focus:ring-1 focus:ring-blue-300 transition-all text-center"
                            value={isCurrentConversion ? item.productVariantId : 'base'}
                            onChange={(e) => {
                              if (e.target.value === 'base') {
                                store.updateItemVariant(item.id, currentTrueVariant ? currentTrueVariant.id : 'base');
                              } else {
                                store.updateItemVariant(item.id, e.target.value);
                              }
                            }}
                          >
                            <option value="base">{item.unit || 'cái'}</option>
                            {conversionVariants.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={10} />
                        </div>
                      ) : (
                        item.unit || 'cái'
                      )}
                    </div>

                    <div className="flex items-center justify-center">
                      <div className="flex items-center border border-gray-300 rounded overflow-hidden h-8 bg-white focus-within:border-primary-500">
                        <button 
                          className="px-2 text-gray-500 hover:bg-gray-100 h-full"
                          onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <input 
                          type="text" 
                          value={item.quantity ?? 1}
                          onChange={(e) => {
                            const v = parseInt(e.target.value.replace(/\D/g, ''));
                            store.updateQuantity(item.id, isNaN(v) ? 1 : v);
                          }}
                          className="w-10 text-center font-semibold text-sm outline-none border-none h-full"
                        />
                        <button 
                          className="px-2 text-gray-500 hover:bg-gray-100 h-full"
                          onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="text-right flex items-center justify-end">
                      <input 
                        type="text" 
                        className="w-24 text-right text-sm font-medium border-b border-dashed border-gray-300 bg-transparent outline-none focus:border-primary-500 pb-0.5"
                        value={money(item.unitPrice)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, ''));
                          store.updateItemPrice(item.id, isNaN(val) ? 0 : val);
                        }}
                      />
                    </div>

                    <div className="text-right text-sm font-bold text-gray-800">
                      {moneyRaw((item.unitPrice || 0) * (item.quantity || 1))}
                    </div>
                  </div>

                  {/* ─── MOBILE ROW ─── */}
                  <div className="flex lg:hidden p-3 gap-3 relative">
                    <div className="w-[60px] h-[60px] shrink-0 rounded border border-gray-200 overflow-hidden flex items-center justify-center bg-white text-gray-400">
                      {item.image ? (
                        <img src={item.image} alt={item.description} className="w-full h-full object-cover" />
                      ) : (
                        item.type === 'service' ? <Scissors size={24} /> : <Package size={24} />
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col pr-8">
                      <div className="font-medium text-[14px] text-gray-800 leading-tight mb-1 flex items-center gap-2 flex-wrap" title={item.description}>
                        <span>{item.description}</span>
                        {trueVariants.length > 0 && (
                          <div className="relative inline-block shrink-0 mt-0.5">
                            <select 
                              className="appearance-none bg-orange-50 text-orange-600 text-[11px] font-medium px-2 py-0.5 rounded pr-4 outline-none cursor-pointer border border-orange-100 hover:border-orange-200 transition-all text-center"
                              value={(!isCurrentConversion && item.productVariantId) ? item.productVariantId : ''}
                              onChange={(e) => store.updateItemVariant(item.id, e.target.value)}
                            >
                              <option value="base" className="hidden">Phiên bản</option>
                              {trueVariants.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-orange-500 pointer-events-none" size={10} />
                          </div>
                        )}
                        
                        {/* Mobile Stock Popover */}
                        <Info size={16} className="text-[#0089A1] ml-1 cursor-pointer" onClick={() => window.alert(`Tổng tồn: ${(item as any).stock ?? '—'}\nKhả dụng: ${(item as any).availableStock ?? '—'}`)} />

                        {conversionVariants.length > 0 && (
                           <div className="relative inline-block shrink-0 mt-0.5 ml-2">
                            <select 
                              className="appearance-none bg-blue-50 text-blue-600 text-[11px] font-medium px-2 py-0.5 rounded pr-4 outline-none cursor-pointer border border-blue-100 hover:border-blue-200 transition-all text-center"
                              value={isCurrentConversion ? item.productVariantId : 'base'}
                              onChange={(e) => {
                                if (e.target.value === 'base') {
                                  store.updateItemVariant(item.id, currentTrueVariant ? currentTrueVariant.id : 'base');
                                } else {
                                  store.updateItemVariant(item.id, e.target.value);
                                }
                              }}
                            >
                              <option value="base">{item.unit || 'cái'}</option>
                              {conversionVariants.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={10} />
                           </div>
                        )}
                      </div>
                      <div className="text-[12px] text-gray-500 mb-0.5 uppercase tracking-wide">SKU: {item.sku || 'N/A'}</div>
                      <div className="text-[14px] font-bold text-gray-800">{moneyRaw(item.unitPrice)}</div>
                      {item.hotelDetails && (
                        <div className="text-[10px] text-primary-600 mt-1 bg-primary-50 w-fit px-1.5 py-0.5 rounded">
                           In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()}
                           {' - '}
                           Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    {/* Delete item button */}
                    <button 
                      onClick={() => store.removeItem(item.id)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                    >
                      <X size={20} />
                    </button>
                    
                    {/* Quantity control */}
                    <div className="absolute bottom-2 right-2">
                      <div className="flex items-center border border-gray-300 rounded overflow-hidden h-[32px] bg-white text-gray-700">
                        <button 
                          className="px-2.5 hover:bg-gray-100 h-full flex items-center justify-center"
                          onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) - 1)}
                        >
                          <Minus size={16} />
                        </button>
                        <input 
                          type="text" 
                          value={item.quantity ?? 1}
                          onChange={(e) => {
                            const v = parseInt(e.target.value.replace(/\D/g, ''));
                            store.updateQuantity(item.id, isNaN(v) ? 1 : v);
                          }}
                          className="w-10 text-center font-bold text-[14px] outline-none border-none h-full bg-transparent"
                        />
                        <button 
                          className="px-2.5 hover:bg-gray-100 h-full flex items-center justify-center"
                          onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) + 1)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>

          {/* Bottom Toolbar & Notes */}
          <div className="mt-auto flex flex-col bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2 p-2 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 overflow-x-auto no-scrollbar whitespace-nowrap">
              <button 
                className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors"
                onClick={() => {
                  const check = window.confirm('Xác nhận làm mới Đơn hàng?');
                  if (check) store.clearCart();
                }}
              >Xoá tất cả</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Khuyến mại</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Đổi trả hàng</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Xem đơn hàng</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">In phiếu</button>
              
              <div className="flex-1"></div>
              
              <button 
                onClick={() => setShowHotelCheckout(true)}
                className="px-4 py-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded hover:bg-amber-100 transition-colors font-medium"
              >
                + Trả chuồng (Hotel)
              </button>
              
              <button className="px-4 py-1.5 text-sm bg-primary-50 border border-primary-200 text-primary-700 rounded hover:bg-primary-100 transition-colors font-medium">
                + Sản phẩm tạm
              </button>
            </div>
            
            <div className="p-2 px-4 bg-white border-t border-gray-200">
              <input 
                type="text" 
                placeholder="Gõ để ghi chú đơn hàng..." 
                className="w-full text-sm outline-none border-none py-1 placeholder:text-gray-400 italic"
                value={activeTab.notes || ''}
                onChange={(e) => store.setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 1. CUSTOMER & PETS (Mobile: 1st, Desktop: Right Col, Row 1) */}
        <div className="order-1 lg:col-start-2 lg:row-start-1 bg-white border-b lg:border-l lg:border-b-0 border-gray-200 z-30 relative">
          <PosCustomerV1 />
        </div>

        {/* 4. CALCULATION AREA (Mobile: 4th, Desktop: Right Col, Row 2) */}
        <div className="order-4 lg:col-start-2 lg:row-start-2 bg-white lg:border-l border-gray-200 z-20 flex-1 flex flex-col p-4 overflow-y-auto">
            
          <div className="mt-auto flex flex-col gap-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm font-medium text-gray-600">Tổng ({cartCount} SP)</span>
              <span className="text-sm font-bold">{moneyRaw(cartTotal)}</span>
            </div>
            
            <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 pb-3">
              <span className="text-sm text-primary-600 cursor-pointer hover:underline decoration-dashed decoration-primary-400 underline-offset-4">Chiết khấu (F6)</span>
              <div className="flex items-center">
                <input 
                  className="w-24 text-right text-sm border-b border-gray-300 outline-none focus:border-primary-500 pb-0.5"
                  value={activeTab.discountTotal > 0 ? money(activeTab.discountTotal) : '0'}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/\D/g, ''));
                    store.setDiscount(isNaN(v) ? 0 : v);
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-[15px] font-bold text-gray-800">KHÁCH PHẢI TRẢ</span>
              <span className="text-xl font-bold text-red-600">{moneyRaw(cartTotal - activeTab.discountTotal)}</span>
            </div>

            <div className="flex justify-between items-center py-1 mt-2">
              <span className="text-sm font-medium text-gray-600 cursor-pointer" onClick={() => document.getElementById('customer_money_input')?.focus()}>
                Tiền khách đưa (F8)
              </span>
              <div className="flex items-center">
                <input 
                  id="customer_money_input"
                  className="w-32 text-right text-base border-b border-gray-300 outline-none focus:border-primary-500 font-semibold pb-0.5"
                  value={customerMoneyInput}
                  onChange={(e) => {
                     let val = e.target.value.replace(/\D/g, '');
                     if (val) {
                       setCustomerMoneyInput(money(parseInt(val)));
                     } else {
                       setCustomerMoneyInput('');
                     }
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-gray-500">Tiền thừa trả khách</span>
              <span className={`text-sm font-bold ${returnMoney > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                {guestMoney === 0 ? '0 đ' : moneyRaw(returnMoney)}
              </span>
            </div>
          </div>
            
        </div>

        {/* 5. BUTTONS AREA (Mobile: 5th, Desktop: Right Col, Row 3) */}
        <div className="order-5 lg:col-start-2 lg:row-start-3 bg-gray-50 border-t border-b lg:border-b-0 lg:border-l border-gray-200 z-20 p-4 flex flex-col gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
            <div className="grid grid-cols-2 gap-3">
              <button 
                className="py-2.5 bg-white border border-gray-300 hover:border-primary-500 text-gray-700 rounded-lg text-[13px] font-bold uppercase transition-colors flex items-center justify-center shadow-sm"
                onClick={() => setShowBookingModal(true)}
                disabled={cartCount === 0}
              >
                ĐẶT HÀNG
              </button>
              <button 
                className="py-2.5 bg-white border border-gray-300 hover:border-primary-500 text-gray-700 rounded-lg text-[13px] font-bold uppercase transition-colors flex items-center justify-center shadow-sm"
                onClick={() => setShowPaymentModal(true)}
              >
                ĐỔI TT
              </button>
            </div>
            <button 
              className={`w-full py-4 text-white text-lg font-bold rounded-lg uppercase shadow-lg transition-transform active:scale-[0.98] ${cartCount > 0 ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/30' : 'bg-gray-400 cursor-not-allowed shadow-none'}`}
              onClick={() => {
                 const method = activeTab.payments && activeTab.payments.length > 0 ? activeTab.payments[0].method : 'CASH';
                 handleCheckout(method as string);
              }}
              disabled={cartCount === 0}
            >
              Thanh Toán (F9)
            </button>
        </div>

      </main>

      {/* ═══ MODALS ═══ */}
      <ServiceBookingModal
        isOpen={!!selectedServiceForBooking}
        onClose={() => setSelectedServiceForBooking(null)}
        service={selectedServiceForBooking}
        customerId={activeTab?.customerId}
        onConfirm={(details) => {
          const cartItem = {
            id: buildCartLineId(
              details.type === 'hotel' ? 'hotel' : 'grooming',
              selectedServiceForBooking.id,
              details.details?.petId,
              details.type === 'hotel' ? details.details?.checkInDate : details.details?.startTime,
              details.type === 'hotel' ? details.details?.checkOutDate : undefined,
            ),
            serviceId: selectedServiceForBooking.id,
            description: selectedServiceForBooking.name,
            sku: selectedServiceForBooking.sku,
            unitPrice: selectedServiceForBooking.sellingPrice ?? selectedServiceForBooking.price ?? 0,
            type: 'service' as const,
            image: selectedServiceForBooking.image,
            unit: 'lần',
            groomingDetails: details.type === 'grooming' ? details.details : undefined,
            hotelDetails: details.type === 'hotel' ? details.details : undefined,
            quantity: 1,
            petId: details.details?.petId,
          };
          store.addItem(cartItem);
          setSelectedServiceForBooking(null);
        }}
      />

      <HotelCheckoutModal
        isOpen={showHotelCheckout}
        onClose={() => setShowHotelCheckout(false)}
        customerId={activeTab?.customerId}
        onConfirm={(checkoutInfo) => {
           store.addItem(checkoutInfo);
           setShowHotelCheckout(false);
        }}
      />

      <ReceiptModal 
        isOpen={!!store.receiptData}
        orderData={store.receiptData}
        onClose={() => {
          store.setReceiptData(null);
          store.resetActiveTab();
        }}
      />

      <PosPaymentModal 
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartTotal={cartTotal}
        initialMethod={activeTab?.payments?.[0]?.method || 'CASH'}
        initialCustomerMoney={customerMoneyInput}
        onConfirm={(method, moneyObj) => {
          store.setSinglePayment(method as any, cartTotal);
          if (moneyObj) {
            setCustomerMoneyInput(new Intl.NumberFormat('vi-VN').format(moneyObj));
          }
          setShowPaymentModal(false);
        }}
      />

      <PosOrderBookingModal 
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onConfirm={(date, note) => {
          const finalNote = `[HẸN ĐẾN: ${date.replace('T', ' ')}] ${note}`.trim();
          handleCheckout('UNPAID', finalNote); 
          setShowBookingModal(false);
        }}
      />
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#f0f2f5]">Đang tải...</div>}>
      <PosPageContent />
    </Suspense>
  );
}
