'use client'

import { X } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import type { ReceiptPaymentModalProps } from './receipt.types'
import { RECEIPT_PAYMENT_METHOD_OPTIONS } from './receipt.constants'
import { fmt } from './receipt.utils'

export function ReceiptPaymentModal({
  isOpen,
  form,
  debtAmount,
  isPending,
  onClose,
  onChange,
  onConfirm,
}: ReceiptPaymentModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Thanh toán phiếu nhập
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Ghi nhận thanh toán cho nhà cung cấp</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Công nợ hiện tại: <span className="font-semibold text-foreground">{fmt(debtAmount)} đ</span>
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

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Số tiền thanh toán
              </span>
              <NumericFormat
                thousandSeparator="."
                decimalSeparator=","
                allowNegative={false}
                value={form.amount || ''}
                placeholder="0"
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-base font-semibold text-foreground outline-none transition-colors focus:border-primary-500"
                onValueChange={(values) => onChange('amount', Math.max(0, values.floatValue || 0))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Hình thức thanh toán
              </span>
              <select
                value={form.paymentMethod}
                onChange={(event) => onChange('paymentMethod', event.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-background-secondary px-4 text-sm font-medium text-foreground outline-none transition-colors focus:border-primary-500"
              >
                {RECEIPT_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Ghi chú thanh toán
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => onChange('notes', event.target.value)}
              placeholder="Nhập ghi chú cho lần thanh toán này"
              className="w-full resize-none rounded-2xl border border-border bg-background-secondary px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/30 hover:text-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || form.amount <= 0}
            className="btn-primary inline-flex h-11 min-w-[160px] items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        </div>
      </div>
    </div>
  )
}
