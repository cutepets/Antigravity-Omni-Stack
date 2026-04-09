'use client';

import { useState, useEffect } from 'react';
import { Settings, X, SlidersHorizontal, Printer, Keyboard } from 'lucide-react';
import { usePosStore } from '@/stores/pos.store';

type Tab = 'POS' | 'PRINT' | 'SHORTCUTS';

export function PosSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('POS');

  // Load state and setters from store
  const {
    autoFocusSearch, setAutoFocusSearch,
    barcodeMode, setBarcodeMode,
    soundEnabled, setSoundEnabled,
    zoomLevel, setZoomLevel,
    defaultPayment, setDefaultPayment,
    printerIp, setPrinterIp,
    paperSize, setPaperSize,
    autoPrint, setAutoPrint,
    autoPrintQR, setAutoPrintQR
  } = usePosStore();

  // Apply zoom effect globally for POS
  useEffect(() => {
    // We only apply this safely on client
    const container = document.querySelector('main')?.parentElement;
    if (container) {
      // In webkit, 'zoom' works perfectly to scale the whole UI layout
      (container as any).style.zoom = `${zoomLevel}%`;
    }
  }, [zoomLevel]);

  const renderTabs = () => (
    <div className="flex items-center border-b border-gray-200">
      <button 
        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'POS' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
        onClick={() => setActiveTab('POS')}
      >
        <SlidersHorizontal size={16} /> Cài đặt POS
      </button>
      <button 
        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'PRINT' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
        onClick={() => setActiveTab('PRINT')}
      >
        <Printer size={16} /> Cài đặt in
      </button>
      <button 
        className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'SHORTCUTS' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
        onClick={() => setActiveTab('SHORTCUTS')}
      >
        <Keyboard size={16} /> Phím tắt
      </button>
    </div>
  );

  const renderPOS = () => (
    <div className="flex flex-col gap-4 p-4 animate-fade-in text-gray-800">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tuỳ chỉnh hành vi POS</h3>
      
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div>
          <div className="text-[15px] font-medium">Tự động focus ô tìm kiếm</div>
          <div className="text-xs text-gray-500">Focus ô tìm SP khi mở đơn mới</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={autoFocusSearch} onChange={e => setAutoFocusSearch(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
        </label>
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div>
          <div className="text-[15px] font-medium">Chế độ quét mã vạch</div>
          <div className="text-xs text-gray-500">Tự động thêm SP khi quét barcode</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={barcodeMode} onChange={e => setBarcodeMode(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
        </label>
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
        <div>
          <div className="text-[15px] font-medium">Âm thanh thao tác</div>
          <div className="text-xs text-gray-500">Phát âm khi thêm SP / thanh toán</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
        </label>
      </div>

      <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-medium">Kích thước giao diện</div>
            <div className="text-xs text-gray-500">Tương thích với màn hình</div>
          </div>
          <div className="text-primary-600 font-bold">
            {zoomLevel > 100 ? '+' : ''}{(zoomLevel - 100).toString()}%
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center font-bold"
            onClick={() => setZoomLevel(Math.max(75, zoomLevel - 5))}
          >-</button>
          
          <input 
            type="range" 
            min="75" max="150" step="5" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(parseInt(e.target.value))} 
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />

          <button 
            className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center font-bold"
            onClick={() => setZoomLevel(Math.min(150, zoomLevel + 5))}
          >+</button>
        </div>
        <div className="text-center">
          <button 
            onClick={() => setZoomLevel(100)}
            className="text-[11px] text-gray-500 hover:text-gray-800 underline decoration-dashed underline-offset-2 flex items-center justify-center gap-1 mx-auto"
          >
            Về mặc định (100%)
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
        <div className="text-[15px] font-medium">Phương thức thanh toán mặc định</div>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {['CASH', 'BANK', 'QR'].map(method => (
            <button 
              key={method}
              className={`py-2 text-xs font-semibold rounded ${defaultPayment === method ? 'bg-primary-500 text-white shadow' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'}`}
              onClick={() => setDefaultPayment(method)}
            >
              {method === 'CASH' ? 'Tiền mặt' : method === 'BANK' ? 'Chuyển khoản' : 'QR Code'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPrint = () => (
    <div className="flex flex-col gap-4 p-4 animate-fade-in text-gray-800">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cài đặt máy in</h3>

      <div className="flex flex-col gap-1.5">
        <label className="text-[15px] font-medium">IP máy in (LAN / Wifi)</label>
        <div className="text-xs text-gray-500 mb-1">Điền IP của máy in để in khi cần kết nối mạng LAN/Mobile</div>
        <input 
          type="text" 
          value={printerIp}
          onChange={e => setPrinterIp(e.target.value)}
          placeholder="VD: 192.168.1.100"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[15px] font-medium">Khổ giấy</label>
        <div className="grid grid-cols-3 gap-2">
          {['K57', 'K80', 'A4'].map(size => (
            <button 
              key={size}
              className={`py-2.5 text-sm font-semibold rounded-lg ${paperSize === size ? 'bg-primary-500 text-white shadow' : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-primary-300'}`}
              onClick={() => setPaperSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100 mt-4">
        <div>
          <div className="text-[15px] font-medium">Tự động in sau khi thanh toán</div>
          <div className="text-xs text-gray-500">In phiếu ngay sau khi hoàn thành đơn</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
        </label>
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
        <div className="pr-4">
          <div className="text-[15px] font-medium">Tự động in mã QR khi thanh toán CK</div>
          <div className="text-xs text-gray-500">In QR chuyển khoản ngay khi chọn phương thức CK / QR</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={autoPrintQR} onChange={e => setAutoPrintQR(e.target.checked)} />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
        </label>
      </div>

    </div>
  );

  const renderShortcuts = () => (
    <div className="flex flex-col gap-4 p-4 animate-fade-in text-gray-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phím tắt có thể tuỳ chỉnh</h3>
        <button className="text-xs border border-gray-200 px-2 py-1 rounded bg-white hover:bg-gray-50 flex items-center gap-1">
           Mặc định
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between bg-gray-50 p-2.5 px-4 rounded-lg border border-gray-100">
          <span className="text-[15px] font-medium text-gray-700">Tìm kiếm sản phẩm</span>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 shadow-sm">F1</kbd>
            <button className="text-sm text-gray-500 hover:text-primary-600 px-2">Sửa</button>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-gray-50 p-2.5 px-4 rounded-lg border border-gray-100">
          <span className="text-[15px] font-medium text-gray-700">Tìm kiếm khách hàng</span>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 shadow-sm">F4</kbd>
            <button className="text-sm text-gray-500 hover:text-primary-600 px-2">Sửa</button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-2.5 px-4 rounded-lg border border-gray-100">
          <span className="text-[15px] font-medium text-gray-700">Mở cửa sổ thanh toán</span>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 shadow-sm">F7</kbd>
            <button className="text-sm text-gray-500 hover:text-primary-600 px-2">Sửa</button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-2.5 px-4 rounded-lg border border-gray-100">
          <span className="text-[15px] font-medium text-gray-700">Xác nhận đơn hàng</span>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 shadow-sm">F12</kbd>
            <button className="text-sm text-gray-500 hover:text-primary-600 px-2">Sửa</button>
          </div>
        </div>
      </div>

      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2 mb-1">Phím cố định</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Tìm kiếm khách hàng (phụ)</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">F2</kbd>
        </div>
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Mở thanh toán (phụ)</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">F11</kbd>
        </div>
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Đóng popup / hủy thao tác</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">Esc</kbd>
        </div>
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Chuyển vị trí con trỏ</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">Tab</kbd>
        </div>
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Tăng / giảm số lượng SP</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-[10px] tracking-widest font-bold text-gray-500">↑ / ↓</kbd>
        </div>
        <div className="flex items-center justify-between bg-white px-1">
          <span className="text-[15px] text-gray-500">Xác nhận / chuyển dòng</span>
          <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">Enter</kbd>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button 
        className="p-1.5 hover:bg-primary-500 rounded-md transition-colors text-white"
        onClick={() => setIsOpen(true)}
        title="Cài đặt POS"
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end font-sans">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-[400px] bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800">
                <Settings size={20} className="text-primary-600" />
                Cài đặt POS
              </h2>
              <button 
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {renderTabs()}

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {activeTab === 'POS' && renderPOS()}
              {activeTab === 'PRINT' && renderPrint()}
              {activeTab === 'SHORTCUTS' && renderShortcuts()}
            </div>
            
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-slide-in-right {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
