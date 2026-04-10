'use client'

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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <QrCode size={20} className={isPaid ? 'text-emerald-600' : 'text-sky-600'} />
              {isPaid ? 'Da nhan thanh toan' : `Cho thanh toan qua ${bankLabel}`}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isPaid
                ? `Don hang ${orderNumber} da duoc doi soat thanh cong tu webhook.`
                : `Don hang ${orderNumber} da duoc tao va giu lai de doi webhook doi soat thanh toan.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-sky-100 bg-linear-to-b from-sky-50 to-white p-3 shadow-inner">
            {intent.qrUrl ? (
              <div className="relative overflow-hidden rounded-[24px] border-[3px] border-sky-200 bg-white px-5 py-6 shadow-sm">
                <div className="absolute right-0 top-0 h-20 w-20 overflow-hidden">
                  <div className="absolute right-[-30px] top-[10px] w-[120px] rotate-45 border-y-2 border-rose-400 bg-white py-1 text-center text-[10px] font-black tracking-[0.2em] text-rose-500">
                    QR
                  </div>
                </div>

                <div className="text-center text-[11px] font-semibold text-slate-400">
                  Mo Ung Dung Ngan Hang Quet QRCode
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-3xl font-black tracking-tight text-rose-500">VIET</span>
                  <span className="text-3xl font-black tracking-tight text-slate-900">QR</span>
                </div>

                <div className="mt-4 rounded-[22px] bg-white px-4 py-3">
                  <img
                    src={intent.qrUrl}
                    alt={`QR ${intent.transferContent}`}
                    className="mx-auto h-52 w-52 max-w-full"
                  />
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">napas247</div>
                  {bankLogo ? <img src={bankLogo} alt={bankLabel} className="h-6 object-contain" /> : null}
                </div>

                <div className="mt-5 space-y-2 text-[12px] text-slate-700">
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-slate-500">So tien:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(intent.amount).replace(' d', ' VND')}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-slate-500">Noi dung CK:</span>
                    <span className="truncate font-bold text-slate-900">{intent.transferContent}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-slate-500">Ten chu TK:</span>
                    <span className="truncate font-bold text-slate-900">{intent.paymentMethod.accountHolder}</span>
                  </div>
                  <div className="grid grid-cols-[78px_1fr] gap-2">
                    <span className="font-medium text-slate-500">So QR don:</span>
                    <span className="truncate font-bold text-slate-900">{intent.code}</span>
                  </div>
                </div>

                <div className="mt-5 text-center text-[10px] text-slate-400">
                  Mau print noi bo duoc render trong he thong
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
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">So tien</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(intent.amount)}</div>
                <div className="mt-2 text-xs text-gray-500">
                  {isPaid ? 'So tien da duoc doi soat thanh cong' : 'Ap dung dung so tien can thu cua don hang'}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Trang thai</div>
                <div className={`mt-2 text-sm font-bold ${isPaid ? 'text-emerald-700' : 'text-sky-700'}`}>{intent.status}</div>
                <div className="mt-2 text-xs text-gray-500">
                  {isPaid
                    ? `Xac nhan luc ${intent.paidAt ? new Date(intent.paidAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}`
                    : intent.expiresAt
                      ? `Han den ${new Date(intent.expiresAt).toLocaleString('vi-VN')}`
                      : 'Khong gioi han'}
                </div>
              </div>
            </div>

            {isPaid ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-900">Thanh toan thanh cong</div>
                <div className="mt-2 text-sm leading-6 text-emerald-800">
                  He thong da nhan bien dong so du, doi soat dung ma don va dung so tien. Co the dong cua so nay de tiep tuc in bien lai hoac thao tac tiep.
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Noi dung chuyen khoan</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-xl bg-white px-3 py-2 font-mono text-sm font-bold text-gray-900 shadow-sm">
                  {intent.transferContent}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(intent.transferContent)
                    toast.success('Da copy noi dung chuyen khoan')
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:text-gray-700"
                >
                  <Copy size={16} />
                </button>
              </div>
              <div className="mt-3 text-xs leading-5 text-gray-500">
                Noi dung da gom: tien to, ID chi nhanh, ma don va ten tai khoan giao dich rut gon.
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Tai khoan nhan</div>
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Landmark size={15} className="text-sky-600" />
                <span>{bankLabel}</span>
              </div>
              {bankLogo ? <img src={bankLogo} alt={bankLabel} className="mt-3 h-7 object-contain" /> : null}
              <div className="mt-2 text-sm text-gray-600">{intent.paymentMethod.accountNumber}</div>
              <div className="mt-1 text-xs text-gray-500">{intent.paymentMethod.accountHolder}</div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">{isPaid ? 'Ket qua doi soat' : 'Luu y'}</div>
              {isPaid ? (
                <div className="mt-2 text-sm text-amber-800">
                  Neu backup webhook gui them du lieu trung, he thong se bo qua va khong tao lap phieu thu.
                </div>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  <li>Mo ung dung ngan hang va quet dung ma QR nay.</li>
                  <li>Khong sua so tien hoac noi dung chuyen khoan.</li>
                  <li>He thong se cap nhat trang thai thanh toan bang webhook rieng.</li>
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Dong
              </button>
              {onRefresh && !isPaid ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  Lam moi QR
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
