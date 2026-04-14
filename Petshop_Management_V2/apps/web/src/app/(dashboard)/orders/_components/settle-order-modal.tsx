'use client'

import { useState } from 'react'
import { CheckCircle2, X, Loader2 } from 'lucide-react'

interface SettleOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { note?: string }) => void
  orderNumber: string
  isPending: boolean
}

export function SettleOrderModal({ isOpen, onClose, onConfirm, orderNumber, isPending }: SettleOrderModalProps) {
  const [note, setNote] = useState('')

  if (!isOpen) return null

  const handleSubmit = () => {
    onConfirm({ note: note.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 size={20} className="text-success" />
            Quyết toán đơn hàng
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-background-secondary transition-colors">
            <X size={18} className="text-foreground-muted" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-background-secondary rounded-xl border border-border">
          <p className="text-sm text-foreground-muted">Đơn hàng</p>
          <p className="font-mono font-bold text-primary-500">{orderNumber}</p>
        </div>

        <div className="mb-4 p-3 bg-success/5 border border-success/20 rounded-xl text-sm text-success">
          <p className="font-semibold mb-1">Quyết toán</p>
          <p>Hoàn tất đơn hàng sau khi đã thanh toán đủ và xuất kho xong.</p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-semibold text-foreground mb-1.5 block">Ghi chú (tùy chọn)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú khi quyết toán..."
            rows={3}
            className="w-full rounded-xl border border-border bg-background-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-success transition-colors resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border bg-background-secondary text-sm font-semibold text-foreground hover:bg-background-tertiary transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-success text-white text-sm font-semibold hover:bg-success/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Quyết toán
          </button>
        </div>
      </div>
    </div>
  )
}
