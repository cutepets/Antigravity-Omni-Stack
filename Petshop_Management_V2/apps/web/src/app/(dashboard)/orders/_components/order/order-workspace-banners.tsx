import { AlertCircle, QrCode, RefreshCw } from 'lucide-react'

type OrderQrResumeBannerProps = {
  show: boolean
  intent: unknown
  onOpenQr: () => void
  onSwitchPayment: () => void
}

export function OrderQrResumeBanner({ show, intent, onOpenQr, onSwitchPayment }: OrderQrResumeBannerProps) {
  if (!show || !intent) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-2.5">
      <QrCode size={16} className="shrink-0 text-sky-500" />
      <span className="flex-1 text-sm font-medium text-foreground">
        Đơn hàng đang chờ xác nhận thanh toán QR
      </span>
      <button
        type="button"
        onClick={onOpenQr}
        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-600"
      >
        <QrCode size={13} />
        Xem lại QR
      </button>
      <button
        type="button"
        onClick={onSwitchPayment}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background-secondary"
      >
        <RefreshCw size={13} />
        Đổi hình thức TT
      </button>
    </div>
  )
}

export function OrderTempItemBanner({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5">
      <AlertCircle size={16} className="shrink-0 text-amber-500" />
      <span className="flex-1 text-sm font-medium text-foreground">
        Đơn có <strong>{count} sản phẩm tạm</strong> chưa được đổi sang thật - tồn kho chưa cập nhật
      </span>
    </div>
  )
}
