'use client';

import { useState } from 'react';
import axios from 'axios';
import { usePosStore } from '../../../../stores/pos.store';
import { customToast as toast } from '@/components/ui/toast-with-copy';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';

export default function CheckoutModal({ isOpen, onClose, subtotal, discount, shippingFee, total }: CheckoutModalProps) {
  const store = usePosStore();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const change = cashReceived > total ? cashReceived - total : 0;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        customerName: store.customerName,
        customerId: store.customerId,
        notes: store.notes,
        discount: store.discount,
        shippingFee: store.shippingFee,
        items: store.items.map(i => ({
          productId: i.type === 'product' ? i.id : undefined,
          serviceId: i.type === 'service' ? i.id : undefined,
          groomingSessionId: i.type === 'grooming' ? i.id : undefined,
          hotelStayId: i.type === 'hotel' ? i.id : undefined,
          description: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          discountItem: i.discountItem,
          type: i.type
        })),
        payments: [
          { method: paymentMethod, amount: total }
        ]
      };

      const res = await axios.post('http://localhost:3001/orders', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setOrderId(res.data?.id || res.data?.data?.id || null);
      setOrderSuccess(true);
      store.clearCart();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Lỗi khi thanh toán');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrderSuccess(false);
    setOrderId(null);
    setCashReceived(0);
    setPaymentMethod('CASH');
    onClose();
  };

  if (!isOpen) return null;

  const methods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'CASH', label: 'Tiền mặt', icon: '💵' },
    { id: 'TRANSFER', label: 'Chuyển khoản', icon: '🏦' },
    { id: 'CARD', label: 'Thẻ', icon: '💳' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        
        {orderSuccess ? (
          /* ====== SUCCESS SCREEN ====== */
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Thanh toán thành công!</h2>
            <p className="text-slate-500 mb-6 text-sm">Đơn hàng đã được tạo thành công.</p>
            
            {change > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 w-full mb-6">
                <p className="text-sm text-amber-700 font-medium">Tiền thừa trả khách</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{change.toLocaleString('vi-VN')} đ</p>
              </div>
            )}

            <button 
              onClick={handleClose}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-md"
            >
              Hoàn tất
            </button>
          </div>
        ) : (
          /* ====== CHECKOUT FORM ====== */
          <>
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Xác nhận thanh toán</h2>
              <p className="text-xs text-slate-500 mt-0.5">{store.items.length} mục · Khách: {store.customerName}</p>
            </div>

            <div className="p-5 space-y-5">
              {/* Order Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tổng tiền hàng</span>
                  <span>{subtotal.toLocaleString('vi-VN')} đ</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Chiết khấu</span>
                    <span className="text-red-500">-{discount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                {shippingFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Phí ship</span>
                    <span>+{shippingFee.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                <div className="pt-2 border-t border-dashed flex justify-between font-bold text-lg">
                  <span className="text-slate-800">Khách cần trả</span>
                  <span className="text-emerald-600">{total.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Hình thức thanh toán</label>
                <div className="grid grid-cols-3 gap-2">
                  {methods.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        paymentMethod === m.id 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xl">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Received (only for CASH) */}
              {paymentMethod === 'CASH' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Tiền khách đưa</label>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    placeholder={total.toLocaleString('vi-VN')}
                    className="w-full px-4 py-3 text-lg font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-right"
                  />
                  {cashReceived > 0 && cashReceived >= total && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex justify-between items-center">
                      <span className="text-sm text-amber-700 font-medium">Tiền thừa</span>
                      <span className="font-bold text-amber-600">{change.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button 
                onClick={handleClose}
                className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-[2] py-3 rounded-xl text-white font-bold tracking-wide transition-all flex justify-center items-center gap-2 shadow-md ${
                  loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg'
                }`}
              >
                {loading ? 'Đang xử lý...' : '✓ XÁC NHẬN THANH TOÁN'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

