'use client';

import { useState } from 'react';
import axios from 'axios';
import { usePosStore } from '../../../../stores/pos.store';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { Banknote, FileText, Smartphone, CreditCard, Star, Printer, X } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'MOMO' | 'VNPAY' | 'POINT';

export default function CheckoutModal({ isOpen, onClose, subtotal, discount, shippingFee, total }: CheckoutModalProps) {
  const store = usePosStore();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isMultiPayment, setIsMultiPayment] = useState(false);

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

  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'CASH', label: 'Tiền mặt', icon: <Banknote className="w-6 h-6 mb-2 text-slate-500" /> },
    { id: 'TRANSFER', label: 'Chuyển khoản', icon: <FileText className="w-6 h-6 mb-2 text-slate-500" /> },
    { id: 'MOMO', label: 'MoMo', icon: <Smartphone className="w-6 h-6 mb-2 text-slate-500" /> },
    { id: 'VNPAY', label: 'VNPay', icon: <CreditCard className="w-6 h-6 mb-2 text-slate-500" /> },
    { id: 'CARD', label: 'Thẻ', icon: <CreditCard className="w-6 h-6 mb-2 text-slate-500" /> },
    { id: 'POINT', label: 'Điểm', icon: <Star className="w-6 h-6 mb-2 text-slate-500" /> },
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
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-slate-800">Hình thức thanh toán</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Nhiều HTTT</span>
                  <button 
                    onClick={() => setIsMultiPayment(!isMultiPayment)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMultiPayment ? 'bg-blue-500' : 'bg-slate-200'}`}
                  >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMultiPayment ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-white">
              {/* Payment Method Grid */}
              <div className="grid grid-cols-3 gap-3">
                {methods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-xl border transition-all text-sm font-semibold ${
                      paymentMethod === m.id && !isMultiPayment
                        ? 'border-blue-500 bg-white text-blue-700 shadow-sm' 
                        : 'border-slate-100 text-slate-600 hover:border-slate-200 bg-white shadow-sm'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cash Received Input (for CASH mode single payment) */}
              {paymentMethod === 'CASH' && !isMultiPayment && (
                <div>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    placeholder={`Tiền mặt khách đưa (Gợi ý: ${total.toLocaleString('vi-VN')} đ)`}
                    className="w-full px-4 py-3 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                  />
                  {cashReceived > 0 && cashReceived >= total && (
                    <div className="mt-2 text-sm text-emerald-600 font-medium text-right px-2">
                      Tiền thừa trả khách: {change.toLocaleString('vi-VN')} đ
                    </div>
                  )}
                </div>
              )}

              {/* Order Summary Box */}
              <div className="bg-slate-100/70 rounded-xl p-4 space-y-3 border border-slate-100">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-[15px]">Cần thanh toán</span>
                  <span className="text-slate-800 font-bold text-lg">{total.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-[15px]">Khách đưa</span>
                  <span className="text-teal-500 font-bold text-sm">{(paymentMethod === 'CASH' && cashReceived > 0 ? cashReceived : total).toLocaleString('vi-VN')} ₫</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-2 flex gap-3 bg-white rounded-b-2xl">
              <button 
                onClick={handleClose}
                className="flex-[1.2] py-3 border border-slate-100 bg-slate-50 rounded-xl text-[15px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-[2] py-3 rounded-xl text-white text-[15px] font-bold transition-all flex justify-center items-center gap-2 ${
                  loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-[#70C5CE] hover:bg-[#5db4bd]'
                }`}
              >
                {loading ? 'Đang xử lý...' : (
                  <>
                    <Printer className="w-[18px] h-[18px]" />
                    Xác nhận & In phiếu
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

