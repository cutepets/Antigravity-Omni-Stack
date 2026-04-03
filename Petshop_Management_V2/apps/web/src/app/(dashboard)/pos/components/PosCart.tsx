'use client';

import { useState } from 'react';
import { usePosStore } from '../../../../stores/pos.store';
import CheckoutModal from './CheckoutModal';

export default function PosCart() {
  const store = usePosStore();
  const [showCheckout, setShowCheckout] = useState(false);

  const subtotal = store.items.reduce((acc, item) => acc + (item.price * item.quantity) - item.discountItem, 0);
  const total = subtotal - store.discount + store.shippingFee;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center rounded-t-xl">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          Hóa đơn <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{store.items.length} món</span>
        </h2>
        <button onClick={store.clearCart} className="text-sm text-red-500 hover:text-red-700 font-medium tracking-wide">
          Xóa rỗng
        </button>
      </div>

      {/* Customer */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
          {store.customerName.charAt(0)}
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            value={store.customerName}
            onChange={(e) => store.setCustomer(store.customerId, e.target.value)}
            className="w-full font-semibold text-sm focus:outline-none bg-transparent"
            placeholder="Tên khách hàng"
          />
          <p className="text-xs text-slate-400">Khách vãng lai</p>
        </div>
        <button className="text-blue-500 hover:text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-plus"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
        {store.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-cart mb-2 opacity-50"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            <p className="text-sm">Giỏ hàng trống</p>
          </div>
        ) : (
          <div className="space-y-2">
            {store.items.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-lg border border-slate-100 flex gap-3 shadow-sm group relative">
                {/* Type badge */}
                {item.type !== 'product' && (
                  <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    item.type === 'grooming' ? 'bg-pink-100 text-pink-600' :
                    item.type === 'hotel' ? 'bg-purple-100 text-purple-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {item.type === 'grooming' ? '💅 Spa' : item.type === 'hotel' ? '🏨 Hotel' : '🔧 DV'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm text-slate-800 line-clamp-2 ${item.type !== 'product' ? 'mt-3' : ''}`}>{item.name}</h4>
                  <div className="flex items-center gap-1 mt-1 font-mono text-xs text-slate-500">
                    <span>{item.price.toLocaleString('vi-VN')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  {/* Quantity Control */}
                  <div className="flex items-center gap-2 border rounded-md px-1 bg-slate-50">
                    <button onClick={() => store.updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-black">-</button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button onClick={() => store.updateQuantity(item.id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-black">+</button>
                  </div>
                  <div className="font-bold text-amber-600 mt-2 text-sm">
                    {((item.price * item.quantity) - item.discountItem).toLocaleString('vi-VN')}
                  </div>
                </div>
                <button 
                  onClick={() => store.removeItem(item.id)}
                  className="absolute right-1 top-1 hidden group-hover:block text-slate-300 hover:text-red-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t border-slate-200 bg-white flex flex-col gap-3">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tổng tiền hàng</span>
          <span className="font-medium">{subtotal.toLocaleString('vi-VN')} đ</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600 items-center">
          <span>Chiết khấu</span>
          <div className="relative">
            <input 
              type="number" 
              value={store.discount || ''}
              onChange={(e) => store.setDiscount(Number(e.target.value))}
              placeholder="0"
              className="w-24 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="absolute right-7 top-1.5 text-xs text-slate-400">đ</span>
          </div>
        </div>
        <div className="pt-3 border-t border-dashed flex justify-between items-center mt-1">
          <span className="font-bold text-slate-800 text-lg">Khách cần trả</span>
          <span className="font-bold text-emerald-600 text-xl">{total.toLocaleString('vi-VN')} đ</span>
        </div>
        
        <button 
          onClick={() => setShowCheckout(true)}
          disabled={store.items.length === 0}
          className={`w-full py-3 rounded-lg text-white font-bold tracking-wide mt-2 transition-all flex justify-center items-center gap-2 ${
            store.items.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg'
          }`}
        >
          THANH TOÁN <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        subtotal={subtotal}
        discount={store.discount}
        shippingFee={store.shippingFee}
        total={total}
      />
    </div>
  );
}
