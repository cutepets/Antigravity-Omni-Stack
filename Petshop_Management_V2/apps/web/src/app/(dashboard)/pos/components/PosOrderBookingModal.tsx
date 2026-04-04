'use client';

import { useState, useEffect } from 'react';
import { X, CalendarIcon, AlertTriangle } from 'lucide-react';

interface PosOrderBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartTotal: number;
  cartCount: number;
  onConfirm: (date: string, note: string) => void;
}

const formatMoney = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

export function PosOrderBookingModal({ isOpen, onClose, cartTotal, cartCount, onConfirm }: PosOrderBookingModalProps) {
  const [bookingDate, setBookingDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      // Fix timezone offset for local time
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
      setBookingDate(localISOTime);
    } else {
      setBookingDate('');
      setNote('');
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-100 flex flex-col pointer-events-auto scale-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-amber-50/50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon size={20} className="text-orange-500" strokeWidth={2} />
            Đặt hàng — hẹn giờ đến
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-6">
          
          {/* Date Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-bold text-gray-600 uppercase tracking-wide">KHÁCH HẸN ĐẾN LÚC <span className="text-red-500">*</span></label>
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded font-medium">Sản phẩm: tối đa 24h</span>
            </div>
            <div className="relative flex items-center">
              <input 
                type="datetime-local" 
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg p-3 pr-10 text-base text-gray-800 outline-none bg-white relative z-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:bottom-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-full"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none z-20">
                <CalendarIcon size={20} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <AlertTriangle size={14} className="text-orange-500" />
              <span className="text-xs text-orange-700">Sản phẩm được giữ tối đa 24h</span>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-gray-600 uppercase tracking-wide">GHI CHÚ THÊM</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Yêu cầu đặc biệt, trạng thái đơn..."
              className="w-full border border-gray-200 focus:border-gray-300 rounded-lg p-3 text-sm text-gray-800 outline-none bg-gray-50/50 min-h-[80px] resize-none placeholder:text-gray-400"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <p className="font-bold text-gray-800 mb-2">Đơn hàng sẽ được lưu:</p>
            <p className="text-sm text-gray-600 mb-1">{cartCount} sản phẩm/dịch vụ · Tổng: <span className="font-bold text-orange-600">{formatMoney(cartTotal)}</span></p>
            <p className="text-sm text-gray-600">Trạng thái: <span className="font-bold text-orange-600">CHỜ KHÁCH ĐẾN</span></p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/80 border-t border-gray-100 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-3 px-4 bg-white border border-gray-200 text-gray-600 rounded-lg text-[15px] font-medium hover:bg-gray-50 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(bookingDate, note)}
            disabled={!bookingDate}
            className={`py-3 px-4 rounded-lg text-[15px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2 ${
              bookingDate 
                ? 'bg-[#F29900] hover:bg-[#d98a00] text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <CalendarIcon size={18} strokeWidth={2.5} />
            Xác nhận Đặt hàng
          </button>
        </div>

      </div>
    </div>
  );
}
