'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Keyboard, Printer, Settings, SlidersHorizontal, X } from 'lucide-react'
import { settingsApi } from '@/lib/api/settings.api'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/lib/payment-methods'
import { useAuthStore } from '@/stores/auth.store'
import { usePosStore } from '@/stores/pos.store'

type Tab = 'POS' | 'PRINT' | 'SHORTCUTS'

export function PosSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('POS')
  const activeBranchId = useAuthStore((state) => state.activeBranchId)

  const {
    autoFocusSearch,
    setAutoFocusSearch,
    barcodeMode,
    setBarcodeMode,
    soundEnabled,
    setSoundEnabled,
    zoomLevel,
    setZoomLevel,
    defaultPayment,
    setDefaultPayment,
    roundingEnabled,
    setRoundingEnabled,
    roundingUnit,
    setRoundingUnit,
    printerIp,
    setPrinterIp,
    paperSize,
    setPaperSize,
    autoPrint,
    setAutoPrint,
    autoPrintQR,
    setAutoPrintQR,
  } = usePosStore()

  const { data: paymentMethods = [], isLoading: isPaymentMethodsLoading, isError: isPaymentMethodsError } = useQuery({
    queryKey: ['settings', 'payment-methods'],
    queryFn: () => settingsApi.getPaymentMethods(),
    staleTime: 30_000,
  })

  useEffect(() => {
    const container = document.querySelector('main')?.parentElement
    if (container) {
      ;(container as any).style.zoom = `${zoomLevel}%`
    }
  }, [zoomLevel])

  const selectablePaymentMethods = useMemo(
    () =>
      paymentMethods
        .filter((method) => method.isActive)
        .filter((method) => method.branchIds.length === 0 || !activeBranchId || method.branchIds.includes(activeBranchId))
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
          if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
          return left.name.localeCompare(right.name, 'vi')
        }),
    [activeBranchId, paymentMethods],
  )

  const resolvedDefaultPaymentId = useMemo(() => {
    if (selectablePaymentMethods.some((method) => method.id === defaultPayment)) {
      return defaultPayment
    }

    return selectablePaymentMethods.find((method) => method.isDefault)?.id ?? selectablePaymentMethods[0]?.id ?? ''
  }, [defaultPayment, selectablePaymentMethods])

  useEffect(() => {
    if (!resolvedDefaultPaymentId || defaultPayment === resolvedDefaultPaymentId) return
    setDefaultPayment(resolvedDefaultPaymentId)
  }, [defaultPayment, resolvedDefaultPaymentId, setDefaultPayment])

  const renderTabs = () => (
    <div className="flex items-center border-b border-gray-200">
      {[
        { id: 'POS' as const, label: 'Cài đặt POS', icon: SlidersHorizontal },
        { id: 'PRINT' as const, label: 'Cài đặt in', icon: Printer },
        { id: 'SHORTCUTS' as const, label: 'Phím tắt', icon: Keyboard },
      ].map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              activeTab === tab.id ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon size={16} /> {tab.label}
          </button>
        )
      })}
    </div>
  )

  const renderToggle = (
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
  ) => (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-[15px] font-medium">{label}</div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-gray-300 peer-focus:outline-none peer-checked:bg-primary-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-['']"></div>
      </label>
    </div>
  )

  const renderPOS = () => (
    <div className="flex animate-fade-in flex-col gap-4 p-4 text-gray-800">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Tùy chỉnh hành vi POS</h3>

      {renderToggle('Tự động focus ô tìm kiếm', autoFocusSearch, setAutoFocusSearch)}
      {renderToggle('Chế độ quét mã vạch', barcodeMode, setBarcodeMode)}
      {renderToggle('Âm thanh thao tác', soundEnabled, setSoundEnabled)}
      {renderToggle('Làm tròn tổng tiền', roundingEnabled, setRoundingEnabled)}

      <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">Đơn vị làm tròn</div>
            <div className="text-xs text-gray-500">Chỉ áp dụng round down theo 100 hoặc 1000 VND</div>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-600 shadow-sm">
            {roundingUnit.toLocaleString('vi-VN')} VND
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[100, 1000].map((unit) => {
            const isSelected = roundingUnit === unit
            return (
              <button
                key={unit}
                type="button"
                onClick={() => setRoundingUnit(unit as 100 | 1000)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500 text-white shadow'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                }`}
              >
                {unit.toLocaleString('vi-VN')}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-gray-500">
          Ví dụ 25,970 sẽ thành 25,900 hoặc 25,000 tùy đơn vị đang chọn.
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-medium">Kích thước giao diện</div>
            <div className="text-xs text-gray-500">Tương thích với màn hình hiện tại</div>
          </div>
          <div className="font-bold text-primary-600">
            {zoomLevel > 100 ? '+' : ''}
            {zoomLevel - 100}%
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 font-bold hover:bg-gray-100"
            onClick={() => setZoomLevel(Math.max(75, zoomLevel - 5))}
          >
            -
          </button>

          <input
            type="range"
            min="75"
            max="150"
            step="5"
            value={zoomLevel}
            onChange={(event) => setZoomLevel(parseInt(event.target.value, 10))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600"
          />

          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 font-bold hover:bg-gray-100"
            onClick={() => setZoomLevel(Math.min(150, zoomLevel + 5))}
          >
            +
          </button>
        </div>
        <div className="text-center">
          <button
            onClick={() => setZoomLevel(100)}
            className="mx-auto flex items-center justify-center gap-1 text-[11px] text-gray-500 underline decoration-dashed underline-offset-2 hover:text-gray-800"
          >
            Về mặc định (100%)
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="text-[15px] font-medium">Phương thức thanh toán mặc định</div>

        {isPaymentMethodsLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            Đang tải cấu hình thanh toán...
          </div>
        ) : null}

        {isPaymentMethodsError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
            Không tải được danh sách phương thức thanh toán.
          </div>
        ) : null}

        {!isPaymentMethodsLoading && !isPaymentMethodsError ? (
          selectablePaymentMethods.length > 0 ? (
            <div className="mt-1 grid grid-cols-2 gap-2">
              {selectablePaymentMethods.map((method) => {
                const isSelected = resolvedDefaultPaymentId === method.id
                return (
                  <button
                    key={method.id}
                    type="button"
                    className={`flex items-center justify-center rounded-lg border px-3 py-2 text-center transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-500 text-white shadow'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                    }`}
                    onClick={() => setDefaultPayment(method.id)}
                  >
                    <div className="text-[13px] font-semibold">{method.name}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Chưa có phương thức thanh toán phù hợp cho chi nhánh hiện tại.
            </div>
          )
        ) : null}
      </div>
    </div>
  )

  const renderPrint = () => (
    <div className="flex animate-fade-in flex-col gap-4 p-4 text-gray-800">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Cài đặt máy in</h3>

      <div className="flex flex-col gap-1.5">
        <label className="text-[15px] font-medium">IP máy in (LAN / Wifi)</label>
        <div className="mb-1 text-xs text-gray-500">Nhập IP của máy in nếu cần kết nối qua mạng LAN hoặc Wifi.</div>
        <input
          type="text"
          value={printerIp}
          onChange={(event) => setPrinterIp(event.target.value)}
          placeholder="VD: 192.168.1.100"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 outline-none transition-colors focus:border-primary-500 focus:bg-white"
        />
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <label className="text-[15px] font-medium">Khổ giấy</label>
        <div className="grid grid-cols-3 gap-2">
          {['K57', 'K80', 'A4'].map((size) => (
            <button
              key={size}
              className={`rounded-lg py-2.5 text-sm font-semibold ${
                paperSize === size
                  ? 'bg-primary-500 text-white shadow'
                  : 'border border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-300'
              }`}
              onClick={() => setPaperSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {renderToggle('Tự động in sau khi thanh toán', autoPrint, setAutoPrint)}
      {renderToggle('Tự động in mã QR khi chuyển khoản', autoPrintQR, setAutoPrintQR)}
    </div>
  )

  const renderShortcuts = () => (
    <div className="flex animate-fade-in flex-col gap-4 p-4 text-gray-800">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Phím tắt có thể tùy chỉnh</h3>
        <button className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-50">
          Mặc định
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {[
          ['Tìm kiếm sản phẩm', 'F1'],
          ['Tìm kiếm khách hàng', 'F4'],
          ['Mở cửa sổ thanh toán', 'F7'],
          ['Xác nhận đơn hàng', 'F12'],
        ].map(([label, key]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5 px-4">
            <span className="text-[15px] font-medium text-gray-700">{label}</span>
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-600 shadow-sm">{key}</kbd>
              <button className="px-2 text-sm text-gray-500 hover:text-primary-600">Sửa</button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mb-1 mt-2 text-xs font-bold uppercase tracking-wider text-gray-500">Phím cố định</h3>
      <div className="flex flex-col gap-2">
        {[
          ['Tìm kiếm khách hàng (phụ)', 'F2'],
          ['Mở thanh toán (phụ)', 'F11'],
          ['Đóng popup / hủy thao tác', 'Esc'],
          ['Chuyển vị trí con trỏ', 'Tab'],
          ['Tăng / giảm số lượng SP', 'Up / Down'],
          ['Xác nhận / chuyển dòng', 'Enter'],
        ].map(([label, key]) => (
          <div key={label} className="flex items-center justify-between bg-white px-1">
            <span className="text-[15px] text-gray-500">{label}</span>
            <kbd className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <button
        className="rounded-md p-1.5 text-white transition-colors hover:bg-primary-500"
        onClick={() => setIsOpen(true)}
        title="Cài đặt POS"
      >
        <Settings size={18} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[100] flex justify-end font-sans">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="relative flex h-full w-[400px] flex-col bg-white shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <Settings size={20} className="text-primary-600" />
                Cài đặt POS
              </h2>
              <button
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {renderTabs()}

            <div className="no-scrollbar flex-1 overflow-y-auto">
              {activeTab === 'POS' ? renderPOS() : null}
              {activeTab === 'PRINT' ? renderPrint() : null}
              {activeTab === 'SHORTCUTS' ? renderShortcuts() : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .animate-slide-in-right {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}
