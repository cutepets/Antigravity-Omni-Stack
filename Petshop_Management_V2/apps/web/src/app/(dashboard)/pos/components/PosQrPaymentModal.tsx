'use client'
import Image from 'next/image';

import { Copy, Landmark, QrCode, RefreshCw, X } from 'lucide-react'
import type { OrderPaymentIntent } from '@/lib/api/order.api'
import { customToast as toast } from '@/components/ui/toast-with-copy'
import { findVietQrBank } from '@/lib/constants/vietqr-banks'


interface PosQrPaymentModalProps {
  isOpen: boolean
  intent: OrderPaymentIntent | null
  onClose: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} d`
}

export function PosQrPaymentModal({
  isOpen,
  intent,
  onClose,
  onRefresh,
  isRefreshing = false,
}: PosQrPaymentModalProps) {
  if (!isOpen || !intent) return null

  const orderNumber = intent.order?.orderNumber ?? intent.code
  const bankLabel = intent.paymentMethod.bankName || intent.paymentMethod.name
  const bank = findVietQrBank(intent.paymentMethod.bankName ?? null)
  const bankLogo = bank?.logo ?? null
  const isPaid = intent.status === 'PAID'

  return (
    <div className="fixed inset-0 z-95 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <QrCode size={20} className={isPaid ? 'text-success' : 'text-sky-500'} />
              {isPaid ? 'Đã nhận thanh toán' : `Chờ thanh toán qua ${bankLabel}`}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {isPaid
                ? `Đơn hàng ${orderNumber} đã được đối soát thành công từ webhook.`
                : `Đơn hàng ${orderNumber} đã được tạo và giữ lại để đối soát thanh toán.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
            {intent.qrUrl ? (
              <div className="relative overflow-hidden rounded-2xl border-2 border-sky-500/30 bg-background px-5 py-6">
                <div className="absolute right-0 top-0 h-20 w-20 overflow-hidden">
                  <div className="absolute right-[-30px] top-[10px] w-[120px] rotate-45 border-y-2 border-rose-400 bg-white py-1 text-center text-[10px] font-black tracking-[0.2em] text-rose-500">
                    QR
                  </div>
                </div>

                <div className="text-center text-[11px] font-semibold text-foreground-muted">
                  Mở ứng dụng ngân hàng quét QR Code
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-3xl font-black tracking-tight text-rose-500">VIET</span>
                  <span className="text-3xl font-black tracking-tight text-slate-900">QR</span>
                </div>

                <div className="mt-4 rounded-[22px] bg-white px-4 py-3">
                  <Image src={intent.qrUrl}
                    alt={`QR ${intent.transferContent}`}
                    className="mx-auto h-52 w-52 max-w-full" width={400} height={400} unoptimized />
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">napas247</div>
                  {bankLogo ? <Image src={bankLogo} alt={bankLabel} className="h-6 object-contain" width={400} height={400} unoptimized /> : null}
                </div>

                <div className="mt-5 space-y-2 text-[12px] text-foreground">
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-foreground-muted">Số tiền:</span>
                    <span className="font-bold text-foreground">{formatCurrency(intent.amount).replace(' d', ' VND')}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-foreground-muted">Nội dung CK:</span>
                    <span className="truncate font-bold text-foreground">{intent.transferContent}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-foreground-muted">Tên chủ TK:</span>
                    <span className="truncate font-bold text-foreground">{intent.paymentMethod.accountHolder}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-foreground-muted">Số QR đơn:</span>
                    <span className="truncate font-bold text-foreground">{intent.code}</span>
                  </div>
                </div>

                <div className="mt-5 text-center text-[10px] text-foreground-muted">
                  Mẫu in nội bộ được render trong hệ thống
                </div>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-sky-200 bg-white text-sm text-gray-500">
                Khong tao duoc hinh QR
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Số tiền</div>
                <div className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(intent.amount)}</div>
                <div className="mt-2 text-xs text-foreground-muted">
                  {isPaid ? 'Số tiền đã được đối soát thành công' : 'Áp dụng đúng số tiền cần thu của đơn hàng'}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Trạng thái</div>
                <div className={`mt-2 text-sm font-bold ${isPaid ? 'text-success' : 'text-sky-500'}`}>{intent.status}</div>
                <div className="mt-2 text-xs text-foreground-muted">
                  {isPaid
                    ? `Xác nhận lúc ${intent.paidAt ? new Date(intent.paidAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}`
                    : intent.expiresAt
                      ? `Hạn đến ${new Date(intent.expiresAt).toLocaleString('vi-VN')}`
                      : 'Không giới hạn'}
                </div>
              </div>
            </div>

            {isPaid ? (
              <div className="rounded-2xl border border-success/30 bg-success/8 p-4">
                <div className="text-sm font-semibold text-success">Thanh toán thành công</div>
                <div className="mt-2 text-sm leading-6 text-success/80">
                  Hệ thống đã nhận biến động số dư, đối soát đúng mã đơn và đủ số tiền. Có thể đóng cửa sổ này để tiếp tục in biên lai hoặc thao tác tiếp.
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Nội dung chuyển khoản</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-xl bg-background px-3 py-2 font-mono text-sm font-bold text-foreground border border-border">
                  {intent.transferContent}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(intent.transferContent)
                    toast.success('Đã copy nội dung chuyển khoản')
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-foreground-muted transition-colors hover:text-foreground"
                >
                  <Copy size={16} />
                </button>
              </div>
              <div className="mt-3 text-xs leading-5 text-foreground-muted">
                Nội dung đã gồm: tiền tố, ID chi nhánh, mã đơn và tên tài khoản giao dịch rút gọn.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background-secondary/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">Tài khoản nhận</div>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Landmark size={15} className="text-sky-500" />
                <span>{bankLabel}</span>
              </div>
              {bankLogo ? <Image src={bankLogo} alt={bankLabel} className="mt-3 h-7 object-contain" width={400} height={400} unoptimized /> : null}
              <div className="mt-2 text-sm text-foreground-muted">{intent.paymentMethod.accountNumber}</div>
              <div className="mt-1 text-xs text-foreground-muted">{intent.paymentMethod.accountHolder}</div>
            </div>

            <div className="rounded-2xl border border-warning/30 bg-warning/8 p-4">
              <div className="text-sm font-semibold text-warning">{isPaid ? 'Kết quả đối soát' : 'Lưu ý'}</div>
              {isPaid ? (
                <div className="mt-2 text-sm text-warning/80">
                  Nếu backup webhook gửi thêm dữ liệu trùng, hệ thống sẽ bỏ qua và không tạo lập phiếu thu.
                </div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-warning/80">
                  <li>Mở ứng dụng ngân hàng và quét đúng mã QR này.</li>
                  <li>Không sửa số tiền hoặc nội dung chuyển khoản.</li>
                  <li>Hệ thống sẽ cập nhật trạng thái thanh toán bằng webhook riêng.</li>
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline h-9 px-5"
              >
                Đóng
              </button>
              {onRefresh && !isPaid ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="btn-primary bg-sky-500 hover:bg-sky-600 text-white h-9 px-5 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  Làm mới QR
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}