'use client';

import { CheckCircle, Printer, X, FileText } from 'lucide-react';
import { useEffect } from 'react';
import { usePosStore } from '@/stores/pos.store';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: any; // Order data right after successful creation
}

export function ReceiptModal({ isOpen, onClose, orderData }: ReceiptModalProps) {
  const { autoPrint } = usePosStore();

  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle auto print
  useEffect(() => {
    if (isOpen && autoPrint && orderData) {
      let printTimer: any;
      
      const afterPrint = () => {
        onClose();
      };
      
      window.addEventListener('afterprint', afterPrint);
      
      // Short delay to ensure DOM is ready for printing
      printTimer = setTimeout(() => {
        window.print();
      }, 150);
      
      return () => {
         clearTimeout(printTimer);
         window.removeEventListener('afterprint', afterPrint);
      };
    }
  }, [isOpen, autoPrint, orderData, onClose]);

  if (!isOpen || !orderData) return null;

  const handlePrint = () => {
    window.print();
  };

  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:bg-white print:p-0">
      
      {/* ── Screen View ── */}
      <div className="bg-background-secondary border border-border w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col animate-slide-in print:hidden">
        <div className="p-6 flex flex-col items-center justify-center text-center pb-4">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center text-success mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Thanh toán thành công</h2>
          <p className="text-sm text-foreground-muted mt-1">Đơn hàng {orderData.code || 'Mới'} đã được lưu</p>
        </div>

        <div className="p-6 pt-0 flex flex-col gap-3">
          <button 
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-colors"
          >
            <Printer size={18} /> In hoá đơn
          </button>
          <button 
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3 bg-background-tertiary hover:bg-background-base text-foreground font-semibold rounded-xl transition-colors border border-border"
          >
            Đóng (Esc)
          </button>
        </div>
      </div>

      {/* ── Print View ── */}
      <div className="hidden print:block w-[80mm] mx-auto bg-white text-black p-4 text-[12px] font-mono leading-tight">
        <div className="text-center mb-4 border-b border-dashed border-gray-400 pb-4">
          <h1 className="text-lg font-bold uppercase mb-1">Cửa Hàng Thú Cưng</h1>
          <p>123 Đường B, Quận 1, TP.HCM</p>
          <p>SĐT: 0123 456 789</p>
        </div>

        <div className="mb-4">
          <p>Mã đơn: {orderData.code || 'N/A'}</p>
          <p>Khách hàng: {orderData.customerName || 'Khách lẻ'}</p>
          <p>Ngày: {new Date().toLocaleString('vi-VN')}</p>
        </div>

        <table className="w-full mb-4 text-left">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="font-normal py-1 w-1/2">Sản phẩm/DV</th>
              <th className="font-normal py-1 text-center w-1/6">SL</th>
              <th className="font-normal py-1 text-right w-1/3">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            {(orderData.items || []).map((item: any, i: number) => (
              <tr key={i} className="border-b border-dashed border-gray-200">
                <td className="py-2 pr-2">{item.description || item.name}</td>
                <td className="py-2 text-center align-top">{item.quantity}</td>
                <td className="py-2 text-right align-top">{money((item.unitPrice || 0) * (item.quantity || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
          {orderData.discount > 0 && (
            <div className="flex justify-between py-0.5">
              <span>Giảm giá:</span>
              <span>- {money(orderData.discount)}</span>
            </div>
          )}
          {orderData.shippingFee > 0 && (
            <div className="flex justify-between py-0.5">
              <span>Phí vận chuyển:</span>
              <span>+ {money(orderData.shippingFee)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 font-bold text-sm mt-1">
            <span>TỔNG CỘNG:</span>
            <span>{money(orderData.payments?.[0]?.amount || 0)}</span>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="font-bold mb-1">Cảm ơn quý khách!</p>
          <p className="text-[10px]">Phần mềm quản lý bởi Dev2</p>
        </div>
      </div>
    </div>
  );
}
