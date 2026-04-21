'use client';

import { useEffect, useState } from 'react';
import { usePosStore, useActiveTab, useCartTotal, useCartItemCount } from '@/stores/pos.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePosCart } from './_hooks/use-pos-cart';
import { usePosPayment } from './_hooks/use-pos-payment';
import { usePosShiftGuard } from './_hooks/use-pos-shift-guard';
import { useBranches } from '@/app/(dashboard)/_shared/branches/use-branches';
import { HotelCheckoutModal } from './components/HotelCheckoutModal';
import { PosCustomerV1 } from './components/PosCustomerV1';
import { PosSettingsPanel } from './components/PosSettingsPanel';
import { PaymentModal } from '@/app/(dashboard)/_shared/payment/components/PaymentModal';
import { QrPaymentModal } from '@/app/(dashboard)/_shared/payment/components/QrPaymentModal';
import { PosShiftClosingModal } from './components/PosShiftClosingModal';
import { PosOrderBookingModal } from './components/PosOrderBookingModal';
import { PosCartItems } from './components/PosCartItems';
import { PosCheckoutPanel } from './components/PosCheckoutPanel';

import { PosProductSearch } from './components/PosProductSearch';
import { PosNotifications } from './components/PosNotifications';
import { PosBranchSelect } from './components/PosBranchSelect';
import { Menu, X, Plus, Home, NotebookText, Settings, UserCircle2, Bell, LogOut, Maximize, Store, QrCode, EyeOff, Eye, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils';
import { HotelQuickPreviewTool } from '@/components/hotel-quick-preview/HotelQuickPreviewTool';

function PosPageContent() {
  const store = usePosStore();
  const activeTab = useActiveTab();
  const cartTotal = useCartTotal();
  const cartCount = useCartItemCount();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const authUser = useAuthStore((state) => state.user);
  const router = useRouter();
  const {
    showHotelCheckout,
    setShowHotelCheckout,
    selectedHotelPetId,
    setSelectedHotelPetId,
    noteEditingId,
    setNoteEditingId,
    discountEditingId,
    setDiscountEditingId,
    selectedRowIndex,
    handleAddItem,
    handleSelectSuggestedService,
    navigateRowUp,
    navigateRowDown,
    decrementSelectedRow,
    incrementSelectedRow,
    lastAddedItemId,
  } = usePosCart();

  const [showTempProductModal, setShowTempProductModal] = useState(false);
  const {
    currentShift,
    showShiftClosingModal,
    openShiftClosingModal,
    closeShiftClosingModal,
    handleShiftSaved,
  } = usePosShiftGuard();
  const {
    showPaymentModal,
    setShowPaymentModal,
    showBookingModal,
    setShowBookingModal,
    showQrPaymentModal,
    setShowQrPaymentModal,
    customerMoneyInput,
    setCustomerMoneyInput,
    isPaymentMenuOpen,
    setIsPaymentMenuOpen,
    paymentMenuRef,
    displayedQrIntent,
    clearQrIntent,
    isQrIntentPending,
    paymentMethods,
    visiblePaymentMethods,
    allowMultiPayment,
    loyaltyPointValue,
    tabPayments,
    isMultiPaymentSummary,
    currentSinglePaymentMethod,
    currentSinglePaymentType,
    isQrBankPayment,
    guestMoney,
    returnMoney,
    multiPaymentTotal,
    hasServiceItems,
    quickCashSuggestions,
    preferredPaymentMethod,
    handleSelectSinglePaymentMethod,
    handleMultiPaymentConfirm,
    handleGenerateQrPayment,
    handleCheckout,
    handleCreateServiceFlow,
  } = usePosPayment();

  const { data: branches = [] } = useBranches();
  const manualDiscountTotal = activeTab?.manualDiscountTotal ?? activeTab?.discountTotal ?? 0;
  const customerPricing = activeTab?.customerPricing;

  // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!activeTab || !activeBranchId) return;
    if (activeTab.linkedOrderId) return;
    if (activeTab.branchId === activeBranchId) return;
    store.setBranch(activeBranchId);
  }, [activeBranchId, activeTab, store]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Cho phép F-keys ngay cả khi đang focus
      if (e.key === 'F2') {
        e.preventDefault();
        store.addTab();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        document.getElementById('customer_money_input')?.focus();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (hasServiceItems) {
          handleCreateServiceFlow();
        } else {
          const method = activeTab?.payments?.[0]?.method ?? preferredPaymentMethod?.type ?? 'CASH';
          handleCheckout(method as string);
        }
        return;
      }

      const isQuantityInput = activeElement?.id?.startsWith('quantity-input-') || activeElement?.id === 'quantity-input';
      if (isInputFocused && !isQuantityInput) return;
      if (!activeTab || activeTab.cart.length === 0) return;

      if (e.key === 'ArrowUp') {
        if (!isInputFocused) {
          e.preventDefault();
          navigateRowDown();
        }
      } else if (e.key === 'ArrowDown') {
        if (!isInputFocused) {
          e.preventDefault();
          navigateRowUp();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        decrementSelectedRow();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        incrementSelectedRow();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, decrementSelectedRow, handleCheckout, handleCreateServiceFlow, hasServiceItems, incrementSelectedRow, navigateRowDown, navigateRowUp, preferredPaymentMethod?.type, store]);

  if (!activeTab) return null;

  return (
    <div className="flex flex-col h-screen bg-background font-sans text-foreground overflow-hidden">
      {/* â• â• â•  HEADER (V1 KiotViet Style) â• â• â•  */}
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
                if (window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                  window.location.href = '/';
                }
              }}
            >
              <LogOut size={20} />
            </button>

            {/* Desktop Menu */}
            <Menu size={20} className="cursor-pointer hover:opacity-80 transition-opacity hidden lg:block shrink-0" />

            <div className="flex-1 lg:w-[300px] lg:flex-none">
              <PosProductSearch
                onSelect={handleAddItem}
                resultsVariant="pos"
                inputClassName="border border-white/35 bg-white/90 shadow-sm"
              />
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
            {customerPricing?.priceBookName ? (
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white tracking-wide shadow-sm">
                {customerPricing.priceBookName}
              </span>
            ) : null}
            {(customerPricing?.discountRate ?? 0) > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-300/20 px-2.5 py-1 text-xs font-semibold text-amber-100">
                CK: {customerPricing?.discountRate}%
              </span>
            ) : null}
            <span className="text-sm font-medium">{authUser?.fullName ?? 'Nhân viên'}</span>
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
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
            title="Chốt sổ tiền mặt"
            onClick={openShiftClosingModal}
          >
            <NotebookText size={16} />
            <span>Chốt sổ</span>
          </button>

          <button
            className="flex items-center gap-2 bg-[#006E82] hover:bg-[#005767] text-white px-3 py-1.5 rounded text-sm font-bold transition-colors ml-1"
            title="Lưu nháp / Thoát"
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                window.location.href = '/';
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* â• â• â•  MAIN POS AREA â• â• â•  */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_420px] lg:grid-rows-[auto_1fr_auto] overflow-y-auto lg:overflow-hidden bg-background relative">

        {/* 3. CART VIEW (Mobile: 3rd, Desktop: Left Col, Row 1-3) */}
        <div className="order-3 lg:col-start-1 lg:row-start-1 lg:row-span-3 flex flex-col bg-surface shadow-sm z-10 lg:overflow-hidden min-h-[400px]">

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-2 bg-surface-secondary border-b border-border text-[13px] font-semibold text-foreground-muted uppercase">
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
            <PosCartItems
              cart={activeTab.cart}
              branchId={activeTab.branchId}
              branches={branches}
              selectedRowIndex={selectedRowIndex}
              noteEditingId={noteEditingId}
              setNoteEditingId={setNoteEditingId}
              discountEditingId={discountEditingId}
              setDiscountEditingId={setDiscountEditingId}
              lastAddedItemId={lastAddedItemId}
            />
          </div>

          {/* Bottom Toolbar & Notes */}
          <div className="mt-auto flex flex-col bg-surface-secondary border-t border-border">
            <div className="flex items-center gap-2 p-2 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 overflow-x-auto no-scrollbar whitespace-nowrap">
              <button
                className="px-4 py-1.5 text-sm bg-surface border border-border text-foreground rounded hover:border-primary-500 transition-colors"
                onClick={() => {
                  const check = window.confirm('Xác nhận làm mới Đơn hàng?');
                  if (check) store.clearCart();
                }}
              >Xoá tất cả</button>
              <button className="px-4 py-1.5 text-sm bg-surface border border-border text-foreground rounded hover:border-primary-500 transition-colors">Khuyến mại</button>
              <button
                className="px-4 py-1.5 text-sm bg-surface border border-border text-foreground rounded hover:border-primary-500 transition-colors"
                onClick={() => {
                  const url = authUser?.id ? `/orders?staffId=${authUser.id}` : '/orders';
                  router.push(url);
                }}
              >Xem đơn hàng</button>
              <button
                className="px-4 py-1.5 text-sm bg-surface border border-border text-foreground rounded hover:border-primary-500 transition-colors"
                onClick={() => {
                  store.addItem({
                    id: `temp-${Date.now()}`,
                    type: 'product',
                    description: '',
                    unitPrice: 0,
                    quantity: 1,
                    sku: '',
                    isTemp: true,
                  } as any);
                }}
              >+ Sản phẩm tạm</button>
              <HotelQuickPreviewTool
                triggerClassName="h-auto rounded border-border bg-surface px-4 py-1.5 text-foreground hover:border-primary-500 hover:bg-surface"
                triggerLabelClassName=""
              />
            </div>

            <div className="p-2 px-4 bg-surface border-t border-border">
              <input
                type="text"
                placeholder="Gõ để ghi chú đơn hàng..."
                className="w-full text-sm outline-none border-none py-1 placeholder:text-foreground-muted italic text-foreground bg-transparent"
                value={activeTab.notes || ''}
                onChange={(e) => store.setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 1. CUSTOMER & PETS (Mobile: 1st, Desktop: Right Col, Row 1) */}
        <div className="order-1 lg:col-start-2 lg:row-start-1 bg-surface border-b lg:border-l lg:border-b-0 border-border z-30 relative">
          <PosCustomerV1
            onSelectSuggestedService={handleSelectSuggestedService}
          />
        </div>

        {/* 4. CALCULATION AREA + 5. BUTTONS AREA */}
        <PosCheckoutPanel
          activeTab={activeTab}
          cartCount={cartCount}
          cartTotal={cartTotal}
          manualDiscountTotal={manualDiscountTotal}
          paymentMethods={paymentMethods}
          visiblePaymentMethods={visiblePaymentMethods}
          allowMultiPayment={allowMultiPayment}
          loyaltyPointValue={loyaltyPointValue}
          tabPayments={tabPayments}
          isMultiPaymentSummary={isMultiPaymentSummary}
          currentSinglePaymentMethod={currentSinglePaymentMethod}
          currentSinglePaymentType={currentSinglePaymentType}
          customerMoneyInput={customerMoneyInput}
          setCustomerMoneyInput={setCustomerMoneyInput}
          isPaymentMenuOpen={isPaymentMenuOpen}
          setIsPaymentMenuOpen={setIsPaymentMenuOpen}
          paymentMenuRef={paymentMenuRef}
          guestMoney={guestMoney}
          returnMoney={returnMoney}
          multiPaymentTotal={multiPaymentTotal}
          quickCashSuggestions={quickCashSuggestions}
          isQrIntentPending={isQrIntentPending}
          onDiscountChange={(discount) => store.setDiscount(discount)}
          onSelectSinglePaymentMethod={handleSelectSinglePaymentMethod}
          onOpenMultiPayment={() => {
            setIsPaymentMenuOpen(false);
            setShowPaymentModal(true);
          }}
          onOpenBooking={() => setShowBookingModal(true)}
          onPrimaryAction={() => {
            if (hasServiceItems) {
              handleCreateServiceFlow();
              return;
            }

            const method = activeTab.payments?.[0]?.method ?? preferredPaymentMethod?.type ?? 'CASH';
            handleCheckout(method as string);
          }}
          primaryActionLabel={hasServiceItems ? 'Tạo Dịch Vụ (F9)' : 'Thanh Toán (F9)'}
        />

      </main >

      {/* â• â• â•  MODALS â• â• â•  */}
      <HotelCheckoutModal
        isOpen={showHotelCheckout}
        onClose={() => {
          setShowHotelCheckout(false);
          setSelectedHotelPetId(undefined);
        }}
        customerId={activeTab?.customerId}
        initialSelectedPet={selectedHotelPetId}
        onConfirm={(details) => {
          store.addItem(details);
          setShowHotelCheckout(false);
          setSelectedHotelPetId(undefined);
          toast.success('Đã chọn checkout lưu chuồng');
        }}
      />

      {/* ReceiptModal removed: checkout now redirects to /orders/:id */}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartTotal={cartTotal}
        paymentMethods={visiblePaymentMethods}
        initialPayments={activeTab?.payments ?? []}
        customerPoints={activeTab?.customerPoints}
        loyaltyPointValue={loyaltyPointValue}
        minimumMethods={2}
        onConfirm={handleMultiPaymentConfirm}
      />

      <PosShiftClosingModal
        isOpen={showShiftClosingModal}
        currentShift={currentShift}
        onClose={closeShiftClosingModal}
        onSaved={handleShiftSaved}
      />

      <QrPaymentModal
        isOpen={showQrPaymentModal}
        intent={displayedQrIntent}
        onClose={() => {
          setShowQrPaymentModal(false)
          clearQrIntent()
        }}
        onRefresh={isQrBankPayment ? () => void handleGenerateQrPayment() : undefined}
        isRefreshing={isQrIntentPending}
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
    </div >
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#f0f2f5]">Đang tải...</div>}>
      <PosPageContent />
    </Suspense>
  );
}
