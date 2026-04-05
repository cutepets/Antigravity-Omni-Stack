'use client';

import { useState } from 'react';
import { useActiveTab, useCartItemCount, useCartSubtotal, useCartTotal, usePosStore } from '@/stores/pos.store';
import CheckoutModal from './CheckoutModal';

export default function PosCart() {
  const store = usePosStore();
  const activeTab = useActiveTab();
  const subtotal = useCartSubtotal();
  const total = useCartTotal();
  const cartItemCount = useCartItemCount();
  const [showCheckout, setShowCheckout] = useState(false);

  if (!activeTab) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between rounded-t-xl border-b border-slate-200 bg-slate-50 p-4">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          Hóa đơn{' '}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{cartItemCount} món</span>
        </h2>
        <button onClick={store.clearCart} className="text-sm font-medium tracking-wide text-red-500 hover:text-red-700">
          Xóa rỗng
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-slate-100 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
          {(activeTab.customerName.trim().charAt(0) || 'K').toUpperCase()}
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={activeTab.customerName}
            onChange={(event) => store.setCustomer(activeTab.customerId, event.target.value)}
            className="w-full bg-transparent text-sm font-semibold focus:outline-none"
            placeholder="Tên khách hàng"
          />
          <p className="text-xs text-slate-400">Khách vãng lai</p>
        </div>
        <button className="text-blue-500 hover:text-blue-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-user-plus"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-2">
        {activeTab.cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-shopping-cart mb-2 opacity-50"
            >
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <p className="text-sm">Giỏ hàng trống</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTab.cart.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="group relative flex gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm"
              >
                {item.type !== 'product' ? (
                  <div
                    className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      item.type === 'grooming'
                        ? 'bg-pink-100 text-pink-600'
                        : item.type === 'hotel'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {item.type === 'grooming' ? 'Spa' : item.type === 'hotel' ? 'Hotel' : 'DV'}
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <h4 className={`line-clamp-2 text-sm font-medium text-slate-800 ${item.type !== 'product' ? 'mt-3' : ''}`}>
                    {item.description}
                  </h4>
                  <div className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-500">
                    <span>{item.unitPrice.toLocaleString('vi-VN')}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <div className="flex items-center gap-2 rounded-md border bg-slate-50 px-1">
                    <button
                      onClick={() => store.updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="flex h-5 w-5 items-center justify-center text-slate-500 hover:text-black"
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => store.updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-5 w-5 items-center justify-center text-slate-500 hover:text-black"
                    >
                      +
                    </button>
                  </div>
                  <div className="mt-2 text-sm font-bold text-amber-600">
                    {(item.unitPrice * item.quantity - item.discountItem).toLocaleString('vi-VN')}
                  </div>
                </div>

                <button
                  onClick={() => store.removeItem(item.id)}
                  className="absolute right-1 top-1 hidden text-slate-300 hover:text-red-500 group-hover:block"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tổng tiền hàng</span>
          <span className="font-medium">{subtotal.toLocaleString('vi-VN')} đ</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Chiết khấu</span>
          <div className="relative">
            <input
              type="number"
              value={activeTab.discountTotal || ''}
              onChange={(event) => store.setDiscount(Number(event.target.value))}
              placeholder="0"
              className="w-24 rounded border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="absolute right-7 top-1.5 text-xs text-slate-400">đ</span>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-dashed pt-3">
          <span className="text-lg font-bold text-slate-800">Khách cần trả</span>
          <span className="text-xl font-bold text-emerald-600">{total.toLocaleString('vi-VN')} đ</span>
        </div>

        <button
          onClick={() => setShowCheckout(true)}
          disabled={activeTab.cart.length === 0}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold tracking-wide text-white transition-all ${
            activeTab.cart.length === 0
              ? 'cursor-not-allowed bg-slate-300'
              : 'bg-amber-500 shadow-md hover:bg-amber-600 hover:shadow-lg'
          }`}
        >
          THANH TOÁN
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-arrow-right"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        subtotal={subtotal}
        discount={activeTab.discountTotal}
        shippingFee={activeTab.shippingFee}
        total={total}
      />
    </div>
  );
}
