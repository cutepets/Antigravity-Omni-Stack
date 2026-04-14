'use client'

import { X } from 'lucide-react'
import type { ReceiptReturnModalProps } from './receipt.types'

export function ReceiptReturnModal({
  isOpen,
  form,
  isPending,
  onClose,
  onChangeNotes,
  onChangeQuantity,
  onConfirm,
}: ReceiptReturnModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
              Hoàn trả phiếu nhập
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Chọn hàng cần hoàn trả cho nhà cung cấp</h2>
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
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {form.items.map((item) => (
              <div
                key={item.receiptItemId}
                className="grid gap-3 rounded-2xl border border-border bg-background-secondary/70 px-4 py-3 md:grid-cols-[minmax(0,1fr)_132px]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                  <div className="mt-1 text-xs text-foreground-muted">
                    {item.sku || 'Không có mã'} • Có thể hoàn {item.availableQty}
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    Số lượng hoàn
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={item.availableQty}
                    value={item.quantity}
                    onChange={(event) => onChangeQuantity(item.receiptItemId, Number(event.target.value))}
                    className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground outline-none transition-colors focus:border-primary-500"
                  />
                </label>
              </div>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
              Ghi chú hoàn trả
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) => onChangeNotes(event.target.value)}
              placeholder="Nhập lý do hoặc ghi chú cho đợt hoàn trả"
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
            disabled={isPending}
            className="btn-primary inline-flex h-11 min-w-[160px] items-center justify-center rounded-2xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận hoàn trả'}
          </button>
        </div>
      </div>
    </div>
  )
}
