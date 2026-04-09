'use client'

import { useEffect, useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  RotateCcw,
  Smartphone,
  Star,
  X,
} from 'lucide-react'
import type { CompleteOrderPayload } from '@/lib/api/order.api'
import { cn, formatCurrency } from '@/lib/utils'

interface OrderSettlementModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: CompleteOrderPayload) => void
  orderNumber?: string
  total: number
  amountPaid: number
  canKeepCredit: boolean
  isPending?: boolean
}

const PAYMENT_METHOD_OPTIONS = [
  { id: 'CASH', label: 'Tiền mặt', icon: Banknote },
  { id: 'BANK', label: 'Chuyển khoản', icon: Landmark },
  { id: 'MOMO', label: 'MoMo', icon: Smartphone },
  { id: 'VNPAY', label: 'VNPay', icon: CreditCard },
  { id: 'CARD', label: 'Thẻ', icon: CreditCard },
  { id: 'POINTS', label: 'Điểm', icon: Star },
] as const

type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]['id']
type OverpaymentAction = NonNullable<CompleteOrderPayload['overpaymentAction']>

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

export function OrderSettlementModal({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  total,
  amountPaid,
  canKeepCredit,
  isPending = false,
}: OrderSettlementModalProps) {
  const outstandingAmount = Math.max(0, total - amountPaid)
  const existingOverpaidAmount = Math.max(0, amountPaid - total)

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [overpaymentAction, setOverpaymentAction] = useState<OverpaymentAction | undefined>(undefined)
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH')
  const [settlementNote, setSettlementNote] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setPaymentMethod('CASH')
    setCashReceived(outstandingAmount > 0 ? String(outstandingAmount) : '')
    setRefundMethod('CASH')
    setSettlementNote('')
    setOverpaymentAction(
      existingOverpaidAmount > 0 ? (canKeepCredit ? 'KEEP_CREDIT' : 'REFUND') : undefined,
    )
  }, [canKeepCredit, existingOverpaidAmount, isOpen, outstandingAmount])

  useEffect(() => {
    if (!isOpen || outstandingAmount <= 0 || paymentMethod === 'CASH') return
    setCashReceived(String(outstandingAmount))
  }, [isOpen, outstandingAmount, paymentMethod])

  if (!isOpen) return null

  const extraPaymentAmount =
    outstandingAmount > 0
      ? paymentMethod === 'CASH'
        ? parseMoneyInput(cashReceived)
        : outstandingAmount
      : 0
  const projectedPaidAmount = amountPaid + extraPaymentAmount
  const projectedOverpaidAmount = Math.max(0, projectedPaidAmount - total)
  const overpaidAmount = existingOverpaidAmount > 0 ? existingOverpaidAmount : projectedOverpaidAmount
  const isUnderpaid = outstandingAmount > 0 && extraPaymentAmount < outstandingAmount
  const needsOverpaymentAction = overpaidAmount > 0
  const disableConfirm =
    isPending ||
    isUnderpaid ||
    (needsOverpaymentAction && !overpaymentAction) ||
    (overpaymentAction === 'KEEP_CREDIT' && !canKeepCredit)

  const handleConfirm = () => {
    if (disableConfirm) return

    const payload: CompleteOrderPayload = {}

    if (extraPaymentAmount > 0) {
      payload.payments = [{ method: paymentMethod, amount: extraPaymentAmount }]
    }

    if (needsOverpaymentAction && overpaymentAction) {
      payload.overpaymentAction = overpaymentAction
      if (overpaymentAction === 'REFUND') {
        payload.refundMethod = refundMethod
      }
    }

    if (settlementNote.trim()) {
      payload.settlementNote = settlementNote.trim()
    }

    onConfirm(payload)
  }

  const confirmLabel =
    needsOverpaymentAction && overpaymentAction === 'REFUND'
      ? 'Hoàn tất và hoàn tiền'
      : needsOverpaymentAction && overpaymentAction === 'KEEP_CREDIT'
        ? 'Hoàn tất và giữ credit'
        : outstandingAmount > 0
          ? 'Thu thêm và hoàn tất'
          : 'Hoàn tất đơn'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Quyết toán cuối
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {orderNumber ? `Đơn ${orderNumber}` : 'Hoàn tất đơn hàng'}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Thu đủ tiền, xử lý tiền dư nếu có và chốt đơn theo đúng nghiệp vụ phase 2.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Tổng đơn</span>
                <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Đã thu</span>
                <span className="font-semibold text-success">{formatCurrency(amountPaid)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-foreground-muted">
                  {existingOverpaidAmount > 0 ? 'Đang dư' : 'Còn cần thu'}
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    existingOverpaidAmount > 0
                      ? 'text-primary-500'
                      : outstandingAmount > 0
                        ? 'text-warning'
                        : 'text-foreground',
                  )}
                >
                  {formatCurrency(existingOverpaidAmount > 0 ? existingOverpaidAmount : outstandingAmount)}
                </span>
              </div>
            </div>

            {outstandingAmount > 0 ? (
              <div className="space-y-4 rounded-2xl border border-border bg-card/80 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Thu thêm trước khi hoàn tất</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Với tiền mặt có thể nhập số khách đưa để xử lý tiền dư ngay trong cùng màn hình.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {PAYMENT_METHOD_OPTIONS.map((method) => {
                    const Icon = method.icon
                    const isSelected = paymentMethod === method.id

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-center transition-colors',
                          isSelected
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600'
                            : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground',
                        )}
                      >
                        <Icon size={18} className="mx-auto mb-2" />
                        <span className="text-xs font-semibold">{method.label}</span>
                      </button>
                    )
                  })}
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    {paymentMethod === 'CASH' ? 'Khách đưa' : 'Số tiền thu thêm'}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    readOnly={paymentMethod !== 'CASH'}
                    value={
                      cashReceived
                        ? new Intl.NumberFormat('vi-VN').format(parseMoneyInput(cashReceived))
                        : ''
                    }
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder={new Intl.NumberFormat('vi-VN').format(outstandingAmount)}
                    className={cn(
                      'h-12 w-full rounded-2xl border border-border px-4 text-base font-semibold text-foreground outline-none transition-colors',
                      paymentMethod === 'CASH'
                        ? 'bg-background focus:border-primary-500'
                        : 'cursor-not-allowed bg-background-secondary text-foreground-muted',
                    )}
                  />
                </label>

                {isUnderpaid ? (
                  <p className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Cần thu ít nhất {formatCurrency(outstandingAmount)} để hoàn tất đơn.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {existingOverpaidAmount > 0 ? 'Đơn đang dư tiền' : 'Đơn đã đủ tiền'}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {existingOverpaidAmount > 0
                    ? 'Chọn cách xử lý phần dư trước khi chốt đơn.'
                    : 'Có thể hoàn tất ngay nếu toàn bộ dịch vụ đã hoàn thành.'}
                </p>
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Ghi chú quyết toán
              </span>
              <textarea
                rows={4}
                value={settlementNote}
                onChange={(event) => setSettlementNote(event.target.value)}
                placeholder="Ví dụ: thu thêm lúc checkout hotel, hoàn tiền phần chênh lệch..."
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
              />
            </label>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Sau khi quyết toán</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Tổng đã thu dự kiến</span>
                  <span className="font-semibold text-foreground">{formatCurrency(projectedPaidAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Phần dư cần xử lý</span>
                  <span className={cn('font-semibold', overpaidAmount > 0 ? 'text-primary-500' : 'text-foreground')}>
                    {formatCurrency(overpaidAmount)}
                  </span>
                </div>
              </div>
            </div>

            {needsOverpaymentAction ? (
              <div className="space-y-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4">
                <div className="flex items-start gap-3">
                  <RotateCcw size={18} className="mt-0.5 shrink-0 text-primary-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Xử lý tiền dư</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Đơn sẽ dư {formatCurrency(overpaidAmount)} sau quyết toán.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOverpaymentAction('REFUND')}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    overpaymentAction === 'REFUND'
                      ? 'border-primary-500 bg-background text-foreground'
                      : 'border-transparent bg-white/70 text-foreground-muted hover:border-primary-500/40 hover:text-foreground',
                  )}
                >
                  <p className="text-sm font-semibold">Hoàn tiền ngay</p>
                  <p className="mt-1 text-xs">Sinh phiếu chi và đưa lại phần chênh lệch cho khách.</p>
                </button>

                <button
                  type="button"
                  onClick={() => canKeepCredit && setOverpaymentAction('KEEP_CREDIT')}
                  disabled={!canKeepCredit}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                    overpaymentAction === 'KEEP_CREDIT'
                      ? 'border-primary-500 bg-background text-foreground'
                      : 'border-transparent bg-white/70 text-foreground-muted hover:border-primary-500/40 hover:text-foreground',
                    !canKeepCredit && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <p className="text-sm font-semibold">Giữ vào công nợ âm</p>
                  <p className="mt-1 text-xs">
                    {canKeepCredit
                      ? 'Giữ tiền dư trên hồ sơ khách để trừ cho lần sau.'
                      : 'Cần có khách hàng gắn với đơn mới dùng được lựa chọn này.'}
                  </p>
                </button>

                {overpaymentAction === 'REFUND' ? (
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                      Phương thức hoàn tiền
                    </span>
                    <select
                      value={refundMethod}
                      onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
                      className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                    >
                      {PAYMENT_METHOD_OPTIONS.filter((method) => method.id !== 'POINTS').map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
                <p className="text-sm font-semibold text-success">Không có tiền dư cần xử lý</p>
                <p className="mt-1 text-xs text-success/80">
                  Hệ thống sẽ hoàn tất đơn ngay sau khi thu đủ và kiểm tra điều kiện backend.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-background-secondary/70 p-4 text-sm text-foreground-muted">
              Backend sẽ tự chặn nếu phiên spa chưa hoàn tất, hotel chưa checkout hoặc số tiền thu thêm vẫn chưa đủ.
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background-secondary px-5 text-sm font-medium text-foreground transition-colors hover:border-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disableConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={16} />
            {isPending ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
