'use client';

import { useState, type ReactNode } from 'react';
import { orderApi } from '@/lib/api/order.api';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { useActiveTab, usePosStore } from '@/stores/pos.store';
import { Banknote, CreditCard, FileText, Printer, Smartphone, Star, X } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
}

type PaymentMethod = 'CASH' | 'BANK' | 'CARD' | 'MOMO' | 'VNPAY' | 'POINTS';

export default function CheckoutModal({
  isOpen,
  onClose,
  subtotal,
  discount,
  shippingFee,
  total,
}: CheckoutModalProps) {
  const store = usePosStore();
  const activeTab = useActiveTab();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [isMultiPayment, setIsMultiPayment] = useState(false);

  const change = cashReceived > total ? cashReceived - total : 0;

  const handleConfirm = async () => {
    if (!activeTab || activeTab.cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }

    setLoading(true);
    try {
      let resolvedOrderId = activeTab.existingOrderId ?? null;

      if (activeTab.existingOrderId) {
        await orderApi.pay(activeTab.existingOrderId, {
          payments: [{ method: paymentMethod, amount: total }],
        });
      } else {
        const created = (await orderApi.create({
          customerName: activeTab.customerName,
          customerId: activeTab.customerId === 'GUEST' ? undefined : activeTab.customerId,
          branchId: activeTab.branchId,
          notes: activeTab.notes,
          discount: activeTab.discountTotal,
          shippingFee: activeTab.shippingFee,
          items: activeTab.cart.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            serviceId: item.serviceId,
            serviceVariantId: item.serviceVariantId,
            petId: item.petId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountItem: item.discountItem,
            vatRate: item.vatRate,
            type: item.type,
            groomingDetails: item.groomingDetails
              ? {
                  petId: item.groomingDetails.petId,
                  performerId: item.groomingDetails.performerId,
                  startTime: item.groomingDetails.startTime,
                  notes: item.groomingDetails.notes,
                  serviceItems: item.groomingDetails.serviceItems,
                }
              : undefined,
            hotelDetails: item.hotelDetails
              ? {
                  petId: item.hotelDetails.petId,
                  checkInDate: item.hotelDetails.checkIn,
                  checkOutDate: item.hotelDetails.checkOut,
                  roomType: item.hotelDetails.lineType,
                  cageId: item.hotelDetails.stayId,
                  branchId: activeTab.branchId,
                }
              : undefined,
          })),
          payments: [{ method: paymentMethod, amount: total }],
        })) as { id?: string; data?: { id?: string } };

        resolvedOrderId = created?.id ?? created?.data?.id ?? null;
      }

      store.setReceiptData({
        code: resolvedOrderId,
        customerName: activeTab.customerName,
        items: activeTab.cart,
        discount: activeTab.discountTotal,
        shippingFee: activeTab.shippingFee,
        payments: [{ method: paymentMethod, amount: total }]
      });
      store.resetActiveTab();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Lỗi khi thanh toán';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCashReceived(0);
    setPaymentMethod('CASH');
    onClose();
  };

  if (!isOpen || !activeTab) return null;

  const methods: { id: PaymentMethod; label: string; icon: ReactNode }[] = [
    { id: 'CASH', label: 'Tiền mặt', icon: <Banknote className="mb-2 h-6 w-6 text-slate-500" /> },
    { id: 'BANK', label: 'Chuyển khoản', icon: <FileText className="mb-2 h-6 w-6 text-slate-500" /> },
    { id: 'MOMO', label: 'MoMo', icon: <Smartphone className="mb-2 h-6 w-6 text-slate-500" /> },
    { id: 'VNPAY', label: 'VNPay', icon: <CreditCard className="mb-2 h-6 w-6 text-slate-500" /> },
    { id: 'CARD', label: 'Thẻ', icon: <CreditCard className="mb-2 h-6 w-6 text-slate-500" /> },
    { id: 'POINTS', label: 'Điểm', icon: <Star className="mb-2 h-6 w-6 text-slate-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h2 className="text-xl font-bold text-slate-800">Hình thức thanh toán</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Nhiều HTTT</span>
              <button
                onClick={() => setIsMultiPayment((value) => !value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isMultiPayment ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    isMultiPayment ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <button onClick={handleClose} className="text-slate-400 transition-colors hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 bg-white p-5">
          <div className="grid grid-cols-3 gap-3">
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`flex flex-col items-center justify-center rounded-xl border px-2 py-4 text-sm font-semibold transition-all ${
                  paymentMethod === method.id && !isMultiPayment
                    ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                    : 'border-slate-100 bg-white text-slate-600 shadow-sm hover:border-slate-200'
                }`}
              >
                {method.icon}
                {method.label}
              </button>
            ))}
          </div>

          {paymentMethod === 'CASH' && !isMultiPayment ? (
            <div>
              <input
                type="number"
                value={cashReceived || ''}
                onChange={(event) => setCashReceived(Number(event.target.value))}
                placeholder={`Tiền mặt khách đưa (${total.toLocaleString('vi-VN')} đ)`}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none"
              />
              {cashReceived > 0 && cashReceived >= total ? (
                <div className="mt-2 px-2 text-right text-sm font-medium text-emerald-600">
                  Tiền thừa trả khách: {change.toLocaleString('vi-VN')} đ
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-100/70 p-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Tạm tính</span>
              <span className="font-medium text-slate-700">{subtotal.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Chiết khấu</span>
              <span className="font-medium text-slate-700">-{discount.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Phí giao hàng</span>
              <span className="font-medium text-slate-700">{shippingFee.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-slate-500">
              <span className="text-[15px]">Cần thanh toán</span>
              <span className="text-lg font-bold text-slate-800">{total.toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[15px]">Khách đưa</span>
              <span className="text-sm font-bold text-teal-500">
                {(paymentMethod === 'CASH' && cashReceived > 0 ? cashReceived : total).toLocaleString('vi-VN')} đ
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 rounded-b-2xl bg-white p-5 pt-2">
          <button
            onClick={handleClose}
            className="flex-[1.2] rounded-xl border border-slate-100 bg-slate-50 py-3 text-[15px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-bold text-white transition-all ${
              loading ? 'cursor-not-allowed bg-slate-300' : 'bg-[#70C5CE] hover:bg-[#5db4bd]'
            }`}
          >
            {loading ? (
              'Đang xử lý...'
            ) : (
              <>
                <Printer className="h-[18px] w-[18px]" />
                Xác nhận & In phiếu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
