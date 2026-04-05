'use client';

import { useState } from 'react';
import { X, Banknote, Landmark, Smartphone, CreditCard, Star, Printer } from 'lucide-react';

interface PosPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartTotal: number;
  onConfirm: (method: string, customerMoney: number) => void;
  initialMethod?: string;
  initialCustomerMoney?: string;
}

const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

export function PosPaymentModal({ isOpen, onClose, cartTotal, onConfirm, initialMethod = 'CASH', initialCustomerMoney = '' }: PosPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>(initialMethod);
  const [customerMoney, setCustomerMoney] = useState<string>(initialCustomerMoney);
  
  if (!isOpen) return null;

  const paymentMethods = [
    { id: 'CASH', label: 'Tiền mặt', icon: Banknote },
    { id: 'TRANSFER', label: 'Chuyển khoản', icon: Landmark },
    { id: 'MOMO', label: 'MoMo', icon: Smartphone },
    { id: 'VNPAY', label: 'VNPay', icon: CreditCard },
    { id: 'CARD', label: 'Thẻ', icon: CreditCard },
    { id: 'POINTS', label: 'Điểm', icon: Star },
  ];

  const parsedCustomerMoney = customerMoney ? parseInt(customerMoney.replace(/[^0-9]/g, ''), 10) : cartTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-100 flex flex-col pointer-events-auto scale-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">Hình thức thanh toán</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 font-medium">
              Nhiều HTTT
              <div className="relative inline-flex items-center h-5 rounded-full w-9 bg-gray-200">
                <span className="translate-x-1 inline-block w-3 h-3 transform bg-white rounded-full" />
              </div>
            </label>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded flex items-center justify-center">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5">
          {/* Methods grid */}
          <div className="grid grid-cols-3 gap-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                    isSelected 
                      ? 'border-primary-500 bg-primary-50/30 text-primary-700 shadow-[0_0_0_1px_rgba(var(--primary-500),1)]' 
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={24} className={isSelected ? "text-primary-600" : "text-gray-500"} strokeWidth={1.5} />
                  <span className="text-[13px] font-bold">{method.label}</span>
                </button>
              );
            })}
          </div>

          {/* Summary Box */}
          <div className="bg-[#f0f3f6] rounded-xl p-4 flex flex-col gap-3 border border-gray-100/50">
            <div className="flex justify-between items-center text-[15px]">
              <span className="text-gray-500 font-medium">Cần thanh toán</span>
              <span className="font-bold text-gray-800">{formatMoney(cartTotal)}</span>
            </div>
            
            <div className="flex justify-between items-center text-[15px]">
              <span className="text-gray-500 font-medium">Khách đưa</span>
              {selectedMethod === 'CASH' ? (
                <div className="relative">
                  <input
                    type="text"
                    value={customerMoney ? new Intl.NumberFormat('vi-VN').format(parseInt(customerMoney.replace(/\D/g, ''))) : ''}
                    onChange={(e) => setCustomerMoney(e.target.value)}
                    placeholder={new Intl.NumberFormat('vi-VN').format(cartTotal)}
                    autoFocus
                    className="w-32 text-right bg-transparent border-b border-primary-300 focus:border-primary-600 outline-none font-bold text-[#0089A1] pb-0.5"
                  />
                  <span className="text-[#0089A1] font-bold ml-1">đ</span>
                </div>
              ) : (
                <span className="font-bold text-[#0089A1]">{formatMoney(cartTotal)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="py-2.5 px-6 bg-white border border-gray-200 text-gray-600 rounded-lg text-[15px] font-medium hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(selectedMethod, selectedMethod === 'CASH' ? parsedCustomerMoney : cartTotal)}
            className="py-2.5 px-8 bg-[#66C2D1] hover:bg-[#5bb8c7] text-white rounded-lg text-[15px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            Lưu
          </button>
        </div>

      </div>
    </div>
  );
}
