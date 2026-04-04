'use client';
import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

export function PosNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        className="p-1.5 hover:bg-primary-500 rounded-md transition-colors relative"
        onClick={() => setIsOpen(!isOpen)}
        title="Thông báo"
      >
        <Bell size={18} />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-primary-600"></span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-[100] text-gray-800 flex flex-col animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 borzder-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-semibold">Thông báo</h3>
            <button className="text-xs text-primary-600 hover:underline">Đánh dấu đã đọc</button>
          </div>
          
          <div className="overflow-y-auto max-h-[350px] custom-scrollbar flex flex-col">
            <div className="p-3 border-b border-gray-50 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer bg-primary-50/30">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">Cập nhật phiên bản mới</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">Hệ thống đã cập nhật tính năng thanh toán trả chuồng.</div>
                <div className="text-[10px] text-gray-400 mt-1">10 phút trước</div>
              </div>
            </div>
            
            <div className="p-3 border-b border-gray-50 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Bell size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">Sắp hết hàng</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">Sản phẩm Hạt Royal Canin còn dưới 5kg trong kho.</div>
                <div className="text-[10px] text-gray-400 mt-1">2 giờ trước</div>
              </div>
            </div>
          </div>
          
          <div className="p-2 border-t border-gray-100 text-center">
            <button className="text-sm text-primary-600 font-medium hover:underline w-full py-1">Xem tất cả</button>
          </div>
        </div>
      )}
    </div>
  );
}
